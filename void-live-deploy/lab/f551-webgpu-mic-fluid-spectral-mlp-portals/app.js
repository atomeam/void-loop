// Minimal self-contained prototype: Canvas2D fluid fallback + local MLPs + DOM portals
// WebGPU path stubbed for future expansion (device request present)

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 64; // fluid grid
const dt = 0.1;
let density = new Float32Array(N*N);
let vx = new Float32Array(N*N);
let vy = new Float32Array(N*N);
let density0 = new Float32Array(N*N);
let vx0 = new Float32Array(N*N);
let vy0 = new Float32Array(N*N);

function IX(x, y) { return Math.max(0, Math.min(N-1, x)) + Math.max(0, Math.min(N-1, y)) * N; }

function addSource(x, s, dt) { for (let i = 0; i < N*N; i++) x[i] += dt * s[i]; }

function setBnd(b, x) {
  for (let i = 1; i < N-1; i++) {
    x[IX(0, i)] = b === 1 ? -x[IX(1, i)] : x[IX(1, i)];
    x[IX(N-1, i)] = b === 1 ? -x[IX(N-2, i)] : x[IX(N-2, i)];
    x[IX(i, 0)] = b === 2 ? -x[IX(i, 1)] : x[IX(i, 1)];
    x[IX(i, N-1)] = b === 2 ? -x[IX(i, N-2)] : x[IX(i, N-2)];
  }
  x[IX(0, 0)] = 0.5 * (x[IX(1, 0)] + x[IX(0, 1)]);
  x[IX(0, N-1)] = 0.5 * (x[IX(1, N-1)] + x[IX(0, N-2)]);
  x[IX(N-1, 0)] = 0.5 * (x[IX(N-2, 0)] + x[IX(N-1, 1)]);
  x[IX(N-1, N-1)] = 0.5 * (x[IX(N-2, N-1)] + x[IX(N-1, N-2)]);
}

function linSolve(b, x, x0, a, c) {
  for (let k = 0; k < 20; k++) {
    for (let j = 1; j < N-1; j++) {
      for (let i = 1; i < N-1; i++) {
        x[IX(i, j)] = (x0[IX(i, j)] + a * (x[IX(i-1, j)] + x[IX(i+1, j)] + x[IX(i, j-1)] + x[IX(i, j+1)])) / c;
      }
    }
    setBnd(b, x);
  }
}

function diffuse(b, x, x0, diff, dt) {
  const a = dt * diff * (N-2) * (N-2);
  linSolve(b, x, x0, a, 1 + 4 * a);
}

function advect(b, d, d0, vx, vy, dt) {
  const dt0 = dt * (N-2);
  for (let j = 1; j < N-1; j++) {
    for (let i = 1; i < N-1; i++) {
      let x = i - dt0 * vx[IX(i, j)];
      let y = j - dt0 * vy[IX(i, j)];
      x = Math.max(0.5, Math.min(N-1.5, x));
      y = Math.max(0.5, Math.min(N-1.5, y));
      const i0 = Math.floor(x), i1 = i0 + 1;
      const j0 = Math.floor(y), j1 = j0 + 1;
      const s1 = x - i0, s0 = 1 - s1;
      const t1 = y - j0, t0 = 1 - t1;
      d[IX(i, j)] = s0 * (t0 * d0[IX(i0, j0)] + t1 * d0[IX(i0, j1)]) +
                    s1 * (t0 * d0[IX(i1, j0)] + t1 * d0[IX(i1, j1)]);
    }
  }
  setBnd(b, d);
}

function project(vx, vy, p, div) {
  for (let j = 1; j < N-1; j++) {
    for (let i = 1; i < N-1; i++) {
      div[IX(i, j)] = -0.5 * (vx[IX(i+1, j)] - vx[IX(i-1, j)] + vy[IX(i, j+1)] - vy[IX(i, j-1)]) / N;
      p[IX(i, j)] = 0;
    }
  }
  setBnd(0, div); setBnd(0, p);
  linSolve(0, p, div, 1, 4);
  for (let j = 1; j < N-1; j++) {
    for (let i = 1; i < N-1; i++) {
      vx[IX(i, j)] -= 0.5 * N * (p[IX(i+1, j)] - p[IX(i-1, j)]);
      vy[IX(i, j)] -= 0.5 * N * (p[IX(i, j+1)] - p[IX(i, j-1)]);
    }
  }
  setBnd(1, vx); setBnd(2, vy);
}

