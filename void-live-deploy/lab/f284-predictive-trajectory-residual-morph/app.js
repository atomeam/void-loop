const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let pointer = {x: W/2, y: H/2, vx:0, vy:0};
let traj = [];
let residual = 0;
let cards = [];
let sealed = 0;
let particles = Array.from({length:48}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  vx: (Math.random()-0.5)*1, vy: (Math.random()-0.5)*1,
  h: Math.random()*360
}));

// Simple predictive model (main-thread for reliability; Worker path noted)
let hidden = [0,0,0,0];
let weights = new Float32Array(16).map(() => (Math.random()-0.5)*0.5);

function predict(px, py, pvx, pvy) {
  // Tiny residual predictor: features → next pos delta
  const f = [px/W, py/H, pvx, pvy, ...hidden];
  let nx = 0, ny = 0;
  for (let i=0; i<8; i++) {
    nx += f[i % f.length] * weights[i];
    ny += f[(i+4) % f.length] * weights[i+8];
  }
  hidden = hidden.map((h,i) => Math.tanh(h*0.7 + f[i%4]*0.3));
  return {x: px + nx*40, y: py + ny*40};
}

function updateModel(actualX, actualY) {
  const pred = predict(pointer.x, pointer.y, pointer.vx, pointer.vy);
  residual = Math.hypot(pred.x - actualX, pred.y - actualY) / 80;
  residual = Math.min(2, residual);
  // light online update
  if (residual > 0.3) {
    for (let i=0; i<weights.length; i++) weights[i] += (Math.random()-0.5)*0.02*residual;
  }
}

addEventListener('pointermove', e => {
  const nx = e.clientX, ny = e.clientY;
  pointer.vx = nx - pointer.x; pointer.vy = ny - pointer.y;
  updateModel(nx, ny);
  pointer.x = nx; pointer.y = ny;
  traj.push({x:nx, y:ny});
  if (traj.length > 32) traj.shift();
  if (residual > 0.6 && cards.length < 8 && Math.random() < 0.15) spawnCard();
});

function spawnCard() {
  const id = Math.random().toString(36).slice(2,7);
  const el = document.createElement('div');
  el.className = 'card';
  el.textContent = `res:${residual.toFixed(2)}\n#${id}`;
  el.style.left = (pointer.x - 40) + 'px';
  el.style.top = (pointer.y - 20) + 'px';
  el.dataset.ox = pointer.x; el.dataset.oy = pointer.y;
  document.body.appendChild(el);
  cards.push({el, x:pointer.x, y:pointer.y, vx:0, vy:0});
  makeDraggable(el, cards[cards.length-1]);
}

function makeDraggable(el, card) {
  let dx=0, dy=0, drag=false;
  el.onpointerdown = e => { drag=true; dx=e.clientX-card.x; dy=e.clientY-card.y; el.setPointerCapture(e.pointerId); };
  el.onpointermove = e => {
    if (!drag) return;
    card.x = e.clientX - dx; card.y = e.clientY - dy;
    // inject correction
    residual *= 0.7;
    particles.forEach(p => { p.vx += (card.x - p.x)*0.001; p.vy += (card.y - p.y)*0.001; });
  };
  el.onpointerup = () => { drag=false; };
}

function step() {
  // particles
  particles.forEach(p => {
    const dx = pointer.x - p.x, dy = pointer.y - p.y;
    const d = Math.hypot(dx,dy)+1;
    const force = residual * 0.8 / d;
    p.vx += dx * force * 0.02;
    p.vy += dy * force * 0.02;
    p.vx *= 0.96; p.vy *= 0.96;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>W) p.vx*=-1; if (p.y<0||p.y>H) p.vy*=-1;
    p.h = (p.h + residual*4) % 360;
  });
  // cards morph toward density
  cards.forEach(c => {
    let dens = 0;
    particles.forEach(p => dens += Math.exp(-Math.hypot(p.x-c.x, p.y-c.y)/80));
    dens /= particles.length;
    c.x += (pointer.x - c.x)*0.01*residual;
    c.y += (pointer.y - c.y)*0.01*residual;
    c.el.style.left = (c.x-40)+'px';
    c.el.style.top = (c.y-15)+'px';
    c.el.style.transform = `scale(${0.8 + dens*0.6})`;
    c.el.style.borderColor = `hsl(${residual*180},70%,60%)`;
  });
  document.getElementById('res').textContent = residual.toFixed(2);
  document.getElementById('nc').textContent = cards.length;
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  particles.forEach(p => {
    ctx.fillStyle = `hsla(${p.h},70%,60%,0.7)`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 2+residual*2, 0, Math.PI*2); ctx.fill();
  });
  // residual glow
  ctx.strokeStyle = `hsla(${residual*120},80%,70%,0.4)`;
  ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 20+residual*30, 0, Math.PI*2); ctx.stroke();
}

function loop() { step(); draw(); requestAnimationFrame(loop); }
loop();

// IndexedDB seal
let db;
const req = indexedDB.open('f284-traj', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', {keyPath:'id'});
req.onsuccess = e => { db = e.target.result; };
document.getElementById('seal').onclick = () => {
  if (!db) return;
  const id = Date.now().toString(36);
  const genome = {id, weights: Array.from(weights), residual, ts:Date.now()};
  db.transaction('genomes','readwrite').objectStore('genomes').put(genome);
  sealed++; document.getElementById('ns').textContent = sealed;
};
document.getElementById('load').onclick = () => {
  if (!db) return;
  const tx = db.transaction('genomes');
  const store = tx.objectStore('genomes');
  const r = store.getAll();
  r.onsuccess = () => {
    const g = r.result.pop();
    if (g && g.weights) { weights.set(g.weights); residual = g.residual||0; }
  };
};
document.getElementById('reset').onclick = () => {
  cards.forEach(c => c.el.remove()); cards=[]; residual=0; traj=[];
  particles.forEach(p => { p.x=Math.random()*W; p.y=Math.random()*H; });
};
