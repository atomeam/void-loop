const $ = id => document.getElementById(id);
const tasks = [];
let dayWidth = 28;
let totalDays = 20;

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 2500);
}

function parseInput() {
  const lines = $('input').value.split('\n').map(l => l.trim()).filter(Boolean);
  tasks.length = 0;
  const nameToId = {};
  lines.forEach((line, i) => {
    const parts = line.split('|').map(p => p.trim());
    const name = parts[0] || `Task ${i+1}`;
    const duration = Math.max(1, parseInt(parts[1]) || 1);
    const preds = (parts[2] || '').split(',').map(p => p.trim()).filter(Boolean);
    tasks.push({ id: i, name, duration, preds, es:0, ef:0, ls:0, lf:0, slack:0, critical:false, userStart:null });
    nameToId[name.toLowerCase()] = i;
  });
  // resolve preds to ids
  tasks.forEach(t => {
    t.predIds = t.preds.map(p => nameToId[p.toLowerCase()]).filter(id => id !== undefined && id !== t.id);
  });
  return tasks;
}

function hasCycle() {
  const visited = new Set(), stack = new Set();
  function dfs(id) {
    if (stack.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id); stack.add(id);
    for (const p of tasks[id].predIds) if (dfs(p)) return true;
    stack.delete(id);
    return false;
  }
  for (let i = 0; i < tasks.length; i++) if (dfs(i)) return true;
  return false;
}

function computeSchedule() {
  if (!tasks.length) return;
  if (hasCycle()) { toast('Cycle detected — some dependencies ignored'); }
  // forward pass
  const order = topoSort();
  for (const id of order) {
    const t = tasks[id];
    let es = 0;
    for (const p of t.predIds) es = Math.max(es, tasks[p].ef);
    t.es = t.userStart !== null ? Math.max(t.userStart, es) : es;
    t.ef = t.es + t.duration;
  }
  // total duration
  const maxEf = Math.max(0, ...tasks.map(t => t.ef));
  // backward
  for (const id of order.slice().reverse()) {
    const t = tasks[id];
    let lf = maxEf;
    const successors = tasks.filter(s => s.predIds.includes(id));
    if (successors.length) lf = Math.min(...successors.map(s => s.ls));
    t.lf = lf;
    t.ls = t.lf - t.duration;
    t.slack = t.ls - t.es;
    t.critical = t.slack <= 0;
  }
  totalDays = Math.max(10, maxEf + 2);
}

function topoSort() {
  const indeg = tasks.map(t => t.predIds.length);
  const q = tasks.map((t,i) => i).filter(i => indeg[i] === 0);
  const order = [];
  while (q.length) {
    const id = q.shift();
    order.push(id);
    tasks.forEach((t, i) => {
      if (t.predIds.includes(id)) {
        indeg[i]--;
        if (indeg[i] === 0) q.push(i);
      }
    });
  }
  return order.length === tasks.length ? order : tasks.map((_,i) => i); // fallback
}

function render() {
  const tl = $('timeline');
  tl.innerHTML = '';
  tl.style.width = (totalDays * dayWidth + 40) + 'px';
  tasks.forEach((t, i) => {
    const bar = document.createElement('div');
    bar.className = 'bar ' + (t.critical ? 'critical' : 'normal');
    bar.style.left = (t.es * dayWidth + 8) + 'px';
    bar.style.top = (i * 36 + 8) + 'px';
    bar.style.width = Math.max(20, t.duration * dayWidth - 4) + 'px';
    bar.textContent = t.name + ' (' + t.duration + 'd)';
    bar.dataset.id = i;
    bar.addEventListener('pointerdown', startDrag);
    tl.appendChild(bar);
  });
  const maxEf = Math.max(0, ...tasks.map(t => t.ef));
  const crit = tasks.filter(t => t.critical).map(t => t.name).join(', ') || 'none';
  $('stats').textContent = `Total duration: ${maxEf} days · Critical path: ${crit} · ${tasks.length} tasks`;
  updateOutput();
  save();
}

let drag = null;
function startDrag(e) {
  const bar = e.currentTarget;
  const id = +bar.dataset.id;
  drag = { id, startX: e.clientX, origEs: tasks[id].es, bar };
  bar.setPointerCapture(e.pointerId);
  bar.addEventListener('pointermove', onDrag);
  bar.addEventListener('pointerup', endDrag);
}
function onDrag(e) {
  if (!drag) return;
  const dx = e.clientX - drag.startX;
  const newEs = Math.max(0, Math.round(drag.origEs + dx / dayWidth));
  const t = tasks[drag.id];
  // respect preds
  let minEs = 0;
  for (const p of t.predIds) minEs = Math.max(minEs, tasks[p].ef);
  t.userStart = Math.max(newEs, minEs);
  computeSchedule();
  render();
}
function endDrag() {
  if (drag) {
    drag.bar.removeEventListener('pointermove', onDrag);
    drag.bar.removeEventListener('pointerup', endDrag);
    drag = null;
  }
}

function updateOutput() {
  const lines = tasks.map(t => `- **${t.name}**: start day ${t.es}, finish ${t.ef}, duration ${t.duration}d${t.critical ? ' (critical)' : ''}`);
  $('output').textContent = lines.join('\n');
}

function toPNG() {
  const canvas = document.createElement('canvas');
  const w = totalDays * dayWidth + 60;
  const h = tasks.length * 36 + 40;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0f1115'; ctx.fillRect(0,0,w,h);
  ctx.font = '12px system-ui';
  tasks.forEach((t, i) => {
    const x = t.es * dayWidth + 20;
    const y = i * 36 + 20;
    const bw = Math.max(20, t.duration * dayWidth - 4);
    ctx.fillStyle = t.critical ? '#f72585' : '#4cc9f0';
    ctx.fillRect(x, y, bw, 28);
    ctx.fillStyle = '#000';
    ctx.fillText(t.name, x + 6, y + 18);
  });
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'project-plan.png';
  a.click();
  toast('PNG downloaded');
}

function save() {
  try {
    const data = { input: $('input').value, userStarts: tasks.map(t => t.userStart) };
    localStorage.setItem('f665-plan', JSON.stringify(data));
    location.hash = encodeURIComponent(JSON.stringify({ i: $('input').value }));
  } catch (e) { console.debug("lab f665-spatial-dependency-planner:", e); }
}

function load() {
  try {
    const h = location.hash.slice(1);
    if (h) {
      const d = JSON.parse(decodeURIComponent(h));
      if (d.i) $('input').value = d.i;
    } else {
      const s = localStorage.getItem('f665-plan');
      if (s) {
        const d = JSON.parse(s);
        $('input').value = d.input || '';
      }
    }
  } catch (e) { console.debug("lab f665-spatial-dependency-planner:", e); }
  if ($('input').value.trim()) plan();
}

function plan() {
  parseInput();
  computeSchedule();
  render();
}

$('plan').onclick = plan;
$('reset').onclick = () => { $('input').value = ''; tasks.length = 0; render(); };
$('png').onclick = toPNG;
$('copy').onclick = () => {
  navigator.clipboard.writeText($('output').textContent).then(() => toast('Copied'));
};
load();
