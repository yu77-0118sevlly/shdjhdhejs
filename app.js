/* ==================================
   CORE LOGIC & DATA MANAGEMENT
================================== */
const STORAGE_KEY = 'wellness_journal_data';

// 完整数据结构
let db = {
    startDate: null,
    initialWeight: null,
    targetWeight: null,
    height: null,
    waterGoal: 2000,
    moveGoal: 3,
    records: {},      // 日常打卡: weight, water, movement, sleep, mood, completed
    measurements: {}, // 围度: waist, hips, thigh, arm
    photos: {},       // 照片: front, side, back (Base64)
    appearance: { lum: 233, alpha: 0.45, radius: 12, anim: true }
};

let currentChart = null;
let measChart = null;
let calRenderDate = new Date();
let currentLogType = null; 

lucide.createIcons();

// --- Utils ---
function fmtDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
const getTodayStr = () => fmtDate(new Date());

function getDayX(dateStr) {
    if (!db.startDate) return 0;
    const start = new Date(db.startDate); start.setHours(0,0,0,0);
    const curr = new Date(dateStr); curr.setHours(0,0,0,0);
    let diff = Math.floor((curr - start) / 86400000) + 1;
    return diff > 0 ? diff : 0;
}

function loadDB() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        try {
            const parsed = JSON.parse(data);
            db = { ...db, ...parsed }; 
            if (!db.records) db.records = {};
            if (!db.measurements) db.measurements = {};
            if (!db.photos) db.photos = {};
            if (!db.appearance) db.appearance = { lum: 233, alpha: 0.45, radius: 12, anim: true };
        } catch(e) { console.error(e); }
    }
}
function saveDB() { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }

function getRecord(dateStr) {
    if (!db.records[dateStr]) db.records[dateStr] = { completed: false, weight: null, water: null, movement: null, sleep: null, mood: '' };
    return db.records[dateStr];
}

function calcStats() {
    const dates = Object.keys(db.records).filter(k => db.records[k].completed).sort();
    let total = dates.length;
    let maxS = 0; let currS = 0;
    
    if (total > 0) {
        let temp = 1; maxS = 1;
        for (let i = 1; i < total; i++) {
            const d1 = new Date(dates[i-1]); const d2 = new Date(dates[i]);
            if ((d2 - d1) / 86400000 === 1) { temp++; maxS = Math.max(maxS, temp); } else { temp = 1; }
        }
        const todayStr = getTodayStr();
        let yd = new Date(); yd.setDate(yd.getDate() - 1);
        const yStr = fmtDate(yd);
        
        const last = dates[dates.length - 1];
        if (last === todayStr || last === yStr) {
            currS = 1; let cur = new Date(last);
            while(true) {
                cur.setDate(cur.getDate() - 1);
                if (db.records[fmtDate(cur)]?.completed) currS++; else break;
            }
        }
    }
    return { total, maxS, currS };
}

// 应用外观设置
function applyAppearance() {
    const root = document.documentElement;
    root.style.setProperty('--bg-lum', db.appearance.lum);
    root.style.setProperty('--glass-alpha', db.appearance.alpha);
    root.style.setProperty('--radius', db.appearance.radius + 'px');
    if (db.appearance.anim) {
        document.body.classList.add('anim-on');
    } else {
        document.body.classList.remove('anim-on');
    }
}

