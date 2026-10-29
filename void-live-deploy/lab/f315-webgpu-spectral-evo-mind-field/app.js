const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const nodesDiv = document.getElementById('nodes');
const status = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let pointer = { x: W/2, y: H/2, active: false };
let orient = { beta: 0, gamma: 0 };
let field = null; // CPU fallback grid
const GRID = 64;
let generation = 0, bestFitness = 0;
const params = { freqs: [1, 2, 3.5, 5], damp: 0.98, amp: 0.3 };

// Worker for evolution
const workerCode = `
let pop = [];
function init() {
  for (let i = 0; i < 8; i++) {
    pop.push({
      freqs: Array.from({length:4}, () => 0.5 + Math.random()*6),
      damp: 0.9 + Math.random()*0.09,
      amp: 0.1 + Math.random()*0.5,
      fit: 0
    });
  }
}
function mutate(p) {
  const n = JSON.parse(JSON.stringify(p));
  const i = Math.floor(Math.random()*4);
  n.freqs[i] += (Math.random()-0.5)*1.2;
  n.freqs[i] = Math.max(0.2, Math.min(8, n.freqs[i]));
  n.damp += (Math.random()-0.5)*0.02;
  n.damp = Math.max(0.85, Math.min(0.995, n.damp));
  n.amp += (Math.random()-0.5)*0.1;
  n.amp = Math.max(0.05, Math.min(0.8, n.amp));
  return n;
}
function step(fitnesses) {
  for (let i = 0; i < pop.length; i++) pop[i].fit = fitnesses[i] || 0;
  pop.sort((a,b) => b.fit - a.fit);
  const next = [pop[0], pop[1]];
  while (next.length < 8) next.push(mutate(pop[Math.floor(Math.random()*3)]));
  pop = next;
  postMessage({ type: 'params', params: pop[0], gen: Date.now() });
}
init();
onmessage = (e) => {
  if (e.data.type === 'fitness') step(e.data.fits);
  if (e.data.type === 'init') init();
};
`;
const worker = new Worker(URL.createObjectURL(new Blob([workerCode])));
worker.onmessage = (e) => {
  if (e.data.type === 'params') {
    Object.assign(params, e.data.params);
    generation++;
    bestFitness = e.data.params.fit || bestFitness;
    status.textContent = `Gen ${generation} | fitness ${bestFitness.toFixed(2)} | damp ${params.damp.toFixed(3)}`;
  }
};

// Simple CPU spectral field (fallback + driver)
function initField() {
  field = Array.from({length: GRID}, () => Array.from({length: GRID}, () => ({ amp: 0, phase: Math.random()*6.28, vel: 0 })));
}
initField();

function inject(px, py, strength = 1) {
  const gx = Math.floor((px / W) * GRID);
  const gy = Math.floor((py / H) * GRID);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = (gx + dx + GRID) % GRID, y = (gy + dy + GRID) % GRID;
    const d = Math.hypot(dx, dy);
    field[y][x].amp += strength * Math.exp(-d*d/4) * params.amp;
  }
}

function stepField() {
  const fits = [];
  let entropy = 0, clusters = 0;
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    const c = field[y][x];
    // multi-freq drive
    let drive = 0;
    for (let f of params.freqs) drive += Math.sin(c.phase * f + performance.now()/1000);
    c.vel = c.vel * params.damp + drive * 0.05;
    c.phase += c.vel * 0.1;
    c.amp *= 0.995;
    if (c.amp > 0.4) clusters++;
    entropy += -Math.log(Math.abs(c.amp)+0.01);
  }
  // rough fitness for one individual (simplified; worker expects array)
  fits.push(entropy / (GRID*GRID) + clusters / 100);
  for (let i = 1; i < 8; i++) fits.push(fits[0] * (0.8 + Math.random()*0.4));
  worker.postMessage({ type: 'fitness', fits });
}

// Nodes
const mindNodes = [];
function updateNodes() {
  // sample peaks
  const peaks = [];
  for (let y = 2; y < GRID-2; y+=4) for (let x = 2; x < GRID-2; x+=4) {
    if (field[y][x].amp > 0.35) peaks.push({ x, y, a: field[y][x].amp });
  }
  peaks.sort((a,b) => b.a - a.a);
  while (mindNodes.length < Math.min(6, peaks.length)) {
    const el = document.createElement('div');
    el.className = 'mind-node';
    el.onclick = () => sealNode(el);
    nodesDiv.appendChild(el);
    mindNodes.push({ el, life: 0 });
  }
  peaks.slice(0, mindNodes.length).forEach((p, i) => {
    const n = mindNodes[i];
    if (!n) return;
    const sx = (p.x / GRID) * W, sy = (p.y / GRID) * H;
    const s = 40 + p.a * 80;
    n.el.style.left = (sx - s/2) + 'px';
    n.el.style.top = (sy - s/2) + 'px';
    n.el.style.width = n.el.style.height = s + 'px';
    n.el.style.opacity = Math.min(1, p.a * 2);
    n.el.style.transform = `translateZ(${p.a*50}px) rotateY(${orient.gamma*0.5}deg) rotateX(${orient.beta*0.3}deg)`;
    n.el.style.background = `radial-gradient(circle, hsl(${180 + p.a*80},80%,70%), transparent)`;
    n.life++;
  });
  // cull extras
  while (mindNodes.length > peaks.length && mindNodes.length > 0) {
    const n = mindNodes.pop();
    n.el.remove();
  }
}

function sealNode(el) {
  const id = 'seal-' + Date.now();
  const snap = { id, gen: generation, params: {...params}, t: Date.now() };
  try { localStorage.setItem(id, JSON.stringify(snap)); } catch(e) {}
  el.style.boxShadow = '0 0 40px gold';
  setTimeout(() => el.style.boxShadow = '', 600);
  status.textContent += ' | sealed';
}

// Input
canvas.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; inject(pointer.x, pointer.y, 0.8); });
canvas.addEventListener('pointerdown', e => { inject(e.clientX, e.clientY, 1.5); });
if (DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    orient.beta = e.beta || 0; orient.gamma = e.gamma || 0;
    if (Math.abs(orient.beta) > 5 || Math.abs(orient.gamma) > 5) inject(W/2 + orient.gamma*2, H/2 + orient.beta*2, 0.4);
  });
}

// Loop
let frame = 0;
function loop() {
  frame++;
  stepField();
  if (frame % 8 === 0) updateNodes();
  // render
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const scaleX = W / GRID, scaleY = H / GRID;
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    const a = field[y][x].amp;
    if (a > 0.05) {
      ctx.fillStyle = `hsla(${200 + a*100}, 70%, ${40 + a*40}%, ${Math.min(0.9, a)})`;
      ctx.fillRect(x*scaleX, y*scaleY, scaleX, scaleY);
    }
  }
  requestAnimationFrame(loop);
}
status.textContent = 'Spectral field live (CPU fallback). Drag to seed.';
loop();
