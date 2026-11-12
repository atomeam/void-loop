const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; initField(); });

const GRID = 128;
const scale = Math.min(W, H) / GRID;
let U = new Float32Array(GRID * GRID);
let V = new Float32Array(GRID * GRID);
let nextU = new Float32Array(GRID * GRID);
let nextV = new Float32Array(GRID * GRID);

function initField() {
  for (let i = 0; i < GRID * GRID; i++) {
    U[i] = 1;
    V[i] = 0;
  }
  // seed center
  const cx = GRID/2, cy = GRID/2;
  for (let y = cy-10; y < cy+10; y++) for (let x = cx-10; x < cx+10; x++) {
    const i = y*GRID + x;
    if (i >= 0 && i < GRID*GRID) { U[i] = 0.5; V[i] = 0.25; }
  }
}

// Tiny MLP per portal: inputs 6 -> hidden 8 -> outputs 2 (dF, dk)
class TinyMLP {
  constructor() {
    this.w1 = Array.from({length: 8}, () => Array.from({length: 6}, () => (Math.random()-0.5)*0.5));
    this.b1 = Array.from({length: 8}, () => (Math.random()-0.5)*0.2);
    this.w2 = Array.from({length: 2}, () => Array.from({length: 8}, () => (Math.random()-0.5)*0.5));
    this.b2 = Array.from({length: 2}, () => (Math.random()-0.5)*0.2);
  }
  forward(x) {
    const h = this.w1.map((row, i) => Math.tanh(row.reduce((s, w, j) => s + w * x[j], this.b1[i])));
    return this.w2.map((row, i) => Math.tanh(row.reduce((s, w, j) => s + w * h[j], this.b2[i])));
  }
  clone() {
    const m = new TinyMLP();
    m.w1 = JSON.parse(JSON.stringify(this.w1));
    m.b1 = [...this.b1];
    m.w2 = JSON.parse(JSON.stringify(this.w2));
    m.b2 = [...this.b2];
    return m;
  }
  mutate(rate=0.1) {
    const mut = a => a.map(v => v + (Math.random()-0.5)*rate);
    this.w1 = this.w1.map(mut);
    this.b1 = mut(this.b1);
    this.w2 = this.w2.map(mut);
    this.b2 = mut(this.b2);
  }
}

const portals = [];
function createPortal(x, y) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.innerHTML = `<div>Portal</div><div class="stats">U:0 V:0</div>`;
  document.body.appendChild(el);
  const p = { el, x, y, mlp: new TinyMLP(), vx:0, vy:0 };
  portals.push(p);
  makeDraggable(p);
  return p;
}

function makeDraggable(p) {
  let dragging = false, ox=0, oy=0;
  p.el.addEventListener('pointerdown', e => {
    dragging = true;
    p.el.classList.add('dragging');
    ox = e.clientX - p.x;
    oy = e.clientY - p.y;
    e.target.setPointerCapture(e.pointerId);
  });
  p.el.addEventListener('pointermove', e => {
    if (!dragging) return;
    p.x = e.clientX - ox;
    p.y = e.clientY - oy;
    inject(p.x, p.y, 0.2, 0.4);
  });
  p.el.addEventListener('pointerup', () => { dragging = false; p.el.classList.remove('dragging'); });
}

function inject(px, py, du, dv) {
  const gx = Math.floor(px / scale), gy = Math.floor(py / scale);
  for (let dy=-4; dy<=4; dy++) for (let dx=-4; dx<=4; dx++) {
    const x = gx+dx, y = gy+dy;
    if (x>=0 && x<GRID && y>=0 && y<GRID) {
      const i = y*GRID + x;
      U[i] = Math.max(0, Math.min(1, U[i] - du));
      V[i] = Math.max(0, Math.min(1, V[i] + dv));
    }
  }
}

let tiltX = 0, tiltY = 0;
function requestOrient() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => { if (p==='granted') addOrient(); });
  } else addOrient();
}
function addOrient() {
  window.addEventListener('deviceorientation', e => {
    tiltX = (e.gamma || 0) / 45;
    tiltY = (e.beta || 0) / 45;
  });
}
document.getElementById('orient').onclick = requestOrient;

