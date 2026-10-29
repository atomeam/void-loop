"use strict";
// F-218: DeviceOrientation as causal input into local RNNs that control spring-mass softbody parameters.
// Multi-agent competition; hybrid canvas + DOM cards; sealed genomes via IndexedDB + BroadcastChannel.
// Branches away from residual oracles, acoustic injections, codec retinas, spiking foragers, neural DOM chains.

const W = 720, H = 480; // logical size; canvas scales
const GRID = 12; // 12x8 = 96 particles
const COLS = 12, ROWS = 8;
const N = COLS * ROWS;
const SPACING = 36;
const REST = SPACING;
const AGENTS = 5;

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
let dpr = 1, cw = 0, ch = 0;

function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  cw = canvas.width = innerWidth * dpr;
  ch = canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
}
addEventListener("resize", resize); resize();

// Particles
const pos = new Float32Array(N * 2);
const vel = new Float32Array(N * 2);
const force = new Float32Array(N * 2);
const springs = []; // {i,j,rest}

function idx(c, r) { return r * COLS + c; }
function initSoftbody() {
  const ox = (innerWidth - (COLS-1)*SPACING)/2;
  const oy = (innerHeight - (ROWS-1)*SPACING)/2;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = idx(c, r);
      pos[i*2] = ox + c * SPACING;
      pos[i*2+1] = oy + r * SPACING;
      vel[i*2] = vel[i*2+1] = 0;
    }
  }
  springs.length = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = idx(c, r);
      if (c < COLS-1) springs.push({i, j: idx(c+1, r), rest: REST});
      if (r < ROWS-1) springs.push({i, j: idx(c, r+1), rest: REST});
      if (c < COLS-1 && r < ROWS-1) springs.push({i, j: idx(c+1, r+1), rest: REST * Math.SQRT2});
    }
  }
}
initSoftbody();

