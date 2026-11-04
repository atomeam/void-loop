const N_AGENTS = 6;
const RES_SIZE = 24;
const LEAK = 0.28;
const SPARSITY = 0.12;
const RADIUS = 0.88;

let agents = [];
let bc = null;
let db = null;
let pc = null;
let dc = null;
let particles = [];
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const field = document.getElementById('field');
const statusEl = document.getElementById('status');

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

// --- IndexedDB ---
async function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('f530', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function saveGenome(id, data) {
  if (!db) return;
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({ id, ...data, ts: Date.now() });
}

// --- Reservoir utilities ---
function randn() { return Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random()); }

function makeReservoir() {
  const W = Array.from({ length: RES_SIZE }, () => Array(RES_SIZE).fill(0));
  for (let i = 0; i < RES_SIZE; i++) {
    for (let j = 0; j < RES_SIZE; j++) {
      if (Math.random() < SPARSITY) W[i][j] = (Math.random() - 0.5) * 2;
    }
  }
  // crude spectral radius scaling
  const scale = RADIUS / 2.2;
  for (let i = 0; i < RES_SIZE; i++) for (let j = 0; j < RES_SIZE; j++) W[i][j] *= scale;
  const Win = Array.from({ length: RES_SIZE }, () => Array(6).fill(0).map(() => (Math.random() - 0.5) * 0.8));
  const Wout = Array.from({ length: 4 }, () => Array(RES_SIZE).fill(0).map(() => (Math.random() - 0.5) * 0.4));
  return { W, Win, Wout, state: Array(RES_SIZE).fill(0) };
}

function stepReservoir(res, input) {
  const next = Array(RES_SIZE).fill(0);
  for (let i = 0; i < RES_SIZE; i++) {
    let s = 0;
    for (let j = 0; j < RES_SIZE; j++) s += res.W[i][j] * res.state[j];
    for (let k = 0; k < 6; k++) s += res.Win[i][k] * input[k];
    next[i] = (1 - LEAK) * res.state[i] + LEAK * Math.tanh(s);
  }
  res.state = next;
  const out = [0, 0, 0, 0];
  for (let o = 0; o < 4; o++) {
    for (let i = 0; i < RES_SIZE; i++) out[o] += res.Wout[o][i] * res.state[i];
  }
  return out;
}

function hashGenome(wout) {
  const str = JSON.stringify(wout);
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(buf =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  );
}

// --- Agents ---
function createAgent(i) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = `R${i}`;
  el.style.left = (80 + Math.random() * (innerWidth - 160)) + 'px';
  el.style.top = (60 + Math.random() * (innerHeight - 200)) + 'px';
  field.appendChild(el);
  const res = makeReservoir();
  return { el, res, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx: 0, vy: 0, fitness: 0, clicks: 0, hue: 180 };
}

for (let i = 0; i < N_AGENTS; i++) agents.push(createAgent(i));

// --- Particles ---
for (let i = 0; i < 120; i++) {
  particles.push({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, vx: 0, vy: 0 });
}

let pointer = { x: innerWidth / 2, y: innerHeight / 2, dx: 0, dy: 0 };
let motion = { ax: 0, ay: 0 };
let lastX = pointer.x, lastY = pointer.y;

addEventListener('pointermove', e => {
  pointer.dx = (e.clientX - lastX) * 0.15;
  pointer.dy = (e.clientY - lastY) * 0.15;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  lastX = e.clientX;
  lastY = e.clientY;
});

if ('DeviceMotionEvent' in window) {
  addEventListener('devicemotion', e => {
    if (e.accelerationIncludingGravity) {
      motion.ax = (e.accelerationIncludingGravity.x || 0) * 0.05;
      motion.ay = (e.accelerationIncludingGravity.y || 0) * 0.05;
    }
  });
}

// Click reward
field.addEventListener('click', e => {
  const t = e.target.closest('.agent');
  if (!t) return;
  const a = agents.find(ag => ag.el === t);
  if (a) {
    a.clicks += 3;
    a.fitness += 8;
    // small readout nudge
    for (let o = 0; o < 4; o++) for (let i = 0; i < RES_SIZE; i++) a.res.Wout[o][i] += (Math.random() - 0.5) * 0.02;
  }
});

// --- BroadcastChannel ---
try { bc = new BroadcastChannel('f530-reservoir'); } catch (e) { bc = null; }
if (bc) {
  bc.onmessage = async ev => {
    const msg = ev.data;
    if (msg.type === 'genome' && msg.hash && msg.wout && msg.fitness > (agents[0]?.fitness || 0) * 0.9) {
      const verify = await hashGenome(msg.wout);
      if (verify === msg.hash) {
        // adopt into lowest fitness agent
        agents.sort((a, b) => a.fitness - b.fitness);
        const victim = agents[0];
        victim.res.Wout = msg.wout.map(row => row.map(v => v + (Math.random() - 0.5) * 0.03));
        victim.fitness = msg.fitness * 0.85;
        statusEl.textContent = `Adopted remote genome (fit ${msg.fitness.toFixed(1)})`;
      }
    }
  };
}

