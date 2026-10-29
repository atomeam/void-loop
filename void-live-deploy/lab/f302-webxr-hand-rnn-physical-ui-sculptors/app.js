const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const uiLayer = document.getElementById('ui-layer');
const statusEl = document.getElementById('status');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

// Tiny RNN (Elman-style, 8 hidden units)
class TinyRNN {
  constructor(inputSize = 6, hidden = 8, output = 2) {
    this.h = new Float32Array(hidden);
    this.Wxh = Array.from({length: hidden}, () => Array.from({length: inputSize}, () => (Math.random()-0.5)*0.3));
    this.Whh = Array.from({length: hidden}, () => Array.from({length: hidden}, () => (Math.random()-0.5)*0.2));
    this.Why = Array.from({length: output}, () => Array.from({length: hidden}, () => (Math.random()-0.5)*0.4));
    this.bh = new Float32Array(hidden);
    this.by = new Float32Array(output);
  }
  step(x) {
    const newH = new Float32Array(this.h.length);
    for (let i = 0; i < this.h.length; i++) {
      let s = this.bh[i];
      for (let j = 0; j < x.length; j++) s += this.Wxh[i][j] * x[j];
      for (let j = 0; j < this.h.length; j++) s += this.Whh[i][j] * this.h[j];
      newH[i] = Math.tanh(s);
    }
    this.h = newH;
    const out = [];
    for (let i = 0; i < this.Why.length; i++) {
      let s = this.by[i];
      for (let j = 0; j < this.h.length; j++) s += this.Why[i][j] * this.h[j];
      out.push(Math.tanh(s));
    }
    return out;
  }
  serialize() { return {h: Array.from(this.h), Wxh: this.Wxh, Whh: this.Whh, Why: this.Why, bh: Array.from(this.bh), by: Array.from(this.by)}; }
  static from(data) {
    const r = new TinyRNN();
    r.h = Float32Array.from(data.h);
    r.Wxh = data.Wxh; r.Whh = data.Whh; r.Why = data.Why;
    r.bh = Float32Array.from(data.bh); r.by = Float32Array.from(data.by);
    return r;
  }
}

// Cards: hybrid DOM + canvas physics (spring to target)
class SculptorCard {
  constructor(id, x, y, owner = 'neutral') {
    this.id = id; this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.tx = x; this.ty = y; this.owner = owner; this.claimed = false;
    this.el = document.createElement('div');
    this.el.className = 'sculptor-card';
    this.el.innerHTML = `<strong>${id}</strong><br>owner: ${owner}<br>force: 0`;
    this.el.style.left = x + 'px'; this.el.style.top = y + 'px';
    uiLayer.appendChild(this.el);
    this.el.addEventListener('pointerdown', e => { this.dragging = true; e.stopPropagation(); });
  }
  update(dt) {
    if (this.dragging) return;
    const k = 0.08, damp = 0.85;
    const ax = (this.tx - this.x) * k - this.vx * (1-damp);
    const ay = (this.ty - this.y) * k - this.vy * (1-damp);
    this.vx += ax; this.vy += ay;
    this.x += this.vx; this.y += this.vy;
    this.x = Math.max(20, Math.min(innerWidth-160, this.x));
    this.y = Math.max(20, Math.min(innerHeight-110, this.y));
    this.el.style.transform = `translate(${this.x}px, ${this.y}px)`;
    this.el.className = 'sculptor-card' + (this.owner === 'human' ? ' human' : this.claimed ? ' claimed' : '');
    this.el.querySelector('br + br')?.remove(); // simple
  }
  setTarget(tx, ty, force = 0) { this.tx = tx; this.ty = ty; }
}

let cards = [];
for (let i = 0; i < 5; i++) {
  cards.push(new SculptorCard('C'+i, 200 + i*120, 200 + (i%2)*80));
}

const humanRNN = new TinyRNN();
const agentRNNs = [new TinyRNN(), new TinyRNN()];
let xrSession = null, handJoints = null;
let lastTime = performance.now();
let competing = false;
let scores = {human: 0, a0: 0, a1: 0};

// IndexedDB persistence
const dbName = 'f302-sculptors';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes', {keyPath: 'id'});
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function sealGenome() {
  const db = await openDB();
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({id: 'human', data: humanRNN.serialize(), ts: Date.now()});
  statusEl.textContent = 'Genome sealed to IndexedDB';
}
async function loadGenome() {
  try {
    const db = await openDB();
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('human');
    req.onsuccess = () => { if (req.result) { /* apply if wanted */ statusEl.textContent = 'Prior genome found'; } };
  } catch(e) {}
}
loadGenome();

document.getElementById('seal').onclick = sealGenome;
document.getElementById('compete').onclick = () => { competing = !competing; statusEl.textContent = competing ? 'Competition active' : 'Competition paused'; };

async function enterXR() {
  if (!navigator.xr) { statusEl.textContent = 'WebXR not available — using pointer'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', {optionalFeatures: ['hand-tracking']});
    statusEl.textContent = 'WebXR Hand session active';
    // Simplified: in real XR we'd poll joints; here we simulate fallback
  } catch(e) { statusEl.textContent = 'XR failed: ' + e.message + ' — pointer mode'; }
}
document.getElementById('enter-xr').onclick = enterXR;

// Pointer as hand fallback
let pointer = {x: innerWidth/2, y: innerHeight/2};
addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });

function getHandInput() {
  // 6D: relative x/y, velocity-ish, pinch proxy
  return [
    (pointer.x / innerWidth - 0.5) * 2,
    (pointer.y / innerHeight - 0.5) * 2,
    (pointer.x - (cards[0]?.x || 0)) / 200,
    (pointer.y - (cards[0]?.y || 0)) / 200,
    Math.sin(performance.now()/400),
    competing ? 1 : 0
  ];
}

function loop(now) {
  const dt = Math.min(32, now - lastTime); lastTime = now;
  ctx.fillStyle = '#0a0a12'; ctx.fillRect(0,0,canvas.width,canvas.height);
  // faint trails
  ctx.strokeStyle = 'rgba(80,120,200,0.3)';
  cards.forEach(c => { ctx.beginPath(); ctx.arc(c.x+70, c.y+45, 40, 0, Math.PI*2); ctx.stroke(); });

  const inp = getHandInput();
  const humanOut = humanRNN.step(inp);
  // Drive first two cards with human RNN
  if (cards[0]) cards[0].setTarget(pointer.x + humanOut[0]*80, pointer.y + humanOut[1]*60);
  if (cards[1]) cards[1].setTarget(pointer.x + humanOut[1]*60, pointer.y + humanOut[0]*80);

  // Agent competition
  if (competing) {
    agentRNNs.forEach((rnn, ai) => {
      const aout = rnn.step([Math.sin(now/300+ai), Math.cos(now/280), inp[0], inp[1], scores['a'+ai]/10, 1]);
      const targetCard = cards[(ai+2) % cards.length];
      if (targetCard) targetCard.setTarget(innerWidth/2 + aout[0]*200, innerHeight/2 + aout[1]*150);
      // Claim if close to pointer
      cards.forEach(c => {
        const d = Math.hypot(c.x - pointer.x, c.y - pointer.y);
        if (d < 80 && Math.random() < 0.02) { c.owner = 'human'; scores.human++; c.claimed = true; }
      });
    });
  }

  cards.forEach(c => c.update(dt/16));
  statusEl.textContent = `Human ${scores.human} | Agents ${scores.a0}/${scores.a1} | RNN h[0]=${humanRNN.h[0].toFixed(2)}`;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Offline note
if (!navigator.onLine) statusEl.textContent += ' (offline ok)';