function fluidStep() {
  addSource(vx, vx0, dt); addSource(vy, vy0, dt); addSource(density, density0, dt);
  diffuse(1, vx0, vx, 0.0001, dt); diffuse(2, vy0, vy, 0.0001, dt);
  project(vx0, vy0, vx, vy);
  advect(1, vx, vx0, vx0, vy0, dt); advect(2, vy, vy0, vx0, vy0, dt);
  project(vx, vy, vx0, vy0);
  diffuse(0, density0, density, 0.0001, dt);
  advect(0, density, density0, vx, vy, dt);
  // swap
  [density, density0] = [density0, density];
  [vx, vx0] = [vx0, vx];
  [vy, vy0] = [vy0, vy];
  // decay sources
  for (let i = 0; i < N*N; i++) { vx0[i] *= 0.98; vy0[i] *= 0.98; density0[i] *= 0.99; }
}

// Spectral bands (simulated or from mic)
let bands = [0.2, 0.3, 0.4, 0.2]; // low, mid-low, mid-high, high
let micStream = null, analyser = null, audioCtx = null;
let simMode = true;

function updateSpectrum() {
  if (analyser && !simMode) {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const bins = [0, 10, 30, 60, 120];
    for (let b = 0; b < 4; b++) {
      let sum = 0, c = 0;
      for (let i = bins[b]; i < bins[b+1] && i < data.length; i++) { sum += data[i]; c++; }
      bands[b] = c ? (sum / c) / 255 : 0;
    }
  } else {
    // simulated breathing spectrum
    const t = performance.now() / 1000;
    bands[0] = 0.3 + 0.2 * Math.sin(t * 0.7);
    bands[1] = 0.4 + 0.3 * Math.sin(t * 1.3 + 1);
    bands[2] = 0.25 + 0.2 * Math.sin(t * 2.1 + 2);
    bands[3] = 0.15 + 0.1 * Math.sin(t * 3.5 + 3);
  }
}

// Tiny MLP
class MLP {
  constructor() {
    this.w1 = Array.from({length: 4*6}, () => Math.random()*0.4-0.2);
    this.b1 = Array.from({length: 6}, () => Math.random()*0.2-0.1);
    this.w2 = Array.from({length: 6*3}, () => Math.random()*0.4-0.2);
    this.b2 = Array.from({length: 3}, () => Math.random()*0.2-0.1);
    this.fitness = 0.5;
  }
  forward(input) { // input 4: fluid residual, bands avg, proximity, self energy
    const h = new Array(6).fill(0);
    for (let i = 0; i < 6; i++) {
      let s = this.b1[i];
      for (let j = 0; j < 4; j++) s += input[j] * this.w1[j*6 + i];
      h[i] = Math.tanh(s);
    }
    const out = new Array(3).fill(0);
    for (let i = 0; i < 3; i++) {
      let s = this.b2[i];
      for (let j = 0; j < 6; j++) s += h[j] * this.w2[j*3 + i];
      out[i] = Math.tanh(s);
    }
    return out; // buoyancy, expansion, emission
  }
  mutate(rate = 0.05) {
    const m = (arr) => arr.map(v => v + (Math.random()-0.5)*rate);
    this.w1 = m(this.w1); this.b1 = m(this.b1); this.w2 = m(this.w2); this.b2 = m(this.b2);
  }
  async seal() {
    const data = JSON.stringify({w1:this.w1, b1:this.b1, w2:this.w2, b2:this.b2, bands:[...bands]});
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,16);
  }
}

const portals = [];
function createPortal(x, y, title) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.innerHTML = `<h3>${title}</h3><div class="meta">fitness: 0.5<br>seal: —</div>`;
  document.body.appendChild(el);
  const p = {
    el, x, y, vx: 0, vy: 0, size: 1, energy: 0.5,
    mlp: new MLP(), seal: '—', title
  };
  portals.push(p);
  return p;
}

for (let i = 0; i < 6; i++) {
  createPortal(200 + i*180, 200 + (i%2)*150, `Portal ${i+1}`);
}

function getFluidAt(px, py) {
  const gx = Math.floor((px / W) * N);
  const gy = Math.floor((py / H) * N);
  const i = IX(gx, gy);
  return { vx: vx[i] || 0, vy: vy[i] || 0, d: density[i] || 0 };
}