// --- WebRTC (manual signaling) ---
async function setupPeer() {
  pc = new RTCPeerConnection({ iceServers: [] });
  dc = pc.createDataChannel('genome');
  dc.onmessage = async ev => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'genome') {
        const verify = await hashGenome(msg.wout);
        if (verify === msg.hash && msg.fitness > agents.reduce((m, a) => Math.max(m, a.fitness), 0) * 0.8) {
          agents.sort((a, b) => a.fitness - b.fitness);
          agents[0].res.Wout = msg.wout.map(r => [...r]);
          agents[0].fitness = msg.fitness * 0.9;
          statusEl.textContent = `WebRTC adopted genome fit ${msg.fitness.toFixed(1)}`;
        }
      }
    } catch (e) {}
  };
  pc.onicecandidate = e => { if (e.candidate) document.getElementById('offerArea').value += '\n' + JSON.stringify(e.candidate); };
}

document.getElementById('offerBtn').onclick = async () => {
  await setupPeer();
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  document.getElementById('offerArea').value = JSON.stringify(pc.localDescription);
  statusEl.textContent = 'Offer created — copy & send to peer';
};

document.getElementById('answerBtn').onclick = async () => {
  const txt = document.getElementById('offerArea').value.trim();
  if (!txt) return;
  try {
    const desc = JSON.parse(txt);
    if (!pc) await setupPeer();
    if (desc.type === 'offer') {
      await pc.setRemoteDescription(desc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      document.getElementById('offerArea').value = JSON.stringify(pc.localDescription);
      statusEl.textContent = 'Answer created — send back to peer';
    } else if (desc.type === 'answer') {
      await pc.setRemoteDescription(desc);
      statusEl.textContent = 'Remote answer set — DataChannel ready';
    }
  } catch (e) { statusEl.textContent = 'Signaling parse error'; }
};

async function broadcastGenome(a) {
  const hash = await hashGenome(a.res.Wout);
  const msg = { type: 'genome', hash, wout: a.res.Wout, fitness: a.fitness };
  if (bc) bc.postMessage(msg);
  if (dc && dc.readyState === 'open') dc.send(JSON.stringify(msg));
  await saveGenome('best', { hash, wout: a.res.Wout, fitness: a.fitness });
}

document.getElementById('sealBtn').onclick = async () => {
  const best = agents.reduce((b, a) => a.fitness > b.fitness ? a : b, agents[0]);
  await broadcastGenome(best);
  statusEl.textContent = `Sealed best (fit ${best.fitness.toFixed(1)}) → BC + IDB` + (dc?.readyState === 'open' ? ' + WebRTC' : '');
};

// --- Main loop ---
let grid = new Map();
function tick() {
  const inputBase = [
    pointer.x / innerWidth,
    pointer.y / innerHeight,
    Math.max(-1, Math.min(1, pointer.dx)),
    Math.max(-1, Math.min(1, pointer.dy)),
    Math.max(-1, Math.min(1, motion.ax)),
    Math.max(-1, Math.min(1, motion.ay))
  ];

  let meanAct = 0;
  grid.clear();

  agents.forEach(a => {
    const out = stepReservoir(a.res, inputBase);
    a.vx = a.vx * 0.85 + out[0] * 2.2;
    a.vy = a.vy * 0.85 + out[1] * 2.2;
    a.x += a.vx;
    a.y += a.vy;
    // bounds
    if (a.x < 10 || a.x > innerWidth - 90) a.vx *= -0.6;
    if (a.y < 10 || a.y > innerHeight - 140) a.vy *= -0.6;
    a.x = Math.max(10, Math.min(innerWidth - 90, a.x));
    a.y = Math.max(10, Math.min(innerHeight - 140, a.y));
    a.el.style.left = a.x + 'px';
    a.el.style.top = a.y + 'px';
    a.hue = (a.hue + out[3] * 4 + 360) % 360;
    a.el.style.borderColor = `hsl(${a.hue}, 90%, 60%)`;
    a.el.style.boxShadow = `0 0 ${8 + a.fitness * 0.3}px hsl(${a.hue}, 90%, 55%)`;

    // coverage
    const gx = Math.floor(a.x / 60), gy = Math.floor(a.y / 60);
    grid.set(`${gx},${gy}`, true);
    a.fitness = a.fitness * 0.995 + 0.04 + a.clicks * 0.1;
    a.clicks *= 0.95;
    meanAct += a.res.state.reduce((s, v) => s + Math.abs(v), 0) / RES_SIZE;
  });
  meanAct /= N_AGENTS;

  // particles
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.vx += (Math.random() - 0.5) * 0.4 * meanAct;
    p.vy += (Math.random() - 0.5) * 0.4 * meanAct;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    ctx.fillStyle = `hsla(${180 + meanAct * 40}, 80%, 60%, ${0.35 + meanAct * 0.4})`;
    ctx.fillRect(p.x, p.y, 2.2, 2.2);
  });

  const avgFit = agents.reduce((s, a) => s + a.fitness, 0) / N_AGENTS;
  statusEl.textContent = `Agents ${N_AGENTS} | avg fit ${avgFit.toFixed(1)} | res act ${meanAct.toFixed(2)} | ${bc ? 'BC' : 'noBC'} ${dc?.readyState === 'open' ? '| P2P' : ''}`;
  requestAnimationFrame(tick);
}

// init
(async () => {
  try { db = await openDB(); } catch (e) { db = null; }
  statusEl.textContent = 'Reservoir mind live — click agents, seal genomes, try WebRTC';
  tick();
})();
