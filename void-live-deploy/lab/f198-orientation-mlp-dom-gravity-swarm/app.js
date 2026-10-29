const stage = document.getElementById('stage');
const agentsEl = document.getElementById('agents');
const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W = innerWidth, H = innerHeight;
canvas.width = W; canvas.height = H;

const N = 10;
let agents = [];
let ori = { beta: 0, gamma: 0 }; // gravity from orientation
let pointer = { x: W/2, y: H/2 };
let selected = null;
const dbName = 'f198-gravity-swarm';
let db;

function rand(a, b) { return a + Math.random() * (b - a); }
function hashShort(buf) {
  return crypto.subtle.digest('SHA-256', buf).then(h => {
    const arr = new Uint8Array(h);
    return Array.from(arr.slice(0, 6)).map(b => b.toString(16).padStart(2, '0')).join('');
  });
}

function makeMLP() {
  // 4→8→2, ~50 weights
  const w1 = new Float32Array(4 * 8);
  const b1 = new Float32Array(8);
  const w2 = new Float32Array(8 * 2);
  const b2 = new Float32Array(2);
  for (let i = 0; i < w1.length; i++) w1[i] = rand(-0.5, 0.5);
  for (let i = 0; i < w2.length; i++) w2[i] = rand(-0.5, 0.5);
  return { w1, b1, w2, b2 };
}

function forward(m, x) {
  const h = new Float32Array(8);
  for (let i = 0; i < 8; i++) {
    let s = m.b1[i];
    for (let j = 0; j < 4; j++) s += m.w1[i * 4 + j] * x[j];
    h[i] = Math.tanh(s);
  }
  const o = new Float32Array(2);
  for (let i = 0; i < 2; i++) {
    let s = m.b2[i];
    for (let j = 0; j < 8; j++) s += m.w2[i * 8 + j] * h[j];
    o[i] = Math.tanh(s);
  }
  return o;
}

function serializeMLP(m) {
  const total = m.w1.length + m.b1.length + m.w2.length + m.b2.length;
  const buf = new Float32Array(total);
  let o = 0;
  buf.set(m.w1, o); o += m.w1.length;
  buf.set(m.b1, o); o += m.b1.length;
  buf.set(m.w2, o); o += m.w2.length;
  buf.set(m.b2, o);
  return buf.buffer;
}

function deserializeMLP(ab) {
  const f = new Float32Array(ab);
  const w1 = f.slice(0, 32);
  const b1 = f.slice(32, 40);
  const w2 = f.slice(40, 56);
  const b2 = f.slice(56, 58);
  return { w1, b1, w2, b2 };
}

async function sealMLP(m) {
  const ab = serializeMLP(m);
  const short = await hashShort(ab);
  return { short, ab };
}

function createAgent(x, y, mlp) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  const hue = Math.floor(Math.random() * 360);
  el.style.background = `hsl(${hue},70%,40%)`;
  el.textContent = '?';
  agentsEl.appendChild(el);
  const a = {
    el, x, y, vx: 0, vy: 0, mlp: mlp || makeMLP(),
    energy: 1, fitness: 0, seal: '',
    pinned: false
  };
  el.onclick = () => {
    if (selected) selected.el.classList.remove('selected');
    selected = a;
    a.el.classList.add('selected');
  };
  return a;
}

async function initAgents() {
  for (let i = 0; i < N; i++) {
    const a = createAgent(rand(50, W-50), rand(50, H-50));
    const s = await sealMLP(a.mlp);
    a.seal = s.short;
    a.el.textContent = s.short.slice(0, 4);
    agents.push(a);
  }
}

function updatePhysics() {
  const g = 0.15;
  const gx = (ori.gamma / 90) * g;
  const gy = (ori.beta / 90) * g;
  // pointer as soft attractor
  const px = (pointer.x / W - 0.5) * 0.05;
  const py = (pointer.y / H - 0.5) * 0.05;

  for (const a of agents) {
    if (a.pinned) continue;
    // density input: nearby agents
    let dens = 0;
    for (const b of agents) {
      if (a === b) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < 10000) dens += 1 / (1 + Math.sqrt(d2)/20);
    }
    const inputs = [dens, a.energy, gx * 10, gy * 10];
    const out = forward(a.mlp, inputs);
    // MLP jump impulse
    a.vx += out[0] * 0.8;
    a.vy += out[1] * 0.8;
    // gravity
    a.vx += gx + px;
    a.vy += gy + py;
    a.vx *= 0.92;
    a.vy *= 0.92;
    a.x += a.vx;
    a.y += a.vy;
    // bounds
    if (a.x < 20) { a.x = 20; a.vx *= -0.5; }
    if (a.x > W - 50) { a.x = W - 50; a.vx *= -0.5; }
    if (a.y < 20) { a.y = 20; a.vy *= -0.5; }
    if (a.y > H - 50) { a.y = H - 50; a.vy *= -0.5; }
    a.el.style.left = a.x + 'px';
    a.el.style.top = a.y + 'px';
    // fitness: time near center
    const cx = W/2, cy = H/2;
    const d = Math.hypot(a.x - cx, a.y - cy);
    if (d < 120) a.fitness += 0.02 * (1 - d/120);
    a.energy = Math.max(0.1, a.energy - 0.001 + (d < 80 ? 0.005 : 0));
  }
}

