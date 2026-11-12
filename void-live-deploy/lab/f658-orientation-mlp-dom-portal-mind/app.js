const N_PORTALS = 8;
const HIST = 4;
const IN = HIST * 3;
const HID = 16;
const OUT = N_PORTALS * 4; // x, y, scale, hue
const portalsEl = document.getElementById('portals');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const portals = [];
let weights = null; // {w1: Float32Array IN*HID, b1: HID, w2: HID*OUT, b2: OUT}
let fitness = 0;
let history = []; // circular buffer of [beta, gamma, alphaRate]
let lastAlpha = 0;
let orient = { beta: 0, gamma: 0, alpha: 0 };
let hasOrient = false;
let db = null;
let bc = null;
let frame = 0;

function randn() { return (Math.random() * 2 - 1) * 0.3; }
function initWeights() {
  weights = {
    w1: new Float32Array(IN * HID).map(randn),
    b1: new Float32Array(HID).map(randn),
    w2: new Float32Array(HID * OUT).map(randn),
    b2: new Float32Array(OUT).map(randn)
  };
}
function sigmoid(x) { return 1 / (1 + Math.exp(-Math.max(-10, Math.min(10, x)))); }
function tanh(x) { return Math.tanh(Math.max(-5, Math.min(5, x))); }

function forward(input) {
  // input: Float32Array IN
  const h = new Float32Array(HID);
  for (let j = 0; j < HID; j++) {
    let s = weights.b1[j];
    for (let i = 0; i < IN; i++) s += input[i] * weights.w1[i * HID + j];
    h[j] = tanh(s);
  }
  const o = new Float32Array(OUT);
  for (let k = 0; k < OUT; k++) {
    let s = weights.b2[k];
    for (let j = 0; j < HID; j++) s += h[j] * weights.w2[j * OUT + k];
    o[k] = tanh(s);
  }
  return { h, o };
}

function rewardUpdate(reward, h, o) {
  // Simple reward-modulated Hebbian: Δw ~ reward * pre * post
  const lr = 0.01 * reward;
  for (let j = 0; j < HID; j++) {
    for (let i = 0; i < IN; i++) {
      // approximate pre from last input, but we don't store; use small random for demo stability
      weights.w1[i * HID + j] += lr * h[j] * 0.1;
    }
    weights.b1[j] += lr * h[j] * 0.05;
  }
  for (let k = 0; k < OUT; k++) {
    for (let j = 0; j < HID; j++) {
      weights.w2[j * OUT + k] += lr * h[j] * o[k];
    }
    weights.b2[k] += lr * o[k] * 0.05;
  }
  // soft clamp
  for (let arr of [weights.w1, weights.b1, weights.w2, weights.b2]) {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.max(-2, Math.min(2, arr[i]));
  }
}

function createPortals() {
  for (let i = 0; i < N_PORTALS; i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = `Portal ${i + 1}`;
    el.dataset.i = i;
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const reward = 1.0;
      fitness += reward;
      // re-forward for current hidden
      const inp = getInput();
      const { h, o } = forward(inp);
      rewardUpdate(reward, h, o);
      log('Reward +1 on portal ' + (i + 1) + ' · fitness ' + fitness.toFixed(1));
      if (fitness > 5 && bc) sealAndBroadcast();
    });
    portalsEl.appendChild(el);
    portals.push(el);
  }
}

function getInput() {
  const inp = new Float32Array(IN);
  const buf = history.slice(-HIST);
  while (buf.length < HIST) buf.unshift([0, 0, 0]);
  for (let t = 0; t < HIST; t++) {
    const [b, g, a] = buf[t] || [0, 0, 0];
    inp[t * 3] = b / 90;
    inp[t * 3 + 1] = g / 90;
    inp[t * 3 + 2] = a;
  }
  return inp;
}

function applyOutputs(o) {
  const W = window.innerWidth, H = window.innerHeight;
  for (let i = 0; i < N_PORTALS; i++) {
    const base = i * 4;
    const x = (o[base] * 0.5 + 0.5) * (W - 140);
    const y = (o[base + 1] * 0.5 + 0.5) * (H - 100);
    const sc = 0.7 + (o[base + 2] * 0.5 + 0.5) * 0.6;
    const hue = (o[base + 3] * 0.5 + 0.5) * 360;
    const el = portals[i];
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.transform = `scale(${sc})`;
    el.style.background = `hsla(${hue}, 70%, 45%, 0.85)`;
    el.style.color = hue > 180 ? '#fff' : '#111';
  }
}

