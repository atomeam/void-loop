const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const statusEl = document.getElementById('status');
let W, H, particles = [], cards = [], elites = [];
let pointer = { x: 0, y: 0, active: false };
let orient = { beta: 0, gamma: 0 };
let frame = 0;
const N = 80;
const GENOME_LEN = 6;

function resize() {
  W = cv.width = innerWidth;
  H = cv.height = innerHeight;
}
window.addEventListener('resize', resize);
resize();

function randGenome() {
  return Array.from({length: GENOME_LEN}, () => Math.random() * 2 - 1);
}

function createParticle(g, x, y) {
  return {
    x: x ?? Math.random() * W,
    y: y ?? Math.random() * H,
    vx: (Math.random()-0.5)*2,
    vy: (Math.random()-0.5)*2,
    genome: g || randGenome(),
    fitness: 0,
    hue: 180 + Math.random()*120
  };
}

function init() {
  particles = Array.from({length: N}, () => createParticle());
  cards.forEach(c => c.el?.remove());
  cards = [];
  loadFromDB().then(() => updateStatus());
}

function updateStatus() {
  const top = particles.slice().sort((a,b)=>b.fitness-a.fitness)[0];
  statusEl.textContent = `Pop ${particles.length} | Top fit ${top?.fitness.toFixed(1) || 0} | Frame ${frame}`;
}

function evolve() {
  particles.sort((a,b) => b.fitness - a.fitness);
  const next = particles.slice(0, 4).map(p => ({...p, fitness: p.fitness*0.7})); // elitism
  while (next.length < N) {
    const a = particles[Math.floor(Math.random()*8)];
    const b = particles[Math.floor(Math.random()*8)];
    const childG = a.genome.map((v,i) => Math.random()<0.5 ? v : b.genome[i]);
    // mutate
    for (let i=0; i<GENOME_LEN; i++) if (Math.random()<0.15) childG[i] += (Math.random()-0.5)*0.3;
    next.push(createParticle(childG));
  }
  particles = next.slice(0, N);
  spawnCards();
}

function spawnCards() {
  const top = particles.slice().sort((a,b)=>b.fitness-a.fitness).slice(0, 6);
  // clear old
  cards.forEach(c => c.el.remove());
  cards = [];
  top.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.style.left = (p.x % (W-140)) + 'px';
    el.style.top = (p.y % (H-80)) + 'px';
    el.style.borderColor = `hsl(${(p.genome[4]*60+180)}, 70%, 60%)`;
    el.innerHTML = `<b>Elite ${i+1}</b><br>fit ${p.fitness.toFixed(1)}<br>g: ${p.genome.map(v=>v.toFixed(2)).join(' ')}`; // void-review: ok (constant labels, numbers or a hash only; no visitor text)
    el.dataset.idx = i;
    makeDraggable(el, p);
    document.body.appendChild(el);
    cards.push({ el, particle: p });
  });
}

function makeDraggable(el, p) {
  let dx, dy, dragging = false;
  el.addEventListener('pointerdown', e => {
    dragging = true;
    dx = e.clientX - el.offsetLeft;
    dy = e.clientY - el.offsetTop;
    el.setPointerCapture(e.pointerId);
    p.fitness += 5; // boost on interact
  });
  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    el.style.left = (e.clientX - dx) + 'px';
    el.style.top = (e.clientY - dy) + 'px';
  });
  el.addEventListener('pointerup', () => { dragging = false; });
}

function step() {
  frame++;
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);

  particles.forEach(p => {
    // simple forces modulated by genome
    let fx = 0, fy = 0;
    // cohesion-ish toward center or pointer
    const tx = pointer.active ? pointer.x : W/2;
    const ty = pointer.active ? pointer.y : H/2;
    fx += (tx - p.x) * 0.0008 * (1 + p.genome[0]);
    fy += (ty - p.y) * 0.0008 * (1 + p.genome[0]);
    // separation from nearby (cheap)
    particles.forEach(o => {
      if (o === p) return;
      const dx = p.x - o.x, dy = p.y - o.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < 900 && d2 > 0) {
        fx += dx / d2 * 20 * Math.abs(p.genome[1]);
        fy += dy / d2 * 20 * Math.abs(p.genome[1]);
      }
    });
    // orientation bias
    fx += orient.gamma * 0.01 * p.genome[2];
    fy += orient.beta * 0.01 * p.genome[2];

    p.vx = (p.vx + fx) * 0.98;
    p.vy = (p.vy + fy) * 0.98;
    const spd = Math.hypot(p.vx, p.vy);
    const maxS = 2 + Math.abs(p.genome[3]) * 2;
    if (spd > maxS) { p.vx *= maxS/spd; p.vy *= maxS/spd; }
    p.x = (p.x + p.vx + W) % W;
    p.y = (p.y + p.vy + H) % H;

    // fitness
    if (pointer.active) {
      const d = Math.hypot(p.x - pointer.x, p.y - pointer.y);
      if (d < 70) p.fitness += 0.05;
    }
    p.fitness *= 0.999;

    // draw
    ctx.fillStyle = `hsla(${p.hue + p.genome[4]*40}, 70%, 60%, 0.8)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2 + Math.abs(p.genome[5])*2, 0, Math.PI*2);
    ctx.fill();
  });

  if (frame % 180 === 0) evolve();
  if (frame % 30 === 0) updateStatus();
  requestAnimationFrame(step);
}

// sensors
cv.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
});
cv.addEventListener('pointerleave', () => pointer.active = false);
cv.addEventListener('click', e => {
  // seal-click nearest
  let best = null, bd = 1e9;
  particles.forEach(p => {
    const d = Math.hypot(p.x - e.clientX, p.y - e.clientY);
    if (d < bd) { bd = d; best = p; }
  });
  if (best && bd < 40) best.fitness += 15;
});

if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
  });
}

// IndexedDB
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('f565-ga-mind', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('elites');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
async function seal() {
  try {
    const db = await openDB();
    const tx = db.transaction('elites', 'readwrite');
    const top = particles.slice().sort((a,b)=>b.fitness-a.fitness).slice(0,8);
    tx.objectStore('elites').put({ genomes: top.map(p=>p.genome), ts: Date.now() }, 'elite');
    statusEl.textContent = 'Sealed elites to IndexedDB';
  } catch(e) { statusEl.textContent = 'Seal failed (in-memory)'; }
}
async function loadFromDB() {
  try {
    const db = await openDB();
    const tx = db.transaction('elites', 'readonly');
    const req = tx.objectStore('elites').get('elite');
    req.onsuccess = () => {
      if (req.result?.genomes) {
        req.result.genomes.forEach((g,i) => {
          if (particles[i]) particles[i].genome = g;
        });
        statusEl.textContent = 'Restored sealed elites';
      }
    };
  } catch (e) { console.warn('f565-webgpu-genetic-particle-genome-dom-mind:', e); }
}

document.getElementById('evolve').onclick = evolve;
document.getElementById('mutate').onclick = () => {
  particles.forEach(p => { if (Math.random()<0.4) p.genome.forEach((_,i)=> p.genome[i] += (Math.random()-0.5)*0.5); });
  evolve();
};
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = init;

init();
requestAnimationFrame(step);
