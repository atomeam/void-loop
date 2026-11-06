const COLS = 5, ROWS = 4, N = COLS * ROWS;
const GRID = 64;
const stage = document.getElementById('stage');
const statusEl = document.getElementById('status');
const paramsEl = document.getElementById('params');
const vis = document.getElementById('vis');
const vctx = vis.getContext('2d');

let nodes = [];
let field = new Float32Array(GRID * GRID); // scalar potential
let velX = new Float32Array(GRID * GRID);
let velY = new Float32Array(GRID * GRID);
let dwell = new Float32Array(N);
let pinned = new Array(N).fill(false);
let labels = new Array(N).fill('');

// Evolutionary parameters
let params = {
  diffusion: 0.18,
  decay: 0.012,
  orientGain: 0.45,
  audioGain: 0.6,
  pointerGain: 0.8
};
let bestFitness = -Infinity;
let generation = 0;

// Sensors
let orient = { beta: 0, gamma: 0 };
let audioEnergy = 0;
let pointer = { x: 0.5, y: 0.5, active: false };
let audioCtx, analyser, micStream, running = false;

function createNodes() {
  stage.innerHTML = '';
  nodes = [];
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'node';
    el.textContent = `node ${i}`;
    el.dataset.i = i;
    el.addEventListener('click', () => {
      pinned[i] = !pinned[i];
      el.classList.toggle('pinned', pinned[i]);
      if (pinned[i] && !labels[i]) {
        const t = prompt('Seed a short thought:', 'memory') || 'memory';
        labels[i] = t.slice(0, 24);
        el.textContent = labels[i];
      }
    });
    stage.appendChild(el);
    nodes.push(el);
  }
}

function inject(ix, iy, amount) {
  const x = Math.max(0, Math.min(GRID-1, Math.floor(ix)));
  const y = Math.max(0, Math.min(GRID-1, Math.floor(iy)));
  field[y * GRID + x] += amount;
}

function stepField() {
  // Simple diffusion + decay + velocity advection (CPU prototype of the GPU field)
  const next = new Float32Array(field);
  const d = params.diffusion;
  for (let y = 1; y < GRID-1; y++) {
    for (let x = 1; x < GRID-1; x++) {
      const i = y * GRID + x;
      const lap = field[i-1] + field[i+1] + field[i-GRID] + field[i+GRID] - 4 * field[i];
      next[i] = field[i] + d * lap - params.decay * field[i];
      // mild advection
      const vx = velX[i] * 0.15;
      const vy = velY[i] * 0.15;
      const sx = Math.floor(x - vx), sy = Math.floor(y - vy);
      if (sx >= 0 && sx < GRID && sy >= 0 && sy < GRID) {
        next[i] += 0.08 * field[sy * GRID + sx];
      }
    }
  }
  field.set(next);

  // Orientation injection (tilt → force)
  const ox = (orient.gamma / 45) * params.orientGain;
  const oy = (orient.beta / 45) * params.orientGain;
  inject(GRID/2 + ox * 8, GRID/2 + oy * 8, 0.35);

  // Audio injection (center-ish bands)
  if (audioEnergy > 0.05) {
    inject(GRID * 0.3, GRID * 0.4, audioEnergy * params.audioGain * 0.8);
    inject(GRID * 0.7, GRID * 0.6, audioEnergy * params.audioGain * 0.5);
  }

  // Pointer injection
  if (pointer.active) {
    inject(pointer.x * GRID, pointer.y * GRID, params.pointerGain * 0.25);
  }

  // Update simple velocity from gradient
  for (let y = 1; y < GRID-1; y++) {
    for (let x = 1; x < GRID-1; x++) {
      const i = y * GRID + x;
      velX[i] = velX[i] * 0.85 + (field[i+1] - field[i-1]) * 0.4;
      velY[i] = velY[i] * 0.85 + (field[i+GRID] - field[i-GRID]) * 0.4;
    }
  }
}

function sampleField(nx, ny) {
  const x = Math.floor(nx * (GRID-1));
  const y = Math.floor(ny * (GRID-1));
  return field[y * GRID + x] || 0;
}

