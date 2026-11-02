const N = 24; // reservoir size
const CRYSTALS = 7;
const BINS = 8;
let h = new Float32Array(N);
let W_res = new Float32Array(N * N);
let W_in = new Float32Array(N * (BINS + 1));
let crystals = [];
let pointer = { x: 0.5, y: 0.5 };
let audioCtx, analyser, dataArray, micStream;
let db;

function randn() { return (Math.random() + Math.random() + Math.random() - 1.5) * 2; }
function initWeights() {
  for (let i = 0; i < N * N; i++) W_res[i] = randn() * 0.15;
  // spectral radius scale approx
  for (let i = 0; i < N; i++) W_res[i * N + i] *= 0.3;
  for (let i = 0; i < N * (BINS + 1); i++) W_in[i] = randn() * 0.4;
}

function reservoirStep(x) {
  const newH = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let j = 0; j < N; j++) s += W_res[i * N + j] * h[j];
    for (let k = 0; k < BINS; k++) s += W_in[i * (BINS + 1) + k] * x[k];
    s += W_in[i * (BINS + 1) + BINS] * 0.1; // bias
    newH[i] = Math.tanh(s);
  }
  h = newH;
}

function createCrystals() {
  const scene = document.getElementById('scene');
  scene.innerHTML = '';
  crystals = [];
  for (let i = 0; i < CRYSTALS; i++) {
    const el = document.createElement('div');
    el.className = 'crystal';
    el.textContent = i + 1;
    el.style.setProperty('--hue', 180 + i * 30);
    el.style.setProperty('--glow', 1);
    el.style.setProperty('--scale', 1);
    el.onclick = () => sealCrystal(i);
    scene.appendChild(el);
    crystals.push({
      el,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      z: (Math.random() - 0.5) * 200,
      vx: 0, vy: 0, vz: 0,
      slice: i * 3 % N
    });
  }
}

function updatePhysics() {
  const energy = h.reduce((a, b) => a + b * b, 0) / N;
  crystals.forEach((c, i) => {
    const sx = h[c.slice] || 0;
    const sy = h[(c.slice + 1) % N] || 0;
    const sz = h[(c.slice + 2) % N] || 0;
    // pointer bias
    const px = pointer.x * window.innerWidth;
    const py = pointer.y * window.innerHeight;
    c.vx += (px - c.x) * 0.0008 + sx * 0.4;
    c.vy += (py - c.y) * 0.0008 + sy * 0.4;
    c.vz += sz * 0.3;
    // similarity forces
    crystals.forEach((o, j) => {
      if (i === j) return;
      const dx = o.x - c.x, dy = o.y - c.y;
      const dist = Math.hypot(dx, dy) + 1;
      const sim = (h[c.slice] * h[o.slice] + h[(c.slice+1)%N] * h[(o.slice+1)%N]) * 0.5;
      const f = sim > 0.3 ? 0.15 : -0.08;
      c.vx += (dx / dist) * f;
      c.vy += (dy / dist) * f;
    });
    c.vx *= 0.96; c.vy *= 0.96; c.vz *= 0.96;
    c.x += c.vx; c.y += c.vy; c.z += c.vz;
    // bounds
    if (c.x < 20 || c.x > window.innerWidth - 20) c.vx *= -0.5;
    if (c.y < 20 || c.y > window.innerHeight - 20) c.vy *= -0.5;
    c.x = Math.max(20, Math.min(window.innerWidth - 20, c.x));
    c.y = Math.max(20, Math.min(window.innerHeight - 20, c.y));
    const hue = (180 + sx * 120 + i * 20) % 360;
    const scale = 0.8 + Math.abs(sy) * 0.6 + energy * 0.4;
    const glow = 0.5 + energy * 2;
    c.el.style.transform = `translate3d(${c.x - 24}px, ${c.y - 24}px, ${c.z}px) rotateX(${sz * 40}deg) rotateY(${sx * 40}deg) scale(${scale})`;
    c.el.style.setProperty('--hue', hue);
    c.el.style.setProperty('--glow', glow);
  });
}

async function startMic() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    src.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    document.getElementById('status').textContent = 'Mic active. Speak or make sound.';
  } catch (e) {
    document.getElementById('status').textContent = 'Mic denied. Pointer + noise only.';
  }
}

function getSpectral() {
  const x = new Float32Array(BINS);
  if (analyser) {
    analyser.getByteFrequencyData(dataArray);
    for (let i = 0; i < BINS; i++) {
      x[i] = Math.log1p(dataArray[i * 2] || 0) / 6 - 0.5;
    }
  } else {
    for (let i = 0; i < BINS; i++) x[i] = (Math.random() - 0.5) * 0.2;
  }
  return x;
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sealCrystal(idx) {
  const state = Array.from(h).map(v => v.toFixed(3)).join(',');
  const hash = await sha256(state + Date.now());
  const tx = db.transaction('seals', 'readwrite');
  tx.objectStore('seals').put({ id: 'crystal-' + idx, hash, state, ts: Date.now() });
  document.getElementById('status').textContent = `Sealed crystal ${idx + 1}: ${hash.slice(0, 8)}…`;
}

async function sealAll() {
  const state = Array.from(h).map(v => v.toFixed(3)).join(',');
  const hash = await sha256(state);
  const tx = db.transaction('seals', 'readwrite');
  tx.objectStore('seals').put({ id: 'full', hash, state, ts: Date.now() });
  document.getElementById('status').textContent = `Full seal: ${hash.slice(0, 12)}…`;
}

async function restore() {
  const tx = db.transaction('seals', 'readonly');
  const req = tx.objectStore('seals').get('full');
  req.onsuccess = () => {
    if (req.result && req.result.state) {
      const vals = req.result.state.split(',').map(Number);
      for (let i = 0; i < Math.min(N, vals.length); i++) h[i] = vals[i];
      document.getElementById('status').textContent = 'Restored sealed state.';
    }
  };
}

function openDB() {
  return new Promise((res) => {
    const req = indexedDB.open('f489-crystal', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('seals', { keyPath: 'id' });
    req.onsuccess = () => { db = req.result; res(); };
    req.onerror = () => res();
  });
}

function loop() {
  const x = getSpectral();
  reservoirStep(x);
  updatePhysics();
  requestAnimationFrame(loop);
}

document.getElementById('micBtn').onclick = startMic;
document.getElementById('sealBtn').onclick = sealAll;
document.getElementById('restoreBtn').onclick = restore;
document.getElementById('resetBtn').onclick = () => { h.fill(0); createCrystals(); };
window.onmousemove = (e) => { pointer.x = e.clientX / window.innerWidth; pointer.y = e.clientY / window.innerHeight; };
window.ontouchmove = (e) => { if (e.touches[0]) { pointer.x = e.touches[0].clientX / window.innerWidth; pointer.y = e.touches[0].clientY / window.innerHeight; } };
window.onkeydown = (e) => { if (e.key === 's' || e.key === 'S') sealAll(); if (e.key === 'r' || e.key === 'R') restore(); };

initWeights();
createCrystals();
openDB().then(() => loop());
