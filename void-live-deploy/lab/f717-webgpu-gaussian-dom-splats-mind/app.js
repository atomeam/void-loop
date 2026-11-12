const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 12;
const splats = [];
const GRID = 32;
let density = new Float32Array(GRID * GRID);
let density2 = new Float32Array(GRID * GRID);

function rand(a=1) { return (Math.random()-0.5)*a; }

class MLP {
  constructor() {
    this.w1 = Array.from({length:6*8}, () => rand(0.4));
    this.b1 = Array.from({length:8}, () => rand(0.2));
    this.w2 = Array.from({length:8*5}, () => rand(0.4));
    this.b2 = Array.from({length:5}, () => rand(0.2));
  }
  forward(x) {
    const h = new Array(8).fill(0);
    for (let i=0; i<8; i++) {
      let s = this.b1[i];
      for (let j=0; j<6; j++) s += x[j] * this.w1[i*6+j];
      h[i] = Math.tanh(s);
    }
    const y = new Array(5).fill(0);
    for (let i=0; i<5; i++) {
      let s = this.b2[i];
      for (let j=0; j<8; j++) s += h[j] * this.w2[i*8+j];
      y[i] = Math.tanh(s);
    }
    return y;
  }
  mutate(rate=0.1) {
    const m = (arr) => arr.map(v => v + rand(rate));
    this.w1 = m(this.w1); this.b1 = m(this.b1);
    this.w2 = m(this.w2); this.b2 = m(this.b2);
  }
  clone() {
    const c = new MLP();
    c.w1 = [...this.w1]; c.b1 = [...this.b1];
    c.w2 = [...this.w2]; c.b2 = [...this.b2];
    return c;
  }
}

for (let i=0; i<N; i++) {
  const el = document.createElement('div');
  el.className = 'splat';
  document.body.appendChild(el);
  splats.push({
    el, x: Math.random()*W, y: Math.random()*H,
    scale: 1, opacity: 0.7, hue: Math.random()*360,
    mlp: new MLP(), fitness: 0.5
  });
}

let px=W/2, py=H/2, vx=0, vy=0;
let orient = {beta:0, gamma:0};
addEventListener('pointermove', e => { vx = e.clientX - px; vy = e.clientY - py; px=e.clientX; py=e.clientY; });
addEventListener('pointerdown', e => {
  for (const s of splats) {
    const dx = s.x - e.clientX, dy = s.y - e.clientY;
    if (dx*dx+dy*dy < 4000) s.fitness += 0.3;
  }
});

if ('DeviceOrientationEvent' in window) {
  addEventListener('deviceorientation', e => { orient.beta = e.beta||0; orient.gamma = e.gamma||0; });
}

function sampleDensity(x, y) {
  const gx = Math.max(0, Math.min(GRID-1, Math.floor(x / W * GRID)));
  const gy = Math.max(0, Math.min(GRID-1, Math.floor(y / H * GRID)));
  return density[gy*GRID + gx];
}

function updateDensity() {
  for (let i=0; i<density.length; i++) density2[i] = density[i]*0.96;
  const gx = Math.floor(px / W * GRID), gy = Math.floor(py / H * GRID);
  if (gx>=0 && gx<GRID && gy>=0 && gy<GRID) density2[gy*GRID+gx] += 0.4;
  for (const s of splats) {
    const sgx = Math.floor(s.x / W * GRID), sgy = Math.floor(s.y / H * GRID);
    if (sgx>=0 && sgx<GRID && sgy>=0 && sgy<GRID) density2[sgy*GRID+sgx] += 0.05 * s.scale;
  }
  [density, density2] = [density2, density];
}

function step() {
  updateDensity();
  ctx.clearRect(0,0,W,H);
  const img = ctx.createImageData(GRID, GRID);
  for (let i=0; i<density.length; i++) {
    const v = Math.min(255, density[i]*400);
    img.data[i*4] = v*0.3; img.data[i*4+1] = v*0.6; img.data[i*4+2] = v; img.data[i*4+3] = 180;
  }
  ctx.putImageData(img, 0, 0);
  ctx.drawImage(canvas, 0, 0, GRID, GRID, 0, 0, W, H);

  for (const s of splats) {
    const dens = sampleDensity(s.x, s.y);
    const dxp = (px - s.x)/W, dyp = (py - s.y)/H;
    const inp = [dens, dxp, dyp, orient.gamma/90, orient.beta/90, s.fitness];
    const out = s.mlp.forward(inp);
    s.x += out[0]*4 + (orient.gamma||0)*0.05;
    s.y += out[1]*4 + (orient.beta||0)*0.05;
    s.scale = Math.max(0.3, Math.min(2.5, s.scale + out[2]*0.05));
    s.opacity = Math.max(0.2, Math.min(1, s.opacity + out[3]*0.03));
    s.hue = (s.hue + out[4]*8 + 360) % 360;
    s.x = (s.x + W) % W; s.y = (s.y + H) % H;
    s.fitness *= 0.995;
    const dist = Math.hypot(s.x-px, s.y-py);
    s.fitness += Math.max(0, 1 - dist/300) * 0.01;
    s.el.style.transform = `translate(${s.x-40}px,${s.y-40}px) scale(${s.scale})`;
    s.el.style.opacity = s.opacity;
    s.el.style.filter = `blur(${(2-s.scale)*4}px) hue-rotate(${s.hue}deg)`;
  }
  for (let i=0; i<N; i++) for (let j=i+1; j<N; j++) {
    const a=splats[i], b=splats[j];
    if (Math.hypot(a.x-b.x, a.y-b.y) < 80 && a.fitness > b.fitness) {
      if (Math.random() < 0.05) {
        b.mlp = a.mlp.clone(); b.mlp.mutate(0.15);
        b.fitness = a.fitness * 0.8;
      }
    }
  }
  requestAnimationFrame(step);
}
step();

const DB = 'verse-f717';
const bc = new BroadcastChannel('verse-f717');
document.getElementById('seal').onclick = async () => {
  const best = splats.reduce((a,b) => a.fitness > b.fitness ? a : b);
  const data = { w1:best.mlp.w1, b1:best.mlp.b1, w2:best.mlp.w2, b2:best.mlp.b2 };
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open(DB,1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put(data, 'best');
    bc.postMessage(data);
    document.getElementById('status').textContent = 'Sealed';
  } catch(e) { console.warn(e); }
};
document.getElementById('reset').onclick = () => location.reload();
bc.onmessage = (ev) => {
  const data = ev.data;
  if (!data || !data.w1) return;
  const worst = splats.reduce((a,b) => a.fitness < b.fitness ? a : b);
  worst.mlp.w1 = [...data.w1]; worst.mlp.b1 = [...data.b1];
  worst.mlp.w2 = [...data.w2]; worst.mlp.b2 = [...data.b2];
  worst.fitness = 0.7;
};
