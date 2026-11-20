const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.onresize = () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; };

const N = 64;
const dx = 1;
let c = new Float32Array(N*N);
for (let i=0; i<N*N; i++) c[i] = (Math.random()-0.5)*0.1;

// Local mind: parameters epsilon (interface width), M (mobility)
let params = { eps: 1.2, M: 0.8, fitness: 0 };
let genomes = [ { ...params }, { eps: 0.8, M: 1.2, fitness: 0 }, { eps: 1.5, M: 0.5, fitness: 0 } ];
let best = 0;

// IndexedDB + BroadcastChannel for sealed transfer
const dbName = 'verse-f852-ch';
const channel = new BroadcastChannel('f852-genome');
let idb;
const req = indexedDB.open(dbName, 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', { keyPath: 'id' });
req.onsuccess = e => { idb = e.target.result; loadGenome(); };
function loadGenome() {
  if (!idb) return;
  const tx = idb.transaction('genomes', 'readonly');
  const g = tx.objectStore('genomes').get('best');
  g.onsuccess = () => { if (g.result) { Object.assign(params, g.result); updateStats(); } };
}
channel.onmessage = e => {
  if (e.data.fitness > params.fitness) {
    Object.assign(params, e.data);
    updateStats();
  }
};
function seal() {
  params.fitness = Math.max(params.fitness, genomes[best].fitness);
  if (idb) {
    const tx = idb.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put({ id: 'best', ...params });
  }
  channel.postMessage({ ...params });
  document.getElementById('seal').textContent = 'Sealed!';
  setTimeout(() => document.getElementById('seal').textContent = 'Seal Genome', 1000);
}

// DeviceOrientation as causal bias
let orient = { beta: 0, gamma: 0 };
window.addEventListener('deviceorientation', e => {
  if (e.beta != null) orient.beta = e.beta / 90;
  if (e.gamma != null) orient.gamma = e.gamma / 90;
});
// Pointer fallback
let pointer = { x: 0.5, y: 0.5, dx: 0, dy: 0 };
canvas.addEventListener('pointermove', e => {
  pointer.dx = (e.clientX / W - pointer.x) * 2;
  pointer.dy = (e.clientY / H - pointer.y) * 2;
  pointer.x = e.clientX / W;
  pointer.y = e.clientY / H;
});

// Portals as interactive measurement/injection points
const portals = [];
for (let i=0; i<4; i++) {
  const p = document.createElement('div');
  p.className = 'portal';
  p.style.left = (20 + i*15) + '%';
  p.style.top = (30 + (i%2)*20) + '%';
  p.textContent = 'Portal ' + i;
  document.body.appendChild(p);
  let dragging = false, ox, oy;
  p.addEventListener('pointerdown', e => { dragging=true; ox=e.offsetX; oy=e.offsetY; e.target.setPointerCapture(e.pointerId); });
  p.addEventListener('pointermove', e => {
    if (!dragging) return;
    p.style.left = (e.clientX - ox) + 'px';
    p.style.top = (e.clientY - oy) + 'px';
  });
  p.addEventListener('pointerup', () => dragging=false);
  p.addEventListener('click', () => {
    genomes[best].fitness += 1;
    params.fitness += 0.5;
    // slight mutation
    params.eps += (Math.random()-0.5)*0.1;
    params.M += (Math.random()-0.5)*0.05;
    updateStats();
  });
  portals.push(p);
}

function updateStats() {
  document.getElementById('stats').textContent = `ε=${params.eps.toFixed(2)} M=${params.M.toFixed(2)} fit=${params.fitness.toFixed(1)}`;
}

// Cahn-Hilliard step (simplified explicit finite difference)
function laplacian(arr, i, j) {
  const idx = j*N + i;
  const l = arr[j*N + (i-1+N)%N];
  const r = arr[j*N + (i+1)%N];
  const u = arr[((j-1+N)%N)*N + i];
  const d = arr[((j+1)%N)*N + i];
  return (l + r + u + d - 4*arr[idx]) / (dx*dx);
}
function step() {
  const eps2 = params.eps * params.eps;
  const biasX = orient.gamma || pointer.dx;
  const biasY = orient.beta || pointer.dy;
  // Precompute chemical potential mu
  const mu = new Float32Array(N*N);
  for (let j=0; j<N; j++) {
    for (let i=0; i<N; i++) {
      const idx = j*N + i;
      const lap = laplacian(c, i, j);
      mu[idx] = c[idx]*c[idx]*c[idx] - c[idx] - eps2 * lap;
    }
  }
  const next = new Float32Array(N*N);
  for (let j=0; j<N; j++) {
    for (let i=0; i<N; i++) {
      const idx = j*N + i;
      const lapmu = laplacian(mu, i, j);
      const bx = biasX * 0.005 * (i/N - 0.5);
      const by = biasY * 0.005 * (j/N - 0.5);
      next[idx] = c[idx] + params.M * 0.05 * lapmu + bx + by;
      next[idx] = Math.max(-1.5, Math.min(1.5, next[idx]));
    }
  }
  c = next;

  // Portal injection
  portals.forEach((p) => {
    const rect = p.getBoundingClientRect();
    const gx = Math.floor(((rect.left + 30) / W) * N);
    const gy = Math.floor(((rect.top + 30) / H) * N);
    if (gx >= 0 && gx < N && gy >= 0 && gy < N) {
      const idx = gy * N + gx;
      c[idx] += (Math.random() > 0.5 ? 0.08 : -0.08);
      if (Math.abs(c[idx]) > 0.4) genomes[best].fitness += 0.005;
    }
  });
}

function draw() {
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const v = Math.max(0, Math.min(1, (c[i] + 1) / 2));
    const r = Math.floor(v * 200 + 30);
    const b = Math.floor((1 - v) * 200 + 30);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = 80;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  // Scale up using drawImage from a temporary
  const tmp = document.createElement('canvas');
  tmp.width = N; tmp.height = N;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, W, H);
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}
loop();

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => {
  for (let i=0; i<N*N; i++) c[i] = (Math.random()-0.5)*0.2;
  params.fitness = 0;
  updateStats();
};
updateStats();
