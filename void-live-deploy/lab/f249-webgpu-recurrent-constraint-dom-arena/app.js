const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const arena = document.getElementById('arena');
const statusEl = document.getElementById('status');
let W, H, agents = [], energies = [], tilt = {x:0, y:0}, running = true;
let gpuDevice = null, gpuPipeline = null, useGPU = false;
const N = 10, HIDDEN = 8, INPUT = 7, OUTPUT = 2;
const GENOME_SIZE = (INPUT * HIDDEN) + HIDDEN + (HIDDEN * OUTPUT) + OUTPUT + HIDDEN;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize); resize();

function randn() { return (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 0.5; }

function makeGenome() {
  const g = new Float32Array(GENOME_SIZE);
  for (let i = 0; i < g.length; i++) g[i] = randn() * 0.3;
  return g;
}

function mutate(g, rate = 0.08) {
  const ng = new Float32Array(g);
  for (let i = 0; i < ng.length; i++) if (Math.random() < 0.15) ng[i] += randn() * rate;
  return ng;
}

class Agent {
  constructor(id, genome) {
    this.id = id;
    this.genome = genome || makeGenome();
    this.pos = {x: Math.random()*W, y: Math.random()*H};
    this.vel = {x: 0, y: 0};
    this.h = new Float32Array(HIDDEN);
    this.fitness = 0;
    this.el = document.createElement('div');
    this.el.className = 'agent';
    this.el.textContent = id;
    this.el.style.left = this.pos.x + 'px';
    this.el.style.top = this.pos.y + 'px';
    arena.appendChild(this.el);
    this.el.addEventListener('pointerdown', e => this.grab(e));
  }
  grab(e) {
    const move = ev => {
      this.pos.x = ev.clientX; this.pos.y = ev.clientY;
      this.vel.x = this.vel.y = 0;
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  rnnStep(inputs) {
    const g = this.genome;
    let off = 0;
    const Wih = g.subarray(off, off + INPUT*HIDDEN); off += INPUT*HIDDEN;
    const bh = g.subarray(off, off + HIDDEN); off += HIDDEN;
    const Who = g.subarray(off, off + HIDDEN*OUTPUT); off += HIDDEN*OUTPUT;
    const bo = g.subarray(off, off + OUTPUT);
    const newH = new Float32Array(HIDDEN);
    for (let j = 0; j < HIDDEN; j++) {
      let s = bh[j];
      for (let i = 0; i < INPUT; i++) s += Wih[i*HIDDEN + j] * inputs[i];
      s += 0.35 * this.h[j];
      newH[j] = Math.tanh(s);
    }
    this.h = newH;
    const out = [0, 0];
    for (let k = 0; k < OUTPUT; k++) {
      let s = bo[k];
      for (let j = 0; j < HIDDEN; j++) s += Who[j*OUTPUT + k] * newH[j];
      out[k] = Math.tanh(s) * 40;
    }
    return out;
  }
  step(dt) {
    let minE = Infinity, edx = 0, edy = 0;
    for (const e of energies) {
      const dx = e.x - this.pos.x, dy = e.y - this.pos.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < minE) { minE = d; edx = dx/d; edy = dy/d; }
      if (d < 40) this.fitness += dt * (1 - d/40);
    }
    let minA = Infinity, adx = 0, ady = 0;
    for (const a of agents) if (a !== this) {
      const dx = a.pos.x - this.pos.x, dy = a.pos.y - this.pos.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < minA) { minA = d; adx = dx/d; ady = dy/d; }
    }
    const speed = Math.hypot(this.vel.x, this.vel.y);
    const inputs = [tilt.x, tilt.y, edx, edy, adx, ady, Math.min(speed/100, 1)];
    const force = this.rnnStep(inputs);
    let fx = force[0] + tilt.x * 80;
    let fy = force[1] + tilt.y * 80;
    for (const a of agents) if (a !== this) {
      const dx = a.pos.x - this.pos.x, dy = a.pos.y - this.pos.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 120) {
        const k = 0.4 * (1 - d/120);
        fx -= (dx/d) * k * 30;
        fy -= (dy/d) * k * 30;
      }
    }
    this.vel.x = (this.vel.x + fx * dt) * 0.92;
    this.vel.y = (this.vel.y + fy * dt) * 0.92;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.x < 40 || this.pos.x > W-40) this.vel.x *= -0.6;
    if (this.pos.y < 30 || this.pos.y > H-30) this.vel.y *= -0.6;
    this.pos.x = Math.max(40, Math.min(W-40, this.pos.x));
    this.pos.y = Math.max(30, Math.min(H-30, this.pos.y));
    this.el.style.left = (this.pos.x - 36) + 'px';
    this.el.style.top = (this.pos.y - 24) + 'px';
    this.el.style.filter = `hue-rotate(${this.fitness * 20}deg)`;
  }
}

