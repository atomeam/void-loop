const canvas = document.getElementById('bg');
const ctx = canvas.getContext('2d');
const arena = document.getElementById('arena');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 6;
const agents = [];
let orient = { beta: 0, gamma: 0 };
let mouse = { x: W/2, y: H/2 };
let useMouse = false;

function createMLP() {
  // 4 inputs (beta, gamma, vx, vy) → 8 hidden → 2 outputs (fx, fy)
  const w1 = Array.from({length: 4*8}, () => (Math.random()-0.5)*0.8);
  const b1 = Array.from({length: 8}, () => (Math.random()-0.5)*0.2);
  const w2 = Array.from({length: 8*2}, () => (Math.random()-0.5)*0.8);
  const b2 = Array.from({length: 2}, () => (Math.random()-0.5)*0.2);
  return { w1, b1, w2, b2, fitness: 0 };
}

function mlpForward(m, inp) {
  const h = new Array(8).fill(0);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 8; j++)
      h[j] += inp[i] * m.w1[i*8 + j];
  for (let j = 0; j < 8; j++) h[j] = Math.tanh(h[j] + m.b1[j]);
  const out = [0, 0];
  for (let j = 0; j < 8; j++)
    for (let k = 0; k < 2; k++)
      out[k] += h[j] * m.w2[j*2 + k];
  out[0] += m.b2[0]; out[1] += m.b2[1];
  return out;
}

function spawnAgent(i) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = String(i);
  el.style.setProperty('--h', String(40 + i * 50));
  arena.appendChild(el);
  return {
    el, id: i,
    x: 80 + Math.random()*(W-160),
    y: 80 + Math.random()*(H-160),
    vx: 0, vy: 0,
    mlp: createMLP(),
    mass: 1
  };
}

function resetAgents() {
  arena.innerHTML = '';
  agents.length = 0;
  for (let i = 0; i < N; i++) agents.push(spawnAgent(i));
  statusEl.textContent = 'Agents reset. Tilt or move mouse.';
}
resetAgents();

// Orientation
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    if (e.beta != null) {
      orient.beta = Math.max(-45, Math.min(45, e.beta)) / 45;
      orient.gamma = Math.max(-45, Math.min(45, e.gamma)) / 45;
      useMouse = false;
      statusEl.textContent = `Tilt β:${orient.beta.toFixed(2)} γ:${orient.gamma.toFixed(2)}`;
    }
  });
} else {
  useMouse = true;
  statusEl.textContent = 'No DeviceOrientation — using mouse as tilt proxy.';
}

addEventListener('pointermove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (useMouse) {
    orient.beta = (mouse.y / H - 0.5) * 2;
    orient.gamma = (mouse.x / W - 0.5) * 2;
  }
});

// Drag
let dragging = null, dragOff = {x:0,y:0};
arena.addEventListener('pointerdown', e => {
  const el = e.target.closest('.agent');
  if (!el) return;
  dragging = agents.find(a => a.el === el);
  if (!dragging) return;
  dragOff.x = e.clientX - dragging.x;
  dragOff.y = e.clientY - dragging.y;
  el.setPointerCapture(e.pointerId);
});
addEventListener('pointermove', e => {
  if (!dragging) return;
  dragging.x = e.clientX - dragOff.x;
  dragging.y = e.clientY - dragOff.y;
  dragging.vx = dragging.vy = 0;
});
addEventListener('pointerup', () => { dragging = null; });

// Physics + MLP
function step() {
  const dt = 0.016;
  const beta = orient.beta, gamma = orient.gamma;

  for (const a of agents) {
    if (a === dragging) continue;
    const inp = [beta, gamma, a.vx * 0.05, a.vy * 0.05];
    const [fx, fy] = mlpForward(a.mlp, inp);
    const forceScale = 80;
    a.vx += fx * forceScale * dt;
    a.vy += fy * forceScale * dt;
    // damping
    a.vx *= 0.92; a.vy *= 0.92;
    // simple bounds
    a.x += a.vx;
    a.y += a.vy;
    if (a.x < 32) { a.x = 32; a.vx *= -0.5; }
    if (a.x > W-32) { a.x = W-32; a.vx *= -0.5; }
    if (a.y < 32) { a.y = 32; a.vy *= -0.5; }
    if (a.y > H-32) { a.y = H-32; a.vy *= -0.5; }
    // fitness: stay near center or respond well
    const cx = W/2, cy = H/2;
    const dist = Math.hypot(a.x-cx, a.y-cy);
    a.mlp.fitness = Math.max(0, 1 - dist / (Math.min(W,H)*0.4));
    a.el.style.left = (a.x - 32) + 'px';
    a.el.style.top = (a.y - 32) + 'px';
  }

  // mild repulsion
  for (let i = 0; i < agents.length; i++) {
    for (let j = i+1; j < agents.length; j++) {
      const a = agents[i], b = agents[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 70) {
        const f = (70 - d) * 0.4;
        const ux = dx/d, uy = dy/d;
        a.vx -= ux * f; a.vy -= uy * f;
        b.vx += ux * f; b.vy += uy * f;
      }
    }
  }

  // canvas viz
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = `hsla(${200 + beta*60}, 60%, 50%, 0.4)`;
  ctx.beginPath();
  ctx.moveTo(W/2, H/2);
  ctx.lineTo(W/2 + gamma*120, H/2 + beta*120);
  ctx.stroke();
  for (const a of agents) {
    ctx.fillStyle = `hsla(${40 + a.id*50}, 70%, 60%, 0.25)`;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 40, 0, Math.PI*2);
    ctx.fill();
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// Seal / transfer via IndexedDB
let db;
const req = indexedDB.open('F300-genomes', 1);
req.onupgradeneeded = e => {
  e.target.result.createObjectStore('genomes', { keyPath: 'ts' });
};
req.onsuccess = e => { db = e.target.result; };
req.onerror = () => statusEl.textContent = 'IndexedDB unavailable (still works offline).';

function getBest() {
  return agents.reduce((best, a) => a.mlp.fitness > best.mlp.fitness ? a : best, agents[0]);
}

document.getElementById('seal').onclick = () => {
  const best = getBest();
  if (!db) { statusEl.textContent = 'No DB — genome kept in memory only.'; return; }
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({
    ts: Date.now(),
    weights: best.mlp,
    fitness: best.mlp.fitness
  });
  statusEl.textContent = `Sealed agent ${best.id} fitness ${best.mlp.fitness.toFixed(2)}`;
};

document.getElementById('transfer').onclick = () => {
  const best = getBest();
  const target = agents[Math.floor(Math.random()*N)];
  // mutate
  const m = JSON.parse(JSON.stringify(best.mlp));
  for (let k of ['w1','w2','b1','b2'])
    for (let i = 0; i < m[k].length; i++)
      if (Math.random() < 0.15) m[k][i] += (Math.random()-0.5)*0.4;
  target.mlp = m;
  statusEl.textContent = `Transferred mutated genome from ${best.id} → ${target.id}`;
};

document.getElementById('reset').onclick = resetAgents;

statusEl.textContent = 'Ready. Tilt device or move mouse. Drag agents. Seal best.';
