const W = 80, H = 45;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let u = new Float32Array(W * H), v = new Float32Array(W * H), nextU = new Float32Array(W * H), nextV = new Float32Array(W * H);
for (let i = 0; i < u.length; i++) { u[i] = 1.0; v[i] = Math.random() * 0.1; }
const cx = W/2, cy = H/2;
for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const i = (cy+y)*W + (cx+x); if (i >= 0 && i < u.length) v[i] = 0.5; }
let F = 0.037, K = 0.06, Du = 0.16, Dv = 0.08;
let genes = [F, K, Du, Dv];
let pointer = {x: 0.5, y: 0.5};
let activity = 0.5;
const cells = [];
for (let i = 0; i < 8; i++) {
  const el = document.createElement('div'); el.className = 'cell'; el.style.left = Math.random()*80 + '%'; el.style.top = Math.random()*80 + '%';
  document.body.appendChild(el);
  cells.push({el, x: Math.random(), y: Math.random(), vx: 0, vy: 0});
  el.addEventListener('click', () => {
    const ix = Math.floor(cells[i].x * W), iy = Math.floor(cells[i].y * H);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const idx = (iy+dy)*W + (ix+dx); if (idx >= 0 && idx < u.length) v[idx] = Math.min(1, v[idx] + 0.4);
    }
  });
}
function stepRD() {
  for (let y = 1; y < H-1; y++) for (let x = 1; x < W-1; x++) {
    const i = y*W + x;
    const lapU = u[i-1] + u[i+1] + u[i-W] + u[i+W] - 4*u[i];
    const lapV = v[i-1] + v[i+1] + v[i-W] + v[i+W] - 4*v[i];
    const uvv = u[i] * v[i] * v[i];
    nextU[i] = Math.max(0, Math.min(1, u[i] + Du * lapU - uvv + F * (1 - u[i])));
    nextV[i] = Math.max(0, Math.min(1, v[i] + Dv * lapV + uvv - (F + K) * v[i]));
  }
  const px = Math.floor(pointer.x * W), py = Math.floor(pointer.y * H), pi = py*W + px;
  if (pi >= 0 && pi < u.length) nextV[pi] = Math.min(1, nextV[pi] + 0.15);
  [u, nextU] = [nextU, u]; [v, nextV] = [nextV, v];
}
function render() {
  canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight;
  const img = ctx.createImageData(W, H); let sum = 0;
  for (let i = 0; i < u.length; i++) {
    const val = v[i]; sum += val; const c = Math.floor(val * 255);
    img.data[i*4] = c; img.data[i*4+1] = Math.floor(c * 0.6); img.data[i*4+2] = 255 - c; img.data[i*4+3] = 180;
  }
  activity = sum / u.length;
  document.documentElement.style.setProperty('--activity', activity);
  document.documentElement.style.setProperty('--hue', 180 + activity * 120);
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
}
function updateCells() {
  for (const c of cells) {
    const ix = Math.floor(c.x * W), iy = Math.floor(c.y * H);
    let gx = 0, gy = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const idx = (iy+dy)*W + (ix+dx); if (idx >= 0 && idx < v.length) { gx += dx * v[idx]; gy += dy * v[idx]; }
    }
    c.vx = c.vx * 0.8 + gx * 0.02; c.vy = c.vy * 0.8 + gy * 0.02;
    c.x = Math.max(0.05, Math.min(0.95, c.x + c.vx)); c.y = Math.max(0.05, Math.min(0.95, c.y + c.vy));
    c.el.style.left = (c.x * 100) + '%'; c.el.style.top = (c.y * 100) + '%';
    const local = v[iy*W + ix] || 0;
    c.el.style.transform = `scale(${0.6 + local * 1.5})`; c.el.style.opacity = 0.5 + local;
  }
}
const workerCode = `let pop = []; const POP = 6; function randGene() { return [0.02+Math.random()*0.03, 0.05+Math.random()*0.03, 0.1+Math.random()*0.1, 0.05+Math.random()*0.05]; } for (let i = 0; i < POP; i++) pop.push({g: randGene(), f: 0}); self.onmessage = (e) => { const {fitness} = e.data; pop[0].f = fitness; pop.sort((a,b) => b.f - a.f); const best = pop[0].g; for (let i = 3; i < POP; i++) pop[i].g = best.map(g => g + (Math.random()-0.5)*0.01); self.postMessage({genes: best}); };`;
const worker = new Worker(URL.createObjectURL(new Blob([workerCode], {type: 'application/javascript'})));
worker.onmessage = (e) => { genes = e.data.genes; F = genes[0]; K = genes[1]; Du = genes[2]; Dv = genes[3]; document.getElementById('seal').textContent = `genes: F=${F.toFixed(3)} K=${K.toFixed(3)}`; };
let frame = 0;
function loop() { stepRD(); render(); updateCells(); frame++; if (frame % 30 === 0) { let mean = 0, var_ = 0; for (let i = 0; i < v.length; i++) mean += v[i]; mean /= v.length; for (let i = 0; i < v.length; i++) var_ += (v[i]-mean)**2; const fitness = var_ / v.length + mean * 0.5; worker.postMessage({fitness}); } requestAnimationFrame(loop); }
loop();
window.addEventListener('pointermove', (e) => { pointer.x = e.clientX / window.innerWidth; pointer.y = e.clientY / window.innerHeight; });
window.addEventListener('resize', () => { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; });