// Gray-Scott step
const Du = 0.16, Dv = 0.08;
function stepRD() {
  const Fbase = 0.037, kbase = 0.06;
  for (let y=1; y<GRID-1; y++) for (let x=1; x<GRID-1; x++) {
    const i = y*GRID + x;
    const u = U[i], v = V[i];
    // Laplacian
    const lapU = U[i-1] + U[i+1] + U[i-GRID] + U[i+GRID] - 4*u;
    const lapV = V[i-1] + V[i+1] + V[i-GRID] + V[i+GRID] - 4*v;
    // Find nearest portal MLP influence
    let dF = 0, dk = 0, minDist = 999;
    for (const p of portals) {
      const dx = (p.x / scale) - x, dy = (p.y / scale) - y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < minDist && dist < 20) {
        minDist = dist;
        const inputs = [u, v, Math.abs(lapU)+Math.abs(lapV), dist/20, tiltX, tiltY];
        const out = p.mlp.forward(inputs);
        dF = out[0] * 0.01;
        dk = out[1] * 0.01;
      }
    }
    const F = Fbase + dF, k = kbase + dk;
    const uvv = u * v * v;
    nextU[i] = u + (Du * lapU - uvv + F * (1 - u));
    nextV[i] = v + (Dv * lapV + uvv - (F + k) * v);
  }
  // boundaries copy
  for (let i=0; i<GRID; i++) {
    nextU[i] = nextU[GRID+i]; nextV[i] = nextV[GRID+i];
    nextU[(GRID-1)*GRID + i] = nextU[(GRID-2)*GRID + i];
    nextV[(GRID-1)*GRID + i] = nextV[(GRID-2)*GRID + i];
  }
  [U, nextU] = [nextU, U];
  [V, nextV] = [nextV, V];
}

function render() {
  const img = ctx.createImageData(GRID, GRID);
  for (let i=0; i<GRID*GRID; i++) {
    const u = U[i], v = V[i];
    const r = Math.floor((1-u)*255);
    const g = Math.floor(v*200);
    const b = Math.floor(u*v*255);
    img.data[i*4] = r; img.data[i*4+1] = g; img.data[i*4+2] = b; img.data[i*4+3] = 255;
  }
  // scale draw
  const tmp = document.createElement('canvas');
  tmp.width = GRID; tmp.height = GRID;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.drawImage(tmp, 0, 0, W, H);
}

function updatePortals() {
  for (const p of portals) {
    const gx = Math.max(0, Math.min(GRID-1, Math.floor(p.x / scale)));
    const gy = Math.max(0, Math.min(GRID-1, Math.floor(p.y / scale)));
    const i = gy*GRID + gx;
    const u = U[i]||0, v = V[i]||0;
    p.el.querySelector('.stats').textContent = `U:${u.toFixed(2)} V:${v.toFixed(2)}`;
    // attract to high V
    let bestX = p.x, bestY = p.y, bestV = -1;
    for (let dy=-5; dy<=5; dy+=2) for (let dx=-5; dx<=5; dx+=2) {
      const x = gx+dx, y = gy+dy;
      if (x>=0 && x<GRID && y>=0 && y<GRID) {
        const vv = V[y*GRID + x];
        if (vv > bestV) { bestV = vv; bestX = x*scale; bestY = y*scale; }
      }
    }
    p.vx += (bestX - p.x) * 0.01;
    p.vy += (bestY - p.y) * 0.01;
    p.vx *= 0.9; p.vy *= 0.9;
    p.x += p.vx; p.y += p.vy;
    p.x = Math.max(0, Math.min(W-120, p.x));
    p.y = Math.max(0, Math.min(H-70, p.y));
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
  }
}

function seal() {
  const genomes = portals.map(p => ({w1:p.mlp.w1, b1:p.mlp.b1, w2:p.mlp.w2, b2:p.mlp.b2}));
  localStorage.setItem('verse-f677-genomes', JSON.stringify(genomes));
  const ch = new BroadcastChannel('verse-f677');
  ch.postMessage({genomes});
  document.getElementById('status').textContent = 'Genome sealed & broadcast — Verse is now Verse everywhere';
  setTimeout(() => document.getElementById('status').textContent = 'F677 Gray-Scott Causal MLP Portal Mind', 2000);
}

function loadSealed() {
  const s = localStorage.getItem('verse-f677-genomes');
  if (s) {
    try {
      const genomes = JSON.parse(s);
      portals.forEach((p, i) => {
        if (genomes[i]) {
          p.mlp.w1 = genomes[i].w1; p.mlp.b1 = genomes[i].b1;
          p.mlp.w2 = genomes[i].w2; p.mlp.b2 = genomes[i].b2;
        }
      });
    } catch (e) { console.debug("lab f677-webgpu-grayscott-causal-mlp-portal-mind:", e); }
  }
}

const ch = new BroadcastChannel('verse-f677');
ch.onmessage = e => {
  if (e.data.genomes) {
    portals.forEach((p, i) => {
      if (e.data.genomes[i]) {
        p.mlp.w1 = e.data.genomes[i].w1; p.mlp.b1 = e.data.genomes[i].b1;
        p.mlp.w2 = e.data.genomes[i].w2; p.mlp.b2 = e.data.genomes[i].b2;
      }
    });
    document.getElementById('status').textContent = 'Adopted genome from other tab';
  }
};

document.getElementById('seed').onclick = () => inject(W/2, H/2, 0.3, 0.5);
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initField(); portals.forEach(p => p.mlp = new TinyMLP()); };

initField();
for (let i=0; i<4; i++) createPortal(200 + i*150, 200 + (i%2)*100);
loadSealed();

function loop() {
  stepRD();
  render();
  updatePortals();
  requestAnimationFrame(loop);
}
loop();
