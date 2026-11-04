const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const probesEl = document.getElementById('probes');
const statusEl = document.getElementById('status');
const toastEl = document.getElementById('toast');

let W = innerWidth, H = innerHeight;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

// Particles
const N = 160;
let particles = [];
function initParticles() {
  particles = Array.from({length:N}, () => ({
    x: Math.random()*W, y: Math.random()*H,
    vx: (Math.random()-0.5)*40, vy: (Math.random()-0.5)*40,
    charge: Math.random() < 0.5 ? 1 : -1,
    hue: Math.random()*360
  }));
}
initParticles();

// Orientation
let beta = 0, gamma = 0, orientOn = false;
function onOrient(e) {
  beta = e.beta || 0; gamma = e.gamma || 0;
  orientOn = true;
}
document.getElementById('orient').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission().then(p => { if (p==='granted') addEventListener('deviceorientation', onOrient); });
  } else addEventListener('deviceorientation', onOrient);
};

// Pointer
let px = W/2, py = H/2;
canvas.addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; });
canvas.addEventListener('pointerdown', e => { px = e.clientX; py = e.clientY; });

// MLP policy: 5→6→4
let w1 = Array.from({length:6}, () => Array.from({length:5}, () => (Math.random()-0.5)*0.6));
let b1 = Array(6).fill(0);
let w2 = Array.from({length:4}, () => Array.from({length:6}, () => (Math.random()-0.5)*0.6));
let b2 = Array(4).fill(0);
let fitness = 0, bestFitness = 0;
let policyOut = [1, 200, 0, 0];

function relu(x) { return Math.max(0, x); }
function forward(inp) {
  const h = b1.map((b,i) => relu(b + w1[i].reduce((s,w,j)=>s+w*inp[j],0)));
  return b2.map((b,i) => b + w2[i].reduce((s,w,j)=>s+w*h[j],0));
}
function mutate() {
  const rate = 0.08;
  for (let i=0;i<6;i++) for (let j=0;j<5;j++) if (Math.random()<0.3) w1[i][j] += (Math.random()-0.5)*rate;
  for (let i=0;i<4;i++) for (let j=0;j<6;j++) if (Math.random()<0.3) w2[i][j] += (Math.random()-0.5)*rate;
}

// Probes
const PROBE_COUNT = 5;
const probes = [];
for (let i=0;i<PROBE_COUNT;i++) {
  const el = document.createElement('div');
  el.className = 'probe';
  el.innerHTML = `<div>Probe ${i+1}</div><small>energy</small>`;
  probesEl.appendChild(el);
  probes.push({ el, x: Math.random()*W, y: Math.random()*H, vx:0, vy:0 });
  el.onclick = () => {
    fitness += 1.2;
    if (fitness > bestFitness) { bestFitness = fitness; mutate(); showToast('policy evolved'); }
  };
}

// Physics step (CPU N-body electrostatic, softened)
function step(dt) {
  const k = 1800; // force scale
  const soft = 28;
  const damp = 0.96;
  const tiltX = (gamma / 45) * 40;
  const tiltY = (beta / 45) * 40;
  for (let i=0;i<N;i++) {
    let fx=0, fy=0;
    const p = particles[i];
    for (let j=0;j<N;j++) if (i!==j) {
      const q = particles[j];
      let dx = p.x - q.x, dy = p.y - q.y;
      const d2 = dx*dx + dy*dy + soft*soft;
      const f = k * p.charge * q.charge / d2;
      const inv = 1 / Math.sqrt(d2);
      fx += dx * f * inv;
      fy += dy * f * inv;
    }
    fx += tiltX * p.charge * 0.4;
    fy += tiltY * p.charge * 0.4;
    // pointer attractor (weak opposite)
    const dxp = px - p.x, dyp = py - p.y;
    const dp = Math.hypot(dxp,dyp)+20;
    fx += dxp / dp * 12;
    fy += dyp / dp * 12;
    p.vx = (p.vx + fx * dt) * damp;
    p.vy = (p.vy + fy * dt) * damp;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x<0||p.x>W) p.vx *= -0.7;
    if (p.y<0||p.y>H) p.vy *= -0.7;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
  }
}

