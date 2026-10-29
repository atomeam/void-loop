const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W, H, particles = [], orbs = [], pointer = {x:0,y:0,vx:0,vy:0}, spectral = new Array(8).fill(0);

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
addEventListener('resize', resize);
resize();

// Simple particles
for (let i = 0; i < 800; i++) {
  particles.push({
    x: Math.random()*W, y: Math.random()*H,
    vx: (Math.random()-0.5)*1, vy: (Math.random()-0.5)*1,
    life: Math.random()
  });
}

// Worker for tiny MLP (2-layer, causal memory buffer)
const workerCode = `
let weights = {
  w1: Array.from({length: 16}, () => Array.from({length: 12}, () => (Math.random()-0.5)*0.2)),
  b1: Array.from({length: 16}, () => 0),
  w2: Array.from({length: 4}, () => Array.from({length: 16}, () => (Math.random()-0.5)*0.2)),
  b2: Array.from({length: 4}, () => 0)
};
let memory = new Array(4).fill(0); // causal tokens from orbs

function relu(x){ return Math.max(0,x); }
function forward(input) {
  const h = weights.b1.map((b,i) => relu(weights.w1[i].reduce((s,w,j)=>s+w*input[j], b)));
  const out = weights.b2.map((b,i) => Math.tanh(weights.w2[i].reduce((s,w,j)=>s+w*h[j], b)));
  return out;
}

onmessage = (e) => {
  const { spectral, pointer, memoryInject } = e.data;
  if (memoryInject) memory = memoryInject.slice(0,4);
  const input = [...spectral.slice(0,6), pointer.vx*0.01, pointer.vy*0.01, ...memory];
  const forces = forward(input);
  // tiny mutation / adaptation
  if (Math.random() < 0.05) {
    const i = Math.floor(Math.random()*16), j = Math.floor(Math.random()*12);
    weights.w1[i][j] += (Math.random()-0.5)*0.01;
  }
  postMessage({ forces, memory });
};
`;
const blob = new Blob([workerCode], {type:'application/javascript'});
const worker = new Worker(URL.createObjectURL(blob));

let currentForces = [0,0,0,0];
worker.onmessage = (e) => { currentForces = e.data.forces; };

function updateSpectral() {
  // fake spectral from particle density variance in bins
  const bins = new Array(8).fill(0);
  particles.forEach(p => {
    const b = Math.floor((p.x / W) * 8) % 8;
    bins[b] += 1;
  });
  const max = Math.max(...bins,1);
  spectral = bins.map(b => b/max);
}

function step() {
  updateSpectral();
  worker.postMessage({ spectral, pointer, memoryInject: orbs.map(o=>o.memory||0) });

  const [fx, fy, attract, damp] = currentForces;
  particles.forEach(p => {
    p.vx += fx * 0.02 + (pointer.x - p.x)*attract*0.00001;
    p.vy += fy * 0.02 + (pointer.y - p.y)*attract*0.00001;
    p.vx *= 0.98 + damp*0.01;
    p.vy *= 0.98 + damp*0.01;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -1;
    if (p.y < 0 || p.y > H) p.vy *= -1;
    p.life += 0.01;
  });

  // spawn orbs at high density occasionally
  if (Math.random() < 0.01 && orbs.length < 6) {
    const peak = particles.reduce((best,p) => {
      const dens = particles.filter(q => Math.hypot(q.x-p.x,q.y-p.y)<40).length;
      return dens > best.d ? {x:p.x,y:p.y,d:dens} : best;
    }, {d:0});
    if (peak.d > 12) {
      const orb = document.createElement('div');
      orb.className = 'orb';
      orb.textContent = 'echo';
      orb.style.left = peak.x + 'px';
      orb.style.top = peak.y + 'px';
      orb.memory = Math.random();
      document.body.appendChild(orb);
      orbs.push(orb);
      makeDraggable(orb);
    }
  }

  // morph orbs
  orbs.forEach((orb,i) => {
    const energy = spectral[i%8] || 0;
    orb.classList.toggle('high', energy > 0.6);
    orb.style.setProperty('--hue', 180 + currentForces[2]*60);
  });
  document.documentElement.style.setProperty('--hue', 200 + currentForces[0]*40);
}

function makeDraggable(el) {
  let dragging = false, ox, oy;
  el.addEventListener('pointerdown', e => {
    dragging = true; ox = e.clientX - el.offsetLeft; oy = e.clientY - el.offsetTop;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    el.style.left = (e.clientX - ox) + 'px';
    el.style.top = (e.clientY - oy) + 'px';
    el.memory = Math.random(); // inject causal token
  });
  el.addEventListener('pointerup', () => dragging = false);
}

canvas.addEventListener('pointermove', e => {
  pointer.vx = e.clientX - pointer.x;
  pointer.vy = e.clientY - pointer.y;
  pointer.x = e.clientX; pointer.y = e.clientY;
});
canvas.addEventListener('pointerdown', e => {
  // inject energy burst
  for (let i=0;i<30;i++) {
    particles.push({x:e.clientX, y:e.clientY, vx:(Math.random()-0.5)*4, vy:(Math.random()-0.5)*4, life:0});
  }
});

function render() {
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0,0,W,H);
  particles.forEach(p => {
    const a = 0.4 + 0.6*Math.sin(p.life);
    ctx.fillStyle = `hsla(${200 + currentForces[1]*40},70%,60%,${a})`;
    ctx.fillRect(p.x, p.y, 2, 2);
  });
  statusEl.textContent = `F-048 Echo Chamber | orbs:${orbs.length} | forces:[${currentForces.map(f=>f.toFixed(2)).join(',')}]`;
}

function loop() {
  step();
  render();
  requestAnimationFrame(loop);
}
loop();
