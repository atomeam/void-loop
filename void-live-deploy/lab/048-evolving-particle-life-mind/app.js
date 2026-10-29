const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
resize(); addEventListener('resize', resize);

const NS = 4; // species
const NP = 400;
const particles = [];
const cards = [];
const colors = ['#ff6b6b','#4ecdc4','#45b7d1','#96ceb4'];
let matrix = Array.from({length:NS}, () => Array(NS).fill(0).map(() => (Math.random()-0.5)*2));
let bestMatrix = matrix.map(r => [...r]);
let fitness = 0, gen = 0, energy = 0, conf = 0.5;

// init particles
for (let i = 0; i < NP; i++) {
  particles.push({
    x: Math.random()*W, y: Math.random()*H,
    vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
    s: i % NS
  });
}

// create cards
for (let s = 0; s < NS; s++) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `<h4>Species ${s}</h4><small>Drag to attract</small>`;
  card.style.left = (100 + s*150) + 'px';
  card.style.top = (100 + s*30) + 'px';
  card.style.borderColor = colors[s];
  document.body.appendChild(card);
  cards.push({ el: card, x: 100+s*150, y: 100+s*30, s, vx:0, vy:0 });
  makeDraggable(card, s);
}

function makeDraggable(el, s) {
  let dragging = false, ox, oy;
  el.onpointerdown = e => { dragging = true; ox = e.clientX - el.offsetLeft; oy = e.clientY - el.offsetTop; el.setPointerCapture(e.pointerId); };
  el.onpointermove = e => {
    if (!dragging) return;
    const nx = e.clientX - ox, ny = e.clientY - oy;
    el.style.left = nx + 'px'; el.style.top = ny + 'px';
    cards[s].x = nx; cards[s].y = ny;
  };
  el.onpointerup = () => dragging = false;
}

// simple physics step
function step() {
  energy = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    let fx = 0, fy = 0;
    // card attractors
    for (const c of cards) {
      const dx = c.x + 60 - p.x, dy = c.y + 30 - p.y;
      const d2 = dx*dx + dy*dy + 1;
      const force = (c.s === p.s ? 0.8 : -0.3) * 2000 / d2;
      fx += force * dx / Math.sqrt(d2);
      fy += force * dy / Math.sqrt(d2);
    }
    // particle-particle via matrix
    for (let j = 0; j < particles.length; j += 4) {
      if (i === j) continue;
      const o = particles[j];
      const dx = o.x - p.x, dy = o.y - p.y;
      const d2 = dx*dx + dy*dy + 4;
      if (d2 > 20000) continue;
      const m = matrix[p.s][o.s];
      const f = m * 80 / d2;
      fx += f * dx; fy += f * dy;
    }
    p.vx = (p.vx + fx) * 0.95; p.vy = (p.vy + fy) * 0.95;
    p.vx = Math.max(-4, Math.min(4, p.vx));
    p.vy = Math.max(-4, Math.min(4, p.vy));
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -1;
    if (p.y < 0 || p.y > H) p.vy *= -1;
    energy += Math.abs(p.vx) + Math.abs(p.vy);
  }
  energy /= NP;
  // move cards toward own species density
  for (const c of cards) {
    let cx=0, cy=0, cnt=0;
    for (const p of particles) if (p.s === c.s && Math.hypot(p.x-c.x, p.y-c.y)<150) { cx+=p.x; cy+=p.y; cnt++; }
    if (cnt > 5) {
      c.vx = (cx/cnt - c.x) * 0.02;
      c.vy = (cy/cnt - c.y) * 0.02;
      c.x += c.vx; c.y += c.vy;
      c.el.style.left = c.x + 'px'; c.el.style.top = c.y + 'px';
    }
  }
}

// render
function render() {
  ctx.fillStyle = 'rgba(10,10,18,0.2)';
  ctx.fillRect(0,0,W,H);
  for (const p of particles) {
    ctx.fillStyle = colors[p.s];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, 6.28);
    ctx.fill();
  }
  document.getElementById('fit').textContent = fitness.toFixed(2);
  document.getElementById('gen').textContent = gen;
  document.getElementById('en').textContent = energy.toFixed(1);
  document.getElementById('cf').textContent = conf.toFixed(2);
  document.body.style.filter = `hue-rotate(${energy * 20}deg)`;
}

// evolutionary Worker (blob)
const workerCode = `
let pop = [];
const NS = 4;
function randomMatrix() {
  return Array.from({length:NS}, () => Array(NS).fill(0).map(() => (Math.random()-0.5)*2));
}
function mutate(m) {
  const n = m.map(r => [...r]);
  const i = Math.floor(Math.random()*NS), j = Math.floor(Math.random()*NS);
  n[i][j] += (Math.random()-0.5)*0.4;
  n[i][j] = Math.max(-2, Math.min(2, n[i][j]));
  return n;
}
self.onmessage = e => {
  if (e.data.type === 'init') {
    pop = Array.from({length:6}, () => ({ m: randomMatrix(), fit: 0 }));
  }
  if (e.data.type === 'fitness') {
    const f = e.data.diversity * 0.6 + Math.min(e.data.energy, 2) * 0.4;
    const idx = e.data.idx || 0;
    if (pop[idx]) pop[idx].fit = f;
    if (Math.random() < 0.15) {
      pop.sort((a,b) => b.fit - a.fit);
      const parent = pop[0].m;
      const child = mutate(parent);
      pop[pop.length-1] = { m: child, fit: 0 };
      self.postMessage({ type: 'best', matrix: pop[0].m, fit: pop[0].fit, gen: Date.now() % 1000 });
    }
  }
};
self.postMessage({ type: 'ready' });
`;
const blob = new Blob([workerCode], {type:'application/javascript'});
const worker = new Worker(URL.createObjectURL(blob));
worker.onmessage = e => {
  if (e.data.type === 'best') {
    bestMatrix = e.data.matrix;
    matrix = bestMatrix.map(r => [...r]);
    fitness = e.data.fit;
    gen++;
    conf = Math.min(1, fitness / 1.5);
  }
};
worker.postMessage({ type: 'init' });

function diversity() {
  const counts = Array(NS).fill(0);
  for (const p of particles) counts[p.s]++;
  const max = Math.max(...counts), min = Math.min(...counts);
  return 1 - (max - min) / NP;
}

function loop() {
  step();
  render();
  if (Math.random() < 0.02) {
    worker.postMessage({ type: 'fitness', diversity: diversity(), energy, idx: Math.floor(Math.random()*6) });
  }
  requestAnimationFrame(loop);
}
loop();

document.getElementById('seal').onclick = () => {
  try {
    localStorage.setItem('f048-matrix', JSON.stringify(bestMatrix));
    alert('Sealed best matrix to localStorage');
  } catch(e) { alert('Seal failed'); }
};
try {
  const saved = localStorage.getItem('f048-matrix');
  if (saved) { matrix = JSON.parse(saved); bestMatrix = matrix.map(r => [...r]); }
} catch(e) {}
