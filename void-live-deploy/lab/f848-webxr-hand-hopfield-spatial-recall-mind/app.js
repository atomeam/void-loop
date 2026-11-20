const N = 16;
const stage = document.getElementById('stage');
const status = document.getElementById('status');
const portals = [];
for (let i = 0; i < N; i++) {
  const p = document.createElement('div');
  p.className = 'portal';
  p.textContent = i;
  stage.appendChild(p);
  portals.push(p);
}

let W = Array.from({length:N}, () => Array(N).fill(0));
let state = Array(N).fill(1);
let stored = 0;
let energy = 0;
let xrSession = null;
let handJoints = null;
let ptr = {x:0.5, y:0.5};
let orient = {a:0, b:0};

function bipolar(v) { return v > 0 ? 1 : -1; }

function makePattern() {
  const p = Array(N);
  if (handJoints && handJoints.length) {
    for (let i = 0; i < N; i++) {
      const j = handJoints[i % handJoints.length];
      p[i] = bipolar((j.x || 0) + (j.y || 0) * 0.7 + (j.z || 0) * 0.3);
    }
  } else {
    for (let i = 0; i < N; i++) {
      const bit = Math.sin(orient.a * 3 + i) + Math.cos(orient.b * 2 + i * 0.5) + (ptr.x - 0.5) * 2 + (ptr.y - 0.5) * 1.5;
      p[i] = bipolar(bit + (Math.random()-0.5)*0.2);
    }
  }
  return p;
}

function hopfieldUpdate(steps = 3) {
  for (let s = 0; s < steps; s++) {
    const i = Math.floor(Math.random() * N);
    let h = 0;
    for (let j = 0; j < N; j++) h += W[i][j] * state[j];
    state[i] = bipolar(h);
  }
  energy = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) energy -= W[i][j] * state[i] * state[j];
  energy /= 2;
}

function storePattern() {
  const p = makePattern();
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (i !== j) W[i][j] += p[i] * p[j];
  }
  stored++;
  state = p.slice();
}

function applyState() {
  const cols = 4;
  portals.forEach((p, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const baseX = 80 + col * 90, baseY = 80 + row * 90;
    const s = state[i];
    const sc = 0.7 + (s > 0 ? 0.6 : 0.2);
    const hue = s > 0 ? 180 + i*8 : 280 + i*6;
    p.style.transform = `translate(${baseX + s*15}px, ${baseY + s*10}px) scale(${sc})`;
    p.style.background = `hsl(${hue},70%,${s>0?40:25}%)`;
    p.style.boxShadow = s > 0 ? '0 0 18px #0ff' : '0 0 6px #f0f';
  });
}

async function tryXR() {
  if (!navigator.xr) return;
  try {
    const ok = await navigator.xr.isSessionSupported('immersive-vr');
    if (!ok) return;
    status.textContent += ' | XR available';
  } catch (e) { console.debug("lab f848-webxr-hand-hopfield-spatial-recall-mind:", e); }
}

function updateStatus() {
  status.textContent = `F848 Hopfield | patterns:${stored} | energy:${energy.toFixed(1)} | XR:${xrSession?'active':'none'} | hand:${handJoints?'yes':'no'}`;
}

stage.addEventListener('pointermove', e => {
  ptr.x = e.clientX / innerWidth;
  ptr.y = e.clientY / innerHeight;
});
stage.addEventListener('click', storePattern);

if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    orient.a = (e.alpha || 0) * Math.PI / 180;
    orient.b = (e.beta || 0) * Math.PI / 180;
  });
}

async function enterXR() {
  if (!navigator.xr) return alert('No WebXR');
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', {optionalFeatures:['hand-tracking']});
    status.textContent += ' XR started';
  } catch(e) { console.warn(e); }
}

const btn = document.createElement('button');
btn.textContent = 'Enter WebXR (if available)';
btn.style.position = 'absolute';
btn.style.bottom = '8px';
btn.style.left = '8px';
btn.onclick = enterXR;
document.body.appendChild(btn);

const bc = new BroadcastChannel('f848-genome');
bc.onmessage = e => {
  if (e.data && e.data.W && e.data.stored > stored) {
    W = e.data.W;
    stored = e.data.stored;
  }
};
function seal() {
  const data = {W, stored, energy};
  try {
    const req = indexedDB.open('f848-hopfield', 1);
    req.onsuccess = ev => {
      const db = ev.target.result;
      const tx = db.transaction('g', 'readwrite');
      tx.objectStore('g').put(data, 1);
    };
    req.onupgradeneeded = ev => ev.target.result.createObjectStore('g');
  } catch (e) { console.debug("lab f848-webxr-hand-hopfield-spatial-recall-mind:", e); }
  bc.postMessage(data);
}
setInterval(seal, 8000);

function loop() {
  state = makePattern().map((v,i) => Math.random() < 0.15 ? v : state[i]);
  hopfieldUpdate(2);
  applyState();
  updateStatus();
  requestAnimationFrame(loop);
}
tryXR();
loop();
