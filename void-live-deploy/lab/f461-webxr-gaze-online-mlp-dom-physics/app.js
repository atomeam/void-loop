const status = document.getElementById('status');
const field = document.getElementById('field');
let cards = [];
let mlp = null;
let running = true;
let lastGaze = { x: 0.5, y: 0.5, z: 0 };
let dwell = 0;
let xrSession = null;
let orient = { beta: 0, gamma: 0 };
const N = 8;
const CARD_W = 140, CARD_H = 90;

// Tiny online MLP: 6 → 12 → 3 (force xyz per card, but shared head for simplicity; we map per-card)
class TinyMLP {
  constructor() {
    this.w1 = Array.from({length: 12}, () => Array.from({length: 6}, () => (Math.random()-0.5)*0.4));
    this.b1 = Array(12).fill(0);
    this.w2 = Array.from({length: 3}, () => Array.from({length: 12}, () => (Math.random()-0.5)*0.3));
    this.b2 = Array(3).fill(0);
    this.lr = 0.008;
  }
  tanh(x) { return Math.tanh(x); }
  dtanh(y) { return 1 - y*y; }
  forward(x) { // x: [gazeX, gazeY, gazeZ, orientBeta, orientGamma, dwell]
    const h = this.w1.map((row, i) => this.tanh(row.reduce((s, w, j) => s + w * x[j], this.b1[i])));
    const out = this.w2.map((row, i) => row.reduce((s, w, j) => s + w * h[j], this.b2[i]));
    return { h, out };
  }
  update(x, targetForce) { // simple online: pull output toward target (reward signal)
    const { h, out } = this.forward(x);
    const err = out.map((o, i) => targetForce[i] - o);
    // update w2
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 12; j++) this.w2[i][j] += this.lr * err[i] * h[j];
      this.b2[i] += this.lr * err[i];
    }
    // update w1 (backprop-ish)
    const dh = Array(12).fill(0);
    for (let j = 0; j < 12; j++) {
      for (let i = 0; i < 3; i++) dh[j] += err[i] * this.w2[i][j];
      dh[j] *= this.dtanh(h[j]);
    }
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 6; j++) this.w1[i][j] += this.lr * dh[i] * x[j];
      this.b1[i] += this.lr * dh[i];
    }
  }
  serialize() {
    return JSON.stringify({ w1: this.w1, b1: this.b1, w2: this.w2, b2: this.b2 });
  }
  load(json) {
    const o = JSON.parse(json);
    this.w1 = o.w1; this.b1 = o.b1; this.w2 = o.w2; this.b2 = o.b2;
  }
}

mlp = new TinyMLP();

function createCards() {
  field.innerHTML = '';
  cards = [];
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `<h4>Card ${i+1}</h4><div class="meta">idle</div>`;
    el.dataset.i = i;
    field.appendChild(el);
    const c = {
      el,
      x: Math.random() * (window.innerWidth - CARD_W),
      y: Math.random() * (window.innerHeight - CARD_H),
      vx: 0, vy: 0,
      ax: 0, ay: 0,
      mass: 1
    };
    cards.push(c);
    el.style.left = c.x + 'px';
    el.style.top = c.y + 'px';
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); rewardCard(i); });
  }
}

function rewardCard(i) {
  const c = cards[i];
  if (!c) return;
  // Reward signal: attract toward current gaze projection
  const gx = lastGaze.x * window.innerWidth;
  const gy = lastGaze.y * window.innerHeight;
  const tx = (gx - c.x) * 0.05;
  const ty = (gy - c.y) * 0.05;
  const input = [lastGaze.x, lastGaze.y, lastGaze.z, orient.beta/90, orient.gamma/90, Math.min(dwell, 1)];
  mlp.update(input, [tx, ty, 0]);
  c.el.querySelector('.meta').textContent = 'rewarded';
  status.textContent = `Rewarded card ${i+1} · MLP updated · dwell ${dwell.toFixed(2)}`;
  setTimeout(() => { if (c.el) c.el.querySelector('.meta').textContent = 'idle'; }, 800);
}