async function step() {
  updateSpectrum();
  const avgBand = bands.reduce((a,b)=>a+b,0)/4;

  // inject spectral energy into fluid density
  for (let i = 0; i < N*N; i++) density0[i] += avgBand * 0.01;

  fluidStep();

  // update portals
  for (const p of portals) {
    const f = getFluidAt(p.x, p.y);
    const prox = portals.reduce((s, o) => s + (o===p?0:1/(1+Math.hypot(p.x-o.x,p.y-o.y)/100)), 0);
    const input = [f.vx*10, avgBand, Math.min(1, prox), p.energy];
    const out = p.mlp.forward(input);
    const buoyancy = out[0] * 2;
    const exp = out[1];
    const emit = (out[2]+1)/2;

    // advection + buoyancy
    p.vx += f.vx * 30 + buoyancy * (bands[3]-0.2) * 5;
    p.vy += f.vy * 30 + buoyancy * (bands[0]-0.2) * 5;
    p.vx *= 0.92; p.vy *= 0.92;
    p.x += p.vx; p.y += p.vy;
    p.x = Math.max(40, Math.min(W-140, p.x));
    p.y = Math.max(40, Math.min(H-100, p.y));

    p.size = Math.max(0.6, Math.min(2.2, p.size + exp * 0.02 + (avgBand-0.3)*0.01));
    p.energy = Math.max(0, Math.min(1, p.energy * 0.98 + emit * 0.05 + avgBand * 0.02));
    p.mlp.fitness = p.mlp.fitness * 0.99 + (emit * avgBand) * 0.05;

    // reverse pressure into fluid
    const gx = Math.floor((p.x / W) * N);
    const gy = Math.floor((p.y / H) * N);
    const idx = IX(gx, gy);
    vx0[idx] += (Math.random()-0.5) * emit * 0.5;
    vy0[idx] += (Math.random()-0.5) * emit * 0.5;
    density0[idx] += emit * 0.1;

    // genome transfer on resonance contact
    for (const o of portals) {
      if (o === p) continue;
      const d = Math.hypot(p.x-o.x, p.y-o.y);
      if (d < 80 && Math.abs(p.mlp.fitness - o.mlp.fitness) > 0.1 && avgBand > 0.35) {
        if (p.mlp.fitness > o.mlp.fitness) {
          o.mlp = Object.assign(new MLP(), { w1:[...p.mlp.w1], b1:[...p.mlp.b1], w2:[...p.mlp.w2], b2:[...p.mlp.b2], fitness: p.mlp.fitness*0.9 });
          o.mlp.mutate(0.08);
          o.seal = await p.mlp.seal();
          p.seal = o.seal;
        }
      }
    }

    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
    p.el.style.transform = `scale(${p.size})`;
    p.el.style.opacity = 0.6 + p.energy * 0.4;
    p.el.querySelector('.meta').innerHTML = `fitness: ${p.mlp.fitness.toFixed(2)}<br>seal: ${p.seal}<br>energy: ${p.energy.toFixed(2)}`;
  }

  // render fluid
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  const cellW = W / N, cellH = H / N;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const d = density[IX(i, j)];
      if (d > 0.01) {
        const v = Math.min(1, d * 2);
        ctx.fillStyle = `rgba(${100+v*100}, ${80+v*80}, ${200+v*55}, ${v*0.6})`;
        ctx.fillRect(i*cellW, j*cellH, cellW+1, cellH+1);
      }
    }
  }

  statusEl.textContent = `Bands: ${bands.map(b=>b.toFixed(2)).join(' ')} | Portals: ${portals.length} | Mode: ${simMode?'sim':'mic'}`;
  requestAnimationFrame(step);
}

// UI
document.getElementById('micBtn').onclick = async () => {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const src = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    simMode = false;
    statusEl.textContent = 'Mic active';
  } catch (e) { statusEl.textContent = 'Mic denied, using sim'; }
};
document.getElementById('simBtn').onclick = () => { simMode = true; statusEl.textContent = 'Sim spectrum'; };
document.getElementById('vortexBtn').onclick = () => {
  const cx = N/2, cy = N/2;
  for (let j = -8; j <= 8; j++) for (let i = -8; i <= 8; i++) {
    const idx = IX(cx+i, cy+j);
    vx0[idx] += -j * 0.5;
    vy0[idx] += i * 0.5;
    density0[idx] += 0.5;
  }
};
document.getElementById('sealBtn').onclick = async () => {
  const state = { portals: portals.map(p => ({x:p.x,y:p.y,seal:p.seal,fitness:p.mlp.fitness})), bands:[...bands], t: Date.now() };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f551', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('state');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put(state, 'latest');
    statusEl.textContent = 'State sealed to IndexedDB';
  } catch (e) { statusEl.textContent = 'Seal failed (in-memory)'; }
};

// WebGPU stub (capability probe)
if (navigator.gpu) {
  navigator.gpu.requestAdapter().then(a => {
    if (a) statusEl.textContent += ' | WebGPU available (fluid compute reserved)';
  }).catch(()=>{});
}

step();
console.log('F551 Acoustic Fluid Spectral MLP Portals ready. Verse is Verse.');
