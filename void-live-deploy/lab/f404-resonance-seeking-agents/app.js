// F-041 prototype: WebGPU wavefield + local resonance-seeking agents
// Novel combination: GPU wave equation + on-device agents optimizing local phase/frequency
// Fallback to Canvas2D if WebGPU unavailable

const canvas = document.getElementById('canvas');
const status = document.getElementById('status');
const portalsEl = document.getElementById('portals');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N_AGENTS = 6;
const agents = [];
let field = null; // simulated wave amplitude grid (CPU fallback)
const GRID = 64;
let gpu = null;
let resonance = 0;
let lastSeal = null;

function initAgents() {
  for (let i = 0; i < N_AGENTS; i++) {
    agents.push({
      x: Math.random() * W,
      y: Math.random() * H,
      freq: 0.4 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      energy: 0.5,
      id: i,
      memory: [] // simple local history for "reasoning"
    });
  }
}

// Simple CPU wavefield for fallback / agent sampling
function initField() {
  field = new Float32Array(GRID * GRID);
}

function sampleField(x, y) {
  if (!field) return 0;
  const gx = Math.floor((x / W) * GRID) % GRID;
  const gy = Math.floor((y / H) * GRID) % GRID;
  return field[gy * GRID + gx] || 0;
}

function injectSource(x, y, amp) {
  if (!field) return;
  const gx = Math.floor((x / W) * GRID);
  const gy = Math.floor((y / H) * GRID);
  if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
    field[gy * GRID + gx] += amp;
  }
}

// Agents "reason": gradient-ascent style phase adjustment toward local field correlation
function updateAgents(dt) {
  let totalLock = 0;
  agents.forEach(a => {
    const local = sampleField(a.x, a.y);
    // Simple local "mind": try to match phase to field oscillation
    const targetPhase = Math.atan2(Math.sin(performance.now() * 0.001 * a.freq + local), 1);
    let dPhase = targetPhase - a.phase;
    while (dPhase > Math.PI) dPhase -= Math.PI * 2;
    while (dPhase < -Math.PI) dPhase += Math.PI * 2;
    a.phase += dPhase * 0.08; // learning rate
    a.energy = Math.max(0, Math.min(1, a.energy + local * 0.02 - 0.01));
    // Move slightly toward higher energy
    a.x += Math.cos(a.phase) * a.energy * 0.8;
    a.y += Math.sin(a.phase) * a.energy * 0.8;
    a.x = (a.x + W) % W;
    a.y = (a.y + H) % H;
    // Inject own wave
    injectSource(a.x, a.y, a.energy * 0.15);
    totalLock += Math.abs(Math.cos(a.phase - local));
    a.memory.push(local);
    if (a.memory.length > 20) a.memory.shift();
  });
  resonance = totalLock / N_AGENTS;
  document.documentElement.style.setProperty('--resonance', resonance.toFixed(3));
}

// Crude wave step (diffusion + decay) on CPU
function stepField() {
  if (!field) return;
  const next = new Float32Array(field.length);
  for (let y = 1; y < GRID - 1; y++) {
    for (let x = 1; x < GRID - 1; x++) {
      const i = y * GRID + x;
      const lap = field[i-1] + field[i+1] + field[i-GRID] + field[i+GRID] - 4 * field[i];
      next[i] = field[i] * 0.96 + lap * 0.18;
    }
  }
  field = next;
}

function spawnPortal(agent) {
  if (document.querySelectorAll('.portal.active').length > 4) return;
  const p = document.createElement('div');
  p.className = 'portal';
  p.style.left = agent.x + 'px';
  p.style.top = agent.y + 'px';
  p.textContent = `R${agent.id}\nφ${agent.phase.toFixed(1)}`;
  p.onclick = () => {
    injectSource(agent.x, agent.y, 2.0);
    agent.freq *= 0.9 + Math.random() * 0.2;
    status.textContent = `Portal ${agent.id} queried — frequency shifted.`;
    p.classList.remove('active');
    setTimeout(() => p.remove(), 400);
  };
  portalsEl.appendChild(p);
  requestAnimationFrame(() => p.classList.add('active'));
}

function checkResonance() {
  agents.forEach(a => {
    if (a.energy > 0.75 && Math.random() < 0.015) spawnPortal(a);
  });
}

// WebGPU path (minimal: just use canvas 2D for now as robust prototype; GPU noted as future)
// In full version: compute shader for wave, storage buffer readback for agents
async function tryWebGPU() {
  if (!navigator.gpu) {
    status.textContent = 'WebGPU unavailable — running CPU wavefield + local agents.';
    return false;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    const device = await adapter.requestDevice();
    gpu = { device };
    status.textContent = 'WebGPU ready. Agents sampling lattice.';
    return true;
  } catch (e) {
    status.textContent = 'WebGPU init failed — CPU fallback.';
    return false;
  }
}

function draw() {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  // Draw field as points
  if (field) {
    for (let y = 0; y < GRID; y += 2) {
      for (let x = 0; x < GRID; x += 2) {
        const v = field[y * GRID + x];
        if (Math.abs(v) > 0.05) {
          const px = (x / GRID) * W;
          const py = (y / GRID) * H;
          ctx.fillStyle = `hsla(${200 + v * 60}, 70%, 60%, ${Math.min(0.8, Math.abs(v))})`;
          ctx.fillRect(px, py, 4, 4);
        }
      }
    }
  }
  // Agents
  agents.forEach(a => {
    ctx.beginPath();
    ctx.arc(a.x, a.y, 6 + a.energy * 8, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${a.phase * 40}, 80%, 65%, 0.9)`;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

async function loop() {
  const dt = 1 / 60;
  stepField();
  updateAgents(dt);
  checkResonance();
  draw();
  status.textContent = `Agents: ${N_AGENTS} | Resonance: ${resonance.toFixed(2)} | Portals active: ${document.querySelectorAll('.portal.active').length}`;
  requestAnimationFrame(loop);
}

// Interaction
canvas.addEventListener('pointerdown', e => {
  injectSource(e.clientX, e.clientY, 3.5);
  status.textContent = 'Query wave injected. Agents adapting.';
});

document.getElementById('seed').onclick = () => {
  agents.forEach(a => injectSource(a.x, a.y, 1.2));
};

document.getElementById('seal').onclick = async () => {
  const state = {
    agents: agents.map(a => ({x: a.x, y: a.y, freq: a.freq, phase: a.phase, energy: a.energy})),
    resonance,
    ts: Date.now()
  };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('void-f041', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('seals', {keyPath: 'ts'});
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seals', 'readwrite');
    tx.objectStore('seals').put(state);
    lastSeal = state.ts;
    status.textContent = `Sealed at ${new Date(state.ts).toLocaleTimeString()}.`;
  } catch (e) {
    status.textContent = 'Seal failed (IndexedDB).';
  }
};

// Boot
initAgents();
initField();
tryWebGPU().then(() => loop());