// Causal input: DeviceOrientation or mouse
let orient = {beta: 0, gamma: 0}; // degrees
let mouse = {x: innerWidth/2, y: innerHeight/2, down: false};
if (window.DeviceOrientationEvent) {
  addEventListener("deviceorientation", e => {
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
  });
}
canvas.addEventListener("pointermove", e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener("pointerdown", e => { mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY; });
addEventListener("pointerup", () => mouse.down = false);

// Tiny RNN per agent: 4 hidden, input [beta, gamma, localEnergy, agentIdBias], output [stiffnessMul, dampingMul]
// Genome: weights for simple Elman-like RNN
function makeGenome(seed) {
  const rng = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const rand = rng(seed);
  const inN = 4, hid = 6, outN = 2;
  const wih = new Float32Array(inN * hid);
  const whh = new Float32Array(hid * hid);
  const who = new Float32Array(hid * outN);
  const bh = new Float32Array(hid);
  const bo = new Float32Array(outN);
  for (let i = 0; i < wih.length; i++) wih[i] = (rand() - 0.5) * 0.8;
  for (let i = 0; i < whh.length; i++) whh[i] = (rand() - 0.5) * 0.4;
  for (let i = 0; i < who.length; i++) who[i] = (rand() - 0.5) * 0.8;
  for (let i = 0; i < bh.length; i++) bh[i] = (rand() - 0.5) * 0.2;
  for (let i = 0; i < bo.length; i++) bo[i] = (rand() - 0.5) * 0.2;
  return {wih, whh, who, bh, bo, h: new Float32Array(hid), fitness: 0, id: seed, region: seed % ROWS};
}
function rnnForward(g, inputs) {
  // inputs: [beta/90, gamma/90, localE, bias]
  const {wih, whh, who, bh, bo, h} = g;
  const hid = h.length;
  const newH = new Float32Array(hid);
  for (let i = 0; i < hid; i++) {
    let s = bh[i];
    for (let j = 0; j < 4; j++) s += inputs[j] * wih[j * hid + i];
    for (let j = 0; j < hid; j++) s += h[j] * whh[j * hid + i];
    newH[i] = Math.tanh(s);
  }
  h.set(newH);
  const outs = new Float32Array(2);
  for (let i = 0; i < 2; i++) {
    let s = bo[i];
    for (let j = 0; j < hid; j++) s += h[j] * who[j * 2 + i];
    outs[i] = 0.5 + 0.5 * Math.tanh(s); // 0..1
  }
  return outs; // stiffnessMul, dampingMul
}
function mutate(g, rate = 0.08) {
  const keys = ["wih","whh","who","bh","bo"];
  for (const k of keys) {
    const a = g[k];
    for (let i = 0; i < a.length; i++) if (Math.random() < rate) a[i] += (Math.random()-0.5)*0.3;
  }
  g.h.fill(0);
}

const agents = [];
for (let i = 0; i < AGENTS; i++) agents.push(makeGenome(1000 + i * 17));

// Physics step
const DT = 0.016;
let totalEnergy = 0;
function stepPhysics() {
  force.fill(0);
  // Orientation / mouse as global causal force (wind/gravity)
  const gx = (orient.gamma / 45) * 80 + (mouse.x - innerWidth/2) * 0.15;
  const gy = (orient.beta / 45) * 80 + (mouse.y - innerHeight/2) * 0.12;
  if (mouse.down) {
    for (let i = 0; i < N; i++) {
      const dx = mouse.x - pos[i*2], dy = mouse.y - pos[i*2+1];
      const d2 = dx*dx + dy*dy + 100;
      force[i*2] += dx * 1200 / d2;
      force[i*2+1] += dy * 1200 / d2;
    }
  }
  for (let i = 0; i < N; i++) {
    force[i*2] += gx;
    force[i*2+1] += gy;
  }
  // Springs modulated by agents
  for (const sp of springs) {
    const i = sp.i, j = sp.j;
    const dx = pos[j*2] - pos[i*2], dy = pos[j*2+1] - pos[i*2+1];
    const dist = Math.hypot(dx, dy) || 1;
    const stretch = dist - sp.rest;
    // Find controlling agent (by row region)
    const r = Math.floor(i / COLS);
    const ag = agents[r % AGENTS];
    const localE = Math.abs(stretch) * 0.01;
    const inputs = [orient.beta/90, orient.gamma/90, Math.min(1, localE), (ag.id % 10)/10];
    const [kMul, dMul] = rnnForward(ag, inputs);
    const k = 180 * (0.4 + kMul * 1.2);
    const damp = 8 * (0.3 + dMul);
    const f = k * stretch;
    const nx = dx / dist, ny = dy / dist;
    force[i*2] += f * nx; force[i*2+1] += f * ny;
    force[j*2] -= f * nx; force[j*2+1] -= f * ny;
    // damping
    const rvx = vel[j*2] - vel[i*2], rvy = vel[j*2+1] - vel[i*2+1];
    const rel = rvx * nx + rvy * ny;
    force[i*2] += damp * rel * nx; force[i*2+1] += damp * rel * ny;
    force[j*2] -= damp * rel * nx; force[j*2+1] -= damp * rel * ny;
  }
  // Integrate + energy
  totalEnergy = 0;
  for (let i = 0; i < N; i++) {
    vel[i*2] += force[i*2] * DT * 0.002;
    vel[i*2+1] += force[i*2+1] * DT * 0.002;
    vel[i*2] *= 0.992; vel[i*2+1] *= 0.992;
    pos[i*2] += vel[i*2] * DT * 60;
    pos[i*2+1] += vel[i*2+1] * DT * 60;
    // bounds
    if (pos[i*2] < 20) { pos[i*2] = 20; vel[i*2] *= -0.4; }
    if (pos[i*2] > innerWidth-20) { pos[i*2] = innerWidth-20; vel[i*2] *= -0.4; }
    if (pos[i*2+1] < 20) { pos[i*2+1] = 20; vel[i*2+1] *= -0.4; }
    if (pos[i*2+1] > innerHeight-20) { pos[i*2+1] = innerHeight-20; vel[i*2+1] *= -0.4; }
    totalEnergy += vel[i*2]**2 + vel[i*2+1]**2;
  }
  // Fitness: lower energy + less stretch = better (inverted for score)
  const energyScore = Math.max(0, 2000 - totalEnergy);
  for (const ag of agents) ag.fitness = ag.fitness * 0.98 + energyScore * 0.02;
  // Competition: mutate weakest occasionally
  if (Math.random() < 0.005) {
    agents.sort((a,b) => b.fitness - a.fitness);
    const weak = agents[agents.length-1];
    const strong = agents[0];
    // copy some weights
    for (const k of ["wih","who"]) {
      const src = strong[k], dst = weak[k];
      for (let i = 0; i < dst.length; i++) if (Math.random() < 0.3) dst[i] = src[i];
    }
    mutate(weak, 0.15);
    weak.fitness = strong.fitness * 0.7;
  }
}

// Render
function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "rgba(5,5,16,0.25)";
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  // springs
  ctx.lineWidth = 1.2;
  for (const sp of springs) {
    const i = sp.i, j = sp.j;
    const dx = pos[j*2]-pos[i*2], dy = pos[j*2+1]-pos[i*2+1];
    const dist = Math.hypot(dx,dy);
    const stretch = Math.abs(dist - sp.rest) / sp.rest;
    const hue = 200 + stretch * 120;
    ctx.strokeStyle = `hsla(${hue},70%,60%,${0.3+stretch*0.4})`;
    ctx.beginPath();
    ctx.moveTo(pos[i*2], pos[i*2+1]);
    ctx.lineTo(pos[j*2], pos[j*2+1]);
    ctx.stroke();
  }
  // particles
  for (let i = 0; i < N; i++) {
    const r = Math.floor(i / COLS);
    const ag = agents[r % AGENTS];
    const hue = 180 + (ag.id % 80);
    ctx.fillStyle = `hsla(${hue},80%,65%,0.85)`;
    ctx.beginPath();
    ctx.arc(pos[i*2], pos[i*2+1], 3.2, 0, Math.PI*2);
    ctx.fill();
  }
  // agent centroids as markers
  agents.forEach((ag, ai) => {
    let sx=0, sy=0, c=0;
    for (let r = 0; r < ROWS; r++) if (r % AGENTS === ai) {
      for (let c2 = 0; c2 < COLS; c2++) {
        const i = idx(c2, r);
        sx += pos[i*2]; sy += pos[i*2+1]; c++;
      }
    }
    if (c) {
      sx/=c; sy/=c;
      ctx.strokeStyle = ag === agents.slice().sort((a,b)=>b.fitness-a.fitness)[0] ? "#ffd27a" : "#7aa2ff";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI*2); ctx.stroke();
    }
  });
}

