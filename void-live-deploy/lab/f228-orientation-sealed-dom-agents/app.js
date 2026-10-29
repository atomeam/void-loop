const N = 5;
const agents = [];
let tilt = { beta: 0, gamma: 0 }; // causal orientation
let leaderIdx = 0;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const fitEl = document.getElementById('fit');
const tiltEl = document.getElementById('tilt');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// Tiny MLP: 4 inputs (beta, gamma, vx, vy) → 6 hidden → 2 outputs (fx, fy corrective)
function createGenome() {
  const w1 = Array.from({length:24}, () => (Math.random()-0.5)*0.6);
  const b1 = Array.from({length:6}, () => (Math.random()-0.5)*0.1);
  const w2 = Array.from({length:12}, () => (Math.random()-0.5)*0.6);
  const b2 = Array.from({length:2}, () => (Math.random()-0.5)*0.1);
  return { w1, b1, w2, b2 };
}
function mlpForward(g, x) {
  const h = [];
  for (let i = 0; i < 6; i++) {
    let s = g.b1[i];
    for (let j = 0; j < 4; j++) s += x[j] * g.w1[i*4 + j];
    h[i] = Math.tanh(s);
  }
  const o = [];
  for (let i = 0; i < 2; i++) {
    let s = g.b2[i];
    for (let j = 0; j < 6; j++) s += h[j] * g.w2[i*6 + j];
    o[i] = Math.tanh(s) * 2.2;
  }
  return o;
}
function mutate(g, rate=0.12) {
  const ng = JSON.parse(JSON.stringify(g));
  for (const k of ['w1','b1','w2','b2']) {
    for (let i = 0; i < ng[k].length; i++) {
      if (Math.random() < rate) ng[k][i] += (Math.random()-0.5)*0.35;
    }
  }
  return ng;
}

function spawnAgents() {
  document.querySelectorAll('.agent').forEach(el => el.remove());
  agents.length = 0;
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'agent';
    el.textContent = `A${i}`;
    document.getElementById('stage').appendChild(el);
    agents.push({
      el, x: 120 + Math.random()*(window.innerWidth-240), y: 120 + Math.random()*(window.innerHeight-240),
      vx: 0, vy: 0, genome: createGenome(), fitness: 1, energy: 1
    });
  }
}
spawnAgents();

// IndexedDB seal
const dbName = 'f228-seal';
let db;
const req = indexedDB.open(dbName, 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', { keyPath: 'id' });
req.onsuccess = e => { db = e.target.result; loadSeal(); };
function sealLeader() {
  if (!db) { statusEl.textContent = 'IndexedDB unavailable.'; return; }
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({ id: 'leader', genome: agents[leaderIdx].genome, ts: Date.now() });
  statusEl.textContent = 'Leader genome sealed to IndexedDB.';
}
function loadSeal() {
  if (!db) return;
  const tx = db.transaction('genomes', 'readonly');
  const r = tx.objectStore('genomes').get('leader');
  r.onsuccess = () => {
    if (r.result) {
      agents[0].genome = JSON.parse(JSON.stringify(r.result.genome));
      statusEl.textContent = 'Restored sealed leader genome.';
    }
  };
}
document.getElementById('sealBtn').onclick = sealLeader;
document.getElementById('resetBtn').onclick = () => { spawnAgents(); statusEl.textContent = 'Reset agents.'; };

// BroadcastChannel for sealed genome transfer (same-origin multi-tab; WebRTC next)
const bc = new BroadcastChannel('f228-genomes');
bc.onmessage = e => {
  if (e.data && e.data.type === 'seal' && e.data.genome) {
    let worst = 0, worstE = Infinity;
    agents.forEach((a,i) => { if (a.energy < worstE) { worstE = a.energy; worst = i; } });
    agents[worst].genome = JSON.parse(JSON.stringify(e.data.genome));
    statusEl.textContent = 'Received sealed genome via BroadcastChannel; applied to weakest.';
  }
};
document.getElementById('shareBtn').onclick = () => {
  bc.postMessage({ type: 'seal', genome: agents[leaderIdx].genome, from: 'local' });
  statusEl.textContent = 'Broadcast sealed leader genome.';
};

// DeviceOrientation as primary causal input
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    if (e.beta != null && e.gamma != null) {
      tilt.beta = e.beta;
      tilt.gamma = e.gamma;
      tiltEl.textContent = `β: ${tilt.beta.toFixed(1)}°  γ: ${tilt.gamma.toFixed(1)}°`;
    }
  });
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    document.body.addEventListener('click', () => {
      DeviceOrientationEvent.requestPermission().then(p => {
        if (p === 'granted') statusEl.textContent = 'Orientation permission granted.';
      }).catch(() => {});
    }, { once: true });
  }
}
let dragging = false;
window.addEventListener('pointerdown', () => dragging = true);
window.addEventListener('pointerup', () => dragging = false);
window.addEventListener('pointermove', e => {
  if (dragging) {
    tilt.gamma = (e.clientX / window.innerWidth - 0.5) * 60;
    tilt.beta = (e.clientY / window.innerHeight - 0.5) * 60 + 45;
    tiltEl.textContent = `β: ${tilt.beta.toFixed(1)}°  γ: ${tilt.gamma.toFixed(1)}° (sim)`;
  }
});

let frame = 0;
function step() {
  frame++;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const cx = W/2, cy = H/2;
  const gx = tilt.gamma * 2, gy = (tilt.beta - 45) * 2;
  ctx.strokeStyle = '#66ffaa';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + gx*8, cy + gy*8); ctx.stroke();

  let bestFit = -Infinity, worstIdx = 0, worstFit = Infinity;
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    const gax = tilt.gamma * 0.015;
    const gay = (tilt.beta - 45) * 0.015;
    const inp = [tilt.beta / 90, tilt.gamma / 90, a.vx * 0.1, a.vy * 0.1];
    const force = mlpForward(a.genome, inp);
    a.vx = a.vx * 0.92 + gax + force[0] * 0.4;
    a.vy = a.vy * 0.92 + gay + force[1] * 0.4;
    a.x += a.vx * 6;
    a.y += a.vy * 6;
    if (a.x < 40 || a.x > W-40) { a.vx *= -0.7; a.x = Math.max(40, Math.min(W-40, a.x)); }
    if (a.y < 40 || a.y > H-40) { a.vy *= -0.7; a.y = Math.max(40, Math.min(H-40, a.y)); }
    const dist = Math.hypot(a.x - cx, a.y - cy) / (Math.min(W,H)*0.5);
    a.fitness = Math.max(0, 1 - dist);
    a.energy = 0.96 * a.energy + 0.04 * a.fitness;
    if (a.fitness > bestFit) { bestFit = a.fitness; leaderIdx = i; }
    if (a.fitness < worstFit) { worstFit = a.fitness; worstIdx = i; }
    a.el.style.transform = `translate(${a.x-40}px,${a.y-26}px)`;
    a.el.classList.toggle('leader', i === leaderIdx);
    a.el.textContent = `A${i} ${a.fitness.toFixed(2)}`;
    ctx.strokeStyle = i === leaderIdx ? '#ffcc44' : '#4affaa';
    ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - a.vx*10, a.y - a.vy*10); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  fitEl.textContent = `Leader A${leaderIdx} fit ${bestFit.toFixed(2)} energy ${agents[leaderIdx].energy.toFixed(2)}`;

  if (frame % 240 === 0 && worstIdx !== leaderIdx) {
    agents[worstIdx].genome = mutate(agents[leaderIdx].genome);
    statusEl.textContent = `Replaced A${worstIdx} with mutated leader genome.`;
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);