function spawnAgents() {
  agents.forEach(a => a.el.remove());
  agents = [];
  for (let i = 0; i < N; i++) agents.push(new Agent(i, makeGenome()));
}

function placeEnergy(x, y) {
  const e = {x, y, life: 8, el: document.createElement('div')};
  e.el.className = 'energy';
  e.el.style.left = x + 'px';
  e.el.style.top = y + 'px';
  arena.appendChild(e.el);
  energies.push(e);
}

canvas.addEventListener('click', e => placeEnergy(e.clientX, e.clientY));

document.getElementById('orient').onclick = async () => {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    const p = await DeviceOrientationEvent.requestPermission();
    if (p !== 'granted') return;
  }
  window.addEventListener('deviceorientation', ev => {
    tilt.x = (ev.gamma || 0) / 45;
    tilt.y = (ev.beta || 0) / 45;
    tilt.x = Math.max(-1, Math.min(1, tilt.x));
    tilt.y = Math.max(-1, Math.min(1, tilt.y));
  });
  statusEl.textContent = 'Orientation live';
};

let db;
const req = indexedDB.open('F249-arena', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('pop', {keyPath: 'id'});
req.onsuccess = e => { db = e.target.result; };
document.getElementById('seal').onclick = async () => {
  if (!db) return;
  agents.sort((a,b) => b.fitness - a.fitness);
  const champ = agents[0];
  const payload = {id: Date.now(), fitness: champ.fitness, genome: Array.from(champ.genome), hash: ''};
  const buf = new TextEncoder().encode(JSON.stringify(payload.genome));
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  payload.hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
  const tx = db.transaction('pop', 'readwrite');
  tx.objectStore('pop').put(payload);
  statusEl.textContent = `Sealed champ fitness ${champ.fitness.toFixed(1)} · ${payload.hash.slice(0,8)}`;
};

document.getElementById('reset').onclick = () => { energies.forEach(e => e.el.remove()); energies = []; spawnAgents(); };

function evolve() {
  agents.sort((a,b) => b.fitness - a.fitness);
  const champ = agents[0];
  champ.el.classList.add('champ');
  for (let i = Math.floor(N/2); i < N; i++) {
    agents[i].genome = mutate(champ.genome);
    agents[i].fitness *= 0.5;
    agents[i].el.classList.remove('champ');
  }
}

let last = performance.now(), genTimer = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last)/1000);
  last = now;
  genTimer += dt;
  if (genTimer > 6) { evolve(); genTimer = 0; }
  energies = energies.filter(e => {
    e.life -= dt;
    if (e.life <= 0) { e.el.remove(); return false; }
    e.el.style.opacity = e.life / 8;
    return true;
  });
  agents.forEach(a => a.step(dt));
  ctx.fillStyle = 'rgba(10,12,16,0.15)';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = 'rgba(100,180,255,0.25)';
  agents.forEach(a => {
    ctx.beginPath();
    ctx.arc(a.pos.x, a.pos.y, 4, 0, Math.PI*2);
    ctx.stroke();
  });
  const avgFit = agents.reduce((s,a) => s + a.fitness, 0) / N;
  document.documentElement.style.setProperty('--fit', Math.min(0.8, avgFit / 10));
  document.documentElement.style.setProperty('--hue', 180 + avgFit * 15);
  statusEl.textContent = `CPU · agents ${N} · avg fitness ${avgFit.toFixed(2)} · tilt ${tilt.x.toFixed(2)},${tilt.y.toFixed(2)}`;
  requestAnimationFrame(loop);
}

if (navigator.gpu) {
  navigator.gpu.requestAdapter().then(a => a && a.requestDevice()).then(d => {
    if (d) { gpuDevice = d; useGPU = true; statusEl.textContent += ' · WebGPU ready (CPU active)'; }
  }).catch(() => {});
}

spawnAgents();
requestAnimationFrame(loop);