function warpNodes() {
  const w = stage.clientWidth, h = stage.clientHeight;
  for (let i = 0; i < N; i++) {
    const col = i % COLS, row = Math.floor(i / COLS);
    const baseX = (col + 0.5) / COLS;
    const baseY = (row + 0.5) / ROWS;
    const pot = sampleField(baseX, baseY);
    const vx = velX[Math.floor(baseY*(GRID-1))*GRID + Math.floor(baseX*(GRID-1))] || 0;
    const vy = velY[Math.floor(baseY*(GRID-1))*GRID + Math.floor(baseX*(GRID-1))] || 0;

    const tx = (baseX - 0.5) * w * 0.85 + vx * 40 + pot * 30;
    const ty = (baseY - 0.5) * h * 0.75 + vy * 40 + pot * 20;
    const tz = pot * 80;
    const rx = vy * 25 + orient.beta * 0.4;
    const ry = -vx * 25 + orient.gamma * 0.4;
    const scale = 0.85 + Math.min(0.4, Math.abs(pot) * 0.6);
    const opacity = 0.65 + Math.min(0.35, Math.abs(pot) * 0.5);

    const el = nodes[i];
    el.style.transform = `translate3d(${tx}px, ${ty}px, ${tz}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`;
    el.style.opacity = opacity;
    el.style.background = `hsl(${200 + pot * 40}, 40%, ${18 + Math.abs(pot)*8}%)`;

    // dwell accumulation when pointer near
    const dx = pointer.x - baseX, dy = pointer.y - baseY;
    if (Math.hypot(dx, dy) < 0.12 && pointer.active) dwell[i] += 0.016;
  }
}

function evolutionaryStep() {
  // Fitness: mean dwell (encourages engagement) minus high variance (stability) + audio correlation proxy
  let meanDwell = 0;
  for (let i = 0; i < N; i++) meanDwell += dwell[i];
  meanDwell /= N;
  const fitness = meanDwell * 2.2 + audioEnergy * 1.5 - Math.abs(params.diffusion - 0.15) * 0.5;

  if (fitness > bestFitness) bestFitness = fitness;

  // Mutate
  const sigma = 0.04;
  params.diffusion = Math.max(0.05, Math.min(0.4, params.diffusion + (Math.random()-0.5)*sigma));
  params.decay = Math.max(0.002, Math.min(0.04, params.decay + (Math.random()-0.5)*sigma*0.3));
  params.orientGain = Math.max(0.1, Math.min(1.2, params.orientGain + (Math.random()-0.5)*sigma));
  params.audioGain = Math.max(0.1, Math.min(1.5, params.audioGain + (Math.random()-0.5)*sigma));
  params.pointerGain = Math.max(0.2, Math.min(1.5, params.pointerGain + (Math.random()-0.5)*sigma));

  generation++;
  paramsEl.textContent = `diff=${params.diffusion.toFixed(2)} dec=${params.decay.toFixed(3)} gen=${generation} fit=${fitness.toFixed(2)}`;
  // soft reset dwell
  for (let i = 0; i < N; i++) dwell[i] *= 0.7;
}

function drawVis() {
  const img = vctx.createImageData(GRID, GRID);
  for (let i = 0; i < field.length; i++) {
    const v = Math.max(0, Math.min(255, 128 + field[i] * 180));
    img.data[i*4] = v * 0.4;
    img.data[i*4+1] = v * 0.7;
    img.data[i*4+2] = v;
    img.data[i*4+3] = 255;
  }
  vctx.putImageData(img, 0, 0);
}

let frame = 0;
function loop() {
  stepField();
  warpNodes();
  if (frame % 4 === 0) drawVis();
  if (frame % 120 === 0) evolutionaryStep();
  frame++;
  requestAnimationFrame(loop);
}

// Sensors
window.addEventListener('deviceorientation', (e) => {
  if (e.beta != null) orient.beta = e.beta;
  if (e.gamma != null) orient.gamma = e.gamma;
});

stage.addEventListener('pointermove', (e) => {
  const r = stage.getBoundingClientRect();
  pointer.x = (e.clientX - r.left) / r.width;
  pointer.y = (e.clientY - r.top) / r.height;
  pointer.active = true;
});
stage.addEventListener('pointerleave', () => pointer.active = false);

async function startAudio() {
  if (running) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    const data = new Uint8Array(analyser.frequencyBinCount);

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const src = audioCtx.createMediaStreamSource(micStream);
      src.connect(analyser);
      statusEl.textContent = 'mic active · tilt to warp';
    } catch {
      // synthetic driver
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = 110;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(analyser);
      osc.start();
      statusEl.textContent = 'synthetic audio · tilt to warp';
    }

    function pollAudio() {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      audioEnergy = (sum / data.length) / 255;
      requestAnimationFrame(pollAudio);
    }
    pollAudio();
    running = true;
  } catch (err) {
    statusEl.textContent = 'audio unavailable';
  }
}

document.getElementById('audio-toggle').onclick = startAudio;
document.getElementById('reset').onclick = () => {
  field.fill(0); velX.fill(0); velY.fill(0);
  statusEl.textContent = 'field reset';
};

// Init
createNodes();
statusEl.textContent = 'ready · click Start audio · tilt device';
// seed a little noise
for (let i = 0; i < field.length; i++) field[i] = (Math.random()-0.5)*0.05;
loop();

// Note: This is the CPU prototype of the WebGPU compute field.
// Production path replaces stepField() with a WebGPU compute pass
// writing to storage buffers, then a small readback of the 64×64 field.
