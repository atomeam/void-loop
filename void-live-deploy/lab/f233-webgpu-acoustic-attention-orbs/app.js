const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = 128, H = 72;
let field = new Float32Array(W * H);
let prev = new Float32Array(W * H);
let energy = 0, entropy = 0.3, residual = 0.1;
let audioEnergy = 0, spectral = 0.5;
let beta = 0, gamma = 0;
let pointer = {x: 0.5, y: 0.5, down: false};
let orbs = [];
const NUM_ORBS = 6;

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize(); addEventListener('resize', resize);

// Pointer
canvas.addEventListener('pointerdown', e => { pointer.down = true; updatePointer(e); });
canvas.addEventListener('pointermove', e => { if (pointer.down) updatePointer(e); });
canvas.addEventListener('pointerup', () => pointer.down = false);
function updatePointer(e) {
  pointer.x = e.clientX / innerWidth;
  pointer.y = e.clientY / innerHeight;
  deposit(pointer.x, pointer.y, 0.8);
}

function deposit(nx, ny, amt) {
  const x = Math.floor(nx * W), y = Math.floor(ny * H);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const i = (y + dy + H) % H * W + (x + dx + W) % W;
    field[i] = Math.min(1, field[i] + amt * Math.exp(-(dx*dx+dy*dy)/3));
  }
}

// Orientation
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    beta = (e.beta || 0) / 90;
    gamma = (e.gamma || 0) / 90;
  });
}

// Audio
let analyser, dataArray;
async function initAudio() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const actx = new AudioContext();
    const src = actx.createMediaStreamSource(stream);
    analyser = actx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    statusEl.textContent = 'mic active';
  } catch (e) {
    statusEl.textContent = 'mic denied — pointer only';
  }
}
initAudio();

function sampleAudio() {
  if (!analyser) return;
  analyser.getByteFrequencyData(dataArray);
  let sum = 0, wsum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const v = dataArray[i] / 255;
    sum += v;
    wsum += v * i;
  }
  audioEnergy = sum / dataArray.length;
  spectral = dataArray.length ? wsum / (sum + 1e-6) / dataArray.length : 0.5;
}

// Simple diffusion + attention bias (main thread for reliability; Worker stub for evolution)
function step() {
  sampleAudio();
  const bias = audioEnergy * 0.4 + Math.abs(beta) * 0.2 + Math.abs(gamma) * 0.15;
  let eSum = 0, e2 = 0;
  const next = new Float32Array(field.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let s = 0, c = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const j = ((y + dy + H) % H) * W + ((x + dx + W) % W);
      s += field[j]; c++;
    }
    const local = s / c;
    const attn = local * (0.6 + bias) + field[i] * 0.3;
    next[i] = Math.max(0, Math.min(1, attn * 0.92 + (pointer.down ? 0.02 : 0)));
    eSum += next[i];
    e2 += next[i] * next[i];
  }
  field.set(next);
  energy = eSum / (W * H);
  entropy = Math.min(1, Math.sqrt(Math.max(0, e2 / (W*H) - energy*energy)) * 4);
  residual = Math.abs(energy - (prev[0] || energy));
  prev[0] = energy;

  // Morph CSS
  document.documentElement.style.setProperty('--energy', energy.toFixed(3));
  document.documentElement.style.setProperty('--entropy', entropy.toFixed(3));
  document.documentElement.style.setProperty('--residual', residual.toFixed(3));
  document.documentElement.style.setProperty('--hue', Math.floor(180 + spectral * 160 + beta * 40));

  // Update orbs from high-energy peaks
  updateOrbs();
  statusEl.textContent = `E:${energy.toFixed(2)} Ent:${entropy.toFixed(2)} Aud:${audioEnergy.toFixed(2)}`;
}

function updateOrbs() {
  // Find peaks
  const peaks = [];
  for (let i = 0; i < field.length; i += 7) {
    if (field[i] > 0.25) peaks.push({i, v: field[i]});
  }
  peaks.sort((a,b) => b.v - a.v);
  while (orbs.length < NUM_ORBS) {
    const el = document.createElement('div');
    el.className = 'orb';
    document.body.appendChild(el);
    orbs.push(el);
  }
  for (let k = 0; k < NUM_ORBS; k++) {
    const p = peaks[k] || {i: Math.floor(Math.random()*field.length), v: 0.1};
    const x = (p.i % W) / W * innerWidth;
    const y = Math.floor(p.i / W) / H * innerHeight;
    const s = 20 + p.v * 60;
    orbs[k].style.left = (x - s/2) + 'px';
    orbs[k].style.top = (y - s/2) + 'px';
    orbs[k].style.width = orbs[k].style.height = s + 'px';
    orbs[k].style.opacity = Math.min(1, p.v * 1.5);
  }
}

function render() {
  const img = ctx.createImageData(canvas.width, canvas.height);
  const data = img.data;
  const sx = canvas.width / W, sy = canvas.height / H;
  for (let py = 0; py < canvas.height; py++) {
    for (let px = 0; px < canvas.width; px++) {
      const fx = Math.floor(px / sx), fy = Math.floor(py / sy);
      const v = field[fy * W + fx] || 0;
      const idx = (py * canvas.width + px) * 4;
      const h = (180 + spectral * 160) / 360;
      // simple HSL-ish
      data[idx] = Math.floor(v * 255 * (0.4 + spectral));
      data[idx+1] = Math.floor(v * 180 * (1 - Math.abs(beta)));
      data[idx+2] = Math.floor(v * 255 * (0.6 + audioEnergy));
      data[idx+3] = 255;
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

// Seal stub
addEventListener('keydown', e => {
  if (e.key === 's') {
    const seal = { energy, entropy, bias: audioEnergy, t: Date.now() };
    localStorage.setItem('f233-seal', JSON.stringify(seal));
    statusEl.textContent = 'sealed';
  }
});