// DOM cards
const hud = document.getElementById("hud");
function updateDOM() {
  const sorted = agents.slice().sort((a,b) => b.fitness - a.fitness);
  hud.innerHTML = "";
  sorted.forEach((ag, rank) => {
    const div = document.createElement("div");
    div.className = "agent-card" + (rank === 0 ? " leader" : "");
    const hue = 180 + (ag.id % 80);
    div.style.borderLeft = `3px solid hsl(${hue},70%,60%)`;
    div.innerHTML = `<h4>Agent ${ag.id % 1000} · rank ${rank+1}</h4>
      Fitness ${ag.fitness.toFixed(0)} · region row-mod ${ag.region}<br>
      RNN hidden energy ${(ag.h.reduce((s,v)=>s+v*v,0)).toFixed(2)}`;
    hud.appendChild(div);
  });
  document.getElementById("status").textContent =
    `Energy ${totalEnergy.toFixed(0)} · Leader fitness ${sorted[0].fitness.toFixed(0)} · β${orient.beta.toFixed(0)}° γ${orient.gamma.toFixed(0)}° · tilt or drag to disturb`;
}

// Persistence
const DB_NAME = "f218-softbody-genomes";
let db;
const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("f218-leader") : null;
async function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore("genomes", {keyPath: "id"});
    req.onsuccess = e => res(e.target.result);
    req.onerror = () => rej(req.error);
  });
}
async function sealLeader() {
  const leader = agents.slice().sort((a,b)=>b.fitness-a.fitness)[0];
  const plain = {id: "leader", fitness: leader.fitness, wih: Array.from(leader.wih), whh: Array.from(leader.whh), who: Array.from(leader.who), bh: Array.from(leader.bh), bo: Array.from(leader.bo)};
  try {
    if (!db) db = await openDB();
    const tx = db.transaction("genomes", "readwrite");
    tx.objectStore("genomes").put(plain);
    await new Promise(r => tx.oncomplete = r);
    if (bc) bc.postMessage({type:"leader", genome: plain});
    document.getElementById("status").textContent = "Leader sealed to IndexedDB + broadcast.";
  } catch(e) { console.warn(e); }
}
async function loadLeader() {
  try {
    if (!db) db = await openDB();
    const tx = db.transaction("genomes", "readonly");
    const req = tx.objectStore("genomes").get("leader");
    const stored = await new Promise(r => { req.onsuccess = () => r(req.result); });
    if (stored) {
      const ag = agents[0];
      ag.wih.set(stored.wih); ag.whh.set(stored.whh); ag.who.set(stored.who);
      ag.bh.set(stored.bh); ag.bo.set(stored.bo);
      ag.fitness = stored.fitness || 100;
      ag.h.fill(0);
    }
  } catch(e) {}
}
if (bc) bc.onmessage = e => {
  if (e.data.type === "leader") {
    const g = e.data.genome;
    const weak = agents.slice().sort((a,b)=>a.fitness-b.fitness)[0];
    weak.wih.set(g.wih); weak.whh.set(g.whh); weak.who.set(g.who);
    weak.bh.set(g.bh); weak.bo.set(g.bo);
    weak.fitness = (g.fitness||100) * 0.9;
    weak.h.fill(0);
  }
};

// Controls
document.getElementById("seed").onclick = () => {
  for (let i = 0; i < N; i++) {
    vel[i*2] += (Math.random()-0.5)*40;
    vel[i*2+1] += (Math.random()-0.5)*40;
  }
};
document.getElementById("mutate").onclick = () => agents.forEach(a => mutate(a, 0.2));
document.getElementById("seal").onclick = sealLeader;
document.getElementById("reset").onclick = () => {
  agents.length = 0;
  for (let i = 0; i < AGENTS; i++) agents.push(makeGenome(Date.now() % 10000 + i));
  initSoftbody();
};

// Loop
let last = performance.now();
function loop(t) {
  const dt = Math.min(0.05, (t - last)/1000); last = t;
  for (let s = 0; s < 2; s++) stepPhysics();
  render();
  if (Math.floor(t/200) !== Math.floor((t-16)/200)) updateDOM();
  requestAnimationFrame(loop);
}
loadLeader().then(() => requestAnimationFrame(loop));
window.__f218 = {agents, pos, totalEnergy, sealLeader, orient};
