const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const energyEl = document.getElementById('energy');
const portalsEl = document.getElementById('portals');

let W = 96, H = 96;
let grid = new Float32Array(W * H);
let next = new Float32Array(W * H);
let weights = new Float32Array(48); // shared MLP: 9 neigh + 4 audio + 2 ori → 8 hidden → 1
let audioFeatures = [0.2, 0.1, 0.15, 0.05]; // centroid, flux, energy, zcr norm
let ori = [0, 0];
let micOn = false;
let analyser, dataArray, prevSpectrum;
let portals = [];
let lastVibrate = 0;

function randn() { return (Math.random() + Math.random() + Math.random() - 1.5) * 0.8; }

function initWeights() {
  for (let i = 0; i < weights.length; i++) weights[i] = randn() * 0.4;
}

function loadGenome() {
  try {
    const s = localStorage.getItem('verse-f833-genome');
    if (s) { weights = Float32Array.from(JSON.parse(s)); status.textContent = 'sealed genome loaded'; return true; }
  } catch (e) { console.debug("lab f833-webgpu-nca-mic-haptic-mind:", e); }
  return false;
}

function seed() {
  grid.fill(0);
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(Math.random() * W);
    const y = Math.floor(Math.random() * H);
    grid[y * W + x] = Math.random() * 0.8 + 0.2;
  }
}

function mlp(neigh, audio, o) {
  // 9 + 4 + 2 = 15 inputs → 8 hidden → 1
  const input = [...neigh, ...audio, ...o];
  const h = new Array(8).fill(0);
  for (let i = 0; i < 8; i++) {
    let s = weights[i * 16]; // bias
    for (let j = 0; j < 15; j++) s += input[j] * weights[i * 16 + 1 + j];
    h[i] = Math.tanh(s);
  }
  let out = weights[128];
  for (let i = 0; i < 8; i++) out += h[i] * weights[129 + i];
  return Math.tanh(out) * 0.5;
}

function step() {
  const a = audioFeatures;
  const o = ori;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const neigh = [
        grid[(y-1)*W + (x-1)], grid[(y-1)*W + x], grid[(y-1)*W + (x+1)],
        grid[y*W + (x-1)],     grid[i],           grid[y*W + (x+1)],
        grid[(y+1)*W + (x-1)], grid[(y+1)*W + x], grid[(y+1)*W + (x+1)]
      ];
      const delta = mlp(neigh, a, o);
      next[i] = Math.max(0, Math.min(1, grid[i] * 0.92 + delta * 0.35));
    }
  }
  // soft advection from orientation
  const dx = o[0] * 0.4, dy = o[1] * 0.4;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const sx = Math.max(1, Math.min(W-2, x + dx));
      const sy = Math.max(1, Math.min(H-2, y + dy));
      const i = y * W + x;
      next[i] = next[i] * 0.85 + grid[Math.floor(sy) * W + Math.floor(sx)] * 0.15;
    }
  }
  [grid, next] = [next, grid];
}

function updateAudio() {
  if (!analyser) return;
  analyser.getByteFrequencyData(dataArray);
  let energy = 0, centroid = 0, flux = 0, zcr = 0;
  const n = dataArray.length;
  for (let i = 0; i < n; i++) {
    const v = dataArray[i] / 255;
    energy += v;
    centroid += v * i;
    if (prevSpectrum) flux += Math.abs(v - prevSpectrum[i]);
    if (i > 0 && (dataArray[i] - 128) * (dataArray[i-1] - 128) < 0) zcr++;
  }
  energy /= n;
  centroid = (centroid / (energy * n + 1e-6)) / n;
  flux /= n;
  zcr /= n;
  audioFeatures = [centroid, flux, energy, zcr];
  if (!prevSpectrum) prevSpectrum = new Float32Array(n);
  prevSpectrum.set(dataArray.map(v => v/255));
}

