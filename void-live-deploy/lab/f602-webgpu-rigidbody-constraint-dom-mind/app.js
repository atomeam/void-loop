const stage = document.getElementById('stage');
const canvas = document.getElementById('fx');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
function resize() {
  canvas.width = innerWidth; canvas.height = innerHeight;
}
resize(); addEventListener('resize', resize);

const bodies = [];
const N = 7;
const W = 120, H = 80;
function rand(a,b){ return a + Math.random()*(b-a); }
function createBody(i) {
  const el = document.createElement('div');
  el.className = 'body';
  el.innerHTML = `<div class="label">Body ${i}</div><div class="props"></div>`; // void-review: ok (built from this file's own constants and numbers, no visitor text)
  stage.appendChild(el);
  return {
    el, i,
    x: rand(40, innerWidth-160), y: rand(40, innerHeight-120),
    vx: rand(-40,40), vy: rand(-20,20),
    w: W, h: H,
    mass: rand(0.6, 1.8),
    friction: rand(0.2, 0.8),
    restitution: rand(0.3, 0.85),
    fitness: 0,
    angular: 0
  };
}
for (let i=0; i<N; i++) bodies.push(createBody(i));

let gravity = {x: 0, y: 180};
let pointer = {x: innerWidth/2, y: innerHeight/2};
window.addEventListener('deviceorientation', e => {
  if (e.beta != null && e.gamma != null) {
    gravity.x = (e.gamma || 0) * 4;
    gravity.y = Math.max(40, (e.beta || 0) * 6);
    statusEl.textContent = `g ${gravity.x.toFixed(0)},${gravity.y.toFixed(0)}`;
  }
});
let dragging = null, dragOff = {x:0,y:0};
stage.addEventListener('pointerdown', e => {
  const t = e.target.closest('.body');
  if (!t) return;
  dragging = bodies.find(b => b.el === t);
  if (dragging) {
    dragOff.x = e.clientX - dragging.x;
    dragOff.y = e.clientY - dragging.y;
    dragging.vx = dragging.vy = 0;
    t.setPointerCapture(e.pointerId);
  }
});
stage.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  if (dragging) {
    dragging.x = e.clientX - dragOff.x;
    dragging.y = e.clientY - dragOff.y;
  }
});
stage.addEventListener('pointerup', () => { dragging = null; });
stage.addEventListener('click', e => {
  const t = e.target.closest('.body');
  if (!t) return;
  const b = bodies.find(bb => bb.el === t);
  if (b) { b.fitness += 12; b.el.style.borderColor = '#5ce1e6'; setTimeout(()=>b.el.style.borderColor='', 300); }
});