function drawField() {
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(100,200,255,0.3)';
  ctx.beginPath();
  const gx = ori.gamma / 90, gy = ori.beta / 90;
  const cx = W/2, cy = H/2;
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + gx * 80, cy + gy * 80);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,255,200,0.4)';
  ctx.beginPath();
  ctx.arc(cx + gx * 80, cy + gy * 80, 6, 0, Math.PI*2);
  ctx.fill();
  // center resource
  ctx.strokeStyle = 'rgba(255,200,0,0.4)';
  ctx.beginPath();
  ctx.arc(cx, cy, 80, 0, Math.PI*2);
  ctx.stroke();
}

function evolve() {
  agents.sort((a, b) => b.fitness - a.fitness);
  const half = Math.floor(agents.length / 2);
  for (let i = half; i < agents.length; i++) {
    const parent = agents[i % half];
    const child = createAgent(agents[i].x, agents[i].y, null);
    // mutate
    const pm = parent.mlp;
    const cm = makeMLP();
    cm.w1.set(pm.w1); cm.b1.set(pm.b1); cm.w2.set(pm.w2); cm.b2.set(pm.b2);
    for (let k = 0; k < cm.w1.length; k++) if (Math.random() < 0.15) cm.w1[k] += rand(-0.3, 0.3);
    for (let k = 0; k < cm.w2.length; k++) if (Math.random() < 0.15) cm.w2[k] += rand(-0.3, 0.3);
    child.mlp = cm;
    child.fitness = 0;
    child.energy = 1;
    agents[i].el.remove();
    agents[i] = child;
    sealMLP(cm).then(s => { child.seal = s.short; child.el.textContent = s.short.slice(0,4); });
  }
  status.textContent = 'Evolved: top genomes mutated into bottom half.';
}

async function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('genomes', { keyPath: 'id' });
    r.onsuccess = e => res(e.target.result);
    r.onerror = rej;
  });
}

async function saveAll() {
  if (!db) db = await openDB().catch(() => null);
  if (!db) { status.textContent = 'No IndexedDB'; return; }
  const tx = db.transaction('genomes', 'readwrite');
  const store = tx.objectStore('genomes');
  for (let i = 0; i < agents.length; i++) {
    const ab = serializeMLP(agents[i].mlp);
    store.put({ id: i, seal: agents[i].seal, weights: ab, fitness: agents[i].fitness });
  }
  status.textContent = 'Saved to IndexedDB';
}

async function loadAll() {
  if (!db) db = await openDB().catch(() => null);
  if (!db) { status.textContent = 'No IndexedDB'; return; }
  const tx = db.transaction('genomes', 'readonly');
  const store = tx.objectStore('genomes');
  const req = store.getAll();
  req.onsuccess = () => {
    const recs = req.result;
    recs.forEach(rec => {
      if (agents[rec.id]) {
        agents[rec.id].mlp = deserializeMLP(rec.weights);
        agents[rec.id].seal = rec.seal;
        agents[rec.id].el.textContent = rec.seal.slice(0,4);
        agents[rec.id].fitness = rec.fitness || 0;
      }
    });
    status.textContent = 'Loaded from IndexedDB';
  };
}

document.getElementById('oriBtn').onclick = () => {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => {
      if (p === 'granted') window.addEventListener('deviceorientation', e => {
        ori.beta = e.beta || 0; ori.gamma = e.gamma || 0;
      });
    });
  } else {
    window.addEventListener('deviceorientation', e => {
      ori.beta = e.beta || 0; ori.gamma = e.gamma || 0;
    });
  }
  status.textContent = 'Orientation enabled (tilt device) or pointer fallback.';
};

stage.onpointermove = e => { pointer.x = e.clientX; pointer.y = e.clientY; };

document.getElementById('evolve').onclick = evolve;
document.getElementById('save').onclick = saveAll;
document.getElementById('load').onclick = loadAll;

document.getElementById('transfer').onclick = async () => {
  if (!selected) return;
  const ab = serializeMLP(selected.mlp);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
  navigator.clipboard.writeText(selected.seal + '|' + b64);
  status.textContent = 'Seal + base64 copied. Paste into another tab.';
};

document.getElementById('inject').onclick = async () => {
  const txt = document.getElementById('paste').value.trim();
  const parts = txt.split('|');
  if (parts.length < 2) return;
  try {
    const bin = atob(parts[1]);
    const ab = new ArrayBuffer(bin.length);
    const u8 = new Uint8Array(ab);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const mlp = deserializeMLP(ab);
    const a = createAgent(rand(100, W-100), rand(100, H-100), mlp);
    a.seal = parts[0];
    a.el.textContent = parts[0].slice(0,4);
    agents.push(a);
    status.textContent = 'Injected sealed genome as new agent.';
  } catch (e) { status.textContent = 'Inject failed'; }
};

function loop() {
  updatePhysics();
  drawField();
  requestAnimationFrame(loop);
}

initAgents().then(() => {
  openDB().then(d => db = d).catch(() => {});
  loop();
});

addEventListener('resize', () => {
  W = innerWidth; H = innerHeight;
  canvas.width = W; canvas.height = H;
});