/* ==================================
   VIEW RENDERING
================================== */
// 1. HOME
function renderHome() {
    const today = new Date();
    document.getElementById('home-date').textContent = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
    const dayX = getDayX(getTodayStr());
    document.getElementById('home-day').textContent = dayX || '--';
    
    const rec = getRecord(getTodayStr());
    document.getElementById('home-weight').textContent = rec.weight || '--';
    
    let baseWeight = db.initialWeight;
    if (rec.weight && baseWeight) {
        let diff = (rec.weight - baseWeight).toFixed(1);
        document.getElementById('home-diff').textContent = `较初始 ${diff > 0 ? '+'+diff : diff} KG`;
    } else {
        document.getElementById('home-diff').textContent = '暂无体重记录';
    }

    const stats = calcStats();
    let target = [7, 14, 30, 60, 90].find(t => stats.total < t) || 90;
    let pct = (stats.total / target) * 100; if(pct > 100) pct = 100;
    
    document.getElementById('home-progress-line').style.width = pct + '%';
    document.getElementById('home-progress-dot').style.left = pct + '%';
    document.getElementById('home-next-milestone').textContent = `距离下一个里程碑还有 ${target - stats.total} 天`;

    document.getElementById('val-weight').textContent = rec.weight ? rec.weight + ' KG' : '-- KG';
    document.getElementById('val-water').textContent = rec.water ? rec.water : '--';
    document.getElementById('goal-water-display').textContent = db.waterGoal || 2000;
    document.getElementById('val-movement').textContent = rec.movement ? rec.movement + ' 分钟' : '-- 分钟';
    document.getElementById('val-sleep').textContent = rec.sleep ? rec.sleep + ' 小时' : '-- 小时';
    document.getElementById('val-mood').textContent = rec.mood ? rec.mood : '--';

    const btn = document.getElementById('btn-checkin');
    if (rec.completed) {
        btn.textContent = '✓ 今日已完成'; btn.classList.add('completed');
    } else {
        btn.textContent = '完成今日打卡'; btn.classList.remove('completed');
    }
}

