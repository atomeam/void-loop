const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let w, h, particles = [], deposits = [], probes = [];
let gpu = null, gpuDevice = null, useGPU = false;
let fitness = 0, generation = 0, energy = 0.3, residual = 0;
const N = 600;
let worker;

function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize); resize();

function initParticles() {
  particles = [];
  for (let i = 0; i < N; i++) {
    particles.push({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random()-0.5)*0.4, vy: (Math.random()-0.5)*0.4,
      life: 1
    });
  }
}
initParticles();

// Simple Worker GA for parameter evolution
const workerCode = `
let pop = [];
let best = { attract: 0.04, repel: 0.012, decay: 0.96 };
function initPop(n=12) {
  pop = Array.from({length:n}, () => ({
    attract: 0.01 + Math.random()*0.08,
    repel: 0.005 + Math.random()*0.03,
    decay: 0.92 + Math.random()*0.07,
    fit: 0
  }));
}
initPop();
self.onmessage = (e) => {
  const { deposits, particles, gen } = e.data;
  // Fitness: how tightly particles cluster near recent deposits
  let score = 0;
  if (deposits.length && particles.length) {
    deposits.slice(-8).forEach(d => {
      particles.forEach(p => {
        const dx = p.x - d.x, dy = p.y - d.y;
        const dist = Math.hypot(dx, dy) || 1;
        score += Math.max(0, 1 - dist / 180);
      });
    });
    score /= (deposits.slice(-8).length * particles.length);
  }
  // Evolve
  pop.forEach(ind => ind.fit = score * (0.7 + Math.random()*0.6)); // noisy
  pop.sort((a,b) => b.fit - a.fit);
  const elite = pop.slice(0,3);
  const next = [...elite];
  while (next.length < pop.length) {
    const a = elite[Math.floor(Math.random()*elite.length)];
    const b = elite[Math.floor(Math.random()*elite.length)];
    next.push({
      attract: (a.attract + b.attract)/2 + (Math.random()-0.5)*0.01,
      repel: (a.repel + b.repel)/2 + (Math.random()-0.5)*0.004,
      decay: Math.max(0.9, Math.min(0.99, (a.decay + b.decay)/2 + (Math.random()-0.5)*0.01)),
      fit: 0
    });
  }
  pop = next;
  best = { ...elite[0] };
  self.postMessage({ best, score, gen: gen+1 });
};
`;
const blob = new Blob([workerCode], {type:'application/javascript'});
worker = new Worker(URL.createObjectURL(blob));
worker.onmessage = (e) => {
  const { best, score, gen } = e.data;
  fitness = score;
  generation = gen;
  // Apply evolved params (simple force constants)
  window.attract = best.attract;
  window.repel = best.repel;
  window.decay = best.decay;
  residual = Math.abs(score - 0.35);
  document.documentElement.style.setProperty('--cluster', score.toFixed(2));
  document.documentElement.style.setProperty('--evolv', (gen % 10 / 10).toFixed(2));
  document.documentElement.style.setProperty('--energy', energy.toFixed(2));
  document.body.classList.add('morph');
  updateStats();
};

function updateStats() {
  document.getElementById('stats').innerHTML =
    `webgpu: ${useGPU ? 'yes' : 'canvas2d'}<br>fitness: ${fitness.toFixed(2)}<br>gen: ${generation}<br>energy: ${energy.toFixed(2)}`;
}

// Pointer deposits
canvas.addEventListener('pointermove', (e) => {
  if (e.buttons || e.pointerType === 'touch') {
    deposits.push({ x: e.clientX, y: e.clientY, t: performance.now(), energy: 1 });
    if (deposits.length > 40) deposits.shift();
    energy = Math.min(1, energy + 0.02);
  }
});

// Simulate
function step() {
  if (!running) return;
  ctx.fillStyle = 'rgba(4,6,12,0.25)';
  ctx.fillRect(0, 0, w, h);
  const attract = window.attract || 0.04;
  const repel = window.repel || 0.012;
  particles.forEach(p => {
    deposits.slice(-12).forEach(d => {
      const dx = d.x - p.x, dy = d.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      const force = attract * d.energy / (dist * 0.01 + 1) - repel / (dist * 0.005 + 0.5);
      p.vx += (dx / dist) * force * 0.15;
      p.vy += (dy / dist) * force * 0.15;
    });
    p.vx *= (window.decay || 0.96);
    p.vy *= (window.decay || 0.96);
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > w) p.vx *= -0.8;
    if (p.y < 0 || p.y > h) p.vy *= -0.8;
    p.x = Math.max(0, Math.min(w, p.x));
    p.y = Math.max(0, Math.min(h, p.y));
    ctx.fillStyle = `hsla(${200 + residual*80}, 80%, 65%, 0.55)`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, Math.PI*2); ctx.fill();
  });
  // Probes (embodied queries)
  if (probes.length < 3 && Math.random() < 0.01) {
    const el = document.createElement('div');
    el.className = 'probe';
    document.body.appendChild(el);
    probes.push({ el, x: Math.random()*w, y: Math.random()*h });
  }
  probes.forEach(pr => {
    const target = deposits.length ? deposits[deposits.length-1] : {x:w/2,y:h/2};
    pr.x += (target.x - pr.x) * 0.02;
    pr.y += (target.y - pr.y) * 0.02;
    pr.el.style.transform = `translate(${pr.x-28}px, ${pr.y-28}px) scale(${0.7 + fitness})`;
  });
  if (Math.random() < 0.03) {
    worker.postMessage({ deposits: deposits.slice(-20), particles: particles.map(p=>({x:p.x,y:p.y})), gen: generation });
  }
  requestAnimationFrame(step);
}
let running = true;
step();

// WebGPU probe (minimal: just check availability; full compute left as building block)
if (navigator.gpu) {
  navigator.gpu.requestAdapter().then(adapter => {
    if (adapter) {
      useGPU = true;
      updateStats();
      // Placeholder: real WebGPU compute kernel would replace the CPU particle step
      // for next frontier expansion.
    }
  }).catch(()=>{});
}

// Progressive XR
document.getElementById('xr').onclick = async () => {
  if (!navigator.xr) { alert('WebXR not available'); return; }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    // Minimal: on XR, deposits can come from controller/hand; for prototype, note support
    document.getElementById('stats').innerHTML += '<br>xr: entered (flat sim continues)';
    session.end(); // immediate end for this prototype; full projection is next block
  } catch (err) {
    alert('XR session failed: ' + err.message);
  }
};

document.getElementById('evolve').onclick = () => {
  worker.postMessage({ deposits: deposits.slice(-20), particles: particles.map(p=>({x:p.x,y:p.y})), gen: generation });
};

document.getElementById('sealbtn').onclick = () => {
  const state = { fitness, generation, attract: window.attract, repel: window.repel, deposits: deposits.length };
  const req = indexedDB.open('void-f239', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('seals');
  req.onsuccess = () => {
    const tx = req.result.transaction('seals', 'readwrite');
    tx.objectStore('seals').put(state, 'latest');
    document.getElementById('seal').textContent = 'F-239 · sealed';
  };
};

updateStats();
