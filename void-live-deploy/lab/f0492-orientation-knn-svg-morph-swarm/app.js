const N = 24; // vertices
const AGENTS = 4;
const K = 3;
const svg = document.getElementById('svg');
const body = document.getElementById('body');
const status = document.getElementById('status');
const bars = document.getElementById('bars');
const base = [];
for (let i = 0; i < N; i++) {
  const a = (i / N) * Math.PI * 2;
  base.push(Math.cos(a) * 0.7, Math.sin(a) * 0.7);
}
let agents = [];
function makeAgent(id) {
  const examples = [];
  for (let e = 0; e < 8; e++) {
    const ori = [Math.random()*180-90, Math.random()*180-90];
    const verts = new Float32Array(N*2);
    for (let i = 0; i < N*2; i++) verts[i] = (Math.random()-0.5)*0.3;
    examples.push({ori, verts});
  }
  return {id, examples, fitness: Math.random()*0.5+0.2, color: `hsl(${id*90},70%,60%)`};
}
function initAgents() {
  agents = [];
  bars.innerHTML = '';
  for (let i = 0; i < AGENTS; i++) {
    const a = makeAgent(i);
    agents.push(a);
    const bar = document.createElement('div');
    bar.className = 'agent-bar';
    bar.innerHTML = `<div class="agent-fill" style="background:${a.color};width:${a.fitness*100}%"></div>`;
    bars.appendChild(bar);
  }
}
initAgents();
let ori = [0, 0]; // beta, gamma
let usePointer = true;
let lastReward = 0;
window.addEventListener('deviceorientation', e => {
  if (e.beta != null && e.gamma != null) {
    ori = [e.beta, e.gamma];
    usePointer = false;
  }
});
document.addEventListener('pointermove', e => {
  if (usePointer) {
    ori = [(e.clientY / window.innerHeight - 0.5)*90, (e.clientX / window.innerWidth - 0.5)*90];
  }
});
function dist2(a, b) {
  const db = a[0]-b[0], dg = a[1]-b[1];
  return db*db + dg*dg;
}
function queryAgent(agent, q) {
  const scored = agent.examples.map((ex, i) => ({i, d: dist2(ex.ori, q)}));
  scored.sort((a,b) => a.d - b.d);
  const out = new Float32Array(N*2);
  let wsum = 0;
  for (let k = 0; k < Math.min(K, scored.length); k++) {
    const ex = agent.examples[scored[k].i];
    const w = 1 / (scored[k].d + 0.01);
    for (let i = 0; i < N*2; i++) out[i] += ex.verts[i] * w;
    wsum += w;
  }
  if (wsum > 0) for (let i = 0; i < N*2; i++) out[i] /= wsum;
  return out;
}
function updatePath() {
  const proposals = agents.map(a => queryAgent(a, ori));
  const totalFit = agents.reduce((s, a) => s + a.fitness, 0.01);
  const blended = new Float32Array(N*2);
  for (let ai = 0; ai < AGENTS; ai++) {
    const w = agents[ai].fitness / totalFit;
    for (let i = 0; i < N*2; i++) blended[i] += proposals[ai][i] * w;
  }
  let d = '';
  for (let i = 0; i < N; i++) {
    const x = base[i*2] + blended[i*2];
    const y = base[i*2+1] + blended[i*2+1];
    d += (i===0 ? 'M' : 'L') + x.toFixed(3) + ',' + y.toFixed(3) + ' ';
  }
  d += 'Z';
  body.setAttribute('d', d);
  body.setAttribute('stroke', agents.reduce((best, a, i) => a.fitness > agents[best].fitness ? i : best, 0) >= 0 ? agents[0].color : '#7af');
  // update bars
  bars.querySelectorAll('.agent-fill').forEach((fill, i) => {
    fill.style.width = Math.min(100, agents[i].fitness * 100) + '%';
  });
  status.textContent = `ori ${ori[0].toFixed(0)},${ori[1].toFixed(0)} | fits ${agents.map(a=>a.fitness.toFixed(2)).join(' ')} | ${usePointer?'pointer':'tilt'}`;
}
function rewardDominant() {
  let best = 0;
  for (let i = 1; i < AGENTS; i++) if (agents[i].fitness > agents[best].fitness) best = i;
  agents[best].fitness = Math.min(2, agents[best].fitness + 0.3);
  // also add a new example near current ori for the winner
  const verts = new Float32Array(N*2);
  for (let i = 0; i < N*2; i++) verts[i] = (Math.random()-0.5)*0.2;
  agents[best].examples.push({ori: [...ori], verts});
  if (agents[best].examples.length > 24) agents[best].examples.shift();
  lastReward = performance.now();
}
document.getElementById('reward').onclick = rewardDominant;
document.addEventListener('keydown', e => {
  if (e.key === 'r' || e.key === 'R') rewardDominant();
  if (e.key === 's' || e.key === 'S') seal();
});
async function seal() {
  let best = 0;
  for (let i = 1; i < AGENTS; i++) if (agents[i].fitness > agents[best].fitness) best = i;
  const genome = {
    fitness: agents[best].fitness,
    examples: agents[best].examples.map(ex => ({ori: ex.ori, verts: Array.from(ex.verts)}))
  };
  try {
    const db = await idbOpen();
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(genome, 'best');
    await tx.complete;
  } catch (e) { console.warn(e); }
  if (typeof BroadcastChannel !== 'undefined') {
    const ch = new BroadcastChannel('f0492-genome');
    ch.postMessage(genome);
  }
  status.textContent = 'sealed & broadcast';
}
function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('f0492-knn-svg', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function restore() {
  try {
    const db = await idbOpen();
    const tx = db.transaction('genomes', 'readonly');
    const g = await new Promise((res) => {
      const req = tx.objectStore('genomes').get('best');
      req.onsuccess = () => res(req.result);
    });
    if (g && g.examples) adopt(g);
  } catch (e) {}
}
function adopt(genome) {
  let worst = 0;
  for (let i = 1; i < AGENTS; i++) if (agents[i].fitness < agents[worst].fitness) worst = i;
  if (genome.fitness > agents[worst].fitness) {
    agents[worst].fitness = genome.fitness * 0.9;
    agents[worst].examples = genome.examples.map(ex => ({
      ori: ex.ori,
      verts: new Float32Array(ex.verts.map(v => v + (Math.random()-0.5)*0.05))
    }));
    status.textContent = 'adopted genome';
  }
}
if (typeof BroadcastChannel !== 'undefined') {
  const ch = new BroadcastChannel('f0492-genome');
  ch.onmessage = e => adopt(e.data);
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initAgents(); status.textContent = 'reset'; };
restore();
function loop() {
  updatePath();
  requestAnimationFrame(loop);
}
loop();
