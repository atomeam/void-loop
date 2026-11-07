const STORAGE_KEY = 'verse-f620-pomo';
const CIRC = 2 * Math.PI * 80;

let state = {
  tasks: [],
  today: { date: new Date().toISOString().slice(0,10), count: 0 },
  selected: null
};
let timer = {
  running: false,
  mode: 'work', // work | short | long
  remaining: 25 * 60,
  total: 25 * 60,
  startTs: 0,
  pausedRemaining: 0
};
let rafId = null;
let audioCtx = null;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.tasks = parsed.tasks || [];
      const today = new Date().toISOString().slice(0,10);
      if (parsed.today && parsed.today.date === today) {
        state.today = parsed.today;
      } else {
        state.today = { date: today, count: 0 };
      }
    }
  } catch (e) {
    document.getElementById('status').textContent = 'Could not load saved data. Using fresh state.';
  }
  render();
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: state.tasks, today: state.today }));
  } catch (e) {
    document.getElementById('status').textContent = 'Could not save (storage full?). Data is temporary.';
  }
}

function render() {
  const list = document.getElementById('taskList');
  const no = document.getElementById('noTasks');
  list.innerHTML = '';
  if (state.tasks.length === 0) {
    no.style.display = 'block';
  } else {
    no.style.display = 'none';
    state.tasks.forEach((t, i) => {
      const div = document.createElement('div');
      div.className = 'task' + (state.selected === i ? ' selected' : '');
      div.innerHTML = `<span class="name">${escapeHtml(t.name)}</span><span class="count">${t.count} 🍅</span><button data-i="${i}" class="selectBtn">Select</button><button data-i="${i}" class="delBtn">×</button>`;
      list.appendChild(div);
    });
  }
  document.getElementById('todayCount').textContent = state.today.count;
  document.getElementById('dateLabel').textContent = state.today.date;
  updateTimerDisplay();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function updateTimerDisplay() {
  const m = Math.floor(timer.remaining / 60);
  const s = Math.floor(timer.remaining % 60);
  document.getElementById('time').textContent = `${m}:${s.toString().padStart(2,'0')}`;
  const progress = timer.total > 0 ? (timer.total - timer.remaining) / timer.total : 0;
  document.getElementById('ring').style.strokeDashoffset = CIRC * (1 - progress);
  const modeNames = { work: 'Work', short: 'Short break', long: 'Long break' };
  const len = Math.round(timer.total / 60);
  document.getElementById('mode').textContent = `${modeNames[timer.mode]} · ${len} min`;
}

function setMode(mode) {
  if (timer.running) return;
  timer.mode = mode;
  const lens = { work: +document.getElementById('workLen').value || 25, short: +document.getElementById('shortLen').value || 5, long: +document.getElementById('longLen').value || 15 };
  timer.total = Math.max(60, Math.min(90*60, lens[mode] * 60));
  timer.remaining = timer.total;
  updateTimerDisplay();
}

function startTimer() {
  if (timer.mode === 'work' && state.selected === null && state.tasks.length > 0) {
    alert('Select a task first (or start without one).');
  }
  timer.running = true;
  timer.startTs = performance.now() - (timer.total - timer.remaining) * 1000;
  document.getElementById('startBtn').disabled = true;
  document.getElementById('pauseBtn').disabled = false;
  tick();
}

function pauseTimer() {
  timer.running = false;
  cancelAnimationFrame(rafId);
  document.getElementById('startBtn').disabled = false;
  document.getElementById('pauseBtn').disabled = true;
}

function tick() {
  if (!timer.running) return;
  const elapsed = (performance.now() - timer.startTs) / 1000;
  timer.remaining = Math.max(0, timer.total - elapsed);
  updateTimerDisplay();
  if (timer.remaining <= 0) {
    completeSession();
    return;
  }
  rafId = requestAnimationFrame(tick);
}

function completeSession() {
  timer.running = false;
  cancelAnimationFrame(rafId);
  document.getElementById('startBtn').disabled = false;
  document.getElementById('pauseBtn').disabled = true;
  beep();
  if (timer.mode === 'work') {
    if (state.selected !== null && state.tasks[state.selected]) {
      state.tasks[state.selected].count++;
    }
    state.today.count++;
    save();
    render();
    document.getElementById('status').textContent = 'Work session complete! Take a break.';
    setTimeout(() => setMode('short'), 500);
  } else {
    document.getElementById('status').textContent = 'Break over. Ready for work?';
    setTimeout(() => setMode('work'), 500);
  }
}

function beep() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.2, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    o.start(); o.stop(audioCtx.currentTime + 0.4);
  } catch (e) { console.debug("lab f620-pomodoro-task-timer:", e); }
}

function summaryText() {
  const lines = state.tasks.map(t => `${t.name}: ${t.count} pomodoros`);
  lines.push('');
  lines.push(`Today (${state.today.date}): ${state.today.count} pomodoros`);
  return lines.join('\n');
}

document.getElementById('addBtn').onclick = () => {
  const name = document.getElementById('taskInput').value.trim();
  if (!name) return;
  state.tasks.push({ name, count: 0 });
  document.getElementById('taskInput').value = '';
  save(); render();
};
document.getElementById('taskInput').onkeydown = e => { if (e.key === 'Enter') document.getElementById('addBtn').click(); };

document.getElementById('taskList').onclick = e => {
  const i = e.target.dataset.i;
  if (i === undefined) return;
  if (e.target.classList.contains('selectBtn')) {
    state.selected = +i;
    render();
  } else if (e.target.classList.contains('delBtn')) {
    if (confirm('Delete this task?')) {
      state.tasks.splice(+i, 1);
      if (state.selected === +i) state.selected = null;
      else if (state.selected > +i) state.selected--;
      save(); render();
    }
  }
};

document.getElementById('startBtn').onclick = startTimer;
document.getElementById('pauseBtn').onclick = pauseTimer;
document.getElementById('skipBtn').onclick = () => { if (timer.running) { timer.remaining = 0; completeSession(); } };
document.getElementById('breakBtn').onclick = () => setMode('short');
document.getElementById('longBtn').onclick = () => setMode('long');
document.getElementById('workLen').onchange = () => { if (!timer.running && timer.mode === 'work') setMode('work'); };
document.getElementById('shortLen').onchange = () => { if (!timer.running && timer.mode === 'short') setMode('short'); };
document.getElementById('longLen').onchange = () => { if (!timer.running && timer.mode === 'long') setMode('long'); };

document.getElementById('copyBtn').onclick = async () => {
  try {
    await navigator.clipboard.writeText(summaryText());
    document.getElementById('status').textContent = 'Summary copied.';
  } catch (e) {
    document.getElementById('status').textContent = 'Copy failed. Select and copy manually.';
  }
};

document.getElementById('downloadBtn').onclick = () => {
  const blob = new Blob([summaryText()], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pomodoro-${state.today.date}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
};

document.getElementById('resetToday').onclick = () => {
  if (confirm('Reset today\'s tally to 0?')) {
    state.today.count = 0;
    save(); render();
  }
};

// Init
setMode('work');
load();
