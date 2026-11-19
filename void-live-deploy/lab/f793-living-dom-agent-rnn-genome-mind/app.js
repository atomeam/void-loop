const STAGE = document.getElementById('stage');
const STATUS = document.getElementById('status');
const N_START = 9;
const H = 4; // hidden size
const IN = 7; // inputs
const OUT = 4; // outputs

let agents = [];
let orient = {x: 0, y: 0, z: 0};
let ptr = {x: 0, y: 0, vx: 0, vy: 0};
let lastPtr = {x: 0, y: 0};
let db, channel;
let frame = 0;

function rand(a=1) { return (Math.random()*2-1)*a; }
function tanh(x) { return Math.tanh(x); }
function clip(v, a, b) { return Math.max(a, Math.min(b, v)); }

function makeWeights() {
  return {
    Win: Array.from({length: H}, () => Array.from({length: IN}, () => rand(0.4))),
    Wrec: Array.from({length: H}, () => Array.from({length: H}, () => rand(0.3))),
    Wout: Array.from({length: OUT}, () => Array.from({length: H}, () => rand(0.5))),
    b: Array.from({length: H}, () => rand(0.1))
  };
}

function cloneW(w) {
  return {
    Win: w.Win.map(r => [...r]),
    Wrec: w.Wrec.map(r => [...r]),
    Wout: w.Wout.map(r => [...r]),
    b: [...w.b]
  };
}

function createAgent(x, y) {
  const el = document.createElement('div');
  el.className = 'agent';
  STAGE.appendChild(el);
  return {
    el, x, y, vx: 0, vy: 0, hue: Math.random()*360, scale: 1,
    fitness: 0, hidden: Array(H).fill(0), weights: makeWeights(),
    id: Math.random().toString(36).slice(2,7)
  };
}

function initAgents() {
  agents.forEach(a => a.el.remove());
  agents = [];
  for (let i = 0; i < N_START; i++) {
    const a = createAgent(
      100 + Math.random()*(window.innerWidth-200),
      100 + Math.random()*(window.innerHeight-200)
    );
    agents.push(a);
  }
}

function rnnStep(agent, input) {
  const {Win, Wrec, Wout, b} = agent.weights;
  const h = agent.hidden;
  const newH = Array(H).fill(0);
  for (let i = 0; i < H; i++) {
    let s = b[i];
    for (let j = 0; j < IN; j++) s += Win[i][j] * input[j];
    for (let j = 0; j < H; j++) s += Wrec[i][j] * h[j];
    newH[i] = tanh(s);
  }
  agent.hidden = newH;
  const out = Array(OUT).fill(0);
  for (let i = 0; i < OUT; i++) {
    for (let j = 0; j < H; j++) out[i] += Wout[i][j] * newH[j];
  }
  return out;
}

function hebbianNudge(agent, input, out, lr=0.02) {
  const {Win, Wout} = agent.weights;
  for (let i = 0; i < H; i++) {
    for (let j = 0; j < IN; j++) Win[i][j] += lr * agent.hidden[i] * input[j];
  }
  for (let i = 0; i < OUT; i++) {
    for (let j = 0; j < H; j++) Wout[i][j] += lr * out[i] * agent.hidden[j];
  }
}

function updateAgent(agent) {
  const cx = window.innerWidth/2, cy = window.innerHeight/2;
  let nearD = 999, nearA = 0;
  for (const o of agents) {
    if (o === agent) continue;
    const dx = o.x - agent.x, dy = o.y - agent.y;
    const d = Math.hypot(dx, dy);
    if (d < nearD) { nearD = d; nearA = Math.atan2(dy, dx); }
  }
  const input = [
    (agent.x - cx) / cx,
    (agent.y - cy) / cy,
    Math.min(nearD / 300, 1),
    nearA / Math.PI,
    orient.x * 0.5 + ptr.vx * 0.02,
    orient.y * 0.5 + ptr.vy * 0.02,
    Math.tanh(agent.fitness * 0.1)
  ];
  const out = rnnStep(agent, input);
  agent.vx = clip(agent.vx * 0.92 + out[0] * 0.8, -4, 4);
  agent.vy = clip(agent.vy * 0.92 + out[1] * 0.8, -4, 4);
  agent.hue = (agent.hue + out[2] * 4 + 360) % 360;
  agent.scale = clip(agent.scale + out[3] * 0.015, 0.6, 1.8);

  // soft repulsion
  for (const o of agents) {
    if (o === agent) continue;
    const dx = agent.x - o.x, dy = agent.y - o.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 90) {
      const f = (90 - d) * 0.015;
      agent.vx += (dx / d) * f;
      agent.vy += (dy / d) * f;
    }
  }

  agent.x = clip(agent.x + agent.vx, 40, window.innerWidth - 40);
  agent.y = clip(agent.y + agent.vy, 40, window.innerHeight - 40);

  // proximity seal
  if (frame % 8 === 0) {
    for (const o of agents) {
      if (o === agent || o.fitness <= agent.fitness) continue;
      const d = Math.hypot(o.x - agent.x, o.y - agent.y);
      if (d < 70 && o.fitness - agent.fitness > 0.4) {
        agent.weights = cloneW(o.weights);
        agent.fitness = o.fitness * 0.7;
        agent.el.style.boxShadow = '0 0 24px gold';
        setTimeout(() => agent.el.style.boxShadow = '', 400);
      }
    }
  }

  // render
  agent.el.style.left = (agent.x - 36) + 'px';
  agent.el.style.top = (agent.y - 36) + 'px';
  agent.el.style.background = `hsl(${agent.hue}, 70%, 45%)`;
  agent.el.style.transform = `scale(${agent.scale})`;
  agent.el.style.color = agent.scale > 1.2 ? '#000' : '#fff';
  agent.el.textContent = `F${agent.fitness.toFixed(1)}\n${agent.id}`;
}

