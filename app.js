// 数据结构定义与初始化
const STORAGE_KEY = 'buxuchi_data';
let appData = {
    startDate: null,
    initialWeight: null,
    targetWeight: null,
    records: {} 
};

let chartInstance = null;
let currentCalDate = new Date();

// 初始化图标
lucide.createIcons();

// 工具函数
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function getTodayStr() { return formatDate(new Date()); }
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2000);
}

// 数据持久化
function loadData() {
    const str = localStorage.getItem(STORAGE_KEY);
    if (str) {
        try {
            appData = JSON.parse(str);
            if(!appData.records) appData.records = {};
        } catch (e) { console.error("Data parse error", e); }
    }
}
function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// 核心逻辑计算
function calculateStats() {
    if (!appData.startDate) return { dayX: 0, total: 0, currentStreak: 0, maxStreak: 0, monthTotal: 0 };
    
    // 计算第几天
    const start = new Date(appData.startDate);
    start.setHours(0,0,0,0);
    const todayDate = new Date();
    todayDate.setHours(0,0,0,0);
    let dayX = Math.floor((todayDate - start) / 86400000) + 1;
    if (dayX < 1) dayX = 1;

    // 统计打卡
    const dates = Object.keys(appData.records).filter(k => appData.records[k].checkedIn).sort();
    let total = dates.length;
    let maxStreak = 0;
    let currentStreak = 0;
    
    if (total > 0) {
        let temp = 1; maxStreak = 1;
        for (let i = 1; i < total; i++) {
            const d1 = new Date(dates[i-1]);
            const d2 = new Date(dates[i]);
            if ((d2 - d1) / 86400000 === 1) {
                temp++; maxStreak = Math.max(maxStreak, temp);
            } else { temp = 1; }
        }
        
        // 算当前连续 (从今天或昨天倒推)
        const todayStr = getTodayStr();
        let yd = new Date(); yd.setDate(yd.getDate() - 1);
        const yesterdayStr = formatDate(yd);
        
        const last = dates[dates.length - 1];
        if (last === todayStr || last === yesterdayStr) {
            currentStreak = 1;
            let cur = new Date(last);
            while(true) {
                cur.setDate(cur.getDate() - 1);
                let pStr = formatDate(cur);
                if (appData.records[pStr] && appData.records[pStr].checkedIn) {
                    currentStreak++;
                } else break;
            }
        }
    }

    // 本月打卡
    const prefix = getTodayStr().substring(0, 7);
    const monthTotal = dates.filter(d => d.startsWith(prefix)).length;

    return { dayX, total, currentStreak, maxStreak, monthTotal };
}

function getTodayRecord() {
    const today = getTodayStr();
    if (!appData.records[today]) {
        appData.records[today] = {
            checkedIn: false, weight: null, water: 0,
            exercise: {type: "无", time: ""},
            meals: {breakfast: "", lunch: "", dinner: "", snack: ""},
            sleep: "", mood: "", note: ""
        };
    }
    return appData.records[today];
}

// UI 更新：首页
function updateHomeUI() {
    const stats = calculateStats();
    document.getElementById('day-x').textContent = stats.dayX;
    document.getElementById('streak-days').textContent = stats.currentStreak;
    document.getElementById('total-days').textContent = stats.total;
    
    const d = new Date();
    document.getElementById('today-date-text').textContent = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
    
    const rec = getTodayRecord();
    
    document.getElementById('input-weight').value = rec.weight || '';
    document.getElementById('water-current').textContent = rec.water || 0;
    document.getElementById('input-exercise-time').value = rec.exercise.time || '';
    
    document.querySelectorAll('#exercise-types .chip').forEach(c => {
        c.classList.toggle('active', c.dataset.val === rec.exercise.type);
    });
    
    document.getElementById('input-meal-breakfast').value = rec.meals.breakfast || '';
    document.getElementById('input-meal-lunch').value = rec.meals.lunch || '';
    document.getElementById('input-meal-dinner').value = rec.meals.dinner || '';
    document.getElementById('input-meal-snack').value = rec.meals.snack || '';
    document.getElementById('input-sleep').value = rec.sleep || '';
    
    document.querySelectorAll('#mood-types .chip').forEach(c => {
        c.classList.toggle('active', c.dataset.val === rec.mood);
    });
    document.getElementById('input-note').value = rec.note || '';

    updateHomeProgress();

    const btn = document.getElementById('btn-checkin');
    const msg = document.getElementById('checkin-msg');
    if (rec.checkedIn) {
        btn.classList.add('hidden');
        msg.classList.remove('hidden');
    } else {
        btn.classList.remove('hidden');
        msg.classList.add('hidden');
    }
}

