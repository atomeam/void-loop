const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W = 128, H = 128;
let scale = 1;
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  scale = Math.min(canvas.width / W, canvas.height / H);
}
addEventListener('resize', resize);
resize();

// Gray-Scott state
let U = new Float32Array(W * H);
let V = new Float32Array(W * H);
for (let i = 0; i < U.length; i++) { U[i] = 1; V[i] = 0; }
// Seed a small region
for (let y = H/2 - 8; y < H/2 + 8; y++) for (let x = W/2 - 8; x < W/2 + 8; x++) {
  const i = y * W + x;
  U[i] = 0.5; V[i] = 0.25;
}

let F = 0.037, k = 0.06, Du = 0.16, Dv = 0.08;
let genome = { F: 0.037, k: 0.06, Du: 0.16, Dv: 0.08 };
let micEnabled = false;
let analyser = null;
let dataArray = null;

const orgs = []; // {x, y, el, v}

function idx(x, y) { return ((y + H) % H) * W + ((x + W) % W); }

function step() {
  const nextU = new Float32Array(U);
  const nextV = new Float32Array(V);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const u = U[i], v = V[i];
      const lapU = U[idx(x-1,y)] + U[idx(x+1,y)] + U[idx(x,y-1)] + U[idx(x,y+1)] - 4 * u;
      const lapV = V[idx(x-1,y)] + V[idx(x+1,y)] + V[idx(x,y-1)] + V[idx(x,y+1)] - 4 * v;
      const uvv = u * v * v;
      nextU[i] = u + (Du * lapU - uvv + F * (1 - u));
      nextV[i] = v + (Dv * lapV + uvv - (F + k) * v);
      nextU[i] = Math.max(0, Math.min(1, nextU[i]));
      nextV[i] = Math.max(0, Math.min(1, nextV[i]));
    }
  }
  U = nextU; V = nextV;
}

function draw() {
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const v = V[i];
    const g = Math.min(255, v * 400);
    img.data[i*4] = g * 0.3;
    img.data[i*4+1] = g * 0.8;
    img.data[i*4+2] = g;
    img.data[i*4+3] = 255;
  }
  const tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
}

function updateOrgs() {
  const candidates = [];
  for (let y = 4; y < H - 4; y += 8) {
    for (let x = 4; x < W - 4; x += 8) {
      const v = V[y * W + x];
      if (v > 0.35) candidates.push({x, y, v});
    }
  }
  candidates.sort((a,b) => b.v - a.v);
  while (orgs.length > 6) {
    const o = orgs.pop();
    o.el.remove();
  }
  for (let i = 0; i < Math.min(6, candidates.length); i++) {
    const c = candidates[i];
    let org = orgs[i];
    if (!org) {
      const el = document.createElement('div');
      el.className = 'org';
      el.textContent = 'organism';
      document.body.appendChild(el);
      org = {x: c.x, y: c.y, el, v: c.v};
      orgs.push(org);
      makeDraggable(org);
    }
    org.x = c.x; org.y = c.y; org.v = c.v;
    const sx = (c.x / W) * canvas.width;
    const sy = (c.y / H) * canvas.height;
    org.el.style.left = (sx - 30) + 'px';
    org.el.style.top = (sy - 20) + 'px';
    const hue = 200 + (genome.k * 1000);
    org.el.style.background = `hsla(${hue}, 70%, ${40 + c.v*40}%, 0.75)`;
    org.el.style.transform = `scale(${0.6 + c.v})`;
  }
}

function makeDraggable(org) {
  let dragging = false, ox, oy;
  org.el.addEventListener('pointerdown', e => {
    dragging = true;
    ox = e.clientX - parseFloat(org.el.style.left);
    oy = e.clientY - parseFloat(org.el.style.top);
    org.el.setPointerCapture(e.pointerId);
  });
  org.el.addEventListener('pointermove', e => {
    if (!dragging) return;
    org.el.style.left = (e.clientX - ox) + 'px';
    org.el.style.top = (e.clientY - oy) + 'px';
  });
  org.el.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    const cx = parseFloat(org.el.style.left) + 30;
    const cy = parseFloat(org.el.style.top) + 20;
    const gx = Math.floor((cx / canvas.width) * W);
    const gy = Math.floor((cy / canvas.height) * H);
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const i = idx(gx + dx, gy + dy);
      V[i] = Math.min(1, V[i] + 0.4);
      U[i] = Math.max(0, U[i] - 0.2);
    }
    status.textContent = `Reseeded at ${gx},${gy}`;
  });
}

canvas.addEventListener('pointerdown', e => {
  const rect = canvas.getBoundingClientRect();
  const gx = Math.floor(((e.clientX - rect.left) / canvas.width) * W);
  const gy = Math.floor(((e.clientY - rect.top) / canvas.height) * H);
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
    const i = idx(gx + dx, gy + dy);
    V[i] = Math.min(1, V[i] + 0.5);
  }
});

document.getElementById('micBtn').onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ac = new AudioContext();
    const src = ac.createMediaStreamSource(stream);
    analyser = ac.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    micEnabled = true;
    status.textContent = 'Mic active — spectral bands modulating F/k';
  } catch (err) {
    status.textContent = 'Mic denied — pointer only';
  }
};

function updateMic() {
  if (!micEnabled || !analyser) return;
  analyser.getByteFrequencyData(dataArray);
  let low = 0, mid = 0, high = 0;
  const n = dataArray.length;
  for (let i = 0; i < n; i++) {
    if (i < n/4) low += dataArray[i];
    else if (i < n/2) mid += dataArray[i];
    else high += dataArray[i];
  }
  low /= (n/4 * 255); mid /= (n/4 * 255); high /= (n/2 * 255);
  F = genome.F + low * 0.01 - 0.005;
  k = genome.k + mid * 0.02 - 0.01;
  Du = genome.Du + high * 0.05;
  F = Math.max(0.01, Math.min(0.08, F));
  k = Math.max(0.03, Math.min(0.08, k));
}

let fitness = 0;
function evaluate() {
  let ent = 0, spots = 0;
  for (let i = 0; i < V.length; i++) {
    const p = V[i] + 1e-6;
    ent -= p * Math.log(p);
    if (V[i] > 0.4) spots++;
  }
  fitness = ent * 0.01 + spots * 0.1;
  if (Math.random() < 0.002) {
    genome.F += (Math.random() - 0.5) * 0.005;
    genome.k += (Math.random() - 0.5) * 0.005;
    status.textContent = `Evolved F=${genome.F.toFixed(3)} k=${genome.k.toFixed(3)} fit=${fitness.toFixed(1)}`;
  }
}

let db;
const req = indexedDB.open('f517-garden', 1);
req.onupgradeneeded = e => {
  e.target.result.createObjectStore('genomes', { keyPath: 'id' });
};
req.onsuccess = e => { db = e.target.result; };

document.getElementById('sealBtn').onclick = () => {
  if (!db) { status.textContent = 'IDB unavailable'; return; }
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({ id: 'best', genome, fitness, ts: Date.now() });
  status.textContent = 'Genome sealed';
};
document.getElementById('restoreBtn').onclick = () => {
  if (!db) return;
  const tx = db.transaction('genomes', 'readonly');
  const g = tx.objectStore('genomes').get('best');
  g.onsuccess = () => {
    if (g.result) {
      genome = g.result.genome;
      status.textContent = 'Genome restored';
    }
  };
};

function loop() {
  updateMic();
  step();
  draw();
  updateOrgs();
  evaluate();
  requestAnimationFrame(loop);
}
loop();
