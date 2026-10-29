const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 96; // grid
let field = new Float32Array(N * N);
let prev = new Float32Array(N * N);
let sources = [
  { x: 0.3, y: 0.4, freq: 0.08, amp: 1.2 },
  { x: 0.7, y: 0.5, freq: 0.11, amp: 0.9 },
  { x: 0.5, y: 0.7, freq: 0.06, amp: 1.0 }
];

// Tiny reservoir (echo state)
const RES = 32;
let resState = new Float32Array(RES);
let resWeights = Array.from({length: RES}, () => Math.random() * 0.4 - 0.2);
let hist = []; // pointer history

let t = 0;
const nodes = [];

function updateWave() {
  const next = new Float32Array(N * N);
  for (let y = 1; y < N-1; y++) {
    for (let x = 1; x < N-1; x++) {
      const i = y * N + x;
      const lap = field[i-1] + field[i+1] + field[i-N] + field[i+N] - 4 * field[i];
      next[i] = 2 * field[i] - prev[i] + 0.18 * lap;
      // damping
      next[i] *= 0.995;
    }
  }
  // inject sources
  sources.forEach(s => {
    const ix = Math.floor(s.x * N);
    const iy = Math.floor(s.y * N);
    const i = iy * N + ix;
    if (i >= 0 && i < N*N) next[i] += Math.sin(t * s.freq * 40) * s.amp * 0.4;
  });
  prev.set(field);
  field.set(next);
  t += 0.016;
}

function reservoirStep(px, py, energy) {
  // simple echo
  const input = [px, py, energy, Math.sin(t)];
  for (let i = 0; i < RES; i++) {
    let sum = 0.8 * resState[i];
    for (let j = 0; j < input.length; j++) sum += input[j] * resWeights[(i+j)%RES];
    resState[i] = Math.tanh(sum);
  }
  // propose source bias from mean state
  const mean = resState.reduce((a,b)=>a+b,0)/RES;
  if (sources.length > 0) {
    sources[0].freq = 0.07 + mean * 0.04;
    sources[0].amp = 0.8 + Math.abs(mean) * 0.5;
  }
  return Math.abs(mean);
}

let pointer = {x: 0.5, y: 0.5};
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX / W;
  pointer.y = e.clientY / H;
  hist.push({x: pointer.x, y: pointer.y});
  if (hist.length > 32) hist.shift();
});

canvas.addEventListener('click', e => {
  const x = e.clientX / W, y = e.clientY / H;
  sources.push({ x, y, freq: 0.05 + Math.random()*0.1, amp: 0.7 + Math.random()*0.6 });
  if (sources.length > 6) sources.shift();
  spawnNode(x, y, 'src');
});

function spawnNode(x, y, label) {
  const el = document.createElement('div');
  el.className = 'node';
  el.textContent = label;
  el.style.left = (x * W - 32) + 'px';
  el.style.top = (y * H - 24) + 'px';
  document.body.appendChild(el);
  nodes.push({el, x, y, vx: 0, vy: 0});
  // drag
  let dragging = false, ox, oy;
  el.addEventListener('pointerdown', ev => { dragging = true; ox = ev.clientX - parseFloat(el.style.left); oy = ev.clientY - parseFloat(el.style.top); el.setPointerCapture(ev.pointerId); });
  el.addEventListener('pointermove', ev => {
    if (!dragging) return;
    el.style.left = (ev.clientX - ox) + 'px';
    el.style.top = (ev.clientY - oy) + 'px';
    // inject energy near
    const nx = (ev.clientX) / W, ny = (ev.clientY) / H;
    const ix = Math.floor(nx * N), iy = Math.floor(ny * N);
    if (ix>0 && ix<N-1 && iy>0 && iy<N-1) field[iy*N+ix] += 0.8;
  });
  el.addEventListener('pointerup', () => dragging = false);
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < field.length; i++) {
    const v = Math.max(-1, Math.min(1, field[i] * 4));
    const c = v > 0 ? [40, 180 + v*75, 255] : [255, 80, 40 - v*40];
    img.data[i*4] = c[0];
    img.data[i*4+1] = c[1];
    img.data[i*4+2] = c[2];
    img.data[i*4+3] = 255;
  }
  // scale up
  const tmp = document.createElement('canvas');
  tmp.width = N; tmp.height = N;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, W, H);
  // sources
  ctx.fillStyle = '#fff';
  sources.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.x*W, s.y*H, 6, 0, Math.PI*2);
    ctx.fill();
  });
}

let energy = 0;
function loop() {
  updateWave();
  const e = field.reduce((a,b)=>a+Math.abs(b),0)/field.length;
  energy = reservoirStep(pointer.x, pointer.y, e);
  // attract nodes to high energy (simple)
  nodes.forEach(n => {
    // mild attraction toward sources or center
    n.x += (0.5 - n.x) * 0.002;
    n.el.style.left = (n.x * W - 32) + 'px';
    n.el.style.transform = `scale(${1 + energy*0.3})`;
  });
  draw();
  document.getElementById('status').textContent = `Reservoir energy: ${energy.toFixed(2)} | Sources: ${sources.length}`;
  requestAnimationFrame(loop);
}
loop();

// Seal / load
document.getElementById('seal').onclick = () => {
  const data = { sources, resState: Array.from(resState), resWeights, t: Date.now() };
  localStorage.setItem('f300-seal', JSON.stringify(data));
  alert('Sealed to localStorage');
};
document.getElementById('load').onclick = () => {
  const raw = localStorage.getItem('f300-seal');
  if (!raw) return alert('Nothing sealed');
  const data = JSON.parse(raw);
  sources = data.sources || sources;
  if (data.resState) resState.set(data.resState);
  alert('Loaded');
};
document.getElementById('add').onclick = () => {
  sources.push({ x: Math.random(), y: Math.random(), freq: 0.05+Math.random()*0.1, amp: 0.8 });
  spawnNode(sources.at(-1).x, sources.at(-1).y, 'src');
};

// initial nodes
sources.forEach(s => spawnNode(s.x, s.y, 'src'));
