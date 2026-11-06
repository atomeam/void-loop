const N = 16, SIZE = N*N, DIM = 6;
let weights = new Float32Array(SIZE * DIM);
let pos = new Float32Array(SIZE * 2); // lattice coords
let cards = [];
let eta = 0.08, sigma = 4.0, t = 0;
let bmu = 0, qerr = 1.0;
let webgpu = false, device, pipeline;
let orient = {beta:0, gamma:0};
let pointer = {x:0, y:0, vx:0, vy:0};
let lastPtr = {x:0, y:0};

// init random weights + lattice
for (let i=0; i<SIZE; i++) {
  const r = Math.floor(i / N), c = i % N;
  pos[i*2] = c; pos[i*2+1] = r;
  for (let d=0; d<DIM; d++) weights[i*DIM + d] = Math.random()*2-1;
}

// DOM cards (pool of 64 for perf)
const cardsEl = document.getElementById('cards');
const VIS = 64;
for (let i=0; i<VIS; i++) {
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.i = i;
  el.textContent = i;
  cardsEl.appendChild(el);
  cards.push(el);
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => {
    if (e.buttons) {
      const rect = cardsEl.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width * 2 - 1;
      const ny = (e.clientY - rect.top) / rect.height * 2 - 1;
      injectSample([nx, ny, 0.5, orient.beta/90, orient.gamma/90, Math.sin(t*0.01)]);
    }
  });
}

function injectSample(vec) {
  // find BMU and pull neighbors
  let best = 0, bestD = 1e9;
  for (let i=0; i<SIZE; i++) {
    let d=0;
    for (let k=0; k<DIM; k++) { const diff = weights[i*DIM+k] - vec[k]; d += diff*diff; }
    if (d < bestD) { bestD = d; best = i; }
  }
  const br = Math.floor(best / N), bc = best % N;
  for (let i=0; i<SIZE; i++) {
    const r = Math.floor(i / N), c = i % N;
    const dr = Math.min(Math.abs(r-br), N-Math.abs(r-br));
    const dc = Math.min(Math.abs(c-bc), N-Math.abs(c-bc));
    const dist = Math.hypot(dr, dc);
    const h = Math.exp(-(dist*dist)/(2*sigma*sigma));
    for (let k=0; k<DIM; k++) weights[i*DIM+k] += eta * h * (vec[k] - weights[i*DIM+k]);
  }
}

function step() {
  t++;
  // input vector
  const vec = [
    pointer.vx * 5,
    pointer.vy * 5,
    Math.hypot(pointer.vx, pointer.vy)*3,
    orient.beta / 90,
    orient.gamma / 90,
    Math.sin(t * 0.02)
  ];
  // BMU
  let best = 0, bestD = 1e9;
  for (let i=0; i<SIZE; i++) {
    let d=0;
    for (let k=0; k<DIM; k++) { const diff = weights[i*DIM+k] - vec[k]; d += diff*diff; }
    if (d < bestD) { bestD = d; best = i; }
  }
  bmu = best;
  qerr = Math.sqrt(bestD);
  // update
  const br = Math.floor(best / N), bc = best % N;
  for (let i=0; i<SIZE; i++) {
    const r = Math.floor(i / N), c = i % N;
    const dr = Math.min(Math.abs(r-br), N-Math.abs(r-br));
    const dc = Math.min(Math.abs(c-bc), N-Math.abs(c-bc));
    const dist = Math.hypot(dr, dc);
    const h = Math.exp(-(dist*dist)/(2*sigma*sigma));
    for (let k=0; k<DIM; k++) weights[i*DIM+k] += eta * h * (vec[k] - weights[i*DIM+k]);
  }
  eta *= 0.9997; sigma *= 0.9998;
  if (eta < 0.005) eta = 0.005;
  if (sigma < 0.8) sigma = 0.8;
  // update visible cards
  const w = window.innerWidth, h = window.innerHeight;
  for (let v=0; v<VIS; v++) {
    const i = (bmu + v * 4) % SIZE;
    const el = cards[v];
    const wx = weights[i*DIM] * 0.5 + 0.5;
    const wy = weights[i*DIM+1] * 0.5 + 0.5;
    el.style.left = (wx * w - 24) + 'px';
    el.style.top = (wy * h - 24) + 'px';
    el.style.setProperty('--h', (weights[i*DIM+2]*180 + 180) % 360);
    const sc = 0.6 + Math.min(1.4, 1 / (1 + Math.abs(weights[i*DIM+3])));
    el.style.transform = `scale(${sc})`;
    el.style.opacity = 0.4 + 0.5 * Math.exp(-Math.hypot(i%N - bc, Math.floor(i/N)-br)/4);
  }
  document.getElementById('status').textContent =
    `BMU:${bmu} qerr:${qerr.toFixed(3)} η:${eta.toFixed(4)} σ:${sigma.toFixed(2)} GPU:${webgpu}`;
  document.documentElement.style.setProperty('--err', Math.min(1, qerr));
  requestAnimationFrame(step);
}

// input
window.addEventListener('pointermove', e => {
  pointer.vx = (e.clientX - lastPtr.x) / window.innerWidth;
  pointer.vy = (e.clientY - lastPtr.y) / window.innerHeight;
  lastPtr.x = e.clientX; lastPtr.y = e.clientY;
  pointer.x = e.clientX; pointer.y = e.clientY;
});
window.addEventListener('deviceorientation', e => {
  if (e.beta != null) orient.beta = e.beta;
  if (e.gamma != null) orient.gamma = e.gamma;
});

// seal
async function seal() {
  const arr = Array.from(weights);
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(arr.slice(0,64))));
  const hash = Array.from(new Uint8Array(hashBuf)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16);
  const db = await new Promise((res,rej) => {
    const r = indexedDB.open('f606-som-mind', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('maps');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
  const tx = db.transaction('maps', 'readwrite');
  tx.objectStore('maps').put({weights: arr, hash, qerr, t}, 'latest');
  const bc = new BroadcastChannel('f606-genome');
  bc.postMessage({weights: arr, hash, qerr});
  document.getElementById('status').textContent += ` sealed:${hash}`;
}
document.getElementById('seal').onclick = seal;
document.getElementById('reward').onclick = () => { eta = Math.min(0.2, eta*1.5); sigma = Math.min(6, sigma*1.2); };

// receive
new BroadcastChannel('f606-genome').onmessage = e => {
  if (e.data.qerr < qerr * 0.9) {
    weights.set(e.data.weights);
    document.getElementById('status').textContent += ' adopted';
  }
};

// try WebGPU (stub: just detect)
if (navigator.gpu) {
  navigator.gpu.requestAdapter().then(a => a && a.requestDevice()).then(d => { if(d){ device=d; webgpu=true; } }).catch(()=>{});
}

step();
