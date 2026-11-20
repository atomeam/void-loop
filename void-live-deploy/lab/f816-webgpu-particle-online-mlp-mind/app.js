const canvas = document.getElementById('c');
const portalsEl = document.getElementById('portals');
const statusEl = document.getElementById('status');
const NUM_PARTICLES = 1024;
const NUM_PORTALS = 5;
let particles = [];
let mlp = { w1: [], b1: [], w2: [], b2: [] }; // 8-12-4
let fitness = 0;
let useWebGPU = false;
let device, pipeline, particleBuffer;

// Simple MLP helpers
function randn() { return (Math.random() + Math.random() + Math.random() - 1.5) * 0.5; }
function initMLP() {
  mlp.w1 = Array.from({length: 12}, () => Array.from({length: 8}, randn));
  mlp.b1 = Array.from({length: 12}, randn);
  mlp.w2 = Array.from({length: 4}, () => Array.from({length: 12}, randn));
  mlp.b2 = Array.from({length: 4}, randn);
}
function forward(inputs) {
  const h = mlp.b1.map((b, i) => Math.tanh(b + mlp.w1[i].reduce((s, w, j) => s + w * inputs[j], 0)));
  return mlp.b2.map((b, i) => Math.tanh(b + mlp.w2[i].reduce((s, w, j) => s + w * h[j], 0)));
}
function onlineUpdate(inputs, reward) {
  // Lightweight reward-modulated update (proxy for policy gradient)
  const lr = 0.01 * Math.min(1, Math.abs(reward));
  const out = forward(inputs);
  for (let i = 0; i < 4; i++) {
    const err = reward * (Math.random() - 0.5) * 0.1; // exploratory
    mlp.b2[i] += lr * err;
    for (let j = 0; j < 12; j++) mlp.w2[i][j] += lr * err * 0.1;
  }
  fitness += reward;
}

// Particles (CPU fallback always available)
function initParticles() {
  particles = Array.from({length: NUM_PARTICLES}, () => ({
    x: Math.random() * innerWidth, y: Math.random() * innerHeight,
    vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2
  }));
}

// Portals
const portals = [];
function createPortals() {
  for (let i = 0; i < NUM_PORTALS; i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = `Portal ${i+1}\nclick to reward`;
    el.style.left = (20 + i * 15) + '%';
    el.style.top = (30 + (i%2)*20) + '%';
    portalsEl.appendChild(el);
    const p = { el, x: 0, y: 0, vx: 0, vy: 0 };
    el.addEventListener('pointerdown', e => { p.dragging = true; p.ox = e.clientX - parseFloat(el.style.left||0); p.oy = e.clientY - parseFloat(el.style.top||0); });
    el.addEventListener('click', () => {
      const inputs = getInputs();
      onlineUpdate(inputs, 1.5);
      statusEl.textContent = `Rewarded! fitness ${fitness.toFixed(1)}`;
    });
    portals.push(p);
  }
  document.addEventListener('pointermove', e => {
    portals.forEach(p => {
      if (p.dragging) {
        p.el.style.left = (e.clientX - p.ox) + 'px';
        p.el.style.top = (e.clientY - p.oy) + 'px';
      }
    });
  });
  document.addEventListener('pointerup', () => portals.forEach(p => p.dragging = false));
}

let pointer = { x: innerWidth/2, y: innerHeight/2, vx: 0, vy: 0 };
let motion = { ax: 0, ay: 0 };
window.addEventListener('pointermove', e => {
  pointer.vx = e.clientX - pointer.x; pointer.vy = e.clientY - pointer.y;
  pointer.x = e.clientX; pointer.y = e.clientY;
});
if (window.DeviceMotionEvent) {
  window.addEventListener('devicemotion', e => {
    motion.ax = e.accelerationIncludingGravity?.x || 0;
    motion.ay = e.accelerationIncludingGravity?.y || 0;
  });
}

function getInputs() {
  return [
    pointer.vx / 20, pointer.vy / 20,
    motion.ax / 10, motion.ay / 10,
    (pointer.x / innerWidth - 0.5)*2, (pointer.y / innerHeight - 0.5)*2,
    Math.sin(Date.now()/1000), Math.cos(Date.now()/800)
  ];
}

