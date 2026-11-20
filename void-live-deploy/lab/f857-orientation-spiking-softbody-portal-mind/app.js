const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// Softbody particles
const N = 48;
const particles = [];
const constraints = [];
const restLengths = [];
function initSoftbody() {
  particles.length = 0; constraints.length = 0;
  const cx = W/2, cy = H/2, r = 120;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rr = r * (0.6 + Math.random()*0.4);
    particles.push({
      x: cx + Math.cos(a)*rr, y: cy + Math.sin(a)*rr,
      px: 0, py: 0, vx: 0, vy: 0
    });
  }
  // Connect nearby
  for (let i = 0; i < N; i++) {
    for (let j = i+1; j < N; j++) {
      const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
      const d = Math.hypot(dx, dy);
      if (d < 70) {
        constraints.push([i, j]);
        restLengths.push(d);
      }
    }
  }
  // Center pin
  particles.push({ x: cx, y: cy, px: cx, py: cy, vx: 0, vy: 0, pinned: true });
  const center = particles.length-1;
  for (let i = 0; i < N; i += 4) {
    constraints.push([i, center]);
    restLengths.push(Math.hypot(particles[i].x-cx, particles[i].y-cy));
  }
}
initSoftbody();

// LIF neurons
const NEUR = 16;
const V = new Float32Array(NEUR);
const thr = 0.8, leak = 0.92, ref = new Int8Array(NEUR);
let weights = Array.from({length: NEUR}, () => Array.from({length: 4}, () => (Math.random()-0.5)*0.3)); // input: ox,oy,px,py residual
let lastOri = {b:0, g:0}, lastPtr = {x:W/2, y:H/2};
let spikeCount = 0, totalReward = 0;

function stepNeurons(input) {
  let spikes = 0;
  for (let i = 0; i < NEUR; i++) {
    if (ref[i] > 0) { ref[i]--; continue; }
    let I = 0;
    for (let k = 0; k < 4; k++) I += weights[i][k] * input[k];
    V[i] = V[i]*leak + I;
    if (V[i] > thr) {
      V[i] = 0;
      ref[i] = 3;
      spikes++;
      // inject force near a random particle
      const p = particles[Math.floor(Math.random()*N)];
      p.vx += (Math.random()-0.5)*4;
      p.vy += (Math.random()-0.5)*4;
    }
  }
  spikeCount = spikes;
  return spikes;
}

// DOM portals
const portals = [];
for (let i = 0; i < 5; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = '•';
  el.dataset.idx = i * 8;
  document.body.appendChild(el);
  portals.push(el);
  el.onclick = () => rewardPortal(i);
}

function rewardPortal(idx) {
  totalReward += 1;
  document.getElementById('reward').textContent = totalReward;
  // plasticity: strengthen weights toward recent input
  const input = getInput();
  for (let n = 0; n < NEUR; n++) {
    if (V[n] > 0.4) {
      for (let k = 0; k < 4; k++) weights[n][k] += 0.02 * input[k];
    }
  }
}

function getInput() {
  const ox = (lastOri.b || 0) / 90;
  const oy = (lastOri.g || 0) / 90;
  const px = (lastPtr.x - W/2) / W * 2;
  const py = (lastPtr.y - H/2) / H * 2;
  return [ox, oy, px, py];
}

// Orientation
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    lastOri.b = e.beta || 0;
    lastOri.g = e.gamma || 0;
  });
}
addEventListener('pointermove', e => { lastPtr.x = e.clientX; lastPtr.y = e.clientY; });

// Seal
document.getElementById('seal').onclick = async () => {
  const genome = { weights, rest: restLengths.slice(), reward: totalReward, t: Date.now() };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f857', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(genome, 'latest');
    await new Promise(r => tx.oncomplete = r);
    if (window.BroadcastChannel) {
      new BroadcastChannel('f857-genome').postMessage(genome);
    }
    alert('Genome sealed');
  } catch(e) { console.warn(e); alert('Seal in memory only'); }
};

// Load previous if any
(async () => {
  try {
    const db = await new Promise((res) => {
      const r = indexedDB.open('verse-f857', 1);
      r.onsuccess = () => res(r.result);
    });
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('latest');
    req.onsuccess = () => {
      if (req.result) {
        weights = req.result.weights;
        totalReward = req.result.reward || 0;
        document.getElementById('reward').textContent = totalReward;
      }
    };
  } catch (e) { console.debug("lab f857-orientation-spiking-softbody-portal-mind:", e); }
})();

function step() {
  const input = getInput();
  const spikes = stepNeurons(input);
  document.getElementById('spikes').textContent = spikes;

  // Verlet + constraints
  for (let p of particles) {
    if (p.pinned) continue;
    const vx = (p.x - p.px) * 0.98;
    const vy = (p.y - p.py) * 0.98;
    p.px = p.x; p.py = p.y;
    p.x += vx; p.y += vy;
    // weak attract to center
    p.x += (W/2 - p.x) * 0.002;
    p.y += (H/2 - p.y) * 0.002;
  }
  // constraints (a few iterations)
  for (let iter = 0; iter < 3; iter++) {
    for (let c = 0; c < constraints.length; c++) {
      const [i, j] = constraints[c];
      const a = particles[i], b = particles[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const diff = (d - restLengths[c]) / d * 0.5;
      if (!a.pinned) { a.x += dx * diff; a.y += dy * diff; }
      if (!b.pinned) { b.x -= dx * diff; b.y -= dy * diff; }
    }
  }

  // draw
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#4af';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [i, j] of constraints) {
    ctx.moveTo(particles[i].x, particles[i].y);
    ctx.lineTo(particles[j].x, particles[j].y);
  }
  ctx.stroke();
  ctx.fillStyle = '#8cf';
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.pinned ? 4 : 3, 0, Math.PI*2);
    ctx.fill();
  }

  // update portals
  for (let i = 0; i < portals.length; i++) {
    const idx = Math.min(parseInt(portals[i].dataset.idx), N-1);
    const p = particles[idx];
    portals[i].style.left = (p.x - 24) + 'px';
    portals[i].style.top = (p.y - 24) + 'px';
  }

  requestAnimationFrame(step);
}
step();
