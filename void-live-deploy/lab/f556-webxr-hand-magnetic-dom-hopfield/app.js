const N = 48;
const CARDS = 8;
const PATTERNS = 6;
let weights = new Float32Array(N * N);
let patterns = [];
let cards = [];
let pointer = {x: innerWidth/2, y: innerHeight/2};
let orient = {beta:0, gamma:0};
let recallEnergy = 0;
let xrSession = null;
const status = document.getElementById('status');
const handEl = document.getElementById('hand');
const stage = document.getElementById('stage');

function randBit() { return Math.random() > 0.5 ? 1 : -1; }
function initHopfield() {
  for (let i = 0; i < N*N; i++) weights[i] = (Math.random()-0.5)*0.1;
  for (let i = 0; i < N; i++) weights[i*N+i] = 0;
  patterns = [];
  for (let p = 0; p < 2; p++) imprint(Array.from({length:N}, randBit));
}
function imprint(bits) {
  if (patterns.length >= PATTERNS) patterns.shift();
  patterns.push(bits.slice());
  for (let i = 0; i < N; i++) for (let j = i+1; j < N; j++) {
    const d = bits[i] * bits[j] * 0.05;
    weights[i*N+j] += d; weights[j*N+i] += d;
  }
}
function recall() {
  let state = Array.from({length:N}, () => Math.random()>0.5?1:-1);
  for (let step = 0; step < 8; step++) {
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let j = 0; j < N; j++) s += weights[i*N+j] * state[j];
      state[i] = s >= 0 ? 1 : -1;
    }
  }
  let energy = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) energy -= 0.5 * weights[i*N+j] * state[i] * state[j];
  recallEnergy = energy;
  return state;
}
function poseBits() {
  const bits = [];
  const px = pointer.x / innerWidth;
  const py = pointer.y / innerHeight;
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2;
    const v = Math.sin(px * 6 + ang) * Math.cos(py * 4 + orient.beta * 0.02 + ang*0.3);
    bits.push(v > 0 ? 1 : -1);
  }
  return bits;
}

function spawnCards() {
  cards.forEach(c => c.el.remove());
  cards = [];
  for (let i = 0; i < CARDS; i++) {
    const el = document.createElement('div');
    el.className = 'card';
    el.textContent = 'C' + i;
    el.style.left = (100 + Math.random()*(innerWidth-200)) + 'px';
    el.style.top = (100 + Math.random()*(innerHeight-200)) + 'px';
    el.dataset.charge = Math.random() > 0.5 ? '1' : '-1';
    el.classList.add(el.dataset.charge === '1' ? 'positive' : 'negative');
    el.addEventListener('dblclick', () => sealCard(i));
    stage.appendChild(el);
    cards.push({el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx:0, vy:0, charge: parseFloat(el.dataset.charge), genome: null});
  }
}
function sealCard(idx) {
  const slice = Array.from(weights.slice(0, 16));
  const hash = slice.reduce((a,b)=>a+b,0).toFixed(3);
  cards[idx].genome = {slice, hash, t: Date.now()};
  cards[idx].el.style.transform = 'scale(1.15)';
  cards[idx].el.textContent = 'S' + hash.slice(-3);
  setTimeout(() => cards[idx].el.style.transform = '', 200);
  try { new BroadcastChannel('f556-seal').postMessage({idx, hash}); } catch(e) {}
  status.textContent = `Sealed fragment ${hash} into card ${idx}`;
}

function loop() {
  const bits = poseBits();
  if (Math.random() < 0.02) imprint(bits);
  const recalled = recall();
  const polarity = recalled.filter(b=>b>0).length / N - 0.5;

  const hx = pointer.x, hy = pointer.y;
  handEl.style.left = (hx-12) + 'px';
  handEl.style.top = (hy-12) + 'px';

  cards.forEach(c => {
    const dx = hx - c.x, dy = hy - c.y;
    const dist2 = dx*dx + dy*dy + 400;
    const force = (c.charge * polarity * 8000) / dist2;
    c.vx += force * dx / Math.sqrt(dist2);
    c.vy += force * dy / Math.sqrt(dist2);
    c.vx *= 0.92; c.vy *= 0.92;
    c.x += c.vx; c.y += c.vy;
    c.x = Math.max(20, Math.min(innerWidth-90, c.x));
    c.y = Math.max(20, Math.min(innerHeight-90, c.y));
    c.el.style.left = c.x + 'px';
    c.el.style.top = c.y + 'px';
  });
  requestAnimationFrame(loop);
}

stage.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
window.addEventListener('deviceorientation', e => { orient.beta = e.beta||0; orient.gamma = e.gamma||0; });
document.getElementById('seal').onclick = async () => {
  const db = await idb();
  const tx = db.transaction('mem','readwrite');
  tx.objectStore('mem').put({id:'main', weights: Array.from(weights), patterns, cards: cards.map(c=>({x:c.x,y:c.y,charge:c.charge,genome:c.genome}))});
  status.textContent = 'Sealed to IndexedDB';
};
document.getElementById('reset').onclick = () => { initHopfield(); spawnCards(); status.textContent = 'Reset'; };
document.getElementById('enterXR').onclick = async () => {
  if (!navigator.xr) { status.textContent = 'WebXR not available · using fallback'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', {optionalFeatures:['hand-tracking']});
    status.textContent = 'XR session started (hand tracking if supported)';
    xrSession.addEventListener('end', () => { xrSession = null; status.textContent = 'XR ended · fallback'; });
  } catch(e) { status.textContent = 'XR failed: ' + e.message; }
};

function idb() {
  return new Promise((res,rej) => {
    const r = indexedDB.open('f556-hopfield-dom',1);
    r.onupgradeneeded = () => r.result.createObjectStore('mem',{keyPath:'id'});
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function load() {
  try {
    const db = await idb();
    const tx = db.transaction('mem');
    const req = tx.objectStore('mem').get('main');
    req.onsuccess = () => {
      if (req.result) {
        weights = new Float32Array(req.result.weights);
        patterns = req.result.patterns || [];
        status.textContent = 'Restored sealed memory';
      }
    };
  } catch(e) {}
  initHopfield();
  spawnCards();
  loop();
}
load();
