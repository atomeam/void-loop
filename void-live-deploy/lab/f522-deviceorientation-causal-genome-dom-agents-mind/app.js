const stage = document.getElementById('stage');
const focusEl = document.getElementById('focus');
const statusEl = document.getElementById('status');
const NUM_AGENTS = 6;
let agents = [];
let orientation = { alpha: 0, beta: 0, gamma: 0 };
let prevOrient = { alpha: 0, beta: 0, gamma: 0 };
let delta = { da: 0, db: 0, dg: 0 };
let focus = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let hasOrientation = false;
let channel = null;

function randomWeights() {
  // 3→4→2
  const w1 = Array.from({length: 3*4}, () => (Math.random()-0.5)*0.8);
  const w2 = Array.from({length: 4*2}, () => (Math.random()-0.5)*0.8);
  return { w1, w2 };
}

function mlp(genome, input) {
  // input: [da, db, dg] normalized
  const h = new Array(4).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) h[i] += genome.w1[i*3 + j] * input[j];
    h[i] = Math.tanh(h[i]);
  }
  const out = [0, 0];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 4; j++) out[i] += genome.w2[i*4 + j] * h[j];
  }
  return out;
}

function createAgent(i) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.innerHTML = `<div>Agent ${i+1}</div><div class="fitness">fit: 0.00</div><div class="genome-id">…</div>`;
  stage.appendChild(el);
  return {
    el,
    id: i,
    x: 100 + Math.random() * (window.innerWidth - 200),
    y: 100 + Math.random() * (window.innerHeight - 200),
    vx: 0, vy: 0,
    genome: randomWeights(),
    fitness: 0,
    sealed: false,
    hash: null
  };
}

function updateStatus() {
  const sensor = hasOrientation ? 'orientation active' : 'mouse fallback';
  const sealed = agents.filter(a => a.sealed).length;
  statusEl.textContent = `${sensor} · ${NUM_AGENTS} agents · ${sealed} sealed · focus (${Math.round(focus.x)}, ${Math.round(focus.y)})`;
}

async function hashGenome(genome) {
  const str = JSON.stringify(genome);
  const buf = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 12);
}

async function sealAgent(agent) {
  agent.hash = await hashGenome(agent.genome);
  agent.sealed = true;
  agent.el.classList.add('sealed');
  agent.el.querySelector('.genome-id').textContent = agent.hash;
  // IndexedDB
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f522', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes', { keyPath: 'hash' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put({ hash: agent.hash, genome: agent.genome, fitness: agent.fitness, ts: Date.now() });
  } catch (e) { console.warn('IDB', e); }
  // Broadcast
  if (channel) {
    channel.postMessage({ type: 'genome', hash: agent.hash, genome: agent.genome, fitness: agent.fitness });
  }
  updateStatus();
}

function physicsStep() {
  // synthetic or real delta
  const input = [
    Math.max(-1, Math.min(1, delta.da / 30)),
    Math.max(-1, Math.min(1, delta.db / 30)),
    Math.max(-1, Math.min(1, delta.dg / 30))
  ];
  // focus from orientation (beta/gamma map to screen)
  if (hasOrientation) {
    focus.x = (orientation.gamma + 90) / 180 * window.innerWidth;
    focus.y = (orientation.beta + 90) / 180 * window.innerHeight;
  }
  focusEl.style.left = focus.x + 'px';
  focusEl.style.top = focus.y + 'px';

  for (const a of agents) {
    const pref = mlp(a.genome, input);
    // attract to focus
    const dx = focus.x - a.x;
    const dy = focus.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const attract = 0.015;
    a.vx += (dx / dist) * attract * 40 + pref[0] * 0.8;
    a.vy += (dy / dist) * attract * 40 + pref[1] * 0.8;
    // repulsion
    for (const b of agents) {
      if (a === b) continue;
      const rdx = a.x - b.x;
      const rdy = a.y - b.y;
      const rd = Math.hypot(rdx, rdy) || 1;
      if (rd < 140) {
        const rep = (140 - rd) * 0.002;
        a.vx += (rdx / rd) * rep;
        a.vy += (rdy / rd) * rep;
      }
    }
    a.vx *= 0.92;
    a.vy *= 0.92;
    a.x += a.vx;
    a.y += a.vy;
    // bounds
    a.x = Math.max(20, Math.min(window.innerWidth - 140, a.x));
    a.y = Math.max(20, Math.min(window.innerHeight - 100, a.y));
    // fitness: closeness to focus
    a.fitness = a.fitness * 0.95 + (1 / (1 + dist / 200)) * 0.05;
    a.el.style.transform = `translate(${a.x}px, ${a.y}px)`;
    a.el.querySelector('.fitness').textContent = `fit: ${a.fitness.toFixed(2)}`;
  }
  // decay deltas
  delta.da *= 0.9; delta.db *= 0.9; delta.dg *= 0.9;
}

function loop() {
  physicsStep();
  requestAnimationFrame(loop);
}

function initAgents() {
  stage.innerHTML = '';
  agents = [];
  for (let i = 0; i < NUM_AGENTS; i++) agents.push(createAgent(i));
  agents.forEach(a => {
    a.el.addEventListener('click', () => sealAgent(a));
  });
}

// Orientation
function onOrient(e) {
  hasOrientation = true;
  prevOrient = { ...orientation };
  orientation.alpha = e.alpha || 0;
  orientation.beta = e.beta || 0;
  orientation.gamma = e.gamma || 0;
  delta.da = orientation.alpha - prevOrient.alpha;
  delta.db = orientation.beta - prevOrient.beta;
  delta.dg = orientation.gamma - prevOrient.gamma;
  // wrap alpha
  if (Math.abs(delta.da) > 180) delta.da -= Math.sign(delta.da) * 360;
  updateStatus();
}

document.getElementById('btn-perm').addEventListener('click', async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm === 'granted') window.addEventListener('deviceorientation', onOrient);
    } catch (e) { statusEl.textContent = 'Permission denied'; }
  } else {
    window.addEventListener('deviceorientation', onOrient);
  }
});

// Mouse fallback
stage.addEventListener('pointermove', (e) => {
  if (!hasOrientation) {
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    delta.db = (e.clientY - cy) / 10;
    delta.dg = (e.clientX - cx) / 10;
    focus.x = e.clientX;
    focus.y = e.clientY;
  }
});

// BroadcastChannel
try {
  channel = new BroadcastChannel('verse-f522-genomes');
  channel.onmessage = (ev) => {
    if (ev.data.type === 'genome') {
      // adopt if better than worst
      const worst = agents.reduce((a, b) => a.fitness < b.fitness ? a : b);
      if (ev.data.fitness > worst.fitness + 0.05) {
        worst.genome = ev.data.genome;
        worst.hash = ev.data.hash;
        worst.sealed = true;
        worst.el.classList.add('sealed');
        worst.el.querySelector('.genome-id').textContent = worst.hash + ' (shared)';
        statusEl.textContent = 'Adopted shared genome ' + worst.hash;
      }
    }
  };
} catch (e) { console.warn('No BroadcastChannel'); }

document.getElementById('btn-reset').addEventListener('click', initAgents);
document.getElementById('btn-mutate').addEventListener('click', () => {
  agents.forEach(a => {
    a.genome = randomWeights();
    a.sealed = false;
    a.el.classList.remove('sealed');
  });
});

window.addEventListener('resize', () => {
  focus.x = window.innerWidth / 2;
  focus.y = window.innerHeight / 2;
});

// Boot
initAgents();
updateStatus();
loop();
statusEl.textContent = 'Ready · click Request Orientation or move mouse · click agent to seal genome';