const bc = new BroadcastChannel('f602-genome');
function hashProps(b) {
  const s = `${b.mass.toFixed(3)}|${b.friction.toFixed(3)}|${b.restitution.toFixed(3)}`;
  let h = 2166136261;
  for (let i=0; i<s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
function transfer(from, to) {
  if (from.fitness <= to.fitness) return;
  const packet = { mass: from.mass, friction: from.friction, restitution: from.restitution, hash: hashProps(from), fitness: from.fitness };
  to.mass = from.mass * 0.7 + to.mass * 0.3;
  to.friction = from.friction * 0.7 + to.friction * 0.3;
  to.restitution = from.restitution * 0.7 + to.restitution * 0.3;
  to.fitness = Math.max(to.fitness, from.fitness * 0.4);
  bc.postMessage(packet);
  statusEl.textContent = `transfer ${from.i}→${to.i}`;
}
bc.onmessage = e => {
  const p = e.data;
  if (!p || !p.hash) return;
  // adopt if higher fitness
  const best = bodies.reduce((a,b)=> a.fitness > b.fitness ? a : b);
  if (p.fitness > best.fitness) {
    best.mass = p.mass; best.friction = p.friction; best.restitution = p.restitution;
    best.fitness = p.fitness * 0.8;
    statusEl.textContent = 'peer genome adopted';
  }
};

function updateProps(b) {
  b.el.querySelector('.props').textContent = `m:${b.mass.toFixed(2)} f:${b.friction.toFixed(2)} r:${b.restitution.toFixed(2)}`;
  b.el.style.transform = `translate(${b.x}px,${b.y}px) rotate(${b.angular}deg)`;
  const hue = 180 + b.restitution * 40;
  b.el.style.background = `hsl(${hue}, 30%, 12%)`;
}

function step(dt) {
  // gravity
  for (const b of bodies) {
    if (b === dragging) continue;
    b.vx += gravity.x * dt;
    b.vy += gravity.y * dt;
    b.vx *= 0.995; b.vy *= 0.995;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // walls
    if (b.x < 0) { b.x = 0; b.vx *= -b.restitution; }
    if (b.y < 0) { b.y = 0; b.vy *= -b.restitution; }
    if (b.x + b.w > innerWidth) { b.x = innerWidth - b.w; b.vx *= -b.restitution; }
    if (b.y + b.h > innerHeight) { b.y = innerHeight - b.h; b.vy *= -b.restitution; }
    b.angular += b.vx * 0.05;
    b.fitness = Math.max(0, b.fitness * 0.998 + Math.hypot(b.vx, b.vy) * 0.01);
  }
  // contacts (AABB)
  for (let i=0; i<bodies.length; i++) {
    for (let j=i+1; j<bodies.length; j++) {
      const a = bodies[i], c = bodies[j];
      const ox = Math.min(a.x+a.w, c.x+c.w) - Math.max(a.x, c.x);
      const oy = Math.min(a.y+a.h, c.y+c.h) - Math.max(a.y, c.y);
      if (ox > 0 && oy > 0) {
        // positional correction
        if (ox < oy) {
          const dir = a.x < c.x ? -1 : 1;
          a.x += dir * ox * 0.5; c.x -= dir * ox * 0.5;
          const rel = a.vx - c.vx;
          const imp = rel * (1 + Math.min(a.restitution, c.restitution)) * 0.5;
          a.vx -= imp / a.mass; c.vx += imp / c.mass;
          a.vx *= (1 - a.friction * 0.1); c.vx *= (1 - c.friction * 0.1);
        } else {
          const dir = a.y < c.y ? -1 : 1;
          a.y += dir * oy * 0.5; c.y -= dir * oy * 0.5;
          const rel = a.vy - c.vy;
          const imp = rel * (1 + Math.min(a.restitution, c.restitution)) * 0.5;
          a.vy -= imp / a.mass; c.vy += imp / c.mass;
        }
        transfer(a, c); transfer(c, a);
        // flash
        ctx.strokeStyle = 'rgba(92,225,230,0.6)';
        ctx.strokeRect(Math.min(a.x,c.x), Math.min(a.y,c.y), Math.max(a.w,c.w), Math.max(a.h,c.h));
      }
    }
  }
  for (const b of bodies) updateProps(b);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.032, (now - last) / 1000);
  last = now;
  ctx.fillStyle = 'rgba(10,12,16,0.15)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  step(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// IndexedDB
const DB = 'verse-f602';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('best');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function seal() {
  try {
    const db = await openDB();
    const best = bodies.reduce((a,b)=> a.fitness > b.fitness ? a : b);
    const tx = db.transaction('best', 'readwrite');
    tx.objectStore('best').put({ mass: best.mass, friction: best.friction, restitution: best.restitution, fitness: best.fitness }, 'current');
    statusEl.textContent = 'sealed';
  } catch(e) { statusEl.textContent = 'seal failed'; }
}
async function restore() {
  try {
    const db = await openDB();
    const tx = db.transaction('best', 'readonly');
    const req = tx.objectStore('best').get('current');
    req.onsuccess = () => {
      const p = req.result;
      if (p) {
        bodies[0].mass = p.mass; bodies[0].friction = p.friction; bodies[0].restitution = p.restitution; bodies[0].fitness = p.fitness || 0;
        statusEl.textContent = 'restored';
      }
    };
  } catch (e) { console.debug("lab f602-webgpu-rigidbody-constraint-dom-mind:", e); }
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => location.reload();
restore();
