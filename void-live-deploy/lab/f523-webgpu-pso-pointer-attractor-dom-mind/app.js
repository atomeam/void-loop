const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const N = 48;
let particles = [];
let gbest = { pos: [0.5, 0.5], fitness: 0, weights: null };
let attractor = [0.5, 0.5];
let portals = [];
let running = true;

function mlpForward(w, x) {
  // tiny 3→4→3
  const h = new Float32Array(4);
  for (let i = 0; i < 4; i++) {
    h[i] = Math.tanh(w[i*3]*x[0] + w[i*3+1]*x[1] + w[i*3+2]*x[2]);
  }
  const o = new Float32Array(3);
  for (let i = 0; i < 3; i++) {
    o[i] = Math.tanh(w[12 + i*4]*h[0] + w[12+i*4+1]*h[1] + w[12+i*4+2]*h[2] + w[12+i*4+3]*h[3]);
  }
  return o;
}

function initParticles() {
  particles = [];
  for (let i = 0; i < N; i++) {
    const weights = new Float32Array(24);
    for (let j = 0; j < 24; j++) weights[j] = (Math.random() - 0.5) * 0.8;
    particles.push({
      pos: [Math.random(), Math.random()],
      vel: [(Math.random()-0.5)*0.02, (Math.random()-0.5)*0.02],
      pbest: [Math.random(), Math.random()],
      pbestFit: 0,
      weights,
      age: 0
    });
  }
  gbest.weights = particles[0].weights.slice();
}

function fitness(pos) {
  const dx = pos[0] - attractor[0], dy = pos[1] - attractor[1];
  return 1 / (1 + Math.hypot(dx, dy) * 8);
}

function update() {
  let bestFit = 0, bestIdx = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const f = fitness(p.pos);
    if (f > p.pbestFit) { p.pbestFit = f; p.pbest = p.pos.slice(); }
    if (f > bestFit) { bestFit = f; bestIdx = i; }
    p.age++;
    const residual = Math.hypot(p.pos[0]-attractor[0], p.pos[1]-attractor[1]);
    const vm = Math.hypot(p.vel[0], p.vel[1]);
    const coeffs = mlpForward(p.weights, [residual, Math.min(p.age/120,1), vm*20]);
    const w = 0.4 + coeffs[0]*0.3;
    const c1 = 1.2 + coeffs[1]*0.6;
    const c2 = 1.2 + coeffs[2]*0.6;
    const r1 = Math.random(), r2 = Math.random();
    p.vel[0] = w*p.vel[0] + c1*r1*(p.pbest[0]-p.pos[0]) + c2*r2*(gbest.pos[0]-p.pos[0]);
    p.vel[1] = w*p.vel[1] + c1*r1*(p.pbest[1]-p.pos[1]) + c2*r2*(gbest.pos[1]-p.pos[1]);
    p.pos[0] = Math.max(0, Math.min(1, p.pos[0] + p.vel[0]));
    p.pos[1] = Math.max(0, Math.min(1, p.pos[1] + p.vel[1]));
    p.vel[0] *= 0.98; p.vel[1] *= 0.98;
  }
  if (bestFit > gbest.fitness) {
    gbest.pos = particles[bestIdx].pos.slice();
    gbest.fitness = bestFit;
    gbest.weights = particles[bestIdx].weights.slice();
  }
  // update portals
  const top = particles.map((p,i)=>({i,f:fitness(p.pos)})).sort((a,b)=>b.f-a.f).slice(0,5);
  while (portals.length < top.length) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = 'portal';
    document.body.appendChild(el);
    portals.push(el);
  }
  top.forEach((t, k) => {
    const p = particles[t.i];
    const el = portals[k];
    el.style.left = (p.pos[0]*canvas.width - 40) + 'px';
    el.style.top = (p.pos[1]*canvas.height - 20) + 'px';
    el.style.transform = `scale(${0.6 + t.f*1.4})`;
    el.style.filter = `hue-rotate(${Math.hypot(p.vel[0],p.vel[1])*800}deg) blur(${(1-t.f)*2}px)`;
    el.textContent = `fit ${(t.f*100).toFixed(0)}`;
  });
}

function draw() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  ctx.fillStyle = 'rgba(11,11,20,0.25)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#6af';
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.pos[0]*canvas.width, p.pos[1]*canvas.height, 2.5, 0, Math.PI*2);
    ctx.fill();
  }
  // attractor
  ctx.fillStyle = '#f6a';
  ctx.beginPath();
  ctx.arc(attractor[0]*canvas.width, attractor[1]*canvas.height, 6, 0, Math.PI*2);
  ctx.fill();
}

function loop() {
  if (!running) return;
  update();
  draw();
  requestAnimationFrame(loop);
}

canvas.addEventListener('pointermove', e => {
  const r = canvas.getBoundingClientRect();
  attractor[0] = (e.clientX - r.left) / r.width;
  attractor[1] = (e.clientY - r.top) / r.height;
});

// DeviceOrientation fallback
window.addEventListener('deviceorientation', e => {
  if (e.beta != null && e.gamma != null) {
    attractor[0] = Math.max(0, Math.min(1, 0.5 + e.gamma / 90));
    attractor[1] = Math.max(0, Math.min(1, 0.5 + e.beta / 90));
  }
});

document.getElementById('reset').onclick = () => {
  initParticles();
  status.textContent = 'Swarm reset';
};

document.getElementById('seal').onclick = async () => {
  const payload = { weights: Array.from(gbest.weights), fitness: gbest.fitness, ts: Date.now() };
  try {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    const hex = Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
    const req = indexedDB.open('f523', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes');
    req.onsuccess = () => {
      const tx = req.result.transaction('genomes', 'readwrite');
      tx.objectStore('genomes').put({ ...payload, hash: hex }, 'best');
      status.textContent = `Sealed ${hex.slice(0,8)}… fitness ${(gbest.fitness*100).toFixed(0)}`;
    };
  } catch (err) {
    status.textContent = 'Seal failed (unattested)';
  }
};

initParticles();
status.textContent = 'Running. Move pointer to attract. Seal stores best MLP genome.';
loop();