function draw() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const img = ctx.createImageData(W, H);
  let total = 0;
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    total += v;
    const r = Math.floor(v * 80);
    const g = Math.floor(v * 180 + 40);
    const b = Math.floor(v * 255);
    img.data[i*4] = r; img.data[i*4+1] = g; img.data[i*4+2] = b; img.data[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.drawImage(canvas, 0, 0, W, H, 0, 0, canvas.width, canvas.height);
  energyEl.textContent = (total / grid.length).toFixed(3);
  if (total / grid.length > 0.35 && Date.now() - lastVibrate > 400) {
    if (navigator.vibrate) navigator.vibrate([30, 20, 40]);
    lastVibrate = Date.now();
  }
}

function updatePortals() {
  portals.forEach(p => {
    // sample local average
    const gx = Math.floor((p.x / canvas.width) * W);
    const gy = Math.floor((p.y / canvas.height) * H);
    let sum = 0, c = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = Math.max(0, Math.min(W-1, gx + dx));
      const yy = Math.max(0, Math.min(H-1, gy + dy));
      sum += grid[yy * W + xx]; c++;
    }
    const avg = sum / c;
    p.el.style.width = p.el.style.height = (36 + avg * 40) + 'px';
    p.el.style.background = `hsla(${200 + avg*80}, 80%, ${40 + avg*30}%, ${0.3 + avg*0.4})`;
    // slight drift toward higher activity (simplified)
    p.x += (Math.random() - 0.5) * 4 + ori[0] * 8;
    p.y += (Math.random() - 0.5) * 4 + ori[1] * 8;
    p.x = Math.max(30, Math.min(canvas.width - 30, p.x));
    p.y = Math.max(30, Math.min(canvas.height - 30, p.y));
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
  });
}

function loop() {
  updateAudio();
  step();
  draw();
  updatePortals();
  requestAnimationFrame(loop);
}

function createPortals() {
  portalsEl.innerHTML = '';
  portals = [];
  for (let i = 0; i < 6; i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.title = 'click to inject growth';
    const p = { el, x: Math.random() * innerWidth, y: Math.random() * innerHeight };
    el.addEventListener('click', () => {
      const gx = Math.floor((p.x / canvas.width) * W);
      const gy = Math.floor((p.y / canvas.height) * H);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const xx = Math.max(0, Math.min(W-1, gx + dx));
        const yy = Math.max(0, Math.min(H-1, gy + dy));
        grid[yy * W + xx] = Math.min(1, grid[yy * W + xx] + 0.4);
      }
    });
    portalsEl.appendChild(el);
    portals.push(p);
  }
}

async function startMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ac = new AudioContext();
    const src = ac.createMediaStreamSource(stream);
    analyser = ac.createAnalyser();
    analyser.fftSize = 256;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    src.connect(analyser);
    micOn = true;
    status.textContent = 'mic live · NCA responding';
  } catch(e) {
    status.textContent = 'mic denied · synthetic drive';
    // synthetic
    setInterval(() => {
      audioFeatures[2] = 0.2 + Math.sin(Date.now() / 800) * 0.15;
      audioFeatures[0] = 0.3 + Math.sin(Date.now() / 1200) * 0.2;
    }, 100);
  }
}

document.getElementById('seal').onclick = () => {
  localStorage.setItem('verse-f833-genome', JSON.stringify(Array.from(weights)));
  status.textContent = 'genome sealed';
};
document.getElementById('reset').onclick = () => { initWeights(); seed(); status.textContent = 'reset'; };
document.getElementById('mic').onclick = () => { if (!micOn) startMic(); else status.textContent = 'mic already on'; };

window.addEventListener('deviceorientation', e => {
  ori[0] = (e.gamma || 0) / 45;
  ori[1] = (e.beta || 0) / 45;
  ori[0] = Math.max(-1, Math.min(1, ori[0]));
  ori[1] = Math.max(-1, Math.min(1, ori[1]));
});

window.addEventListener('pointermove', e => {
  ori[0] = (e.clientX / innerWidth - 0.5) * 2;
  ori[1] = (e.clientY / innerHeight - 0.5) * 2;
});

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
window.addEventListener('resize', resize);
resize();

if (!loadGenome()) initWeights();
seed();
createPortals();
startMic();
status.textContent = 'NCA running · grant mic for sound response';
loop();