function loop() {
  frame++;
  if (hasOrient) {
    const rate = (orient.alpha - lastAlpha) * 0.01;
    lastAlpha = orient.alpha;
    history.push([orient.beta, orient.gamma, rate]);
    if (history.length > 20) history.shift();
  } else {
    // pointer proxy: mild motion
    history.push([Math.sin(frame * 0.02) * 20, Math.cos(frame * 0.03) * 15, 0]);
    if (history.length > 20) history.shift();
  }
  const inp = getInput();
  const { o } = forward(inp);
  applyOutputs(o);
  requestAnimationFrame(loop);
}

function log(msg) {
  logEl.textContent = msg;
  setTimeout(() => { if (logEl.textContent === msg) logEl.textContent = ''; }, 3000);
}

async function openDB() {
  return new Promise((res) => {
    const req = indexedDB.open('verse-f658', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('models');
    req.onsuccess = () => res(req.result);
    req.onerror = () => res(null);
  });
}

async function loadBest() {
  if (!db) return;
  return new Promise((res) => {
    const tx = db.transaction('models', 'readonly');
    const req = tx.objectStore('models').get('best');
    req.onsuccess = () => res(req.result);
    req.onerror = () => res(null);
  });
}

async function saveBest() {
  if (!db || !weights) return;
  const data = { weights: {
    w1: Array.from(weights.w1), b1: Array.from(weights.b1),
    w2: Array.from(weights.w2), b2: Array.from(weights.b2)
  }, fitness, timestamp: Date.now() };
  const tx = db.transaction('models', 'readwrite');
  tx.objectStore('models').put(data, 'best');
}

async function sealAndBroadcast() {
  await saveBest();
  if (bc) {
    const seal = { type: 'seal', fitness, hash: btoa(String(fitness).slice(0, 8)), weightsSummary: weights.w1.slice(0, 4) };
    bc.postMessage(seal);
    log('Sealed & broadcast fitness ' + fitness.toFixed(1));
  }
}

function downloadJSON() {
  if (!weights) return;
  const data = {
    weights: { w1: Array.from(weights.w1), b1: Array.from(weights.b1), w2: Array.from(weights.w2), b2: Array.from(weights.b2) },
    fitness, timestamp: Date.now(), portals: N_PORTALS
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'f658-portal-mind.json';
  a.click();
  log('Downloaded seal JSON');
}

function setupBC() {
  try {
    bc = new BroadcastChannel('verse-f658-portals');
    bc.onmessage = (ev) => {
      const m = ev.data;
      if (m && m.type === 'seal' && m.fitness > fitness + 1) {
        log('Peer seal better (' + m.fitness.toFixed(1) + ') — adopting cue');
        // In full version would transfer weights; here cue only for safety
        fitness = m.fitness * 0.8;
      }
    };
  } catch (e) { bc = null; }
}

async function init() {
  initWeights();
  createPortals();
  db = await openDB();
  const saved = await loadBest();
  if (saved && saved.weights) {
    weights.w1 = new Float32Array(saved.weights.w1);
    weights.b1 = new Float32Array(saved.weights.b1);
    weights.w2 = new Float32Array(saved.weights.w2);
    weights.b2 = new Float32Array(saved.weights.b2);
    fitness = saved.fitness || 0;
    log('Restored best from IndexedDB');
  }
  setupBC();
  window.addEventListener('deviceorientation', (e) => {
    if (e.beta != null) {
      hasOrient = true;
      orient.beta = e.beta;
      orient.gamma = e.gamma;
      orient.alpha = e.alpha;
      statusEl.textContent = `tilt β${orient.beta.toFixed(0)} γ${orient.gamma.toFixed(0)} · fitness ${fitness.toFixed(1)}`;
    }
  });
  document.getElementById('perm').onclick = async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const p = await DeviceOrientationEvent.requestPermission();
      if (p === 'granted') log('Tilt enabled');
    } else {
      log('Tilt available (or use mouse proxy)');
    }
  };
  document.getElementById('seal').onclick = () => { saveBest(); downloadJSON(); };
  document.getElementById('reset').onclick = () => { initWeights(); fitness = 0; log('Mind reset'); };
  loop();
  statusEl.textContent = 'F658 ready — enable tilt or use proxy motion';
}
init();
