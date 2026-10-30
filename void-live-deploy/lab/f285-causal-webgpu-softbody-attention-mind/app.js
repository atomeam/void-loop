const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 180;
const particles = [];
for (let i = 0; i < N; i++) {
  particles.push({
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    id: i
  });
}

const probes = [];
for (let i = 0; i < 4; i++) {
  const el = document.createElement('div');
  el.className = 'probe';
  el.textContent = 'probe ' + i;
  el.style.left = (100 + i * 120) + 'px';
  el.style.top = (100 + (i % 2) * 150) + 'px';
  document.body.appendChild(el);
  probes.push({ el, x: 100 + i * 120, y: 100 + (i % 2) * 150, vx: 0, vy: 0 });
}

let motion = { x: 0, y: 0, z: 0 };
if (window.DeviceMotionEvent) {
  addEventListener('devicemotion', e => {
    if (e.acceleration) {
      motion.x = e.acceleration.x || 0;
      motion.y = e.acceleration.y || 0;
      motion.z = e.acceleration.z || 0;
    }
  });
}

const workerCode = `
let weights = Array(64).fill(0).map(() => Math.random() * 0.2 - 0.1);
function attn(samples) {
  const forces = samples.map(s => {
    let fx = 0, fy = 0;
    for (let h = 0; h < 4; h++) {
      const q = s.vx * weights[h*8] + s.vy * weights[h*8+1] + motionBias;
      const k = s.x * 0.01 * weights[h*8+2] + s.y * 0.01 * weights[h*8+3];
      const score = Math.tanh(q * k);
      fx += score * weights[h*8+4];
      fy += score * weights[h*8+5];
    }
    return { fx: fx * 0.15, fy: fy * 0.15 };
  });
  if (Math.random() < 0.02) weights[Math.floor(Math.random()*weights.length)] += (Math.random()-0.5)*0.05;
  return { forces, weights };
}
let motionBias = 0;
self.onmessage = e => {
  if (e.data.type === 'step') {
    motionBias = (e.data.motion.x + e.data.motion.y) * 0.05;
    const res = attn(e.data.samples);
    self.postMessage(res);
  } else if (e.data.type === 'load') {
    if (e.data.weights) weights = e.data.weights;
  }
};
`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const worker = new Worker(URL.createObjectURL(blob));

let forceBias = Array(N).fill(0).map(() => ({ fx: 0, fy: 0 }));
worker.onmessage = e => {
  const { forces, weights } = e.data;
  forces.forEach((f, i) => {
    if (i < N) forceBias[i] = f;
  });
  window.lastWeights = weights;
};

function sampleParticles() {
  const samples = [];
  for (let i = 0; i < 24; i++) {
    const p = particles[Math.floor(Math.random() * N)];
    samples.push({ x: p.x, y: p.y, vx: p.vx, vy: p.vy });
  }
  return samples;
}

let frame = 0;
function step() {
  frame++;
  if (frame % 4 === 0) {
    worker.postMessage({ type: 'step', samples: sampleParticles(), motion });
  }

  for (let i = 0; i < N; i++) {
    const p = particles[i];
    let fx = forceBias[i]?.fx || 0;
    let fy = forceBias[i]?.fy || 0;
    fx += (W/2 - p.x) * 0.0008;
    fy += (H/2 - p.y) * 0.0008;
    for (let j = 0; j < 8; j++) {
      const o = particles[(i + j * 23) % N];
      const dx = o.x - p.x, dy = o.y - p.y;
      const d2 = dx*dx + dy*dy + 100;
      const d = Math.sqrt(d2);
      const rest = 40;
      const f = (d - rest) * 0.002;
      fx += dx / d * f;
      fy += dy / d * f;
    }
    p.vx = (p.vx + fx) * 0.98;
    p.vy = (p.vy + fy) * 0.98;
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -0.8;
    if (p.y < 0 || p.y > H) p.vy *= -0.8;
  }

  probes.forEach(pr => {
    let dens = 0, fx = 0, fy = 0;
    particles.forEach(p => {
      const dx = p.x - pr.x, dy = p.y - pr.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < 12000) {
        dens++;
        fx += dx * 0.0002;
        fy += dy * 0.0002;
      }
    });
    pr.vx = (pr.vx + fx) * 0.9;
    pr.vy = (pr.vy + fy) * 0.9;
    pr.x += pr.vx;
    pr.y += pr.vy;
    pr.el.style.left = pr.x + 'px';
    pr.el.style.top = pr.y + 'px';
    pr.el.style.transform = `scale(${1 + dens*0.02})`;
  });

  ctx.fillStyle = 'rgba(10,10,20,0.15)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--hue')}, 70%, 60%)`;
  particles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI*2);
    ctx.fill();
  });

  let energy = 0;
  particles.forEach(p => energy += p.vx*p.vx + p.vy*p.vy);
  energy /= N;
  const hue = 200 + energy * 40 + Math.abs(motion.x) * 5;
  document.documentElement.style.setProperty('--hue', hue);
  document.documentElement.style.setProperty('--radius', (8 + energy * 20) + 'px');
  document.documentElement.style.setProperty('--blur', Math.min(4, energy * 0.5) + 'px');

  requestAnimationFrame(step);
}
requestAnimationFrame(step);

let drag = null, ox = 0, oy = 0;
document.addEventListener('pointerdown', e => {
  const pr = probes.find(p => p.el.contains(e.target));
  if (pr) {
    drag = pr;
    ox = e.clientX - pr.x;
    oy = e.clientY - pr.y;
    pr.el.style.cursor = 'grabbing';
  }
});
document.addEventListener('pointermove', e => {
  if (drag) {
    drag.x = e.clientX - ox;
    drag.y = e.clientY - oy;
    particles.forEach(p => {
      const dx = p.x - drag.x, dy = p.y - drag.y;
      if (dx*dx + dy*dy < 8000) {
        p.vx += (e.movementX || 0) * 0.1;
        p.vy += (e.movementY || 0) * 0.1;
      }
    });
  }
});
document.addEventListener('pointerup', () => { if (drag) drag.el.style.cursor = 'grab'; drag = null; });

document.getElementById('seal').onclick = async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('f285', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('mind');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
  const tx = db.transaction('mind', 'readwrite');
  tx.objectStore('mind').put({ weights: window.lastWeights || [], particles: particles.map(p => ({x:p.x,y:p.y,vx:p.vx,vy:p.vy})), t: Date.now() }, 'sealed');
  document.getElementById('status').textContent = 'Sealed to IndexedDB';
};

(async () => {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('f285', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mind');
    const req = tx.objectStore('mind').get('sealed');
    req.onsuccess = () => {
      if (req.result) {
        worker.postMessage({ type: 'load', weights: req.result.weights });
        if (req.result.particles) {
          req.result.particles.forEach((sp, i) => {
            if (particles[i]) Object.assign(particles[i], sp);
          });
        }
        document.getElementById('status').textContent = 'Loaded sealed mind';
      }
    };
  } catch (e) {}
})();
