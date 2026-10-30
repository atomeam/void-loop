const arena = document.getElementById('arena');
const status = document.getElementById('status');
let agents = [];
let deposits = [];
let champion = null;
let webgpu = false;
let adapter, device, pipeline, bindGroup;
let weightsBuffer, stateBuffer, outBuffer;

const INPUT = 4; // relx, rely, dist, tiltmag
const HIDDEN = 6;
const OUTPUT = 2;
const WEIGHTS_PER = INPUT*HIDDEN + HIDDEN + HIDDEN*OUTPUT + OUTPUT; // ~46

function randWeights() {
  const w = new Float32Array(WEIGHTS_PER);
  for (let i = 0; i < w.length; i++) w[i] = (Math.random() - 0.5) * 0.8;
  return w;
}

function mlp(state, weights) {
  // CPU fallback: input -> hidden (relu) -> output
  let h = new Float32Array(HIDDEN);
  let o = new Float32Array(OUTPUT);
  let idx = 0;
  for (let i = 0; i < HIDDEN; i++) {
    let s = weights[idx++];
    for (let j = 0; j < INPUT; j++) s += state[j] * weights[idx++];
    h[i] = Math.max(0, s);
  }
  for (let i = 0; i < OUTPUT; i++) {
    let s = weights[idx++];
    for (let j = 0; j < HIDDEN; j++) s += h[j] * weights[idx++];
    o[i] = Math.tanh(s);
  }
  return o;
}

class Agent {
  constructor(id) {
    this.id = id;
    this.el = document.createElement('div');
    this.el.className = 'agent';
    this.el.textContent = 'A' + id;
    arena.appendChild(this.el);
    this.x = Math.random() * (innerWidth - 80);
    this.y = Math.random() * (innerHeight - 60);
    this.vx = 0; this.vy = 0;
    this.weights = randWeights();
    this.fitness = 0;
    this.isChamp = false;
  }
  step(dt, gravity) {
    // Find nearest deposit
    let nx = 0, ny = 0, nd = 9999;
    for (const d of deposits) {
      const dx = d.x - this.x, dy = d.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < nd) { nd = dist; nx = dx / (dist + 1); ny = dy / (dist + 1); }
    }
    const tilt = Math.hypot(gravity.x, gravity.y);
    const state = [nx, ny, Math.min(nd / 200, 1), tilt];
    const acc = mlp(state, this.weights); // or from GPU later
    this.vx += (acc[0] * 120 + gravity.x * 40) * dt;
    this.vy += (acc[1] * 120 + gravity.y * 40) * dt;
    this.vx *= 0.98; this.vy *= 0.98;
    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;
    // bounce
    if (this.x < 0 || this.x > innerWidth - 72) this.vx *= -0.7;
    if (this.y < 0 || this.y > innerHeight - 48) this.vy *= -0.7;
    this.x = Math.max(0, Math.min(innerWidth - 72, this.x));
    this.y = Math.max(0, Math.min(innerHeight - 48, this.y));
    // fitness
    if (nd < 80) this.fitness += (1 - nd / 80) * dt;
    this.el.style.left = this.x + 'px';
    this.el.style.top = this.y + 'px';
    this.el.classList.toggle('champ', this.isChamp);
  }
}

function spawnAgents(n) {
  agents.forEach(a => a.el.remove());
  agents = [];
  for (let i = 0; i < n; i++) agents.push(new Agent(i));
  champion = agents[0];
}

function placeDeposit(x, y) {
  const d = { x, y, el: document.createElement('div'), life: 8 };
  d.el.className = 'deposit';
  d.el.style.left = (x - 8) + 'px';
  d.el.style.top = (y - 8) + 'px';
  arena.appendChild(d.el);
  deposits.push(d);
}

arena.addEventListener('click', e => {
  placeDeposit(e.clientX, e.clientY);
});

let gravity = { x: 0, y: 0 };
window.addEventListener('deviceorientation', e => {
  if (e.gamma != null) {
    gravity.x = Math.max(-1, Math.min(1, e.gamma / 45));
    gravity.y = Math.max(-1, Math.min(1, e.beta / 45));
  }
});

async function tryWebGPU() {
  if (!navigator.gpu) return false;
  try {
    adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    device = await adapter.requestDevice();
    // Minimal compute shader for batch MLP (simplified; real weights layout omitted for brevity but structure present)
    const shader = device.createShaderModule({
      code: `
        @group(0) @binding(0) var<storage, read> weights: array<f32>;
        @group(0) @binding(1) var<storage, read> states: array<f32>;
        @group(0) @binding(2) var<storage, read_write> outs: array<f32>;
        @compute @workgroup_size(1)
        fn main(@builtin(global_invocation_id) id: vec3u) {
          // Placeholder: real kernel would unpack per-agent weights and eval
          // For prototype, CPU path is authoritative; GPU hook ready for expansion
          outs[id.x * 2] = 0.0;
          outs[id.x * 2 + 1] = 0.0;
        }
      `
    });
    pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module: shader, entryPoint: 'main' }
    });
    return true;
  } catch (e) {
    console.warn('WebGPU failed', e);
    return false;
  }
}

async function sealChampion() {
  if (!champion) return;
  const data = new Uint8Array(champion.weights.buffer);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('f240-arena', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seals');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const tx = db.transaction('seals', 'readwrite');
  tx.objectStore('seals').put({ hash, weights: Array.from(champion.weights), fitness: champion.fitness, t: Date.now() }, 'champ');
  await new Promise(r => tx.oncomplete = r);
  status.textContent += ` | sealed ${hash.slice(0, 8)}`;
}

document.getElementById('seal').onclick = sealChampion;
document.getElementById('xr').onclick = async () => {
  if (navigator.xr) {
    try {
      const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
      status.textContent += ' | XR entered (probe)';
      s.end();
    } catch (e) { status.textContent += ' | XR denied'; }
  } else status.textContent += ' | no XR';
};
document.getElementById('nAgents').oninput = e => spawnAgents(+e.target.value);

async function init() {
  webgpu = await tryWebGPU();
  status.textContent = `WebGPU: ${webgpu ? 'yes (hook)' : 'CPU'} | agents: 8`;
  spawnAgents(8);
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // age deposits
    deposits = deposits.filter(d => {
      d.life -= dt;
      if (d.life <= 0) { d.el.remove(); return false; }
      return true;
    });
    // evolve occasionally
    if (Math.random() < 0.02) {
      agents.sort((a, b) => b.fitness - a.fitness);
      const best = agents[0];
      champion = best;
      agents.forEach((a, i) => {
        a.isChamp = (a === best);
        if (i > agents.length * 0.6 && Math.random() < 0.5) {
          // transfer mutated
          a.weights = best.weights.map(w => w + (Math.random() - 0.5) * 0.15);
          a.fitness *= 0.5;
        }
      });
    }
    const avgFit = agents.reduce((s, a) => s + a.fitness, 0) / agents.length;
    document.documentElement.style.setProperty('--fit', Math.min(1, avgFit / 5));
    document.documentElement.style.setProperty('--hue', 180 + avgFit * 20);
    agents.forEach(a => a.step(dt, gravity));
    status.textContent = `WebGPU: ${webgpu ? 'hook' : 'CPU'} | fit: ${avgFit.toFixed(2)} | deposits: ${deposits.length} | tilt: ${gravity.x.toFixed(2)},${gravity.y.toFixed(2)}`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
init();