// Energy
function fieldEnergy() {
  let e=0;
  for (let i=0;i<N;i++) e += particles[i].vx**2 + particles[i].vy**2;
  return e / N;
}

// Policy update
function updatePolicy() {
  const en = Math.min(1, fieldEnergy()/800);
  const inp = [
    Math.max(-1,Math.min(1, beta/90)),
    Math.max(-1,Math.min(1, gamma/90)),
    en,
    px/W * 2 - 1,
    py/H * 2 - 1
  ];
  const raw = forward(inp);
  policyOut = [
    Math.max(0.65, Math.min(1.7, 1 + raw[0]*0.4)),
    ((raw[1]*40 + 200) % 360 + 360) % 360,
    raw[2]*40,
    raw[3]*40
  ];
  document.documentElement.style.setProperty('--scale', policyOut[0]);
  document.documentElement.style.setProperty('--hue', policyOut[1]);
  document.documentElement.style.setProperty('--blur', Math.abs(raw[0])*3 + 'px');
  document.documentElement.style.setProperty('--pulse', 0.75 + Math.sin(performance.now()/400)*0.15);
}

// Probe positions: follow clusters or policy offset from center
function updateProbes() {
  // simple: each probe tracks a particle with matching index modulo, plus policy offset
  for (let i=0;i<PROBE_COUNT;i++) {
    const p = particles[(i * 23) % N];
    const pr = probes[i];
    const tx = p.x + policyOut[2] * (i-2);
    const ty = p.y + policyOut[3] * (i-2);
    pr.vx += (tx - pr.x) * 0.08;
    pr.vy += (ty - pr.y) * 0.08;
    pr.vx *= 0.82; pr.vy *= 0.82;
    pr.x += pr.vx; pr.y += pr.vy;
    pr.el.style.left = pr.x + 'px';
    pr.el.style.top = pr.y + 'px';
    pr.el.querySelector('small').textContent = 'e ' + fieldEnergy().toFixed(0);
  }
}

// Render
function render() {
  ctx.fillStyle = 'rgba(10,10,18,0.28)';
  ctx.fillRect(0,0,W,H);
  for (const p of particles) {
    ctx.beginPath();
    ctx.fillStyle = `hsla(${p.hue},70%,${50 + p.charge*15}%,0.85)`;
    ctx.arc(p.x, p.y, p.charge > 0 ? 3.2 : 2.4, 0, Math.PI*2);
    ctx.fill();
  }
}

// Seal / IndexedDB / Broadcast
const DB_NAME = 'f535', STORE = 'genome';
let db;
const bc = new BroadcastChannel('f535-electro');
bc.onmessage = e => {
  if (e.data && e.data.type === 'genome' && e.data.fitness > bestFitness) {
    try {
      const g = e.data.genome;
      w1 = g.w1; b1 = g.b1; w2 = g.w2; b2 = g.b2;
      bestFitness = e.data.fitness;
      showToast('adopted superior genome');
    } catch(err) {}
  }
};
function openDB() {
  return new Promise(res => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => { db = r.result; res(); };
    r.onerror = () => res();
  });
}
async function seal() {
  const genome = { w1, b1, w2, b2, fitness: bestFitness };
  const json = JSON.stringify(genome);
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
  const hash = Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  if (db) {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ hash, genome, fitness: bestFitness, t: Date.now() }, 'best');
  }
  bc.postMessage({ type:'genome', genome, fitness: bestFitness, hash });
  showToast('sealed ' + hash.slice(0,8));
  statusUpdate(hash);
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initParticles(); fitness=0; showToast('reset'); };

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 1800);
}
function statusUpdate(h) {
  statusEl.textContent = `N=${N} energy=${fieldEnergy().toFixed(0)} fit=${bestFitness.toFixed(1)} orient=${orientOn?'on':'off'} ${h?'seal '+h.slice(0,6):''}`;
}

// Loop
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.032, (now-last)/1000);
  last = now;
  step(dt);
  if (now % 120 < 16) updatePolicy();
  updateProbes();
  render();
  if (now % 400 < 16) statusUpdate();
  requestAnimationFrame(loop);
}
openDB().then(() => requestAnimationFrame(loop));
