const canvas = document.getElementById('canvas');
const status = document.getElementById('status');
const W = 128, H = 128;
let field = new Float32Array(W * H);
let useGPU = false;
let adapter, device, pipeline, bindGroup;

// Simple Lenia-like params
let kernelR = 6;
let growthMu = 0.15, growthSigma = 0.02;
let mlp = Array(20).fill(0).map(() => (Math.random()-0.5)*0.2);

function initField() {
  for (let i = 0; i < field.length; i++) field[i] = Math.random() < 0.05 ? 1 : 0;
}

function stepLeniaCPU() {
  const next = new Float32Array(W * H);
  const r = Math.max(3, Math.min(12, kernelR));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0, count = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const d2 = dx*dx + dy*dy;
          if (d2 > r*r || d2 === 0) continue;
          const nx = (x + dx + W) % W, ny = (y + dy + H) % H;
          const w = 1 - d2 / (r*r);
          sum += field[ny * W + nx] * w;
          count += w;
        }
      }
      const avg = count ? sum / count : 0;
      const g = Math.exp(-((avg - growthMu)**2) / (2 * growthSigma * growthSigma));
      next[y * W + x] = Math.max(0, Math.min(1, field[y * W + x] + 0.1 * (g - field[y * W + x])));
    }
  }
  field = next;
}

function getStats() {
  let mass = 0, peaks = 0, varSum = 0;
  const mean = field.reduce((a,b)=>a+b,0) / field.length;
  for (let i = 0; i < field.length; i++) {
    mass += field[i];
    varSum += (field[i] - mean)**2;
    if (field[i] > 0.6) peaks++;
  }
  return [mass / field.length, peaks / 100, Math.sqrt(varSum / field.length), growthMu, kernelR / 10, 0, 0, 0];
}

function mlpForward(stats) {
  // Tiny 8→4→6
  const h = [0,0,0,0];
  for (let i = 0; i < 4; i++) {
    let s = mlp[i];
    for (let j = 0; j < 8; j++) s += stats[j] * mlp[4 + i*8 + j];
    h[i] = Math.tanh(s);
  }
  const o = [0,0,0,0,0,0];
  for (let i = 0; i < 6; i++) {
    let s = mlp[36 + i];
    for (let j = 0; j < 4; j++) s += h[j] * mlp[42 + i*4 + j];
    o[i] = Math.tanh(s);
  }
  return o;
}

function updateMLP(stats, reward) {
  // Crude Hebbian-ish
  for (let i = 0; i < mlp.length; i++) mlp[i] += 0.001 * reward * (Math.random()-0.5);
}

const portals = [];
for (let i = 0; i < 5; i++) {
  const d = document.createElement('div');
  d.className = 'portal';
  d.textContent = 'Portal ' + (i+1);
  document.body.appendChild(d);
  portals.push({el: d, x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight});
}

function findPeaks() {
  const peaks = [];
  for (let y = 1; y < H-1; y++) for (let x = 1; x < W-1; x++) {
    const v = field[y*W+x];
    if (v > 0.55 && v >= field[y*W+x-1] && v >= field[y*W+x+1] && v >= field[(y-1)*W+x] && v >= field[(y+1)*W+x]) {
      peaks.push({x: x / W * window.innerWidth, y: y / H * window.innerHeight, v});
    }
  }
  return peaks.slice(0, 8);
}

function render() {
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < field.length; i++) {
    const v = field[i];
    const c = Math.floor(v * 255);
    img.data[i*4] = c * 0.3; img.data[i*4+1] = c * 0.6; img.data[i*4+2] = c; img.data[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height);
}

function loop() {
  stepLeniaCPU();
  const stats = getStats();
  const out = mlpForward(stats);
  kernelR = 5 + out[0] * 4;
  growthMu = 0.1 + out[1] * 0.1;
  const peaks = findPeaks();
  portals.forEach((p, i) => {
    if (peaks.length) {
      const pk = peaks[i % peaks.length];
      p.x += (pk.x - p.x) * 0.05 * (0.5 + out[2]);
      p.y += (pk.y - p.y) * 0.05 * (0.5 + out[2]);
    }
    p.el.style.transform = `translate(${p.x}px,${p.y}px) scale(${0.8 + out[3]*0.4})`;
    p.el.style.filter = `hue-rotate(${out[4]*60}deg)`;
  });
  updateMLP(stats, stats[1] - 0.2);
  render();
  status.textContent = `Mass:${stats[0].toFixed(2)} Peaks:${Math.round(stats[1]*100)} R:${kernelR.toFixed(1)}`;
  requestAnimationFrame(loop);
}

canvas.addEventListener('pointerdown', e => {
  const x = Math.floor(e.clientX / canvas.width * W);
  const y = Math.floor(e.clientY / canvas.height * H);
  for (let dy=-3; dy<=3; dy++) for (let dx=-3; dx<=3; dx++) {
    const nx = (x+dx+W)%W, ny = (y+dy+H)%H;
    field[ny*W+nx] = 1;
  }
});

document.getElementById('seal').onclick = async () => {
  const genome = {mlp: [...mlp], kernelR, growthMu};
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f0487', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(genome, 'latest');
    status.textContent = 'Sealed to IndexedDB';
  } catch(e) { status.textContent = 'Seal failed: ' + e.message; }
};

document.getElementById('reset').onclick = initField;

async function tryLoad() {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f0487', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readonly');
    const g = await new Promise(res => {
      const req = tx.objectStore('genomes').get('latest');
      req.onsuccess = () => res(req.result);
    });
    if (g) { mlp = g.mlp; kernelR = g.kernelR; growthMu = g.growthMu; status.textContent = 'Restored sealed genome'; }
  } catch(e) {}
}

initField();
tryLoad();
loop();
status.textContent = 'CPU Lenia running (WebGPU path available in full build)';
