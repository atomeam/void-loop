const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// Tiny MLP: 4 inputs → 6 hidden → 2 outputs. Genome = flat weights + biases.
function randomMLP() {
  const w1 = Array.from({length: 4*6}, () => (Math.random()-0.5)*0.8);
  const b1 = Array.from({length: 6}, () => (Math.random()-0.5)*0.2);
  const w2 = Array.from({length: 6*2}, () => (Math.random()-0.5)*0.8);
  const b2 = Array.from({length: 2}, () => (Math.random()-0.5)*0.2);
  return { w1, b1, w2, b2 };
}
function mlpForward(g, x) {
  const h = [];
  for (let i = 0; i < 6; i++) {
    let s = g.b1[i];
    for (let j = 0; j < 4; j++) s += x[j] * g.w1[i*4 + j];
    h.push(Math.tanh(s));
  }
  const o = [];
  for (let i = 0; i < 2; i++) {
    let s = g.b2[i];
    for (let j = 0; j < 6; j++) s += h[j] * g.w2[i*6 + j];
    o.push(Math.tanh(s));
  }
  return o;
}
function genomeToString(g) {
  return btoa(JSON.stringify(g)).replace(/=+$/, '');
}
function stringToGenome(s) {
  try { return JSON.parse(atob(s)); } catch { return null; }
}

const agents = [];
const resources = [];
let selected = null;
let nextId = 1;

function spawnAgent(genome = null, x = Math.random()*W, y = Math.random()*H) {
  const g = genome || randomMLP();
  const card = document.createElement('div');
  card.className = 'agent-card';
  card.textContent = `A${nextId}`;
  document.body.appendChild(card);
  const a = { id: nextId++, x, y, vx: 0, vy: 0, energy: 20, genome: g, card, color: `hsl(${Math.random()*360},70%,55%)` };
  agents.push(a);
  return a;
}

function updateObservations(a) {
  let resDensity = 0, peerDist = 0, peerCount = 0;
  for (const r of resources) {
    const d = Math.hypot(a.x - r.x, a.y - r.y);
    if (d < 80) resDensity += (1 - d/80) * r.life;
  }
  for (const o of agents) {
    if (o === a) continue;
    const d = Math.hypot(a.x - o.x, a.y - o.y);
    peerDist += d;
    peerCount++;
  }
  const avgPeer = peerCount ? peerDist / peerCount / Math.hypot(W, H) : 0.5;
  const ptr = pointer;
  const ptrDist = Math.hypot(a.x - ptr.x, a.y - ptr.y) / Math.hypot(W, H);
  return [
    Math.min(1, resDensity / 30),
    avgPeer,
    Math.min(1, ptrDist),
    Math.min(1, a.energy / 100)
  ];
}

const pointer = { x: W/2, y: H/2 };
canvas.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
canvas.addEventListener('pointerdown', e => {
  resources.push({ x: e.clientX, y: e.clientY, life: 1, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2 });
  statusEl.textContent = `Planted resource. Agents: ${agents.length} | Resources: ${resources.length}`;
});

// IndexedDB
let db;
const req = indexedDB.open('f267-arena', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', { keyPath: 'id' });
req.onsuccess = e => { db = e.target.result; loadSealed(); };
function seal(agent) {
  if (!db || !agent) return;
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put({ id: agent.id, genome: agent.genome, energy: agent.energy, ts: Date.now() });
  statusEl.textContent = `Sealed A${agent.id} (energy ${agent.energy.toFixed(1)})`;
}
function loadSealed() {
  if (!db) return;
  db.transaction('genomes').objectStore('genomes').getAll().onsuccess = e => {
    const rows = e.target.result || [];
    rows.slice(-3).forEach(r => spawnAgent(r.genome, Math.random()*W*0.6+W*0.2, Math.random()*H*0.6+H*0.2));
  };
}

document.getElementById('addAgent').onclick = () => spawnAgent();
document.getElementById('seal').onclick = () => selected && seal(selected);
document.getElementById('exportBtn').onclick = () => {
  if (!selected) return;
  const s = genomeToString(selected.genome);
  navigator.clipboard.writeText(s).then(() => statusEl.textContent = 'Genome copied to clipboard');
};
document.getElementById('importToggle').onclick = () => document.getElementById('genomeBox').classList.toggle('open');
document.getElementById('doImport').onclick = () => {
  const g = stringToGenome(document.getElementById('genomeIn').value.trim());
  if (g) { spawnAgent(g); statusEl.textContent = 'Imported genome spawned'; }
  else statusEl.textContent = 'Invalid genome string';
};

// Start with a few
for (let i = 0; i < 3; i++) spawnAgent();

function step() {
  // resources
  for (let i = resources.length - 1; i >= 0; i--) {
    const r = resources[i];
    r.x += r.vx; r.y += r.vy;
    r.life -= 0.004;
    if (r.life <= 0 || r.x < 0 || r.x > W || r.y < 0 || r.y > H) resources.splice(i, 1);
  }
  // agents
  for (const a of agents) {
    const obs = updateObservations(a);
    const force = mlpForward(a.genome, obs);
    a.vx += force[0] * 0.35;
    a.vy += force[1] * 0.35;
    a.vx *= 0.92; a.vy *= 0.92;
    a.x = Math.max(20, Math.min(W-20, a.x + a.vx));
    a.y = Math.max(20, Math.min(H-20, a.y + a.vy));
    // collect
    for (let i = resources.length - 1; i >= 0; i--) {
      const r = resources[i];
      if (Math.hypot(a.x - r.x, a.y - r.y) < 28) {
        a.energy += r.life * 8;
        resources.splice(i, 1);
      }
    }
    a.energy = Math.max(0, a.energy - 0.02);
    // DOM card
    const scale = 0.7 + Math.min(1.4, a.energy / 80);
    a.card.style.transform = `translate(${a.x - 45}px, ${a.y - 18}px) scale(${scale})`;
    a.card.style.borderColor = a.color;
    a.card.style.width = (70 + a.energy * 0.4) + 'px';
    a.card.textContent = `A${a.id}\nE:${a.energy.toFixed(0)}`;
  }
  // render canvas
  ctx.fillStyle = '#010409';
  ctx.fillRect(0, 0, W, H);
  for (const r of resources) {
    ctx.beginPath();
    ctx.arc(r.x, r.y, 4 + r.life * 6, 0, Math.PI*2);
    ctx.fillStyle = `rgba(88,166,255,${r.life})`;
    ctx.fill();
  }
  for (const a of agents) {
    ctx.beginPath();
    ctx.arc(a.x, a.y, 6, 0, Math.PI*2);
    ctx.fillStyle = a.color;
    ctx.fill();
  }
  requestAnimationFrame(step);
}
// click agent card selection (pointer events on canvas already used; approximate by proximity)
canvas.addEventListener('click', e => {
  let best = null, bestD = 40;
  for (const a of agents) {
    const d = Math.hypot(a.x - e.clientX, a.y - e.clientY);
    if (d < bestD) { bestD = d; best = a; }
  }
  agents.forEach(a => a.card.classList.remove('selected'));
  if (best) { best.card.classList.add('selected'); selected = best; statusEl.textContent = `Selected A${best.id}`; }
});
requestAnimationFrame(step);
