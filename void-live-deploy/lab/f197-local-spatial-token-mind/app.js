const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
let W, H, gridW = 80, gridH = 50;
let field = new Float32Array(gridW * gridH);
let next = new Float32Array(gridW * gridH);
function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Pointer deposits
let ptr = {x: W/2, y: H/2, vx: 0, vy: 0};
canvas.addEventListener('pointermove', e => {
  const nx = e.clientX, ny = e.clientY;
  ptr.vx = nx - ptr.x; ptr.vy = ny - ptr.y;
  ptr.x = nx; ptr.y = ny;
  deposit(nx, ny, 1.2);
});
canvas.addEventListener('pointerdown', e => deposit(e.clientX, e.clientY, 2.5));

function deposit(px, py, amount) {
  const gx = Math.floor(px / W * gridW);
  const gy = Math.floor(py / H * gridH);
  if (gx >= 0 && gx < gridW && gy >= 0 && gy < gridH) {
    field[gy * gridW + gx] = Math.min(1, field[gy * gridW + gx] + amount);
  }
}

// Diffusion step
function stepField() {
  for (let y = 1; y < gridH-1; y++) {
    for (let x = 1; x < gridW-1; x++) {
      const i = y * gridW + x;
      const n = field[i-1] + field[i+1] + field[i-gridW] + field[i+gridW];
      next[i] = field[i] * 0.92 + n * 0.02;
      if (next[i] < 0.01) next[i] = 0;
    }
  }
  [field, next] = [next, field];
}

// Local Worker: tiny sequence model for trajectory tokens
const workerCode = `
let history = [];
const MAX = 12;
let weights = new Float32Array(8).fill(0.1); // simple linear on features
let bias = 0.5;
self.onmessage = e => {
  const {vx, vy, energy, samples} = e.data;
  history.push({vx, vy, energy});
  if (history.length > MAX) history.shift();
  // Features: mean speed, turn, energy variance
  let speed = 0, turn = 0, en = 0;
  for (let i = 1; i < history.length; i++) {
    const a = history[i-1], b = history[i];
    speed += Math.hypot(b.vx, b.vy);
    turn += Math.abs(Math.atan2(b.vy, b.vx) - Math.atan2(a.vy, a.vx));
    en += b.energy;
  }
  speed /= Math.max(1, history.length-1);
  turn /= Math.max(1, history.length-1);
  en /= Math.max(1, history.length);
  // Softmax-like scores for 4 tokens: expand, focus, scatter, memory
  const feats = [speed, turn, en, 1];
  let scores = [0,0,0,0];
  for (let t = 0; t < 4; t++) {
    scores[t] = bias + weights[t*2] * feats[0] + weights[t*2+1] * feats[1];
  }
  const max = Math.max(...scores);
  const exp = scores.map(s => Math.exp(s - max));
  const sum = exp.reduce((a,b)=>a+b, 0);
  const probs = exp.map(e => e / sum);
  const entropy = -probs.reduce((a,p) => a + (p>0 ? p*Math.log(p) : 0), 0);
  const conf = 1 - entropy / Math.log(4);
  const best = probs.indexOf(Math.max(...probs));
  const tokens = ['expand','focus','scatter','memory'];
  self.postMessage({token: tokens[best], conf, entropy, probs});
};
`;
const blob = new Blob([workerCode], {type: 'application/javascript'});
const worker = new Worker(URL.createObjectURL(blob));
let lastThought = {token: 'idle', conf: 0.5, entropy: 1};

worker.onmessage = e => {
  lastThought = e.data;
  spawnToken(lastThought.token);
  // Morph chrome
  document.documentElement.style.setProperty('--hue', 180 + lastThought.conf * 120);
  document.documentElement.style.setProperty('--blur', (lastThought.entropy * 2) + 'px');
  document.documentElement.style.setProperty('--contrast', 1 + lastThought.conf * 0.4);
  hud.textContent = `tokens: ${document.querySelectorAll('.token').length} | conf: ${lastThought.conf.toFixed(2)} | entropy: ${lastThought.entropy.toFixed(2)} | last: ${lastThought.token}`;
};

function sampleEnergy() {
  let s = 0, c = 0;
  for (let i = 0; i < field.length; i += 7) { s += field[i]; c++; }
  return s / c;
}

setInterval(() => {
  worker.postMessage({vx: ptr.vx, vy: ptr.vy, energy: sampleEnergy()});
  ptr.vx *= 0.9; ptr.vy *= 0.9;
}, 800);

// Tokens as draggable DOM
const tokenEffects = {
  expand: (gx, gy) => { for (let d=-2; d<=2; d++) for (let e=-2; e<=2; e++) { const i=(gy+d)*gridW+(gx+e); if(i>=0&&i<field.length) field[i]=Math.min(1,field[i]+0.4); } },
  focus: (gx, gy) => { field[gy*gridW+gx] = Math.min(1, field[gy*gridW+gx] + 1.5); },
  scatter: (gx, gy) => { for (let i=0; i<field.length; i++) if (Math.random()<0.05) field[i] *= 0.3; },
  memory: (gx, gy) => { /* reinforce local history */ field[gy*gridW+gx] += 0.8; }
};

function spawnToken(label) {
  const el = document.createElement('div');
  el.className = 'token';
  el.textContent = label;
  el.style.left = (Math.random() * (W - 80)) + 'px';
  el.style.top = (Math.random() * (H - 40) + 40) + 'px';
  document.body.appendChild(el);
  makeDraggable(el, label);
  // Auto-remove old
  if (document.querySelectorAll('.token').length > 8) {
    document.querySelector('.token').remove();
  }
}

function makeDraggable(el, label) {
  let drag = false, ox=0, oy=0;
  el.addEventListener('pointerdown', e => {
    drag = true; ox = e.clientX - el.offsetLeft; oy = e.clientY - el.offsetTop;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    el.style.left = (e.clientX - ox) + 'px';
    el.style.top = (e.clientY - oy) + 'px';
  });
  el.addEventListener('pointerup', e => {
    drag = false;
    const gx = Math.floor(parseFloat(el.style.left) / W * gridW);
    const gy = Math.floor(parseFloat(el.style.top) / H * gridH);
    if (tokenEffects[label]) tokenEffects[label](gx, gy);
    // Simple reinforce: positive feedback for this token
    // (in real would update worker weights)
    el.style.background = 'hsla(120, 70%, 40%, 0.9)';
    setTimeout(() => el.remove(), 600);
  });
}

// Render
function render() {
  stepField();
  const img = ctx.createImageData(gridW, gridH);
  const data = img.data;
  for (let i = 0; i < field.length; i++) {
    const v = field[i];
    const c = i * 4;
    data[c] = v * 80;
    data[c+1] = v * 180;
    data[c+2] = v * 255;
    data[c+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.drawImage(canvas, 0, 0, gridW, gridH, 0, 0, W, H);
  requestAnimationFrame(render);
}
render();

// Seal on unload
window.addEventListener('beforeunload', () => {
  try { localStorage.setItem('f197-field', JSON.stringify(Array.from(field.slice(0,100)))); } catch(e){}
});
