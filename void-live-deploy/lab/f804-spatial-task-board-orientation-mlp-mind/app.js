const scene = document.getElementById('scene');
const taskIn = document.getElementById('task');
let tasks = [];
let cam = { rx: -15, ry: 10 };
let drag = null;

// Simple local "model": hash text to hue for clustering similar words
function hueFor(text) {
  let h = 0;
  for (let c of text.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h}, 70%, 55%)`;
}

function load() {
  try {
    const raw = localStorage.getItem('f804-tasks') || location.hash.slice(1);
    if (raw) tasks = JSON.parse(decodeURIComponent(raw));
  } catch (e) { console.debug("lab f804-spatial-task-board-orientation-mlp-mind:", e); }
  render();
}

function save() {
  localStorage.setItem('f804-tasks', JSON.stringify(tasks));
}

function render() {
  scene.innerHTML = '';
  tasks.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'card' + (t.done ? ' done' : '');
    el.style.left = (t.x || 40 + (i % 5) * 200) + 'px';
    el.style.top = (t.y || 80 + Math.floor(i / 5) * 140) + 'px';
    el.style.transform = `translateZ(${t.z || 0}px)`;
    el.style.setProperty('--hue', hueFor(t.text));
    el.innerHTML = `<h3>${t.text}</h3><small>${t.done ? 'done' : 'open'} · drag me</small>`;
    el.dataset.i = i;
    el.addEventListener('pointerdown', startDrag);
    el.addEventListener('dblclick', () => { t.done = !t.done; save(); render(); });
    scene.appendChild(el);
  });
  updateCam();
}

function startDrag(e) {
  const i = +e.target.closest('.card').dataset.i;
  drag = { i, sx: e.clientX, sy: e.clientY, ox: tasks[i].x || 0, oy: tasks[i].y || 0 };
  e.target.setPointerCapture(e.pointerId);
  const move = (ev) => {
    if (!drag) return;
    tasks[drag.i].x = drag.ox + (ev.clientX - drag.sx);
    tasks[drag.i].y = drag.oy + (ev.clientY - drag.sy);
    render();
  };
  const up = () => { drag = null; save(); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function updateCam() {
  scene.style.transform = `rotateX(${cam.rx}deg) rotateY(${cam.ry}deg)`;
}

// DeviceOrientation as camera
window.addEventListener('deviceorientation', (e) => {
  if (e.beta == null) return;
  cam.rx = Math.max(-40, Math.min(20, e.beta - 30));
  cam.ry = Math.max(-40, Math.min(40, e.gamma || 0));
  updateCam();
  document.getElementById('status').textContent = `tilt β${Math.round(e.beta)} γ${Math.round(e.gamma||0)} · offline`;
});

// Mouse drag on background for camera proxy
let camDrag = null;
document.getElementById('board').addEventListener('pointerdown', (e) => {
  if (e.target.closest('.card')) return;
  camDrag = { sx: e.clientX, sy: e.clientY, orx: cam.rx, ory: cam.ry };
});
window.addEventListener('pointermove', (e) => {
  if (!camDrag) return;
  cam.ry = camDrag.ory + (e.clientX - camDrag.sx) * 0.3;
  cam.rx = camDrag.orx - (e.clientY - camDrag.sy) * 0.3;
  updateCam();
});
window.addEventListener('pointerup', () => camDrag = null);

document.getElementById('add').onclick = () => {
  const text = taskIn.value.trim();
  if (!text) return;
  tasks.push({ text, done: false, x: 100 + Math.random()*300, y: 100 + Math.random()*200, z: 0 });
  taskIn.value = '';
  save(); render();
};
taskIn.onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('add').click(); };

document.getElementById('copy').onclick = () => {
  const txt = tasks.map(t => (t.done ? '[x] ' : '[ ] ') + t.text).join('\n');
  navigator.clipboard.writeText(txt).then(() => alert('Copied list'));
};

document.getElementById('csv').onclick = () => {
  const csv = 'task,done\n' + tasks.map(t => `"${t.text.replace(/"/g,'""')}",${t.done}`).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  a.download = 'tasks.csv';
  a.click();
};

document.getElementById('share').onclick = () => {
  const hash = '#' + encodeURIComponent(JSON.stringify(tasks));
  location.hash = hash;
  navigator.clipboard.writeText(location.href).then(() => alert('Share link copied'));
};

document.getElementById('clear').onclick = () => { if (confirm('Clear all?')) { tasks = []; save(); render(); } };

load();
if (location.hash.length > 1) load();