function updateHomeProgress() {
    const rec = getTodayRecord();
    let completed = 0;
    if (rec.weight) completed++;
    if (rec.water >= 2000) completed++;
    if (rec.exercise.type !== "无" || rec.exercise.time) completed++;
    if (rec.meals.breakfast || rec.meals.lunch || rec.meals.dinner) completed++;
    if (rec.sleep) completed++;
    if (rec.mood) completed++;
    
    document.getElementById('task-completed').textContent = completed;
    document.getElementById('daily-progress').style.width = `${(completed/6)*100}%`;
}

// 绑定首页表单事件
function bindHomeEvents() {
    const saveAndUI = () => { saveData(); updateHomeProgress(); };
    
    document.getElementById('input-weight').addEventListener('change', (e) => {
        getTodayRecord().weight = parseFloat(e.target.value) || null;
        saveAndUI();
    });
    
    document.getElementById('btn-water-add').addEventListener('click', () => {
        let rec = getTodayRecord();
        rec.water = (rec.water || 0) + 250;
        document.getElementById('water-current').textContent = rec.water;
        saveAndUI();
    });
    document.getElementById('btn-water-reset').addEventListener('click', () => {
        let rec = getTodayRecord();
        rec.water = 0;
        document.getElementById('water-current').textContent = 0;
        saveAndUI();
    });

    document.querySelectorAll('#exercise-types .chip').forEach(el => {
        el.addEventListener('click', (e) => {
            document.querySelectorAll('#exercise-types .chip').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            getTodayRecord().exercise.type = e.target.dataset.val;
            saveAndUI();
        });
    });
    document.getElementById('input-exercise-time').addEventListener('change', (e) => {
        getTodayRecord().exercise.time = e.target.value;
        saveAndUI();
    });

    ['breakfast', 'lunch', 'dinner', 'snack'].forEach(meal => {
        document.getElementById(`input-meal-${meal}`).addEventListener('change', (e) => {
            getTodayRecord().meals[meal] = e.target.value;
            saveAndUI();
        });
    });

    document.getElementById('input-sleep').addEventListener('change', (e) => {
        getTodayRecord().sleep = e.target.value;
        saveAndUI();
    });

    document.querySelectorAll('#mood-types .chip').forEach(el => {
        el.addEventListener('click', (e) => {
            document.querySelectorAll('#mood-types .chip').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            getTodayRecord().mood = e.target.dataset.val;
            saveAndUI();
        });
    });
    document.getElementById('input-note').addEventListener('change', (e) => {
        getTodayRecord().note = e.target.value;
        saveAndUI();
    });

    document.getElementById('btn-checkin').addEventListener('click', () => {
        const rec = getTodayRecord();
        if (!rec.checkedIn) {
            rec.checkedIn = true;
            saveData();
            updateHomeUI();
        }
    });
}

// UI 更新：趋势页
function updateTrendUI(days = 7) {
    const dates = Object.keys(appData.records).sort();
    let dataPoints = [];
    dates.forEach(d => {
        if (appData.records[d].weight) {
            dataPoints.push({ x: d, y: appData.records[d].weight });
        }
    });

    if (days !== 'all') {
        const limit = parseInt(days);
        dataPoints = dataPoints.slice(-limit);
    }

    const canvas = document.getElementById('weightChart');
    const msg = document.getElementById('chart-empty-msg');
    const list = document.getElementById('weight-history-list');
    
    if (dataPoints.length === 0) {
        canvas.style.display = 'none';
        msg.classList.remove('hidden');
        list.innerHTML = '<div class="empty-msg">暂无体重记录</div>';
        return;
    }
    
    canvas.style.display = 'block';
    msg.classList.add('hidden');

    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: dataPoints.map(p => p.x.substring(5)),
            datasets: [{
                label: '体重 (kg)',
                data: dataPoints.map(p => p.y),
                borderColor: '#1d1d1f',
                backgroundColor: 'rgba(29, 29, 31, 0.1)',
                borderWidth: 2,
                pointRadius: 4,
                pointBackgroundColor: '#fff',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // 列表
    let listHTML = '';
    [...dataPoints].reverse().forEach(p => {
        listHTML += `<div class="hist-item"><span>${p.x}</span><strong>${p.y} kg</strong></div>`;
    });
    list.innerHTML = listHTML;
}

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        updateTrendUI(e.target.dataset.days);
    });
});

