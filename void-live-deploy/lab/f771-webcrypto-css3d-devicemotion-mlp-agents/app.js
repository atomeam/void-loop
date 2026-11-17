const STAGE = document.getElementById('stage');
const STATUS = document.getElementById('status');
const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 7;
const agents = [];
let bestFitness = -Infinity;
let bestWeights = null;
let cryptoKey = null; // {privateKey, publicKey}
const DB_NAME = 'verse-f771';
const STORE = 'genomes';

// Tiny MLP: 8 inputs → 12 hidden → 4 outputs
function randWeights() {
  const w1 = Array.from({length:12*8}, () => (Math.random()-0.5)*0.4);
  const b1 = Array.from({length:12}, () => (Math.random()-0.5)*0.2);
  const w2 = Array.from({length:4*12}, () => (Math.random()-0.5)*0.4);
  const b2 = Array.from({length:4}, () => (Math.random()-0.5)*0.2);
  return {w1,b1,w2,b2};
}
function mlpForward(w, x) {
  const h = new Array(12);
  for (let i=0;i<12;i++) {
    let s = w.b1[i];
    for (let j=0;j<8;j++) s += w.w1[i*8+j] * x[j];
    h[i] = Math.tanh(s);
  }
  const o = new Array(4);
  for (let i=0;i<4;i++) {
    let s = w.b2[i];
    for (let j=0;j<12;j++) s += w.w2[i*12+j] * h[j];
    o[i] = Math.tanh(s);
  }
  return o;
}
function mutate(w, rate=0.08) {
  const m = JSON.parse(JSON.stringify(w));
  for (const k of ['w1','b1','w2','b2']) m[k] = m[k].map(v => v + (Math.random()-0.5)*rate);
  return m;
}
function serialize(w) { return JSON.stringify(w); }
function deserialize(s) { return JSON.parse(s); }

async function initCrypto() {
  try {
    const pair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );
    cryptoKey = pair;
    STATUS.textContent = 'WebCrypto ready. Sealed genomes will be signed.';
  } catch(e) {
    STATUS.textContent = 'WebCrypto unavailable; transfer unsigned.';
  }
}

async function openDB() {
  return new Promise((res,rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function saveGenome(signed) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(signed, 'best');
    await new Promise(r => tx.oncomplete = r);
  } catch (e) { console.debug("lab f771-webcrypto-css3d-devicemotion-mlp-agents:", e); }
}
async function loadGenome() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('best');
    return new Promise(r => { req.onsuccess = () => r(req.result); req.onerror = () => r(null); });
  } catch(e) { return null; }
}

class Agent {
  constructor(i) {
    this.id = i;
    this.el = document.createElement('div');
    this.el.className = 'card';
    this.el.innerHTML = `<div>Agent ${i}</div><div class="fit">fit 0</div>`;
    STAGE.appendChild(this.el);
    this.x = Math.random()*(W-100)+50;
    this.y = Math.random()*(H-140)+70;
    this.vx = 0; this.vy = 0;
    this.rz = 0; this.vrz = 0;
    this.weights = randWeights();
    this.fitness = 0;
    this.el.onclick = () => this.reward(40);
  }
  reward(v) {
    this.fitness += v;
    this.el.style.borderColor = '#f72585';
    setTimeout(() => this.el.style.borderColor = '#4cc9f0', 200);
  }
  update(inputs, dt) {
    const o = mlpForward(this.weights, inputs);
    this.vx += o[0] * 80 * dt;
    this.vy += o[1] * 80 * dt;
    this.vrz += o[2] * 2 * dt;
    this.vx *= 0.92; this.vy *= 0.92; this.vrz *= 0.9;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rz += this.vrz * dt;
    if (this.x < 40) { this.x=40; this.vx*=-0.5; }
    if (this.x > W-100) { this.x=W-100; this.vx*=-0.5; }
    if (this.y < 50) { this.y=50; this.vy*=-0.5; }
    if (this.y > H-130) { this.y=H-130; this.vy*=-0.5; }
    // mild attraction if o[3] high
    const ax = (pointer.x - this.x) * Math.max(0,o[3]) * 0.4 * dt;
    const ay = (pointer.y - this.y) * Math.max(0,o[3]) * 0.4 * dt;
    this.x += ax; this.y += ay;
    const dist = Math.hypot(pointer.x-this.x, pointer.y-this.y);
    if (dist < 80) this.fitness += (80-dist)*0.02;
    this.el.style.transform = `translate3d(${this.x}px,${this.y}px,0) rotateZ(${this.rz}rad) rotateX(${o[2]*15}deg)`;
    this.el.querySelector('.fit').textContent = `fit ${this.fitness.toFixed(0)}`;
    const hue = 200 + (this.fitness % 160);
    this.el.style.borderColor = `hsl(${hue},80%,60%)`;
    if (this.fitness > bestFitness) {
      bestFitness = this.fitness;
      bestWeights = JSON.parse(JSON.stringify(this.weights));
    }
  }
  adopt(w) { this.weights = mutate(w, 0.05); this.fitness *= 0.7; }
}