function step() {
  if (!running) return;
  const input = [lastGaze.x, lastGaze.y, lastGaze.z || 0, orient.beta/90 || 0, orient.gamma/90 || 0, Math.min(dwell, 1)];
  const { out } = mlp.forward(input);
  const forceScale = 80;

  cards.forEach((c, i) => {
    // MLP outputs shared force; modulate slightly per card by index for variety
    const fx = out[0] * forceScale * (0.7 + 0.3 * Math.sin(i));
    const fy = out[1] * forceScale * (0.7 + 0.3 * Math.cos(i));
    // gravity from orientation
    const gx = (orient.gamma || 0) * 0.4;
    const gy = (orient.beta || 0) * 0.4;
    c.ax = (fx + gx) / c.mass;
    c.ay = (fy + gy) / c.mass;
    c.vx = (c.vx + c.ax * 0.016) * 0.92;
    c.vy = (c.vy + c.ay * 0.016) * 0.92;
    c.x += c.vx;
    c.y += c.vy;
    // bounds
    c.x = Math.max(0, Math.min(window.innerWidth - CARD_W, c.x));
    c.y = Math.max(0, Math.min(window.innerHeight - CARD_H, c.y));
    c.el.style.left = c.x + 'px';
    c.el.style.top = c.y + 'px';
    // focus highlight if near gaze
    const dx = (c.x + CARD_W/2) / window.innerWidth - lastGaze.x;
    const dy = (c.y + CARD_H/2) / window.innerHeight - lastGaze.y;
    const dist = Math.hypot(dx, dy);
    c.el.classList.toggle('focused', dist < 0.18);
    if (dist < 0.12) dwell = Math.min(1, dwell + 0.008); else dwell *= 0.98;
  });
  requestAnimationFrame(step);
}

// Pointer as gaze proxy
window.addEventListener('pointermove', (e) => {
  lastGaze.x = e.clientX / window.innerWidth;
  lastGaze.y = e.clientY / window.innerHeight;
  lastGaze.z = 0;
});

// DeviceOrientation as causal input
window.addEventListener('deviceorientation', (e) => {
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
});

// WebXR gaze (head orientation as gaze direction)
document.getElementById('xr-btn').addEventListener('click', async () => {
  if (!navigator.xr) { status.textContent = 'WebXR not available · using proxy'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    status.textContent = 'WebXR session active · head gaze driving MLP';
    const gl = document.createElement('canvas').getContext('webgl2');
    const layer = new XRWebGLLayer(xrSession, gl);
    xrSession.updateRenderState({ baseLayer: layer });
    const ref = await xrSession.requestReferenceSpace('local');
    xrSession.requestAnimationFrame(function onFrame(t, frame) {
      const pose = frame.getViewerPose(ref);
      if (pose) {
        const dir = pose.transform.orientation; // quaternion
        // simple projection of forward as gaze
        lastGaze.x = 0.5 + Math.sin(dir.y) * 0.4;
        lastGaze.y = 0.5 + Math.sin(dir.x) * 0.3;
        lastGaze.z = Math.cos(dir.z || 0);
      }
      if (xrSession) xrSession.requestAnimationFrame(onFrame);
    });
    xrSession.addEventListener('end', () => { xrSession = null; status.textContent = 'WebXR ended · proxy active'; });
  } catch (err) {
    status.textContent = 'WebXR failed · pointer/orientation proxy';
  }
});

document.getElementById('seal-btn').addEventListener('click', async () => {
  const data = mlp.serialize();
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data)).then(b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join('').slice(0,16));
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f461', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('weights');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('weights', 'readwrite');
    tx.objectStore('weights').put({ data, hash, ts: Date.now() }, 'mlp');
    status.textContent = `Sealed MLP · id ${hash}`;
  } catch (e) {
    status.textContent = 'Seal failed (IDB) · hash ' + hash;
  }
});

document.getElementById('reset-btn').addEventListener('click', () => {
  createCards();
  dwell = 0;
  status.textContent = 'Cards reset · MLP weights kept';
});

document.getElementById('reward-btn').addEventListener('click', () => {
  if (cards.length) rewardCard(Math.floor(Math.random() * cards.length));
});

// init
createCards();
requestAnimationFrame(step);

// load prior seal if any
(async () => {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f461', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('weights', 'readonly');
    const req = tx.objectStore('weights').get('mlp');
    req.onsuccess = () => {
      if (req.result) {
        mlp.load(req.result.data);
        status.textContent = `Loaded sealed MLP · ${req.result.hash}`;
      }
    };
  } catch (e) {}
})();
