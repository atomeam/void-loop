const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const hudE = document.getElementById('e');
const hudR = document.getElementById('r');
const hudT = document.getElementById('t');
const hudM = document.getElementById('m');
const panels = document.getElementById('panels');

let W = 0, H = 0, scale = 4;
let gridW = 0, gridH = 0;
let field = null;
let next = null;
let pointer = { x: 0.5, y: 0.5, down: false, vx: 0, vy: 0 };
let lastX = 0, lastY = 0;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  gridW = Math.floor(W / scale);
  gridH = Math.floor(H / scale);
  field = new Float32Array(gridW * gridH);
  next = new Float32Array(gridW * gridH);
}
window.addEventListener('resize', resize);
resize();

const orbs = [];
for (let i = 0; i < 5; i++) {
  const el = document.createElement('div');
  el.className = 'orb';
  el.textContent = 'probe ' + (i+1);
  panels.appendChild(el);
  orbs.push({ el, x: 0.2 + i*0.15, y: 0.3 + (i%2)*0.3, vx: 0, vy: 0 });
}

const workerCode = `
let history = [];
let weights = new Float32Array(8).map(() => Math.random()*0.2 - 0.1);
self.onmessage = function(e) {
  const { samples, vx, vy } = e.data;
  history.push({ vx, vy, t: performance.now() });
  if (history.length > 12) history.shift();
  let predVx = 0, predVy = 0;
  if (history.length > 2) {
    const prev = history[history.length-2];
    predVx = prev.vx;
    predVy = prev.vy;
  }
  const residual = Math.hypot(vx - predVx, vy - predVy);
  let thought = 0;
  for (let i = 0; i < samples.length; i++) {
    thought += samples[i] * (0.5 + Math.sin(i + residual*2)*0.3);
  }
  thought = Math.tanh(thought / (samples.length || 1));
  for (let i = 0; i < weights.length; i++) {
    weights[i] += (thought - 0.5) * 0.01 * (Math.random()-0.5);
    weights[i] = Math.max(-0.5, Math.min(0.5, weights[i]));
  }
  self.postMessage({ residual, thought, energy: samples.reduce((a,b)=>a+b,0)/samples.length, weights: Array.from(weights) });
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));

let mind = { residual: 0.2, thought: 0.5, energy: 0.3 };

worker.onmessage = (e) => {
  mind = e.data;
  document.documentElement.style.setProperty('--energy', mind.energy.toFixed(3));
  document.documentElement.style.setProperty('--thought', mind.thought.toFixed(3));
  document.documentElement.style.setProperty('--residual', mind.residual.toFixed(3));
  document.documentElement.style.setProperty('--hue', (200 + mind.thought*80 + mind.residual*40).toFixed(0));
  hudE.textContent = mind.energy.toFixed(2);
  hudR.textContent = mind.residual.toFixed(2);
  hudT.textContent = mind.thought.toFixed(2);
};

function sampleField() {
  const samples = [];
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(Math.random() * gridW);
    const y = Math.floor(Math.random() * gridH);
    samples.push(field[y * gridW + x] || 0);
  }
  return samples;
}

function stepField(dt) {
  const decay = 0.985 - mind.residual * 0.01;
  const diff = 0.12 + mind.thought * 0.05;
  for (let y = 1; y < gridH-1; y++) {
    for (let x = 1; x < gridW-1; x++) {
      const i = y * gridW + x;
      const n = field[i-1] + field[i+1] + field[i-gridW] + field[i+gridW];
      next[i] = field[i] * decay + (n * 0.25 - field[i]) * diff;
      if (next[i] < 0.001) next[i] = 0;
    }
  }
  if (pointer.down) {
    const gx = Math.floor(pointer.x * gridW);
    const gy = Math.floor(pointer.y * gridH);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const xx = gx + dx, yy = gy + dy;
        if (xx > 0 && xx < gridW-1 && yy > 0 && yy < gridH-1) {
          next[yy * gridW + xx] = Math.min(1, next[yy * gridW + xx] + 0.35 * Math.exp(-(dx*dx+dy*dy)*0.4));
        }
      }
    }
  }
  [field, next] = [next, field];
}

function draw() {
  const img = ctx.createImageData(W, H);
  const data = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const gx = Math.min(gridW-1, Math.floor(x / scale));
      const gy = Math.min(gridH-1, Math.floor(y / scale));
      const e = field[gy * gridW + gx] || 0;
      const i = (y * W + x) * 4;
      data[i] = Math.min(255, e * 180 + 10);
      data[i+1] = Math.min(255, e * 120 + 20);
      data[i+2] = Math.min(255, e * 220 + 40);
      data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = `hsla(${200 + mind.thought*40}, 80%, 70%, 0.4)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(pointer.x * W, pointer.y * H);
  ctx.stroke();
  lastX = pointer.x * W;
  lastY = pointer.y * H;
}

function updateOrbs() {
  orbs.forEach((o, idx) => {
    const gx = Math.floor(o.x * gridW);
    const gy = Math.floor(o.y * gridH);
    const e = field[gy * gridW + gx] || 0;
    o.vx += (mind.thought - 0.5) * 0.002 + (Math.random()-0.5)*0.001;
    o.vy += (mind.residual - 0.3) * 0.002;
    o.vx *= 0.96; o.vy *= 0.96;
    o.x = Math.max(0.05, Math.min(0.95, o.x + o.vx));
    o.y = Math.max(0.1, Math.min(0.9, o.y + o.vy));
    o.el.style.left = (o.x * 100) + '%';
    o.el.style.top = (o.y * 100) + '%';
    o.el.style.transform = `translate(-50%, -50%) scale(${0.6 + e*1.2})`;
  });
}

let lastT = performance.now();
let sampleAcc = 0;
function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  stepField(dt);
  draw();
  updateOrbs();
  sampleAcc += dt;
  if (sampleAcc > 0.25) {
    sampleAcc = 0;
    worker.postMessage({ samples: sampleField(), vx: pointer.vx, vy: pointer.vy });
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

canvas.addEventListener('pointerdown', e => { pointer.down = true; pointer.x = e.clientX / W; pointer.y = e.clientY / H; });
canvas.addEventListener('pointerup', () => pointer.down = false);
canvas.addEventListener('pointermove', e => {
  const nx = e.clientX / W, ny = e.clientY / H;
  pointer.vx = (nx - pointer.x) * 60;
  pointer.vy = (ny - pointer.y) * 60;
  pointer.x = nx; pointer.y = ny;
});

document.getElementById('xr').onclick = async () => {
  if (!navigator.xr) { alert('WebXR not available'); return; }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    hudM.textContent = 'XR';
    session.addEventListener('end', () => { hudM.textContent = 'flat'; });
  } catch (err) {
    console.warn(err);
    alert('WebXR session failed — staying in flat mode');
  }
};

setInterval(() => {
  try { localStorage.setItem('f196-mind', JSON.stringify(mind)); } catch (e) { console.warn('f415-webxr-causal-attention-lattice:', e); }
}, 5000);