// UI 更新：日历页
function renderCalendar() {
    const y = currentCalDate.getFullYear();
    const m = currentCalDate.getMonth();
    document.getElementById('cal-month-year').textContent = `${y}年${m+1}月`;
    
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m+1, 0).getDate();
    
    const container = document.getElementById('cal-days');
    container.innerHTML = '';
    
    let emptyDays = firstDay === 0 ? 6 : firstDay - 1;
    for(let i=0; i<emptyDays; i++) {
        container.innerHTML += `<div class="cal-day empty"></div>`;
    }
    
    const todayStr = getTodayStr();
    
    for(let i=1; i<=daysInMonth; i++) {
        const dStr = `${y}-${String(m+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        let cls = 'cal-day';
        if (dStr === todayStr) cls += ' today';
        if (dStr > todayStr) cls += ' future';
        if (appData.records[dStr] && appData.records[dStr].checkedIn) cls += ' checked';
        
        const div = document.createElement('div');
        div.className = cls;
        div.textContent = i;
        if (dStr <= todayStr) {
            div.addEventListener('click', () => {
                document.querySelectorAll('.cal-day').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                showDayDetails(dStr);
            });
        }
        container.appendChild(div);
    }
}
document.getElementById('cal-prev').addEventListener('click', () => { currentCalDate.setMonth(currentCalDate.getMonth()-1); renderCalendar(); });
document.getElementById('cal-next').addEventListener('click', () => { currentCalDate.setMonth(currentCalDate.getMonth()+1); renderCalendar(); });
document.getElementById('cal-today').addEventListener('click', () => { currentCalDate = new Date(); renderCalendar(); });

function showDayDetails(dStr) {
    const box = document.getElementById('selected-day-details');
    box.classList.remove('hidden');
    document.getElementById('detail-date').textContent = dStr;
    
    const rec = appData.records[dStr];
    if (!rec) {
        document.getElementById('detail-dayx').textContent = "当天无记录";
        ['weight', 'water', 'exercise', 'meal', 'sleep', 'mood'].forEach(id => document.getElementById(`dt-${id}`).textContent = '-');
        document.getElementById('dt-note').textContent = '';
        return;
    }
    
    const start = new Date(appData.startDate); start.setHours(0,0,0,0);
    const curr = new Date(dStr); curr.setHours(0,0,0,0);
    let dayx = Math.floor((curr - start) / 86400000) + 1;
    document.getElementById('detail-dayx').textContent = dayx > 0 ? `减脂第 ${dayx} 天` : '未开始记录';

    document.getElementById('dt-weight').textContent = rec.weight ? `${rec.weight} kg` : '-';
    document.getElementById('dt-water').textContent = rec.water ? `${rec.water} ml` : '-';
    document.getElementById('dt-exercise').textContent = (rec.exercise && rec.exercise.type !== "无") ? `${rec.exercise.type} ${rec.exercise.time ? rec.exercise.time+'min' : ''}` : '-';
    
    let mealStr = [];
    if(rec.meals.breakfast) mealStr.push('早');
    if(rec.meals.lunch) mealStr.push('中');
    if(rec.meals.dinner) mealStr.push('晚');
    document.getElementById('dt-meal').textContent = mealStr.length > 0 ? '已记录' : '-';
    
    document.getElementById('dt-sleep').textContent = rec.sleep ? `${rec.sleep} h` : '-';
    document.getElementById('dt-mood').textContent = rec.mood || '-';
    document.getElementById('dt-note').textContent = rec.note || '';
}

// UI 更新：挑战页
function updateChallengeUI() {
    const stats = calculateStats();
    const totalDays = stats.total;
    
    const cContainer = document.getElementById('challenge-container');
    cContainer.innerHTML = '';
    
    const targets = [30, 60, 90];
    let currentTarget = targets.find(t => totalDays < t) || 90;
    let title = `${currentTarget} DAYS 挑战`;
    let isFinished = totalDays >= 90;
    
    if(isFinished) {
        cContainer.innerHTML = `
            <div class="glass-card challenge-card">
                <div class="ch-header"><span class="ch-title">90 DAYS 终极挑战</span><span>已完成</span></div>
                <div class="progress-bar"><div class="progress-fill" style="width:100%"></div></div>
                <p class="text-center mt-2 text-secondary" style="font-size:13px;">太棒了，你已经养成了习惯！</p>
            </div>
        `;
    } else {
        const percent = (totalDays / currentTarget) * 100;
        cContainer.innerHTML = `
            <div class="glass-card challenge-card">
                <div class="ch-header">
                    <span class="ch-title">${title}</span>
                    <span>${totalDays} / ${currentTarget}</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
                <p class="text-center mt-2 text-secondary" style="font-size:13px;">还差 ${currentTarget - totalDays} 天</p>
            </div>
        `;
    }
    
    const mContainer = document.getElementById('milestone-container');
    mContainer.innerHTML = '';
    const milestones = [7, 14, 30, 60, 90, 100];
    milestones.forEach(m => {
        const unlocked = totalDays >= m;
        mContainer.innerHTML += `
            <div class="ms-card ${unlocked ? 'unlocked' : ''}">
                <h4>${m} DAYS</h4>
                <p>${unlocked ? '已完成 ✓' : '未解锁'}</p>
            </div>
        `;
    });
}

// UI 更新：我的页
function updateProfileUI() {
    const stats = calculateStats();
    
    document.getElementById('stat-total-days').textContent = stats.total;
    document.getElementById('stat-max-streak').textContent = stats.maxStreak;
    document.getElementById('stat-month-days').textContent = stats.monthTotal;
    
    let wCount = 0, eCount = 0, mCount = 0;
    let latestWeight = null;
    
    const dates = Object.keys(appData.records).sort();
    dates.forEach(d => {
        const r = appData.records[d];
        if(r.weight) { wCount++; latestWeight = r.weight; }
        if(r.exercise && r.exercise.type !== "无") eCount++;
        if(r.meals && (r.meals.breakfast || r.meals.lunch || r.meals.dinner)) mCount++;
    });
    
    document.getElementById('stat-weight-count').textContent = wCount;
    document.getElementById('stat-exercise-count').textContent = eCount;
    document.getElementById('stat-meal-count').textContent = mCount;
    
    document.getElementById('prof-init-weight').textContent = appData.initialWeight ? appData.initialWeight + ' kg' : '-';
    const currW = latestWeight || appData.initialWeight;
    document.getElementById('prof-curr-weight').textContent = currW ? currW + ' kg' : '-';
    document.getElementById('prof-target-weight').textContent = appData.targetWeight ? appData.targetWeight + ' kg' : '-';
    
    const diffEl = document.getElementById('prof-weight-diff');
    const remEl = document.getElementById('prof-weight-remain');
    const progEl = document.getElementById('prof-weight-progress');
    
    if (appData.initialWeight && currW) {
        let diff = (currW - appData.initialWeight).toFixed(1);
        diffEl.textContent = `较初始 ${diff > 0 ? '+'+diff : diff} kg`;
    } else { diffEl.textContent = '-'; }
    
    if (appData.initialWeight && currW && appData.targetWeight) {
        let totalAim = Math.abs(appData.initialWeight - appData.targetWeight);
        let currAim = Math.abs(appData.initialWeight - currW);
        let remain = Math.abs(currW - appData.targetWeight).toFixed(1);
        remEl.textContent = `距离目标: ${remain} kg`;
        
        let pct = (currAim / totalAim) * 100;
        if(pct > 100) pct = 100; if(pct < 0) pct = 0;
        progEl.style.width = pct + '%';
    } else {
        remEl.textContent = '-';
        progEl.style.width = '0%';
    }
}

// 导出与导入
document.getElementById('btn-export').addEventListener('click', () => {
    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `减脂记录-${getTodayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('导出成功');
});

