const W = 32, H = 32;
let density = new Float32Array(W * H);
let hueBias = 0;
const portals = [];
const channel = new BroadcastChannel('f872-field');
let mlpWeights = new Float32Array(4 * 8 + 8 * 2 + 8 + 2); // simple
let lastOri = {b:0, g:0};
let pointer = {x:0, y:0, vx:0, vy:0};

// init random weights
for (let i = 0; i < mlpWeights.length; i++) mlpWeights[i] = (Math.random() - 0.5) * 0.4;

function mlpForward(input) {
  // input: [b, g, res, 1]
  const h = new Float32Array(8);
  for (let j = 0; j < 8; j++) {
    let s = mlpWeights[4*8 + j]; // bias-ish, simplified
    for (let i = 0; i < 4; i++) s += input[i] * mlpWeights[i*8 + j];
    h[j] = Math.tanh(s);
  }
  const out = new Float32Array(2);
  for (let k = 0; k < 2; k++) {
    let s = mlpWeights[4*8 + 8 + k];
    for (let j = 0; j < 8; j++) s += h[j] * mlpWeights[4*8 + 8*2 + j*2 + k];
    out[k] = Math.tanh(s);
  }
  return out;
}

function inject(x, y, val) {
  const ix = Math.floor(x * W), iy = Math.floor(y * H);
  if (ix >= 0 && ix < W && iy >= 0 && iy < H) density[iy * W + ix] = Math.min(1, density[iy * W + ix] + val);
}

function stepField() {
  // simple diffusion + decay
  const next = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = density[y * W + x] * 0.85;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = (x + dx + W) % W, ny = (y + dy + H) % H;
          s += density[ny * W + nx] * 0.02;
        }
      }
      next[y * W + x] = Math.max(0, Math.min(1, s));
    }
  }
  density.set(next);
}

function sample(x, y) {
  const ix = Math.floor(x * W), iy = Math.floor(y * H);
  return density[Math.max(0, Math.min(H-1, iy)) * W + Math.max(0, Math.min(W-1, ix))] || 0;
}

function createPortals() {
  for (let i = 0; i < 6; i++) {
    const p = document.createElement('div');
    p.className = 'portal';
    p.textContent = '•';
    p.style.left = (20 + Math.random() * 60) + '%';
    p.style.top = (20 + Math.random() * 60) + '%';
    p.onclick = () => rewardPortal(p);
    document.body.appendChild(p);
    portals.push(p);
  }
}

function rewardPortal(p) {
  const rect = p.getBoundingClientRect();
  const sx = rect.left / innerWidth, sy = rect.top / innerHeight;
  const d = sample(sx, sy);
  // simple delta update toward current output
  const input = [lastOri.b, lastOri.g, Math.hypot(pointer.vx, pointer.vy), 1];
  const out = mlpForward(input);
  const target = [Math.min(1, d + 0.3), hueBias];
  const lr = 0.08;
  // crude update on output layer
  for (let k = 0; k < 2; k++) {
    const err = target[k] - out[k];
    mlpWeights[4*8 + 8 + k] += lr * err;
  }
  // broadcast seal
  channel.postMessage({ type: 'genome', weights: Array.from(mlpWeights) });
  p.style.transform = 'scale(1.4)';
  setTimeout(() => p.style.transform = '', 200);
}

function updatePortals() {
  portals.forEach(p => {
    const rect = p.getBoundingClientRect();
    const sx = (rect.left + 40) / innerWidth;
    const sy = (rect.top + 40) / innerHeight;
    const d = sample(sx, sy);
    const scale = 0.7 + d * 1.2;
    const hue = 200 + hueBias * 80 + d * 40;
    p.style.transform = `scale(${scale})`;
    p.style.filter = `hue-rotate(${hue}deg) blur(${d*4}px)`;
    p.style.opacity = 0.6 + d * 0.4;
  });
}

function drawField() {
  const canvas = document.getElementById('field');
  canvas.width = innerWidth; canvas.height = innerHeight;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let i = 0; i < density.length; i++) {
    const v = density[i];
    img.data[i*4] = v * 80;
    img.data[i*4+1] = v * 160;
    img.data[i*4+2] = v * 255;
    img.data[i*4+3] = v * 180;
  }
  const tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
}

channel.onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === 'inject') {
    inject(msg.x, msg.y, msg.val);
    hueBias = (hueBias + msg.hue) * 0.5;
  } else if (msg.type === 'genome') {
    if (msg.weights && msg.weights.length === mlpWeights.length) {
      mlpWeights.set(msg.weights);
    }
  }
};

window.addEventListener('deviceorientation', (e) => {
  lastOri.b = (e.beta || 0) / 90;
  lastOri.g = (e.gamma || 0) / 90;
});

window.addEventListener('pointermove', (e) => {
  pointer.vx = (e.clientX - pointer.x) / innerWidth;
  pointer.vy = (e.clientY - pointer.y) / innerHeight;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});

document.getElementById('seal').onclick = () => {
  channel.postMessage({ type: 'genome', weights: Array.from(mlpWeights) });
  // IndexedDB seal (simplified)
  try {
    const req = indexedDB.open('verse-f872', 1);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('genomes', 'readwrite');
      tx.objectStore('genomes').put({ id: 'local', weights: Array.from(mlpWeights), t: Date.now() });
    };
    req.onupgradeneeded = () => req.result.createObjectStore('genomes', { keyPath: 'id' });
  } catch (e) { console.debug("lab f872-webrtc-shared-orientation-mlp-field-mind:", e); }
};

function loop() {
  const input = [lastOri.b, lastOri.g, Math.hypot(pointer.vx, pointer.vy) * 5, 1];
  const out = mlpForward(input);
  const px = 0.5 + lastOri.g * 0.3 + pointer.x / innerWidth * 0.2;
  const py = 0.5 + lastOri.b * 0.3 + pointer.y / innerHeight * 0.2;
  const val = (out[0] + 1) * 0.08;
  inject(px, py, val);
  hueBias = out[1];
  channel.postMessage({ type: 'inject', x: px, y: py, val, hue: out[1] });
  stepField();
  updatePortals();
  drawField();
  requestAnimationFrame(loop);
}

createPortals();
loop();
