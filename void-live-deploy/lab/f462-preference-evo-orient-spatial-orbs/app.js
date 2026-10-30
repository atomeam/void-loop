const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N_PARTICLES = 400;
const N_ATTRACTORS = 5;
const POP = 6;
let generation = 0;
let avgFitness = 0;
let tiltX = 0, tiltY = 0;
let pointer = {x: W/2, y: H/2, down: false};
let db;

const particles = Array.from({length: N_PARTICLES}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  vx: 0, vy: 0
}));

function randomGenome() {
  const g = [];
  for (let i = 0; i < N_ATTRACTORS; i++) {
    g.push(
      Math.random() * W,
      Math.random() * H,
      Math.random() * 360,
      0.3 + Math.random() * 1.5,
      40 + Math.random() * 80
    );
  }
  return g;
}

let population = Array.from({length: POP}, () => ({genome: randomGenome(), fitness: 0}));
let champion = population[0];

function mutate(g, rate = 0.15) {
  return g.map((v, i) => {
    if (Math.random() > rate) return v;
    const dim = i % 5;
    if (dim === 0) return Math.max(0, Math.min(W, v + (Math.random()-0.5)*80));
    if (dim === 1) return Math.max(0, Math.min(H, v + (Math.random()-0.5)*80));
    if (dim === 2) return (v + (Math.random()-0.5)*60 + 360) % 360;
    if (dim === 3) return Math.max(0.1, v + (Math.random()-0.5)*0.5);
    return Math.max(20, v + (Math.random()-0.5)*30);
  });
}

function evolve() {
  population.sort((a,b) => b.fitness - a.fitness);
  champion = population[0];
  avgFitness = population.reduce((s,p) => s+p.fitness, 0) / POP;
  document.getElementById('fit').textContent = avgFitness.toFixed(2);
  document.getElementById('gen').textContent = ++generation;
  const next = [champion];
  while (next.length < POP) {
    const parent = population[Math.floor(Math.random() * Math.min(3, POP))];
    next.push({genome: mutate(parent.genome), fitness: 0});
  }
  population = next;
  updateCards();
}

function getAttractors(g) {
  const atts = [];
  for (let i = 0; i < N_ATTRACTORS; i++) {
    const b = i*5;
    atts.push({
      x: g[b], y: g[b+1], hue: g[b+2], str: g[b+3], r: g[b+4]
    });
  }
  return atts;
}

function updateCards() {
  const cards = document.getElementById('cards');
  cards.innerHTML = '';
  population.slice(0, 3).forEach((ind, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h4>Candidate ${idx+1}</h4>Fit: ${ind.fitness.toFixed(1)}<br>Drag to adjust pos`;
    card.dataset.idx = idx;
    makeDraggable(card, ind);
    cards.appendChild(card);
  });
}

function makeDraggable(el, ind) {
  let ox, oy;
  el.onpointerdown = e => {
    ox = e.clientX - parseFloat(el.style.left || 0);
    oy = e.clientY - parseFloat(el.style.top || 0);
    el.setPointerCapture(e.pointerId);
  };
  el.onpointermove = e => {
    if (e.buttons) {
      const dx = (e.clientX - ox) * 0.5;
      const dy = (e.clientY - oy) * 0.5;
      ind.genome[0] = Math.max(0, Math.min(W, ind.genome[0] + dx * 0.1));
      ind.genome[1] = Math.max(0, Math.min(H, ind.genome[1] + dy * 0.1));
    }
  };
}

function step() {
  const atts = getAttractors(champion.genome);
  const gx = tiltX * 0.3, gy = tiltY * 0.3;

  particles.forEach(p => {
    let fx = gx, fy = gy;
    atts.forEach(a => {
      const dx = a.x - p.x, dy = a.y - p.y;
      const d2 = dx*dx + dy*dy + 100;
      const d = Math.sqrt(d2);
      const f = a.str * 800 / d2;
      fx += dx / d * f;
      fy += dy / d * f;
    });
    p.vx = (p.vx + fx) * 0.92;
    p.vy = (p.vy + fy) * 0.92;
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -0.5;
    if (p.y < 0 || p.y > H) p.vy *= -0.5;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
  });

  if (pointer.down || true) {
    atts.forEach((a, i) => {
      const d = Math.hypot(a.x - pointer.x, a.y - pointer.y);
      if (d < a.r * 1.5) {
        population[0].fitness += 0.002;
      }
    });
  }
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const atts = getAttractors(champion.genome);
  atts.forEach(a => {
    const grd = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, a.r);
    grd.addColorStop(0, `hsla(${a.hue},80%,60%,0.8)`);
    grd.addColorStop(1, `hsla(${a.hue},80%,30%,0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.r, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.fillStyle = 'rgba(200,220,255,0.6)';
  particles.forEach(p => {
    ctx.fillRect(p.x-1, p.y-1, 2, 2);
  });
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}
loop();
updateCards();

canvas.addEventListener('pointerdown', e => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.down = true;
  const atts = getAttractors(champion.genome);
  let best = 0, bd = Infinity;
  atts.forEach((a,i) => {
    const d = Math.hypot(a.x - pointer.x, a.y - pointer.y);
    if (d < bd) { bd = d; best = i; }
  });
  if (bd < 150) {
    population.forEach(ind => ind.fitness += (ind === champion ? 1 : 0.2));
    if (Math.random() < 0.3) evolve();
  }
});
canvas.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
canvas.addEventListener('pointerup', () => pointer.down = false);

if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    tiltX = (e.gamma || 0) / 45;
    tiltY = (e.beta || 0) / 45;
  });
}

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('verse-f462', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seal');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
document.getElementById('seal').onclick = async () => {
  try {
    db = db || await openDB();
    const tx = db.transaction('seal', 'readwrite');
    tx.objectStore('seal').put({genome: champion.genome, gen: generation, fit: avgFitness}, 'champion');
    document.getElementById('status').textContent = 'Sealed to IndexedDB';
  } catch(e) { document.getElementById('status').textContent = 'Seal failed (memory only)'; }
};
document.getElementById('load').onclick = async () => {
  try {
    db = db || await openDB();
    const tx = db.transaction('seal', 'readonly');
    const req = tx.objectStore('seal').get('champion');
    req.onsuccess = () => {
      if (req.result) {
        champion.genome = req.result.genome;
        generation = req.result.gen || 0;
        population[0] = champion;
        document.getElementById('status').textContent = 'Loaded champion';
        updateCards();
      }
    };
  } catch(e) {}
};
document.getElementById('mutate').onclick = () => evolve();

setTimeout(evolve, 100);