function loop() {
  frame++;
  agents.forEach(updateAgent);
  STATUS.textContent = `Agents: ${agents.length} | Orient: ${orient.x.toFixed(2)},${orient.y.toFixed(2)} | Frame ${frame}`;
  requestAnimationFrame(loop);
}

// events
window.addEventListener('deviceorientation', e => {
  orient.x = (e.gamma || 0) / 45;
  orient.y = (e.beta || 0) / 45;
  orient.z = (e.alpha || 0) / 180;
}, true);

window.addEventListener('pointermove', e => {
  ptr.vx = e.clientX - lastPtr.x;
  ptr.vy = e.clientY - lastPtr.y;
  lastPtr.x = e.clientX;
  lastPtr.y = e.clientY;
  ptr.x = e.clientX;
  ptr.y = e.clientY;
});

STAGE.addEventListener('click', e => {
  const el = e.target.closest('.agent');
  if (!el) return;
  const agent = agents.find(a => a.el === el);
  if (!agent) return;
  agent.fitness += 2.5;
  // simple hebbian on last inputs (approximate)
  const input = [0,0,0.5,0,orient.x,orient.y,0.5];
  const out = [0,0,0.2,0.1];
  hebbianNudge(agent, input, out, 0.04);
  agent.el.style.boxShadow = '0 0 30px white';
  setTimeout(() => agent.el.style.boxShadow = '', 300);
});

document.getElementById('addBtn').onclick = () => {
  const a = createAgent(window.innerWidth/2 + rand(80), window.innerHeight/2 + rand(80));
  agents.push(a);
};

document.getElementById('resetBtn').onclick = () => {
  agents.forEach(a => { a.weights = makeWeights(); a.fitness = 0; a.hidden.fill(0); });
  STATUS.textContent = 'Genomes reset';
};

// persistence
async function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('verse-f793', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes', {keyPath: 'id'});
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function seal() {
  if (!db) return;
  const tx = db.transaction('genomes', 'readwrite');
  const store = tx.objectStore('genomes');
  const payload = agents.map(a => ({
    id: a.id, fitness: a.fitness,
    weights: a.weights, hue: a.hue
  }));
  await store.clear();
  for (const p of payload) store.put(p);
  if (channel) channel.postMessage({type: 'seal', genomes: payload, ts: Date.now()});
  STATUS.textContent = 'Sealed & broadcast';
}

document.getElementById('sealBtn').onclick = seal;

async function loadGenomes() {
  if (!db) return;
  const tx = db.transaction('genomes', 'readonly');
  const store = tx.objectStore('genomes');
  const all = await new Promise(r => {
    const req = store.getAll();
    req.onsuccess = () => r(req.result || []);
  });
  if (all.length) {
    all.forEach((g, i) => {
      if (agents[i]) {
        agents[i].weights = g.weights;
        agents[i].fitness = g.fitness;
        agents[i].hue = g.hue || agents[i].hue;
      }
    });
    STATUS.textContent = `Loaded ${all.length} genomes`;
  }
}

async function init() {
  try { db = await openDB(); } catch(e) { console.warn(e); }
  try {
    channel = new BroadcastChannel('f793-genome');
    channel.onmessage = ev => {
      if (ev.data?.type === 'seal' && ev.data.genomes) {
        ev.data.genomes.forEach((g, i) => {
          if (agents[i] && g.fitness > agents[i].fitness) {
            agents[i].weights = g.weights;
            agents[i].fitness = g.fitness * 0.9;
          }
        });
        STATUS.textContent = 'Adopted sealed genomes from peer';
      }
    };
  } catch (e) { console.debug("lab f793-living-dom-agent-rnn-genome-mind:", e); }
  initAgents();
  await loadGenomes();
  // optional WebXR probe
  if (navigator.xr) {
    navigator.xr.isSessionSupported('immersive-vr').then(ok => {
      if (ok) STATUS.textContent += ' | WebXR VR available';
    }).catch(()=>{});
  }
  loop();
}

init();