let pointer = {x: W/2, y: H/2};
addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });

let motion = {ax:0, ay:0, az:0, rx:0, ry:0, rz:0};
function onMotion(e) {
  const a = e.accelerationIncludingGravity || e.acceleration || {};
  const r = e.rotationRate || {};
  motion.ax = (a.x||0)*0.1; motion.ay = (a.y||0)*0.1; motion.az = (a.z||0)*0.1;
  motion.rx = (r.alpha||0)*0.01; motion.ry = (r.beta||0)*0.01; motion.rz = (r.gamma||0)*0.01;
}
if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
  document.body.addEventListener('click', async () => {
    try { await DeviceMotionEvent.requestPermission(); } catch (e) { console.debug("lab f771-webcrypto-css3d-devicemotion-mlp-agents:", e); }
  }, {once:true});
}
addEventListener('devicemotion', onMotion);

// mouse proxy for desktop
let lastX=0, lastY=0;
addEventListener('pointermove', e => {
  motion.ax = (e.clientX - lastX)*0.05; motion.ay = (e.clientY - lastY)*0.05;
  lastX = e.clientX; lastY = e.clientY;
});

function spawn() {
  agents.forEach(a => a.el.remove());
  agents.length = 0;
  bestFitness = -Infinity;
  for (let i=0;i<N;i++) agents.push(new Agent(i));
}

async function seal() {
  if (!bestWeights) return;
  let signed = { weights: bestWeights, fitness: bestFitness, sig: null };
  if (cryptoKey) {
    try {
      const data = new TextEncoder().encode(serialize(bestWeights));
      const sig = await crypto.subtle.sign({name:'ECDSA', hash:'SHA-256'}, cryptoKey.privateKey, data);
      signed.sig = Array.from(new Uint8Array(sig));
      STATUS.textContent = 'Genome sealed & signed. Transferring…';
    } catch(e) { STATUS.textContent = 'Sign failed, unsigned seal.'; }
  }
  await saveGenome(signed);
  // transfer to others
  agents.forEach(a => a.adopt(bestWeights));
  STATUS.textContent = `Sealed fitness ${bestFitness.toFixed(0)}. Agents adopted (verified if signed).`;
}

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { spawn(); STATUS.textContent = 'Agents reset.'; };

async function init() {
  await initCrypto();
  const saved = await loadGenome();
  spawn();
  if (saved && saved.weights) {
    // optional verify
    let ok = true;
    if (saved.sig && cryptoKey) {
      try {
        const data = new TextEncoder().encode(serialize(saved.weights));
        const sig = new Uint8Array(saved.sig).buffer;
        ok = await crypto.subtle.verify({name:'ECDSA', hash:'SHA-256'}, cryptoKey.publicKey, sig, data);
      } catch(e) { ok = false; }
    }
    if (ok) {
      agents.forEach(a => a.adopt(saved.weights));
      STATUS.textContent = 'Restored signed genome from IndexedDB.';
    }
  }
  loop();
}

let last = performance.now();
function loop(now = performance.now()) {
  const dt = Math.min(0.05, (now - last)/1000);
  last = now;
  // background trail
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#4cc9f033';
  agents.forEach(a => ctx.fillRect(a.x+40, a.y+60, 4, 4));
  const inputsBase = [motion.ax, motion.ay, motion.az, motion.rx, motion.ry, motion.rz, 0, 0];
  agents.forEach(a => {
    const dist = Math.hypot(pointer.x - a.x, pointer.y - a.y) / Math.max(W,H);
    const inp = inputsBase.slice();
    inp[6] = dist;
    inp[7] = a.fitness * 0.01;
    a.update(inp, dt);
  });
  requestAnimationFrame(loop);
}

init();
