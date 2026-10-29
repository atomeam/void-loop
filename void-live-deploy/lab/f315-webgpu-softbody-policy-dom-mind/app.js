const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const cardsEl = document.getElementById('cards');

let W = innerWidth, H = innerHeight;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

const N = 16;
const particles = [];
const springs = [];
const cards = [];

for (let i = 0; i < N; i++) {
  const a = (i / N) * Math.PI * 2;
  particles.push({
    x: W/2 + Math.cos(a)*80, y: H/2 + Math.sin(a)*80,
    vx: 0, vy: 0, mass: 1, fixed: false
  });
}
for (let i = 0; i < N; i++) {
  springs.push({ a:i, b:(i+1)%N, rest: 50, k: 0.3 });
  if (i % 4 === 0) springs.push({ a:i, b:(i+4)%N, rest: 90, k: 0.15 });
}

const labels = ['Reach','Hold','Flow','Rest'];
for (let i = 0; i < 4; i++) {
  const pIdx = i * 4;
  const card = document.createElement('div');
  card.className = 'card';
  card.textContent = labels[i];
  card.dataset.p = pIdx;
  cardsEl.appendChild(card);
  cards.push({ el: card, p: pIdx, dragging: false });
}

let policy = new Float32Array(16);
for (let i = 0; i < 16; i++) policy[i] = (Math.random()-0.5)*0.1;

let target = { x: W/2 + 100, y: H/2 };
let energy = 0;

function stepPhysics() {
  for (let m = 0; m < 4; m++) {
    const p = particles[m*4 + 1];
    const dx = target.x - p.x, dy = target.y - p.y;
    const f = policy[m*4] * dx + policy[m*4+1] * dy;
    p.vx += f * 0.05;
    p.vy += (policy[m*4+2] * dx + policy[m*4+3] * dy) * 0.05;
  }
  for (const s of springs) {
    const a = particles[s.a], b = particles[s.b];
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const force = (dist - s.rest) * s.k;
    const fx = force * dx / dist, fy = force * dy / dist;
    a.vx += fx / a.mass; a.vy += fy / a.mass;
    b.vx -= fx / b.mass; b.vy -= fy / b.mass;
  }
  energy = 0;
  for (const p of particles) {
    if (p.fixed) continue;
    p.vx *= 0.98; p.vy *= 0.98;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 20) { p.x = 20; p.vx *= -0.5; }
    if (p.x > W-20) { p.x = W-20; p.vx *= -0.5; }
    if (p.y < 20) { p.y = 20; p.vy *= -0.5; }
    if (p.y > H-20) { p.y = H-20; p.vy *= -0.5; }
    energy += p.vx*p.vx + p.vy*p.vy;
  }
  for (const c of cards) {
    const p = particles[c.p];
    c.el.style.left = (p.x - 45) + 'px';
    c.el.style.top = (p.y - 30) + 'px';
    c.el.style.transform = `scale(${1 + Math.min(0.3, energy*0.001)})`;
  }
}

function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = '#4466aa';
  ctx.lineWidth = 1;
  for (const s of springs) {
    const a = particles[s.a], b = particles[s.b];
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  }
  ctx.fillStyle = '#88aaff';
  for (const p of particles) {
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
  }
  ctx.fillStyle = '#ffaa44';
  ctx.beginPath(); ctx.arc(target.x, target.y, 6, 0, Math.PI*2); ctx.fill();
}

let last = 0;
function loop(t) {
  if (t - last > 16) {
    stepPhysics();
    render();
    last = t;
    const dist = Math.hypot(particles[1].x - target.x, particles[1].y - target.y);
    if (dist < 40 && energy < 50) {
    } else if (Math.random() < 0.02) {
      const i = Math.floor(Math.random()*16);
      policy[i] += (Math.random()-0.5)*0.02;
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

let drag = null, ox=0, oy=0;
cardsEl.addEventListener('pointerdown', e => {
  if (!e.target.classList.contains('card')) return;
  drag = e.target;
  drag.setPointerCapture(e.pointerId);
  ox = e.clientX - parseFloat(drag.style.left || 0);
  oy = e.clientY - parseFloat(drag.style.top || 0);
  const p = particles[+drag.dataset.p];
  p.fixed = true;
});
addEventListener('pointermove', e => {
  if (!drag) return;
  const p = particles[+drag.dataset.p];
  p.x = e.clientX - ox + 45;
  p.y = e.clientY - oy + 30;
  target.x = p.x; target.y = p.y;
});
addEventListener('pointerup', e => {
  if (!drag) return;
  particles[+drag.dataset.p].fixed = false;
  drag = null;
});

document.getElementById('seal').onclick = async () => {
  const db = await idb();
  const tx = db.transaction('policy', 'readwrite');
  tx.objectStore('policy').put({ id:1, weights: Array.from(policy), t: Date.now() });
  status.textContent = 'sealed';
};
document.getElementById('load').onclick = async () => {
  const db = await idb();
  const tx = db.transaction('policy', 'readonly');
  const req = tx.objectStore('policy').get(1);
  req.onsuccess = () => {
    if (req.result) {
      policy = new Float32Array(req.result.weights);
      status.textContent = 'loaded';
    }
  };
};

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('f315', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('policy', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}

status.textContent = 'running (CPU softbody + policy)';
