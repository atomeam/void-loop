const DB_NAME = 'verse-f672-notes';
const STORE = 'state';
let db;
let notes = [];
let weights = { // simple Elman-like: input 3 -> hidden 4 -> out 2, plus hidden recurrence
  ih: Array(4).fill(0).map(() => Array(3).fill(0).map(() => (Math.random()-0.5)*0.3)),
  hh: Array(4).fill(0).map(() => Array(4).fill(0).map(() => (Math.random()-0.5)*0.2)),
  ho: Array(2).fill(0).map(() => Array(4).fill(0).map(() => (Math.random()-0.5)*0.4)),
  h: [0,0,0,0]
};
let tilt = {x:0, y:0, mag:0};
let pointer = {x:0, y:0, vx:0, vy:0, active:false};
let lastTime = performance.now();

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function loadState() {
  try {
    db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('state');
    return new Promise(r => {
      req.onsuccess = () => r(req.result || null);
      req.onerror = () => r(null);
    });
  } catch { return null; }
}

async function saveState() {
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ notes: notes.map(n => ({text:n.text, x:n.x, y:n.y, vx:n.vx, vy:n.vy})), weights }, 'state');
  } catch (e) { console.debug("lab f672-orientation-rnn-physical-note-sorter:", e); }
}

function tanh(x) { return Math.tanh(x); }
function forwardRNN(input) {
  const hNew = weights.h.map((h, i) => {
    let s = 0;
    for (let j=0; j<3; j++) s += weights.ih[i][j] * input[j];
    for (let j=0; j<4; j++) s += weights.hh[i][j] * h;
    return tanh(s);
  });
  weights.h = hNew;
  const out = [0,0];
  for (let o=0; o<2; o++) {
    for (let j=0; j<4; j++) out[o] += weights.ho[o][j] * hNew[j];
  }
  return out.map(tanh);
}

function adapt() {
  // light Hebbian-ish on high mag
  if (tilt.mag > 0.4) {
    for (let i=0; i<4; i++) {
      for (let j=0; j<3; j++) weights.ih[i][j] += 0.002 * (Math.random()-0.5);
    }
  }
}

function createNote(text, x, y) {
  const el = document.createElement('div');
  el.className = 'note';
  el.innerHTML = `<div class="text">${text}</div>`;
  document.getElementById('board').appendChild(el);
  const n = { el, text, x: x || 100+Math.random()*200, y: y || 100+Math.random()*200, vx:0, vy:0, cluster:0 };
  el.style.left = n.x + 'px';
  el.style.top = n.y + 'px';
  notes.push(n);
  return n;
}

function renderNotes() {
  notes.forEach(n => {
    n.el.style.left = n.x + 'px';
    n.el.style.top = n.y + 'px';
    n.el.style.borderColor = n.cluster === 0 ? '#5eead4' : '#f472b6';
  });
}

function physics(dt) {
  const board = document.getElementById('board');
  const w = board.clientWidth, h = board.clientHeight;
  const input = [tilt.x, tilt.y, tilt.mag];
  const out = forwardRNN(input);
  const strength = 0.8 + out[0] * 0.6;
  const bias = out[1];
  const c1 = {x: w*0.3, y: h*0.4};
  const c2 = {x: w*0.7, y: h*0.6};
  notes.forEach(n => {
    // soft assign
    const d1 = Math.hypot(n.x-c1.x, n.y-c1.y);
    const d2 = Math.hypot(n.x-c2.x, n.y-c2.y);
    n.cluster = (d1 + bias*20) < d2 ? 0 : 1;
    const target = n.cluster === 0 ? c1 : c2;
    const dx = target.x - n.x, dy = target.y - n.y;
    const dist = Math.hypot(dx, dy) || 1;
    const force = strength * 40 / (dist + 40);
    n.vx += (dx/dist) * force * dt * 0.001;
    n.vy += (dy/dist) * force * dt * 0.001;
    // pointer influence
    if (pointer.active) {
      const pdx = pointer.x - n.x, pdy = pointer.y - n.y;
      const pd = Math.hypot(pdx, pdy) || 1;
      if (pd < 120) {
        n.vx += (pdx/pd) * 0.3 * dt * 0.001;
        n.vy += (pdy/pd) * 0.3 * dt * 0.001;
      }
    }
    n.vx *= 0.92; n.vy *= 0.92;
    n.x += n.vx * dt * 0.05;
    n.y += n.vy * dt * 0.05;
    n.x = Math.max(10, Math.min(w-150, n.x));
    n.y = Math.max(10, Math.min(h-80, n.y));
  });
  adapt();
  renderNotes();
}

function loop(now) {
  const dt = Math.min(32, now - lastTime);
  lastTime = now;
  physics(dt);
  requestAnimationFrame(loop);
}

function updateTiltFromPointer() {
  // fallback
  tilt.x = (pointer.x / window.innerWidth - 0.5) * 2;
  tilt.y = (pointer.y / window.innerHeight - 0.5) * 2;
  tilt.mag = Math.hypot(tilt.x, tilt.y);
}

document.getElementById('add').onclick = () => {
  const lines = document.getElementById('input').value.split('\n').map(s => s.trim()).filter(Boolean);
  lines.forEach(t => createNote(t));
  document.getElementById('input').value = '';
  saveState();
  document.getElementById('status').textContent = notes.length + ' notes';
};

document.getElementById('clear').onclick = () => {
  notes.forEach(n => n.el.remove());
  notes = [];
  saveState();
};

document.getElementById('export').onclick = () => {
  const groups = {0:[], 1:[]};
  notes.forEach(n => groups[n.cluster].push(n.text));
  let text = '=== Cluster A ===\n' + (groups[0].join('\n') || '(empty)') + '\n\n=== Cluster B ===\n' + (groups[1].join('\n') || '(empty)');
  const blob = new Blob([text], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'organized-notes.txt';
  a.click();
};

document.addEventListener('pointermove', e => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.active = true;
  updateTiltFromPointer();
});
document.addEventListener('pointerdown', e => { pointer.active = true; });
document.addEventListener('pointerup', () => { pointer.active = false; });

window.addEventListener('deviceorientation', e => {
  if (e.beta != null && e.gamma != null) {
    tilt.x = Math.max(-1, Math.min(1, e.gamma / 45));
    tilt.y = Math.max(-1, Math.min(1, e.beta / 45));
    tilt.mag = Math.hypot(tilt.x, tilt.y);
    document.getElementById('status').textContent = `tilt ${tilt.x.toFixed(2)},${tilt.y.toFixed(2)}`;
  }
}, true);

// request permission on iOS
if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
  document.body.addEventListener('click', function once() {
    DeviceOrientationEvent.requestPermission().then(s => {
      if (s === 'granted') document.getElementById('status').textContent = 'Orientation ready';
    }).catch(()=>{});
    document.body.removeEventListener('click', once);
  }, {once:true});
}

(async () => {
  const state = await loadState();
  if (state && state.notes) {
    state.notes.forEach(n => createNote(n.text, n.x, n.y));
    if (state.weights) weights = state.weights;
  }
  if (notes.length === 0) {
    createNote('Meeting notes');
    createNote('Buy milk');
    createNote('Idea: new feature');
  }
  requestAnimationFrame(loop);
  setInterval(saveState, 5000);
})();
