const N = 24; // reservoir size
const P = 7;  // portals
const stage = document.getElementById('stage');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

// Reservoir
let W = new Float32Array(N * N);
let Win = new Float32Array(N * 5); // 4 inputs + bias
let x = new Float32Array(N);
let Wout = new Float32Array(P * 3 * N); // per portal: fx, fy, hue
let seed = 42;

function rand(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function initReservoir(s = 42) {
  seed = s;
  const r = rand(s);
  for (let i = 0; i < N * N; i++) W[i] = (r() - 0.5) * 2 * (r() < 0.15 ? 1 : 0);
  // spectral radius approx normalize
  let max = 0;
  for (let i = 0; i < N; i++) {
    let sum = 0;
    for (let j = 0; j < N; j++) sum += Math.abs(W[i * N + j]);
    if (sum > max) max = sum;
  }
  if (max > 0) for (let i = 0; i < N * N; i++) W[i] *= 0.9 / max;
  for (let i = 0; i < N * 5; i++) Win[i] = (r() - 0.5) * 0.5;
  for (let i = 0; i < Wout.length; i++) Wout[i] = (r() - 0.5) * 0.1;
  x.fill(0);
}

// Portals
const portals = [];
for (let i = 0; i < P; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = '•';
  el.style.setProperty('--h', 180 + i * 20);
  stage.appendChild(el);
  portals.push({ el, x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, z: 0, vx: 0, vy: 0 });
}

let orient = { beta: 0, gamma: 0 };
let ptr = { x: 0, y: 0, vx: 0, vy: 0 };
let audioCtx, osc, gain;

function updateReservoir(input) {
  // x = (1-leak)*x + leak*tanh(W x + Win u)
  const leak = 0.25;
  const nx = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let j = 0; j < N; j++) s += W[i * N + j] * x[j];
    for (let k = 0; k < 5; k++) s += Win[i * 5 + k] * input[k];
    nx[i] = (1 - leak) * x[i] + leak * Math.tanh(s);
  }
  x.set(nx);
}

function readoutForces() {
  const forces = [];
  for (let p = 0; p < P; p++) {
    let fx = 0, fy = 0, h = 0;
    for (let i = 0; i < N; i++) {
      fx += Wout[(p * 3 + 0) * N + i] * x[i];
      fy += Wout[(p * 3 + 1) * N + i] * x[i];
      h  += Wout[(p * 3 + 2) * N + i] * x[i];
    }
    forces.push({ fx: fx * 80, fy: fy * 80, h: ((h * 30 + 180) % 360 + 360) % 360 });
  }
  return forces;
}

function reward(pIdx) {
  const lr = 0.08;
  const desired = { fx: 0.1, fy: 0.1, h: 0.2 }; // mild attract toward center-ish
  for (let i = 0; i < N; i++) {
    const xi = x[i];
    Wout[(pIdx * 3 + 0) * N + i] += lr * xi * (desired.fx - (Wout[(pIdx * 3 + 0) * N + i] * xi));
    Wout[(pIdx * 3 + 1) * N + i] += lr * xi * (desired.fy - (Wout[(pIdx * 3 + 1) * N + i] * xi));
    Wout[(pIdx * 3 + 2) * N + i] += lr * xi * 0.05;
  }
  statusEl.textContent = `Rewarded portal ${pIdx}`;
}

// Input
window.addEventListener('deviceorientation', e => {
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
});
window.addEventListener('pointermove', e => {
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
  ptr.vx = dx * 0.2; ptr.vy = dy * 0.2;
  ptr.x = e.clientX; ptr.y = e.clientY;
});

portals.forEach((p, i) => p.el.addEventListener('click', () => reward(i)));

// Seal
async function seal() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f865', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('es');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('es', 'readwrite');
    tx.objectStore('es').put({ seed, Wout: Array.from(Wout), ts: Date.now() }, 'main');
    await new Promise(r => tx.oncomplete = r);
    const bc = new BroadcastChannel('f865-es');
    bc.postMessage({ seed, Wout: Array.from(Wout) });
    statusEl.textContent = 'Sealed to IndexedDB + broadcast';
  } catch (e) {
    sessionStorage.setItem('f865', JSON.stringify({ seed, Wout: Array.from(Wout) }));
    statusEl.textContent = 'Sealed to sessionStorage';
  }
}
document.getElementById('sealBtn').onclick = seal;

// Audio
document.getElementById('audioBtn').onclick = () => {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    osc = audioCtx.createOscillator();
    gain = audioCtx.createGain();
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
};

// Load seal
async function loadSeal() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f865', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('es', 'readonly');
    const req = tx.objectStore('es').get('main');
    req.onsuccess = () => {
      if (req.result) {
        seed = req.result.seed;
        Wout.set(req.result.Wout);
        initReservoir(seed);
        statusEl.textContent = 'Loaded sealed reservoir';
      }
    };
  } catch (e) { console.debug("lab f865-orientation-es-portal-lattice-mind:", e); }
  const bc = new BroadcastChannel('f865-es');
  bc.onmessage = e => {
    if (e.data.Wout) {
      Wout.set(e.data.Wout);
      seed = e.data.seed;
      initReservoir(seed);
      statusEl.textContent = 'Adopted sealed reservoir from tab';
    }
  };
}

initReservoir();
loadSeal();

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
window.addEventListener('resize', resize);

function loop() {
  const input = [
    Math.tanh(orient.beta / 90),
    Math.tanh(orient.gamma / 90),
    Math.tanh(ptr.vx / 20),
    Math.tanh(ptr.vy / 20),
    1
  ];
  updateReservoir(input);
  const forces = readoutForces();

  // physics
  portals.forEach((p, i) => {
    const f = forces[i];
    p.vx += f.fx * 0.02;
    p.vy += f.fy * 0.02;
    p.vx *= 0.92; p.vy *= 0.92;
    p.x += p.vx; p.y += p.vy;
    // soft walls
    if (p.x < 40) p.vx += 2; if (p.x > innerWidth - 40) p.vx -= 2;
    if (p.y < 40) p.vy += 2; if (p.y > innerHeight - 40) p.vy -= 2;
    p.z = Math.sin(Date.now() * 0.001 + i) * 40;
    p.el.style.transform = `translate3d(${p.x - 40}px, ${p.y - 40}px, ${p.z}px) rotateX(${orient.beta * 0.3}deg) rotateY(${orient.gamma * 0.3}deg)`;
    p.el.style.setProperty('--h', f.h);
  });

  // canvas trail
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(120,180,255,0.4)';
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const px = (i / N) * canvas.width;
    const py = canvas.height * 0.5 + x[i] * 120;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();

  if (osc) {
    const energy = x.reduce((s, v) => s + v * v, 0) / N;
    osc.frequency.value = 120 + energy * 200;
    gain.gain.value = 0.05 + energy * 0.1;
  }

  requestAnimationFrame(loop);
}
loop();
