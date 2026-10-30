const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = innerWidth, H = innerHeight;
canvas.width = W; canvas.height = H;
window.onresize = () => { W = innerWidth; H = innerHeight; canvas.width = W; canvas.height = H; };

const N = 5;
const agents = [];
let tilt = { x: 0, y: 0 };
let pointer = { x: 0.5, y: 0.5 };
let hasOri = false;
let gpu = null;
let sealed = null;

function randomGenome() {
  const w1 = Array.from({length: 4*8}, () => (Math.random()-0.5)*0.4);
  const b1 = Array.from({length: 8}, () => (Math.random()-0.5)*0.1);
  const w2 = Array.from({length: 8*2}, () => (Math.random()-0.5)*0.4);
  const b2 = Array.from({length: 2}, () => (Math.random()-0.5)*0.1);
  return { w1, b1, w2, b2, fitness: 0, id: Math.random().toString(36).slice(2,7) };
}
function mlpForward(g, inputs) {
  const h = [];
  for (let i = 0; i < 8; i++) {
    let s = g.b1[i];
    for (let j = 0; j < 4; j++) s += inputs[j] * g.w1[i*4 + j];
    h[i] = Math.tanh(s);
  }
  const out = [];
  for (let i = 0; i < 2; i++) {
    let s = g.b2[i];
    for (let j = 0; j < 8; j++) s += h[j] * g.w2[i*8 + j];
    out[i] = Math.tanh(s) * 2.5;
  }
  return out;
}
function mutate(g, sigma = 0.15) {
  const m = structuredClone(g);
  const mut = arr => arr.map(v => v + (Math.random()-0.5)*sigma);
  m.w1 = mut(m.w1); m.b1 = mut(m.b1); m.w2 = mut(m.w2); m.b2 = mut(m.b2);
  m.fitness = 0; m.id = Math.random().toString(36).slice(2,7);
  return m;
}
function genomeHash(g) {
  const s = g.w1.concat(g.b1, g.w2, g.b2).map(v => v.toFixed(4)).join(',');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

for (let i = 0; i < N; i++) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = 'A' + i;
  document.body.appendChild(el);
  agents.push({
    el, genome: randomGenome(),
    x: Math.random() * W, y: Math.random() * H,
    vx: 0, vy: 0, fitness: 0
  });
}

const wells = [
  { x: W*0.3, y: H*0.4, vx: 0.4, vy: 0.3 },
  { x: W*0.7, y: H*0.6, vx: -0.3, vy: 0.5 }
];

async function initGPU() {
  if (!navigator.gpu) return null;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    statusEl.textContent = 'WebGPU device ready · CPU physics active';
    return device;
  } catch (e) {
    return null;
  }
}
initGPU().then(d => gpu = d);

function step() {
  wells.forEach(w => {
    w.x += w.vx; w.y += w.vy;
    if (w.x < 40 || w.x > W-40) w.vx *= -1;
    if (w.y < 40 || w.y > H-40) w.vy *= -1;
  });

  agents.forEach(a => {
    const relX = (a.x / W - 0.5);
    const relY = (a.y / H - 0.5);
    const inputs = [tilt.x, tilt.y, relX, relY];
    const force = mlpForward(a.genome, inputs);
    a.vx += force[0] * 0.8;
    a.vy += force[1] * 0.8;

    agents.forEach(b => {
      if (a === b) return;
      const dx = a.x - b.x, dy = a.y - b.y;
      const d2 = dx*dx + dy*dy + 100;
      const f = 8000 / d2;
      a.vx += dx * f * 0.01;
      a.vy += dy * f * 0.01;
    });

    let best = wells[0], bd = Infinity;
    wells.forEach(w => {
      const d = Math.hypot(a.x - w.x, a.y - w.y);
      if (d < bd) { bd = d; best = w; }
    });
    const ax = (best.x - a.x) * 0.002, ay = (best.y - a.y) * 0.002;
    a.vx += ax; a.vy += ay;

    a.vx *= 0.92; a.vy *= 0.92;
    a.x += a.vx; a.y += a.vy;
    a.x = Math.max(36, Math.min(W-36, a.x));
    a.y = Math.max(36, Math.min(H-36, a.y));

    a.fitness += Math.max(0, 120 - bd) * 0.01;
    a.genome.fitness = a.fitness;

    a.el.style.left = (a.x - 36) + 'px';
    a.el.style.top = (a.y - 36) + 'px';
    a.el.textContent = a.genome.id.slice(0,3) + ' ' + a.fitness.toFixed(0);
  });

  const champ = agents.reduce((best, a) => a.fitness > best.fitness ? a : best, agents[0]);
  agents.forEach(a => a.el.classList.toggle('champ', a === champ));

  if (Math.random() < 0.008) {
    const sorted = [...agents].sort((a,b) => b.fitness - a.fitness);
    const champG = sorted[0].genome;
    sealed = { genome: structuredClone(champG), hash: genomeHash(champG), t: Date.now() };
    for (let i = 2; i < sorted.length; i++) {
      sorted[i].genome = mutate(champG, 0.2);
      sorted[i].fitness *= 0.5;
    }
    statusEl.textContent = 'Transfer: champ ' + champG.id.slice(0,4) + ' hash ' + sealed.hash;
  }

  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  wells.forEach(w => {
    ctx.beginPath();
    ctx.arc(w.x, w.y, 28, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(80,180,255,0.35)';
    ctx.fill();
    ctx.strokeStyle = '#8cf';
    ctx.stroke();
  });
  agents.forEach(a => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x + a.vx*3, a.y + a.vy*3);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.stroke();
  });

  requestAnimationFrame(step);
}
requestAnimationFrame(step);

document.getElementById('ori').onclick = async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    try {
      const p = await DeviceOrientationEvent.requestPermission();
      if (p === 'granted') hasOri = true;
    } catch (e) {}
  } else hasOri = true;
  window.addEventListener('deviceorientation', e => {
    if (!hasOri) return;
    tilt.x = Math.max(-1, Math.min(1, (e.gamma || 0) / 45));
    tilt.y = Math.max(-1, Math.min(1, (e.beta || 0) / 45));
  });
  statusEl.textContent = hasOri ? 'Orientation active' : 'Permission denied · pointer proxy';
};
window.onpointermove = e => {
  if (hasOri) return;
  pointer.x = e.clientX / W;
  pointer.y = e.clientY / H;
  tilt.x = (pointer.x - 0.5) * 1.6;
  tilt.y = (pointer.y - 0.5) * 1.6;
};

let db;
const req = indexedDB.open('F254-sealed', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('champ');
req.onsuccess = e => { db = e.target.result; };

document.getElementById('seal').onclick = () => {
  if (!sealed || !db) { statusEl.textContent = 'No sealed champ yet'; return; }
  const tx = db.transaction('champ', 'readwrite');
  tx.objectStore('champ').put(sealed, 'latest');
  statusEl.textContent = 'Sealed to IndexedDB · hash ' + sealed.hash;
};
document.getElementById('reset').onclick = () => {
  agents.forEach(a => {
    a.genome = randomGenome();
    a.fitness = 0;
    a.x = Math.random()*W; a.y = Math.random()*H;
    a.vx = a.vy = 0;
  });
  statusEl.textContent = 'Population reset';
};

setTimeout(() => {
  if (!db) return;
  const tx = db.transaction('champ', 'readonly');
  const g = tx.objectStore('champ').get('latest');
  g.onsuccess = () => {
    if (g.result) {
      agents[0].genome = g.result.genome;
      statusEl.textContent = 'Loaded sealed genome ' + g.result.hash;
    }
  };
}, 800);