document.getElementById('input-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if(data.records) {
                appData = data;
                saveData();
                showToast('导入成功');
                location.reload();
            } else { showToast('文件格式错误'); }
        } catch(err) { showToast('解析失败'); }
    };
    reader.readAsText(file);
});

document.getElementById('btn-reset').addEventListener('click', () => {
    if(confirm('确定要清除所有数据恢复默认设置吗？此操作无法撤销。')) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
});

// 路由与初始化
function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-target="${pageId}"]`).classList.add('active');
    
    if(pageId === 'page-home') updateHomeUI();
    if(pageId === 'page-trend') updateTrendUI(document.querySelector('.filter-btn.active').dataset.days);
    if(pageId === 'page-calendar') renderCalendar();
    if(pageId === 'page-challenge') updateChallengeUI();
    if(pageId === 'page-profile') updateProfileUI();
}

document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => switchPage(el.dataset.target));
});

function initApp() {
    loadData();
    if (!appData.startDate) {
        document.getElementById('onboarding').classList.add('active');
        document.getElementById('app').classList.remove('active');
        document.getElementById('setup-start-date').value = getTodayStr();
        
        document.getElementById('btn-start').addEventListener('click', () => {
            const sd = document.getElementById('setup-start-date').value;
            const iw = document.getElementById('setup-initial-weight').value;
            const tw = document.getElementById('setup-target-weight').value;
            if(!sd) { showToast('请选择开始日期'); return; }
            
            appData.startDate = sd;
            if(iw) appData.initialWeight = parseFloat(iw);
            if(tw) appData.targetWeight = parseFloat(tw);
            
            saveData();
            document.getElementById('onboarding').classList.remove('active');
            document.getElementById('app').classList.add('active');
            bindHomeEvents();
            switchPage('page-home');
        });
    } else {
        document.getElementById('onboarding').classList.remove('active');
        document.getElementById('app').classList.add('active');
        bindHomeEvents();
        switchPage('page-home');
    }
}

// 启动
initApp();
