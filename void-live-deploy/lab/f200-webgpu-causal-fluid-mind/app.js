const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
let W = 128, H = 72;
let density = new Float32Array(W * H);
let velX = new Float32Array(W * H);
let velY = new Float32Array(W * H);
let mouse = {x:0, y:0, down:false};
let energy = 0.2, visc = 0.45, diff = 0.18;
let bestGenes = {visc:0.45, diff:0.18, fit:0};

function resize() {
  canvas.width = innerWidth; canvas.height = innerHeight;
  W = Math.min(160, Math.floor(canvas.width / 8));
  H = Math.min(90, Math.floor(canvas.height / 8));
  density = new Float32Array(W * H);
  velX = new Float32Array(W * H);
  velY = new Float32Array(W * H);
}
addEventListener('resize', resize); resize();

addEventListener('pointermove', e => {
  mouse.x = e.clientX / canvas.width * W;
  mouse.y = e.clientY / canvas.height * H;
  if (e.buttons) deposit(0.08);
});
addEventListener('pointerdown', e => { mouse.down = true; deposit(0.15); });
addEventListener('pointerup', () => mouse.down = false);

function deposit(amt) {
  const ix = Math.floor(mouse.x), iy = Math.floor(mouse.y);
  for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) {
    const i = (iy+dy)*W + (ix+dx);
    if (i>=0 && i<density.length) density[i] = Math.min(1, density[i] + amt);
  }
}

function step() {
  const next = new Float32Array(density);
  for (let y=1; y<H-1; y++) for (let x=1; x<W-1; x++) {
    const i = y*W + x;
    const lap = (density[i-1] + density[i+1] + density[i-W] + density[i+W]) * 0.25 - density[i];
    next[i] = density[i] + lap * diff - density[i] * 0.012 + velX[i]*0.01;
    velX[i] *= (1 - visc * 0.05);
    velY[i] *= (1 - visc * 0.05);
    if (density[i] > 0.1) {
      velX[i] += (density[i+1] - density[i-1]) * 0.02;
      velY[i] += (density[i+W] - density[i-W]) * 0.02;
    }
  }
  density.set(next);
  energy = density.reduce((a,b)=>a+b,0) / density.length;
}

const workerSrc = `let pop = Array.from({length:6}, () => ({visc:0.3+Math.random()*0.5, diff:0.1+Math.random()*0.3, fit:0}));
let gen = 0;
self.onmessage = e => {
  const {samples, energy} = e.data;
  const mean = samples.reduce((a,b)=>a+b,0)/samples.length;
  const var_ = samples.reduce((a,b)=>a+(b-mean)**2,0)/samples.length;
  const entropy = Math.min(1, var_ * 4);
  pop.forEach(g => g.fit = entropy * 0.6 + Math.min(1, energy*3) * 0.4 - Math.abs(g.visc-0.4)*0.1);
  pop.sort((a,b)=>b.fit-a.fit);
  const best = {...pop[0]};
  for (let i=2; i<pop.length; i++) {
    pop[i].visc = Math.max(0.1, Math.min(0.9, pop[i%2].visc + (Math.random()-0.5)*0.1));
    pop[i].diff = Math.max(0.05, Math.min(0.4, pop[i%2].diff + (Math.random()-0.5)*0.05));
  }
  gen++;
  self.postMessage({best, gen, entropy});
};`;
const blob = new Blob([workerSrc], {type:'application/javascript'});
const worker = new Worker(URL.createObjectURL(blob));
worker.onmessage = e => {
  const {best, entropy} = e.data;
  visc = best.visc * 0.7 + visc * 0.3;
  diff = best.diff * 0.7 + diff * 0.3;
  if (best.fit > bestGenes.fit) bestGenes = best;
  document.documentElement.style.setProperty('--visc', visc.toFixed(2));
  document.documentElement.style.setProperty('--hue', (210 + entropy * 120 + energy * 40).toFixed(0));
  document.documentElement.style.setProperty('--sat', (30 + energy * 50).toFixed(0) + '%');
  document.documentElement.style.setProperty('--energy', energy.toFixed(2));
  hud.innerHTML = `F-200 Causal Fluid Mind<br>Energy ${energy.toFixed(2)} · Visc ${visc.toFixed(2)} · Ent ${entropy.toFixed(2)}<br>Gen fitness ${best.fit.toFixed(2)}`;
};

const portals = Array.from({length:5}, () => {
  const el = document.createElement('div');
  el.className = 'portal';
  document.body.appendChild(el);
  return {el, x: Math.random()*W, y: Math.random()*H, vx:0, vy:0};
});

function updatePortals() {
  portals.forEach(p => {
    let best = 0, bx = p.x, by = p.y;
    for (let k=0; k<12; k++) {
      const sx = Math.floor(Math.random()*W), sy = Math.floor(Math.random()*H);
      const v = density[sy*W+sx] || 0;
      if (v > best) { best = v; bx = sx; by = sy; }
    }
    p.vx += (bx - p.x) * 0.02;
    p.vy += (by - p.y) * 0.02;
    p.vx *= 0.9; p.vy *= 0.9;
    p.x = Math.max(0, Math.min(W-1, p.x + p.vx));
    p.y = Math.max(0, Math.min(H-1, p.y + p.vy));
    const d = density[Math.floor(p.y)*W + Math.floor(p.x)] || 0;
    const s = 40 + d * 80 + visc * 20;
    p.el.style.width = p.el.style.height = s + 'px';
    p.el.style.left = (p.x / W * canvas.width - s/2) + 'px';
    p.el.style.top = (p.y / H * canvas.height - s/2) + 'px';
    p.el.style.background = `hsla(${210 + d*140}, 70%, ${40+d*30}%, ${0.35+d*0.5})`;
    p.el.style.filter = `blur(${(1-d)*4}px)`;
  });
}

function render() {
  const img = ctx.createImageData(canvas.width, canvas.height);
  const data = img.data;
  for (let y=0; y<canvas.height; y+=2) for (let x=0; x<canvas.width; x+=2) {
    const gx = Math.floor(x / canvas.width * W), gy = Math.floor(y / canvas.height * H);
    const d = density[gy*W + gx] || 0;
    const c = Math.floor(d * 255);
    const i = (y*canvas.width + x) * 4;
    data[i] = c*0.3; data[i+1] = c*0.6; data[i+2] = c; data[i+3] = 180;
  }
  ctx.putImageData(img, 0, 0);
}

function loop() {
  step();
  updatePortals();
  render();
  if (Math.random() < 0.05) {
    const samples = [];
    for (let i=0; i<16; i++) samples.push(density[Math.floor(Math.random()*density.length)]);
    worker.postMessage({samples, energy});
  }
  requestAnimationFrame(loop);
}
loop();

document.getElementById('seal').onclick = () => {
  localStorage.setItem('f200-genes', JSON.stringify(bestGenes));
  hud.textContent = 'Sealed best genes to localStorage';
};
const saved = localStorage.getItem('f200-genes');
if (saved) { try { bestGenes = JSON.parse(saved); visc = bestGenes.visc; diff = bestGenes.diff; } catch(e){} }
