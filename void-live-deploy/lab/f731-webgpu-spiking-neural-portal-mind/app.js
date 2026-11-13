const N = 24; // neurons
const G = 6;  // portals / groups
const TAU = 20;
const THRESH = 1.0;
const RESET = 0.0;
const DECAY = 0.95;

let V = new Float32Array(N);
let spikes = new Uint8Array(N);
let W = new Float32Array(N * N); // synapses
let fitness = new Float32Array(G);
let portals = [];
let ptr = {x:0, y:0, vx:0, vy:0};
let orient = {b:0, g:0};
let mode = 'js';
let db, bc;

function initWeights() {
  for (let i = 0; i < N*N; i++) W[i] = (Math.random() - 0.5) * 0.15;
  // mild local structure
  for (let g = 0; g < G; g++) {
    const base = g * (N/G);
    for (let i = 0; i < N/G; i++) for (let j = 0; j < N/G; j++) if (i!==j) W[(base+i)*N + base+j] += 0.08;
  }
}

function step() {
  const I = new Float32Array(N);
  // orientation + pointer currents
  const ob = orient.b / 90, og = orient.g / 90;
  const px = ptr.vx * 0.02, py = ptr.vy * 0.02;
  for (let i = 0; i < N; i++) {
    const g = Math.floor(i / (N/G));
    I[i] = 0.3 * (ob * Math.sin(i) + og * Math.cos(i) + px * (i%3) + py * ((i+1)%3));
    // recurrent
    let rec = 0;
    for (let j = 0; j < N; j++) if (spikes[j]) rec += W[i*N + j];
    I[i] += rec * 0.8;
  }
  // LIF
  for (let i = 0; i < N; i++) {
    V[i] += (I[i] - V[i]) / TAU;
    spikes[i] = 0;
    if (V[i] > THRESH) {
      spikes[i] = 1;
      V[i] = RESET;
      const g = Math.floor(i / (N/G));
      fitness[g] += 1;
    }
  }
  for (let g = 0; g < G; g++) fitness[g] *= DECAY;
}

function createPortals() {
  const cont = document.getElementById('portals');
  for (let g = 0; g < G; g++) {
    const d = document.createElement('div');
    d.className = 'portal';
    d.textContent = 'P' + g;
    d.style.left = (20 + g*14) + '%';
    d.style.top = (30 + (g%3)*15) + '%';
    cont.appendChild(d);
    portals.push({el: d, x: 100 + g*80, y: 150 + (g%2)*100, vx:0, vy:0, g});
  }
}

function updatePortals() {
  for (let g = 0; g < G; g++) {
    const p = portals[g];
    const rate = fitness[g];
    // spike-driven forces
    p.vx += (rate - 2) * 0.4 + (Math.random()-0.5)*0.2;
    p.vy += (rate - 2) * 0.3 + (Math.random()-0.5)*0.2;
    p.vx *= 0.92; p.vy *= 0.92;
    p.x += p.vx; p.y += p.vy;
    p.x = Math.max(20, Math.min(window.innerWidth-80, p.x));
    p.y = Math.max(20, Math.min(window.innerHeight-80, p.y));
    p.el.style.transform = `translate(${p.x}px,${p.y}px) scale(${0.8 + rate*0.08})`;
    const hue = 200 + rate * 40;
    p.el.style.background = `hsla(${hue},70%,50%,0.28)`;
    p.el.textContent = `P${g}\n${rate.toFixed(1)}`;
  }
}

const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
function resize() { cv.width = window.innerWidth; cv.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,cv.width,cv.height);
  // membrane bars
  const bw = cv.width / N;
  for (let i = 0; i < N; i++) {
    const h = Math.max(0, V[i]) * 80;
    ctx.fillStyle = spikes[i] ? '#fff' : `hsl(${200 + i*5},70%,60%)`;
    ctx.fillRect(i*bw, cv.height - 120 - h, bw-1, h);
  }
  // simple raster dots
  ctx.fillStyle = '#adf';
  for (let i = 0; i < N; i++) if (spikes[i]) ctx.fillRect(i*bw, 40, bw-1, 8);
}

function loop() {
  step();
  updatePortals();
  draw();
  const best = fitness.indexOf(Math.max(...fitness));
  document.getElementById('status').textContent =
    `mode:${mode} | best P${best} fit:${fitness[best].toFixed(2)} | spikes:${spikes.reduce((a,b)=>a+b,0)}`;
  requestAnimationFrame(loop);
}

// inputs
window.addEventListener('pointermove', e => {
  ptr.vx = e.clientX - ptr.x; ptr.vy = e.clientY - ptr.y;
  ptr.x = e.clientX; ptr.y = e.clientY;
});
window.addEventListener('deviceorientation', e => {
  if (e.beta != null) orient.b = e.beta;
  if (e.gamma != null) orient.g = e.gamma;
});

// persistence
async function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('verse-f731-snn', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
async function seal() {
  try {
    if (!db) db = await openDB();
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put({W: Array.from(W), fitness: Array.from(fitness), t: Date.now()}, 'latest');
    document.getElementById('status').textContent = 'Sealed to IndexedDB';
  } catch(e) { console.warn(e); }
}
function propose() {
  if (!bc) bc = new BroadcastChannel('f731-genomes');
  const best = fitness.indexOf(Math.max(...fitness));
  bc.postMessage({type:'genome', W: Array.from(W), from: best, fit: fitness[best]});
  document.getElementById('status').textContent = 'Proposed transfer';
}
if (typeof BroadcastChannel !== 'undefined') {
  bc = new BroadcastChannel('f731-genomes');
  bc.onmessage = e => {
    if (e.data.type === 'genome' && e.data.fit > Math.max(...fitness) * 0.8) {
      W.set(e.data.W);
      document.getElementById('status').textContent = 'Accepted remote genome';
    }
  };
}

document.getElementById('seal').onclick = seal;
document.getElementById('transfer').onclick = propose;
document.getElementById('reset').onclick = () => { initWeights(); fitness.fill(0); };

// try WebGPU note
if (navigator.gpu) {
  mode = 'webgpu-ready (JS kernel)';
  // placeholder: real compute kernel would go here for production
}

initWeights();
createPortals();
loop();