// Simulation step
function step() {
  const inputs = getInputs();
  const out = forward(inputs); // [forceX, forceY, emit, damp]
  const fx = out[0] * 0.4, fy = out[1] * 0.4;
  const damp = 0.98 + out[3] * 0.01;

  // Portal force injection
  portals.forEach(p => {
    const rect = p.el.getBoundingClientRect();
    p.x = rect.left + 60; p.y = rect.top + 40;
  });

  particles.forEach(pt => {
    pt.vx += fx * 0.5; pt.vy += fy * 0.5;
    portals.forEach(p => {
      const dx = p.x - pt.x, dy = p.y - pt.y;
      const d2 = dx*dx + dy*dy + 100;
      const f = 80 / d2;
      pt.vx += dx * f; pt.vy += dy * f;
    });
    pt.vx *= damp; pt.vy *= damp;
    pt.x += pt.vx; pt.y += pt.vy;
    if (pt.x < 0 || pt.x > innerWidth) pt.vx *= -0.8;
    if (pt.y < 0 || pt.y > innerHeight) pt.vy *= -0.8;
    pt.x = Math.max(0, Math.min(innerWidth, pt.x));
    pt.y = Math.max(0, Math.min(innerHeight, pt.y));
  });

  // Update portals from clusters (simple: average nearby)
  portals.forEach((p, i) => {
    let cx = 0, cy = 0, n = 0;
    particles.forEach(pt => {
      if (Math.abs(pt.x - p.x) < 150 && Math.abs(pt.y - p.y) < 150) {
        cx += pt.x; cy += pt.y; n++;
      }
    });
    if (n > 5) {
      const tx = cx / n, ty = cy / n;
      p.el.style.transform = `translate(${(tx - p.x)*0.05}px, ${(ty - p.y)*0.05}px) scale(${1 + n/200})`;
      p.el.style.background = `rgba(${30+n}, ${40+n/2}, 120, 0.6)`;
    }
  });
}

// Rendering
const ctx = canvas.getContext('2d');
function resize() {
  canvas.width = innerWidth; canvas.height = innerHeight;
}
resize();
window.addEventListener('resize', resize);

function render() {
  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#6af';
  particles.forEach(pt => {
    ctx.fillRect(pt.x, pt.y, 2, 2);
  });
}

function loop() {
  step();
  render();
  requestAnimationFrame(loop);
}

// Persistence
const dbName = 'verse-f816';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('weights');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
async function saveWeights() {
  const db = await openDB();
  const tx = db.transaction('weights', 'readwrite');
  tx.objectStore('weights').put({ mlp, fitness, ts: Date.now() }, 'current');
  const bc = new BroadcastChannel('f816-weights');
  bc.postMessage({ mlp, fitness });
  statusEl.textContent = 'Sealed & broadcast';
}
async function loadWeights() {
  try {
    const db = await openDB();
    const tx = db.transaction('weights', 'readonly');
    const req = tx.objectStore('weights').get('current');
    req.onsuccess = () => {
      if (req.result) {
        mlp = req.result.mlp;
        fitness = req.result.fitness || 0;
        statusEl.textContent = `Restored fitness ${fitness.toFixed(1)}`;
      }
    };
  } catch (e) { console.debug("lab f816-webgpu-particle-online-mlp-mind:", e); }
}
const bc = new BroadcastChannel('f816-weights');
bc.onmessage = e => {
  if (e.data.fitness > fitness) {
    mlp = e.data.mlp;
    fitness = e.data.fitness;
    statusEl.textContent = `Received better weights ${fitness.toFixed(1)}`;
  }
};

document.getElementById('seal').onclick = saveWeights;
document.getElementById('reset').onclick = () => { initMLP(); fitness = 0; statusEl.textContent = 'Reset'; };

// Init
initMLP();
initParticles();
createPortals();
loadWeights();
statusEl.textContent = 'Running (Canvas2D fallback)';
loop();

// Optional WebGPU upgrade (sketch - falls back silently)
if (navigator.gpu) {
  navigator.gpu.requestAdapter().then(adapter => {
    if (adapter) statusEl.textContent += ' | WebGPU available (CPU sim active)';
  }).catch(()=>{});
}