// 2. JOURNAL
function renderJournal() {
    const stats = calcStats();
    document.getElementById('journal-current-streak').textContent = stats.currS + ' 天';
    document.getElementById('journal-longest-streak').textContent = stats.maxS + ' 天';
    const y = calRenderDate.getFullYear(); const m = calRenderDate.getMonth();
    document.getElementById('cal-month').textContent = `${y}年 ${m + 1}月`;

    const container = document.getElementById('cal-days');
    container.innerHTML = '';
    
    let firstDay = new Date(y, m, 1).getDay();
    let emptyDays = firstDay === 0 ? 6 : firstDay - 1;
    for(let i=0; i<emptyDays; i++) container.innerHTML += `<div class="cal-day empty"></div>`;
    
    const daysInM = new Date(y, m+1, 0).getDate();
    const todayStr = getTodayStr();

    for(let i=1; i<=daysInM; i++) {
        const dStr = `${y}-${String(m+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        let cls = 'cal-day';
        if (dStr === todayStr) cls += ' today';
        if (dStr > todayStr) cls += ' future';
        if (db.records[dStr]?.completed) cls += ' logged';

        const div = document.createElement('div');
        div.className = cls; div.textContent = i;
        if (dStr <= todayStr) {
            div.onclick = () => {
                document.querySelectorAll('.cal-day').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                showDayDetail(dStr);
            };
        }
        container.appendChild(div);
    }
    document.getElementById('journal-detail').classList.add('hidden');
}

function showDayDetail(dStr) {
    const dDate = new Date(dStr);
    document.getElementById('jd-date').textContent = `${dDate.getMonth() + 1}月${dDate.getDate()}日`;
    const dayX = getDayX(dStr);
    document.getElementById('jd-day').textContent = dayX ? `第 ${dayX} 天` : '--';
    
    const rec = db.records[dStr] || {};
    document.getElementById('jd-weight').textContent = rec.weight ? rec.weight + ' KG' : '--';
    document.getElementById('jd-water').textContent = rec.water ? rec.water + ' ML' : '--';
    document.getElementById('jd-move').textContent = rec.movement ? rec.movement + ' MIN' : '--';
    document.getElementById('jd-sleep').textContent = rec.sleep ? rec.sleep + ' H' : '--';
    document.getElementById('jd-note').textContent = rec.mood ? rec.mood : '--';
    document.getElementById('journal-detail').classList.remove('hidden');
}

// 3. PROGRESS
function renderProgress(range = '7') {
    let dates = Object.keys(db.records).sort();
    let pts = [];
    dates.forEach(d => { if(db.records[d].weight) pts.push({x:d, y:db.records[d].weight}); });
    
    let currW = pts.length > 0 ? pts[pts.length-1].y : (db.initialWeight || null);
    document.getElementById('prog-current-weight').textContent = currW ? currW + ' KG' : '-- KG';
    if (db.initialWeight && currW) {
        let diff = (currW - db.initialWeight).toFixed(1);
        document.getElementById('prog-total-change').textContent = `${diff > 0 ? '+'+diff : diff} KG`;
    } else { document.getElementById('prog-total-change').textContent = '-- KG'; }

    const canvas = document.getElementById('weightChart');
    const empty = document.getElementById('chart-empty');
    if (pts.length === 0) {
        canvas.style.display = 'none'; empty.classList.remove('hidden');
    } else {
        canvas.style.display = 'block'; empty.classList.add('hidden');
        let chartPts = range !== 'all' ? pts.slice(-parseInt(range)) : pts;
        
        if(currentChart) currentChart.destroy();
        currentChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: chartPts.map(p => p.x.substring(5)),
                datasets: [{ data: chartPts.map(p => p.y), borderColor: '#242424', borderWidth: 1.5, pointBackgroundColor: '#242424', pointRadius: 2, fill: false, tension: 0.4 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(255,255,255,0.9)', titleColor: '#777', bodyColor: '#242424', borderColor: 'rgba(36,36,36,0.1)', borderWidth: 1, displayColors: false } },
                scales: { x: { display: false }, y: { display: false, min: Math.min(...chartPts.map(p=>p.y)) - 2, max: Math.max(...chartPts.map(p=>p.y)) + 2 } },
                layout: { padding: 10 }
            }
        });
    }

    let wDays = 0, wMove = 0;
    let today = new Date(); today.setHours(0,0,0,0);
    let aWeekAgo = new Date(today); aWeekAgo.setDate(today.getDate() - 7);
    dates.forEach(d => {
        let dDate = new Date(d);
        if (dDate >= aWeekAgo && dDate <= today) {
            if(db.records[d].completed) wDays++;
            if(db.records[d].movement) wMove++;
        }
    });
    document.getElementById('wr-days').textContent = wDays;
    document.getElementById('wr-move').textContent = wMove;
    document.getElementById('wr-diff').textContent = (pts.length > 1) ? (pts[pts.length-1].y - pts[pts.length-2].y).toFixed(1) : '--';

    const mRec = db.measurements[getTodayStr()] || {};
    document.getElementById('input-waist').value = mRec.waist || '';
    document.getElementById('input-hips').value = mRec.hips || '';
    document.getElementById('input-thigh').value = mRec.thigh || '';
    document.getElementById('input-arm').value = mRec.arm || '';
    renderMeasChart();
    
    updatePhotoDropdowns();
    renderComparePhotos();
}

function renderMeasChart() {
    let mDates = Object.keys(db.measurements).sort();
    if (mDates.length === 0) return;
    
    let dLabel = mDates.map(d => d.substring(5));
    let dw = mDates.map(d => db.measurements[d].waist || null);
    let dh = mDates.map(d => db.measurements[d].hips || null);
    let dt = mDates.map(d => db.measurements[d].thigh || null);
    let da = mDates.map(d => db.measurements[d].arm || null);

    const mCanvas = document.getElementById('measChart');
    if(measChart) measChart.destroy();
    measChart = new Chart(mCanvas, {
        type: 'line',
        data: {
            labels: dLabel,
            datasets: [
                { label: '腰围', data: dw, borderColor: '#242424', borderWidth: 1, tension: 0.3 },
                { label: '臀围', data: dh, borderColor: '#777777', borderWidth: 1, borderDash: [5,5], tension: 0.3 },
                { label: '大腿', data: dt, borderColor: '#A2A2A0', borderWidth: 1, tension: 0.3 },
                { label: '手臂', data: da, borderColor: '#d0d0d0', borderWidth: 1, tension: 0.3 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    });
}

document.getElementById('btn-save-meas').onclick = () => {
    let t = getTodayStr();
    if(!db.measurements[t]) db.measurements[t] = {};
    db.measurements[t].waist = parseFloat(document.getElementById('input-waist').value) || null;
    db.measurements[t].hips = parseFloat(document.getElementById('input-hips').value) || null;
    db.measurements[t].thigh = parseFloat(document.getElementById('input-thigh').value) || null;
    db.measurements[t].arm = parseFloat(document.getElementById('input-arm').value) || null;
    saveDB(); renderMeasChart();
};

let currentPhotoType = 'front';
document.querySelectorAll('.pt-tab').forEach(t => {
    t.onclick = (e) => {
        document.querySelectorAll('.pt-tab').forEach(el=>el.classList.remove('active'));
        e.target.classList.add('active');
        currentPhotoType = e.target.dataset.ptype;
        renderComparePhotos();
    }
});

function handlePhotoUpload(e, type) {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 400;
            const scale = Math.min(MAX_WIDTH / img.width, 1);
            canvas.width = img.width * scale; canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.6);
            
            let t = getTodayStr();
            if(!db.photos[t]) db.photos[t] = {};
            db.photos[t][type] = base64;
            saveDB(); updatePhotoDropdowns(); renderComparePhotos();
        }
        img.src = evt.target.result;
    }
    reader.readAsDataURL(file);
}
document.getElementById('file-front').onchange = (e) => handlePhotoUpload(e, 'front');
document.getElementById('file-side').onchange = (e) => handlePhotoUpload(e, 'side');
document.getElementById('file-back').onchange = (e) => handlePhotoUpload(e, 'back');

function updatePhotoDropdowns() {
    let pDates = Object.keys(db.photos).sort();
    let s1 = document.getElementById('compare-date-1');
    let s2 = document.getElementById('compare-date-2');
    let html = pDates.length > 0 ? '' : '<option>--</option>';
    pDates.forEach(d => html += `<option value="${d}">${d}</option>`);
    s1.innerHTML = html; s2.innerHTML = html;
    if(pDates.length > 0) {
        s1.value = pDates[0]; s2.value = pDates[pDates.length-1];
    }
}

document.getElementById('compare-date-1').onchange = renderComparePhotos;
document.getElementById('compare-date-2').onchange = renderComparePhotos;

function renderComparePhotos() {
    let d1 = document.getElementById('compare-date-1').value;
    let d2 = document.getElementById('compare-date-2').value;
    let f1 = document.getElementById('frame-1');
    let f2 = document.getElementById('frame-2');
    
    if (d1 !== '--' && db.photos[d1] && db.photos[d1][currentPhotoType]) {
        f1.innerHTML = `<img src="${db.photos[d1][currentPhotoType]}">`;
    } else { f1.innerHTML = `<span class="empty-text">暂无照片</span>`; }
    
    if (d2 !== '--' && db.photos[d2] && db.photos[d2][currentPhotoType]) {
        f2.innerHTML = `<img src="${db.photos[d2][currentPhotoType]}">`;
    } else { f2.innerHTML = `<span class="empty-text">暂无照片</span>`; }
}


// 4. CHALLENGES
function renderChallenges() {
    const stats = calcStats();
    let html = '';
    [30, 60, 90].forEach(t => {
        let pct = (stats.total / t) * 100; if(pct>100) pct=100;
        let diff = t - stats.total;
        html += `
        <div class="chal-item">
            <div class="chal-head">
                <span class="editorial-label" style="font-size:12px; color:var(--text-primary);">${t} 天挑战</span>
                <span class="editorial-label">${stats.total > t ? t : stats.total} / ${t}</span>
            </div>
            <div class="fine-line-track">
                <div class="fine-line-fill" style="width:${pct}%"></div>
                <div class="fine-line-dot" style="left:${pct}%"></div>
            </div>
            <div class="editorial-label text-right mt-2">${diff > 0 ? diff + ' 天后完成' : '已完成'}</div>
        </div>`;
    });
    document.getElementById('challenges-list').innerHTML = html;

    let msHtml = '';
    [7, 14, 30, 60, 90, 100].forEach(m => {
        let unlocked = stats.total >= m;
        msHtml += `<div class="ms-item ${unlocked?'unlocked':''}"><i data-lucide="${unlocked?'check-circle':'circle'}"></i> ${m} 天</div>`;
    });
    document.getElementById('milestones-list').innerHTML = msHtml;
    lucide.createIcons();
}

// 5. PROFILE & SETTINGS
function renderProfile() {
    const stats = calcStats();
    document.getElementById('prof-start').textContent = db.startDate || '--';
    document.getElementById('prof-day').textContent = '第 ' + (getDayX(getTodayStr()) || '--') + ' 天';
    document.getElementById('prof-total').textContent = stats.total + ' 天';
    document.getElementById('prof-streak').textContent = stats.maxS + ' 天';
    
    document.getElementById('set-start-date').value = db.startDate || '';
    document.getElementById('set-height').value = db.height || '';
    document.getElementById('set-init-weight').value = db.initialWeight || '';
    
    let dates = Object.keys(db.records).sort();
    let currW = null; for(let i=dates.length-1; i>=0; i--) { if(db.records[dates[i]].weight) { currW = db.records[dates[i]].weight; break; } }
    document.getElementById('set-curr-weight').value = currW || '';
    document.getElementById('set-target-weight').value = db.targetWeight || '';
    
    document.getElementById('set-water-goal').value = db.waterGoal || 2000;
    document.getElementById('set-move-goal').value = db.moveGoal || 3;

    document.getElementById('app-bg-lum').value = db.appearance.lum;
    document.getElementById('app-glass-alpha').value = db.appearance.alpha * 100;
    document.getElementById('app-radius').value = db.appearance.radius;
    document.getElementById('app-anim').checked = db.appearance.anim;
}

document.getElementById('btn-save-goals').onclick = () => {
    let sd = document.getElementById('set-start-date').value; if(sd) db.startDate = sd;
    db.height = parseFloat(document.getElementById('set-height').value) || null;
    db.initialWeight = parseFloat(document.getElementById('set-init-weight').value) || null;
    db.targetWeight = parseFloat(document.getElementById('set-target-weight').value) || null;
    
    let cw = parseFloat(document.getElementById('set-curr-weight').value);
    if (!isNaN(cw)) getRecord(getTodayStr()).weight = cw;

    db.waterGoal = parseInt(document.getElementById('set-water-goal').value) || 2000;
    db.moveGoal = parseInt(document.getElementById('set-move-goal').value) || 3;
    
    saveDB(); renderProfile();
};

function updateAppearance() {
    db.appearance.lum = document.getElementById('app-bg-lum').value;
    db.appearance.alpha = document.getElementById('app-glass-alpha').value / 100;
    db.appearance.radius = document.getElementById('app-radius').value;
    db.appearance.anim = document.getElementById('app-anim').checked;
    applyAppearance(); saveDB();
}
document.getElementById('app-bg-lum').oninput = updateAppearance;
document.getElementById('app-glass-alpha').oninput = updateAppearance;
document.getElementById('app-radius').oninput = updateAppearance;
document.getElementById('app-anim').onchange = updateAppearance;

/* ==================================
   INTERACTIONS
================================== */
function switchView(viewId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    let nav = document.querySelector(`.nav-item[data-target="${viewId}"]`);
    if(nav) nav.classList.add('active');
    
    if (viewId === 'view-home') renderHome();
    if (viewId === 'view-journal') renderJournal();
    if (viewId === 'view-progress') renderProgress(document.querySelector('.c-filter.active')?.dataset.range || '7');
    if (viewId === 'view-challenges') renderChallenges();
    if (viewId === 'view-profile') renderProfile();
}
document.querySelectorAll('.nav-item').forEach(el => { el.onclick = () => switchView(el.dataset.target); });

const sheet = document.getElementById('log-sheet');
const overlay = document.getElementById('sheet-overlay');
const inputNum = document.getElementById('sheet-input-num');
const inputText = document.getElementById('sheet-input-text');

function openLogSheet(type) {
    currentLogType = type; const rec = getRecord(getTodayStr());
    
    // 动态翻译弹窗标题
    let titleCN = '';
    if(type==='weight') titleCN = '记录体重';
    if(type==='water') titleCN = '记录饮水';
    if(type==='movement') titleCN = '记录运动';
    if(type==='sleep') titleCN = '记录睡眠';
    if(type==='mood') titleCN = '状态与饮食';
    
    document.getElementById('sheet-title').textContent = titleCN;
    
    inputNum.classList.add('hidden'); inputText.classList.add('hidden');
    inputNum.value = ''; inputText.value = '';
    
    if (type === 'mood') {
        inputText.classList.remove('hidden'); inputText.value = rec.mood || '';
        document.getElementById('sheet-unit').textContent = '';
        setTimeout(() => inputText.focus(), 300);
    } else {
        inputNum.classList.remove('hidden'); inputNum.value = rec[type] || '';
        let unit = type === 'weight' ? 'KG' : (type === 'water' ? 'ML' : (type === 'movement' ? '分钟' : '小时'));
        document.getElementById('sheet-unit').textContent = unit;
        setTimeout(() => inputNum.focus(), 300);
    }
    sheet.classList.add('active'); overlay.classList.add('active');
}

function closeSheet() { sheet.classList.remove('active'); overlay.classList.remove('active'); inputNum.blur(); inputText.blur(); }
overlay.onclick = closeSheet;

document.getElementById('btn-save-sheet').onclick = () => {
    const rec = getRecord(getTodayStr());
    if (currentLogType === 'mood') { rec.mood = inputText.value.trim(); } 
    else { let val = parseFloat(inputNum.value); rec[currentLogType] = isNaN(val) ? null : val; }
    saveDB(); closeSheet(); renderHome();
};

document.getElementById('btn-checkin').onclick = () => {
    getRecord(getTodayStr()).completed = true; saveDB(); renderHome();
};

document.getElementById('cal-prev').onclick = () => { calRenderDate.setMonth(calRenderDate.getMonth()-1); renderJournal(); };
document.getElementById('cal-next').onclick = () => { calRenderDate.setMonth(calRenderDate.getMonth()+1); renderJournal(); };

document.querySelectorAll('.c-filter').forEach(f => {
    f.onclick = (e) => {
        document.querySelectorAll('.c-filter').forEach(el => el.classList.remove('active'));
        e.target.classList.add('active');
        renderProgress(e.target.dataset.range);
    }
});

/* ==================================
   DATA MGT & INIT
================================== */
document.getElementById('btn-export').onclick = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Wellness-Journal-${getTodayStr()}.json`;
    a.click(); URL.revokeObjectURL(url);
};

document.getElementById('file-import').onchange = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { try { let data = JSON.parse(e.target.result); if(data.records) { db = data; saveDB(); location.reload(); } } catch(err) { alert('导入失败，请检查文件。'); } };
    reader.readAsText(file);
};

document.getElementById('btn-reset').onclick = () => {
    if(confirm('确定要清除所有数据吗？此操作无法恢复。')) { localStorage.removeItem(STORAGE_KEY); location.reload(); }
};

function init() {
    loadDB();
    applyAppearance();
    
    if (!db.startDate) {
        document.getElementById('onboarding').classList.add('active');
        document.getElementById('app').classList.remove('active');
        document.getElementById('setup-start-date').value = getTodayStr();
        
        document.getElementById('btn-begin').onclick = () => {
            const sd = document.getElementById('setup-start-date').value;
            if(!sd) return alert('请选择开始日期。');
            db.startDate = sd;
            db.initialWeight = parseFloat(document.getElementById('setup-initial-weight').value) || null;
            db.targetWeight = parseFloat(document.getElementById('setup-target-weight').value) || null;
            
            saveDB();
            document.getElementById('onboarding').classList.remove('active');
            document.getElementById('app').classList.add('active');
            switchView('view-home');
        };
    } else {
        document.getElementById('onboarding').classList.remove('active');
        document.getElementById('app').classList.add('active');
        switchView('view-home');
    }
}

init();
