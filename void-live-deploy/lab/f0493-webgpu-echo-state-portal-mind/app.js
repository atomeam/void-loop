const cv = document.getElementById('cv');
const statusEl = document.getElementById('status');
const portalsEl = document.getElementById('portals');
let W = innerWidth, H = innerHeight;
cv.width = W; cv.height = H;
window.onresize = () => { W = innerWidth; H = innerHeight; cv.width = W; cv.height = H; };

// Simple Echo State Network
const N = 32; // reservoir
let Wres = new Float32Array(N * N);
let Win = new Float32Array(N * 5);
let Wout = new Float32Array(2 * N); // 2 outputs
let state = new Float32Array(N);
let fitness = 1.0;

function randn() { return (Math.random() + Math.random() + Math.random() - 1.5) * 2; }
function initESN() {
  for (let i = 0; i < N*N; i++) Wres[i] = randn() * 0.5;
  // spectral radius approx normalize
  let max = 0; for (let i = 0; i < N*N; i++) max = Math.max(max, Math.abs(Wres[i]));
  for (let i = 0; i < N*N; i++) Wres[i] *= 0.9 / (max || 1);
  for (let i = 0; i < N*5; i++) Win[i] = randn() * 0.3;
  for (let i = 0; i < 2*N; i++) Wout[i] = 0;
  state.fill(0);
  fitness = 1.0;
}
initESN();

let ori = [0, 0], ptr = [0.5, 0.5], mic = 0;

// Particles
const NP = 400;
let px = new Float32Array(NP), py = new Float32Array(NP), vx = new Float32Array(NP), vy = new Float32Array(NP);
function initParticles() {
  for (let i = 0; i < NP; i++) {
    px[i] = Math.random() * W; py[i] = Math.random() * H;
    vx[i] = (Math.random()-0.5)*2; vy[i] = (Math.random()-0.5)*2;
  }
}
initParticles();

// Portals
const portals = [];
for (let i = 0; i < 4; i++) {
  const d = document.createElement('div');
  d.className = 'portal';
  d.textContent = `Portal ${i+1}\nclick to reward`;
  d.onclick = () => rewardPortal(i);
  portalsEl.appendChild(d);
  portals.push({el: d, x: Math.random()*W, y: Math.random()*H, fit: 1});
}

function rewardPortal(idx) {
  fitness += 0.5;
  // Simple Hebbian-ish update on Wout toward current state
  for (let o = 0; o < 2; o++) for (let j = 0; j < N; j++) {
    Wout[o*N + j] += 0.01 * state[j] * (o === 0 ? 1 : -0.5);
  }
  statusEl.textContent = `Rewarded portal ${idx+1} | fitness ${fitness.toFixed(2)}`;
}

// Input listeners
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    ori[0] = (e.beta || 0) / 90;
    ori[1] = (e.gamma || 0) / 90;
  });
}
window.addEventListener('pointermove', e => {
  ptr[0] = e.clientX / W;
  ptr[1] = e.clientY / H;
});

// Optional mic
navigator.mediaDevices?.getUserMedia({audio:true}).then(stream => {
  const ac = new AudioContext();
  const src = ac.createMediaStreamSource(stream);
  const an = ac.createAnalyser(); an.fftSize = 256;
  src.connect(an);
  const data = new Uint8Array(an.frequencyBinCount);
  setInterval(() => {
    an.getByteFrequencyData(data);
    mic = data.reduce((a,b)=>a+b,0) / data.length / 255;
  }, 100);
}).catch(()=>{});

// Broadcast + IDB
const bc = new BroadcastChannel('f0493-genome');
bc.onmessage = e => {
  if (e.data.fitness > fitness) {
    Wout.set(e.data.Wout);
    fitness = e.data.fitness * 0.95;
    statusEl.textContent = 'Adopted higher genome from peer';
  }
};
const idbReq = indexedDB.open('f0493', 1);
idbReq.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
let db;
idbReq.onsuccess = e => { db = e.target.result; loadGenome(); };

function saveGenome() {
  if (!db) return;
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({Wout: Array.from(Wout), fitness, t: Date.now()}, 'latest');
  bc.postMessage({Wout: Array.from(Wout), fitness});
  statusEl.textContent = `Sealed fitness ${fitness.toFixed(2)}`;
}
function loadGenome() {
  if (!db) return;
  const tx = db.transaction('genomes', 'readonly');
  const req = tx.objectStore('genomes').get('latest');
  req.onsuccess = () => {
    if (req.result) {
      Wout.set(req.result.Wout);
      fitness = req.result.fitness || 1;
      statusEl.textContent = 'Loaded sealed genome';
    }
  };
}

document.getElementById('seal').onclick = saveGenome;
document.getElementById('reward').onclick = () => rewardPortal(0);
document.getElementById('reset').onclick = () => { initESN(); initParticles(); statusEl.textContent = 'Reset'; };

// Simulation loop
function tanh(x) { return Math.tanh(x); }
function stepESN() {
  const input = [ori[0], ori[1], ptr[0]*2-1, ptr[1]*2-1, mic];
  const next = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let j = 0; j < N; j++) s += Wres[i*N + j] * state[j];
    for (let k = 0; k < 5; k++) s += Win[i*5 + k] * input[k];
    next[i] = tanh(s);
  }
  state.set(next);
  let o0 = 0, o1 = 0;
  for (let j = 0; j < N; j++) {
    o0 += Wout[j] * state[j];
    o1 += Wout[N + j] * state[j];
  }
  return [Math.tanh(o0), Math.tanh(o1)];
}

function stepParticles(outs) {
  const [str, rot] = outs;
  const cx = W * (0.5 + str * 0.3);
  const cy = H * (0.5 + rot * 0.3);
  for (let i = 0; i < NP; i++) {
    let dx = cx - px[i], dy = cy - py[i];
    let d = Math.hypot(dx, dy) || 1;
    vx[i] += (dx / d) * str * 0.4 + (Math.random()-0.5)*0.1;
    vy[i] += (dy / d) * str * 0.4 + (Math.random()-0.5)*0.1;
    // rotation
    const rx = -dy * rot * 0.02, ry = dx * rot * 0.02;
    vx[i] += rx; vy[i] += ry;
    vx[i] *= 0.96; vy[i] *= 0.96;
    px[i] = (px[i] + vx[i] + W) % W;
    py[i] = (py[i] + vy[i] + H) % H;
  }
  // Simple clusters for portals
  const bins = 4;
  const sums = Array.from({length: bins}, () => ({x:0,y:0,c:0}));
  for (let i = 0; i < NP; i++) {
    const b = Math.floor(i / (NP / bins));
    sums[b].x += px[i]; sums[b].y += py[i]; sums[b].c++;
  }
  for (let b = 0; b < bins; b++) {
    if (sums[b].c) {
      portals[b].x = sums[b].x / sums[b].c;
      portals[b].y = sums[b].y / sums[b].c;
      portals[b].el.style.left = (portals[b].x - 60) + 'px';
      portals[b].el.style.top = (portals[b].y - 35) + 'px';
    }
  }
}

function render() {
  const ctx = cv.getContext('2d');
  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#66aaff';
  for (let i = 0; i < NP; i++) {
    ctx.fillRect(px[i], py[i], 2, 2);
  }
}

function loop() {
  const outs = stepESN();
  stepParticles(outs);
  render();
  requestAnimationFrame(loop);
}
loop();
statusEl.textContent = 'Echo-state mind active — tilt / move / click portals / Seal';
