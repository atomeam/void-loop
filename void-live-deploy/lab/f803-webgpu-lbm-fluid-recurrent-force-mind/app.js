const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
onresize = () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; };

// Simplified 2D fluid proxy (velocity field + density particles for visual LBM-like)
const NX = 64, NY = 36;
let u = new Float32Array(NX * NY), v = new Float32Array(NX * NY);
let dens = new Float32Array(NX * NY);
for (let i = 0; i < dens.length; i++) dens[i] = 0.1 + Math.random() * 0.05;

// Tiny Elman RNN: input 4, hidden 6, output 2
const HIDDEN = 6;
let Wxh = Array.from({length: HIDDEN}, () => Array.from({length: 4}, () => (Math.random()-0.5)*0.3));
let Whh = Array.from({length: HIDDEN}, () => Array.from({length: HIDDEN}, () => (Math.random()-0.5)*0.2));
let Why = Array.from({length: 2}, () => Array.from({length: HIDDEN}, () => (Math.random()-0.5)*0.4));
let h = new Float32Array(HIDDEN);
function rnn(input) {
  const newH = new Float32Array(HIDDEN);
  for (let i = 0; i < HIDDEN; i++) {
    let s = 0;
    for (let j = 0; j < 4; j++) s += Wxh[i][j] * input[j];
    for (let j = 0; j < HIDDEN; j++) s += Whh[i][j] * h[j];
    newH[i] = Math.tanh(s);
  }
  h.set(newH);
  const out = [0, 0];
  for (let i = 0; i < 2; i++) {
    let s = 0;
    for (let j = 0; j < HIDDEN; j++) s += Why[i][j] * h[j];
    out[i] = Math.tanh(s) * 0.8;
  }
  return out;
}

let px = W/2, py = H/2, pvx = 0, pvy = 0;
let tiltX = 0, tiltY = 0;
window.addEventListener('pointermove', e => {
  pvx = (e.clientX - px) * 0.1;
  pvy = (e.clientY - py) * 0.1;
  px = e.clientX; py = e.clientY;
});
window.addEventListener('deviceorientation', e => {
  tiltX = (e.gamma || 0) / 45;
  tiltY = (e.beta || 0) / 45;
});

const probes = [];
for (let i = 0; i < 4; i++) {
  const el = document.createElement('div');
  el.className = 'probe';
  el.textContent = 'probe ' + i;
  el.style.left = (20 + i * 25) + '%';
  el.style.top = (30 + (i%2)*20) + '%';
  document.getElementById('probes').appendChild(el);
  let drag = false, ox, oy;
  el.addEventListener('pointerdown', e => { drag = true; ox = e.clientX - el.offsetLeft; oy = e.clientY - el.offsetTop; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (drag) { el.style.left = (e.clientX - ox) + 'px'; el.style.top = (e.clientY - oy) + 'px'; } });
  el.addEventListener('pointerup', () => drag = false);
  probes.push(el);
}

function injectForce(fx, fy, cx, cy, rad = 8) {
  const gx = Math.floor(cx / W * NX), gy = Math.floor(cy / H * NY);
  for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    const x = gx + dx, y = gy + dy;
    if (x < 0 || x >= NX || y < 0 || y >= NY) continue;
    const d2 = dx*dx + dy*dy;
    if (d2 > rad*rad) continue;
    const w = Math.exp(-d2 / (rad*rad/4));
    const idx = y * NX + x;
    u[idx] += fx * w * 0.15;
    v[idx] += fy * w * 0.15;
    dens[idx] += 0.02 * w;
  }
}

function step() {
  // RNN force from recent motion + tilt
  const inp = [pvx, pvy, Math.hypot(pvx, pvy), (tiltX + tiltY) * 0.5];
  const [fx, fy] = rnn(inp);
  injectForce(fx, fy, px, py, 6);

  // Probes sample and lightly stir
  probes.forEach((p, i) => {
    const rect = p.getBoundingClientRect();
    const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
    const gx = Math.floor(cx / W * NX), gy = Math.floor(cy / H * NY);
    if (gx >= 0 && gx < NX && gy >= 0 && gy < NY) {
      const d = dens[gy * NX + gx];
      p.style.opacity = 0.4 + d * 2;
      p.style.background = `rgba(0,${Math.floor(200+d*100)},180,0.3)`;
      if (d > 0.4) injectForce((Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3, cx, cy, 3);
    }
  });

  // Simple advection + diffusion + decay (LBM proxy)
  const nu = new Float32Array(u), nv = new Float32Array(v), nd = new Float32Array(dens);
  for (let y = 1; y < NY-1; y++) for (let x = 1; x < NX-1; x++) {
    const idx = y * NX + x;
    const uu = u[idx], vv = v[idx];
    // semi-Lagrangian-ish
    const sx = x - uu * 0.8, sy = y - vv * 0.8;
    const ix = Math.max(0, Math.min(NX-1, Math.floor(sx))), iy = Math.max(0, Math.min(NY-1, Math.floor(sy)));
    const sidx = iy * NX + ix;
    nu[idx] = u[sidx] * 0.96 + (u[idx-1] + u[idx+1] + u[idx-NX] + u[idx+NX]) * 0.01;
    nv[idx] = v[sidx] * 0.96 + (v[idx-1] + v[idx+1] + v[idx-NX] + v[idx+NX]) * 0.01;
    nd[idx] = dens[sidx] * 0.98 + 0.002;
  }
  u.set(nu); v.set(nv); dens.set(nd);
  pvx *= 0.9; pvy *= 0.9;
}

function render() {
  const img = ctx.createImageData(W, H);
  const data = img.data;
  for (let y = 0; y < H; y++) {
    const gy = Math.floor(y / H * NY);
    for (let x = 0; x < W; x++) {
      const gx = Math.floor(x / W * NX);
      const idx = gy * NX + gx;
      const d = Math.min(1, dens[idx] * 3);
      const spd = Math.min(1, Math.hypot(u[idx], v[idx]) * 4);
      const p = (y * W + x) * 4;
      data[p] = Math.floor(spd * 80);
      data[p+1] = Math.floor(d * 180 + spd * 40);
      data[p+2] = Math.floor(200 - d * 100);
      data[p+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function loop() {
  step();
  render();
  requestAnimationFrame(loop);
}
loop();

// Seal
const idb = indexedDB.open('f803', 1);
idb.onupgradeneeded = e => e.target.result.createObjectStore('genome');
document.getElementById('seal').onclick = () => {
  const weights = { Wxh, Whh, Why, h: Array.from(h) };
  const tx = idb.result.transaction('genome', 'readwrite');
  tx.objectStore('genome').put(weights, 'rnn');
  const bc = new BroadcastChannel('f803-genome');
  bc.postMessage(weights);
  document.getElementById('status').textContent = 'Genome sealed';
};
document.getElementById('reset').onclick = () => location.reload();

// Adopt on load / channel
function adopt(w) {
  if (w.Wxh) { Wxh = w.Wxh; Whh = w.Whh; Why = w.Why; if (w.h) h.set(w.h); }
}
idb.onsuccess = () => {
  const tx = idb.result.transaction('genome');
  tx.objectStore('genome').get('rnn').onsuccess = e => { if (e.target.result) adopt(e.target.result); };
};
new BroadcastChannel('f803-genome').onmessage = e => adopt(e.data);
