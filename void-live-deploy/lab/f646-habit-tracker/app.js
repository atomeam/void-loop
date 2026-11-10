const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const KEY = 'verse-habit-tracker-v1';
let habits = [];

function load() {
  try { habits = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { habits = []; }
  render();
}
function save() { localStorage.setItem(KEY, JSON.stringify(habits)); }

function streakOf(checks) {
  // consecutive from the most recent day backwards, wrapping the week once for simplicity
  let s = 0;
  const today = (new Date().getDay() + 6) % 7; // 0=Mon
  for (let i = 0; i < 7; i++) {
    const d = (today - i + 7) % 7;
    if (checks[d]) s++; else break;
  }
  return s;
}

function render() {
  const el = document.getElementById('habits');
  el.innerHTML = '';
  habits.forEach((h, i) => {
    const row = document.createElement('div');
    row.className = 'habit';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = h.name;
    row.appendChild(name);
    for (let d = 0; d < 7; d++) {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'check';
      cb.checked = !!h.checks[d];
      cb.onchange = () => { h.checks[d] = cb.checked; save(); render(); };
      const cell = document.createElement('div');
      cell.style.textAlign = 'center';
      cell.appendChild(cb);
      row.appendChild(cell);
    }
    const st = document.createElement('div');
    st.className = 'streak';
    st.textContent = streakOf(h.checks);
    row.appendChild(st);
    el.appendChild(row);
  });
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

document.getElementById('addBtn').onclick = () => {
  const v = document.getElementById('habitInput').value.trim();
  if (!v) return;
  habits.push({ name: v, checks: Array(7).fill(false) });
  document.getElementById('habitInput').value = '';
  save(); render();
};
document.getElementById('habitInput').onkeydown = e => { if (e.key === 'Enter') document.getElementById('addBtn').click(); };

document.getElementById('copyBtn').onclick = () => {
  const lines = habits.map(h => `${h.name}: ${streakOf(h.checks)}-day streak (${h.checks.filter(Boolean).length}/7 this week)`);
  const text = lines.length ? lines.join('\n') : 'No habits yet.';
  navigator.clipboard.writeText(text).then(() => toast('Copied')).catch(() => toast('Copy failed'));
};

document.getElementById('csvBtn').onclick = () => {
  let csv = 'Habit,' + DAYS.join(',') + ',Streak\n';
  habits.forEach(h => {
    csv += `"${h.name.replace(/"/g,'""')}",` + h.checks.map(c => c ? 1 : 0).join(',') + ',' + streakOf(h.checks) + '\n';
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  a.download = 'habits.csv';
  a.click();
  toast('CSV downloaded');
};

document.getElementById('printBtn').onclick = () => window.print();
document.getElementById('clearBtn').onclick = () => {
  if (confirm('Clear all habits?')) { habits = []; save(); render(); toast('Cleared'); }
};

load();
