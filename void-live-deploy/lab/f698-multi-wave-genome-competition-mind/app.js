const N = 48, DAMP_BASE = 0.98;
const canvases = [], grids = [], prevs = [], genomes = [], fitness = [];
const gridEl = document.getElementById('grid');
for (let i = 0; i < 4; i++) {
  const c = document.createElement('canvas');
  c.width = c.height = N;
  c.dataset.i = i;
  gridEl.appendChild(c);
  canvases.push(c);
  grids.push(new Float32Array(N*N));
  prevs.push(new Float32Array(N*N));
  genomes.push(new Float32Array([0.3 + Math.random()*0.4, 0.02 + Math.random()*0.04, 0.5 + Math.random()*0.5, Math.random()*360]));
  fitness.push(0);
}
let tiltX = 0, tiltY = 0;
window.addEventListener('deviceorientation', e => {
  tiltX = (e.gamma || 0) / 90;
  tiltY = (e.beta || 0) / 90;
}, true);
function idx(x,y){ return y*N + x; }
function step(i) {
  const u = grids[i], p = prevs[i], g = genomes[i];
  const c2 = g[0]*g[0], damp = 1 - g[1];
  const next = new Float32Array(N*N);
  for (let y=1; y<N-1; y++) for (let x=1; x<N-1; x++) {
    const lap = u[idx(x-1,y)] + u[idx(x+1,y)] + u[idx(x,y-1)] + u[idx(x,y+1)] - 4*u[idx(x,y)];
    let v = 2*u[idx(x,y)] - p[idx(x,y)] + c2 * lap;
    v *= damp;
    v += tiltX * 0.002 * (x - N/2) + tiltY * 0.002 * (y - N/2);
    next[idx(x,y)] = Math.max(-2, Math.min(2, v));
  }
  prevs[i].set(u);
  grids[i].set(next);
  fitness[i] *= 0.995;
}
function render(i) {
  const c = canvases[i], ctx = c.getContext('2d');
  const img = ctx.createImageData(N, N);
  const u = grids[i], hue = genomes[i][3];
  for (let k=0; k<N*N; k++) {
    const v = Math.abs(u[k]);
    const a = Math.min(255, v*180);
    img.data[k*4] = Math.sin(hue*0.017)*a;
    img.data[k*4+1] = Math.sin((hue+120)*0.017)*a;
    img.data[k*4+2] = Math.sin((hue+240)*0.017)*a;
    img.data[k*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const f = fitness[i];
  c.style.transform = `scale(${0.85 + Math.min(0.3, f*0.05)})`;
  c.classList.toggle('fit', f > 5);
}
function inject(i, mx, my, amp) {
  const g = genomes[i];
  const cx = Math.floor(mx * N), cy = Math.floor(my * N);
  for (let y=Math.max(0,cy-4); y<Math.min(N,cy+5); y++)
    for (let x=Math.max(0,cx-4); x<Math.min(N,cx+5); x++) {
      const d = Math.hypot(x-cx, y-cy);
      if (d < 5) grids[i][idx(x,y)] += amp * g[2] * Math.exp(-d*d/8);
    }
  fitness[i] += amp * g[2];
}
canvases.forEach((c,i) => {
  c.addEventListener('pointerdown', e => {
    const r = c.getBoundingClientRect();
    inject(i, (e.clientX-r.left)/r.width, (e.clientY-r.top)/r.height, 1.2);
  });
  c.addEventListener('pointermove', e => {
    if (e.buttons) {
      const r = c.getBoundingClientRect();
      inject(i, (e.clientX-r.left)/r.width, (e.clientY-r.top)/r.height, 0.4);
    }
  });
});
function transfer() {
  const order = [0,1,2,3].sort((a,b) => fitness[b]-fitness[a]);
  const top = order[0], bot = order[3];
  const ng = new Float32Array(genomes[top]);
  for (let k=0; k<4; k++) ng[k] += (Math.random()-0.5)*0.08;
  ng[0] = Math.max(0.1, Math.min(0.8, ng[0]));
  ng[1] = Math.max(0.005, Math.min(0.1, ng[1]));
  ng[2] = Math.max(0.2, Math.min(1.5, ng[2]));
  ng[3] = (ng[3] + 360) % 360;
  genomes[bot].set(ng);
  fitness[bot] = fitness[top]*0.3;
  document.getElementById('status').textContent = `transfer ${top}→${bot}`;
}
setInterval(transfer, 8000);
function loop() {
  for (let i=0; i<4; i++) { step(i); render(i); }
  requestAnimationFrame(loop);
}
loop();
// IndexedDB
let db;
const req = indexedDB.open('verse-f698', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
req.onsuccess = e => {
  db = e.target.result;
  const tx = db.transaction('genomes','readonly');
  tx.objectStore('genomes').get('all').onsuccess = ev => {
    if (ev.target.result) {
      const d = ev.target.result;
      for (let i=0; i<4; i++) genomes[i].set(d.genomes[i]);
      fitness.splice(0,4,...d.fitness);
      document.getElementById('status').textContent = 'restored';
    }
  };
};
document.getElementById('seal').onclick = () => {
  if (!db) return;
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put({genomes: genomes.map(g=>Array.from(g)), fitness:[...fitness]}, 'all');
  document.getElementById('status').textContent = 'sealed';
};
document.getElementById('reset').onclick = () => {
  for (let i=0; i<4; i++) {
    grids[i].fill(0); prevs[i].fill(0); fitness[i]=0;
    genomes[i].set([0.3+Math.random()*0.4, 0.02+Math.random()*0.04, 0.5+Math.random()*0.5, Math.random()*360]);
  }
  document.getElementById('status').textContent = 'reset';
};
