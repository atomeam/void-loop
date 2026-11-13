const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
function resize() {
  canvas.width = innerWidth; canvas.height = innerHeight;
}
resize(); addEventListener('resize', resize);

const N_STATES = 4;
const STATE_NAMES = ['Wander', 'Cluster', 'Orbit', 'Freeze'];
const N_OBS = 9; // simplified: 3 orient bins x 3 speed bins
const N_AGENTS = 6;

let agents = [];
let orientation = { beta: 0, gamma: 0 };
let pointer = { x: innerWidth/2, y: innerHeight/2, vx: 0, vy: 0 };
let lastPointer = { x: pointer.x, y: pointer.y };
let bestGenome = null;
let bestFitness = -Infinity;

function randMat(rows, cols, stochastic = false) {
  const m = Array.from({length: rows}, () => Array.from({length: cols}, () => Math.random()));
  if (stochastic) m.forEach(row => {
    const s = row.reduce((a,b)=>a+b,0);
    for (let i=0;i<row.length;i++) row[i] /= s;
  });
  return m;
}

function cloneGenome(g) {
  return {
    trans: g.trans.map(r => r.slice()),
    emit: g.emit.map(r => r.slice()),
    fitness: g.fitness
  };
}

function mutateGenome(g, rate = 0.08) {
  const ng = cloneGenome(g);
  for (let i=0;i<N_STATES;i++) {
    for (let j=0;j<N_STATES;j++) if (Math.random()<rate) ng.trans[i][j] += (Math.random()-0.5)*0.3;
    for (let k=0;k<N_OBS;k++) if (Math.random()<rate) ng.emit[i][k] += (Math.random()-0.5)*0.3;
  }
  // renormalize
  ng.trans.forEach(row => { const s=row.reduce((a,b)=>a+Math.max(0,b),0); for(let j=0;j<row.length;j++) row[j]=Math.max(0.01,row[j])/s; });
  ng.emit.forEach(row => { const s=row.reduce((a,b)=>a+Math.max(0,b),0); for(let k=0;k<row.length;k++) row[k]=Math.max(0.01,row[k])/s; });
  return ng;
}

function makeAgent(i) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'A' + i;
  document.body.appendChild(el);
  return {
    id: i,
    el,
    x: Math.random()*innerWidth*0.8 + 50,
    y: Math.random()*innerHeight*0.7 + 80,
    vx: 0, vy: 0,
    genome: {
      trans: randMat(N_STATES, N_STATES, true),
      emit: randMat(N_STATES, N_OBS, true),
      fitness: 1
    },
    belief: Array(N_STATES).fill(1/N_STATES),
    state: 0
  };
}

function initAgents() {
  document.querySelectorAll('.portal').forEach(e => e.remove());
  agents = [];
  for (let i=0;i<N_AGENTS;i++) agents.push(makeAgent(i));
}
initAgents();

function getObservation() {
  // bin beta (-90..90 -> 0,1,2), gamma, speed
  const b = Math.max(0, Math.min(2, Math.floor((orientation.beta + 90) / 60)));
  const g = Math.max(0, Math.min(2, Math.floor((orientation.gamma + 90) / 60)));
  const speed = Math.hypot(pointer.vx, pointer.vy);
  const s = Math.max(0, Math.min(2, Math.floor(speed / 15)));
  return (b % 3) * 3 + (s % 3); // simplified 0-8
}

function forwardUpdate(agent, obs) {
  const { trans, emit } = agent.genome;
  const newB = Array(N_STATES).fill(0);
  for (let j=0;j<N_STATES;j++) {
    let sum = 0;
    for (let i=0;i<N_STATES;i++) sum += agent.belief[i] * trans[i][j];
    newB[j] = sum * (emit[j][obs] || 0.01);
  }
  const z = newB.reduce((a,b)=>a+b,0) || 1;
  for (let j=0;j<N_STATES;j++) agent.belief[j] = newB[j] / z;
  agent.state = agent.belief.indexOf(Math.max(...agent.belief));
}

function updateAgent(agent) {
  const obs = getObservation();
  forwardUpdate(agent, obs);
  const st = agent.state;
  const cx = innerWidth/2, cy = innerHeight/2;
  let ax=0, ay=0;
  if (st === 0) { // Wander
    ax = (Math.random()-0.5)*1.2; ay = (Math.random()-0.5)*1.2;
  } else if (st === 1) { // Cluster
    const dx = cx - agent.x, dy = cy - agent.y;
    ax = dx * 0.002; ay = dy * 0.002;
  } else if (st === 2) { // Orbit
    const dx = pointer.x - agent.x, dy = pointer.y - agent.y;
    const d = Math.hypot(dx,dy)||1;
    ax = -dy / d * 0.8; ay = dx / d * 0.8;
  } else { // Freeze
    ax = -agent.vx * 0.1; ay = -agent.vy * 0.1;
  }
  // mild orientation bias
  ax += orientation.gamma * 0.002;
  ay += orientation.beta * 0.002;
  agent.vx = agent.vx * 0.92 + ax;
  agent.vy = agent.vy * 0.92 + ay;
  agent.x += agent.vx; agent.y += agent.vy;
  agent.x = Math.max(40, Math.min(innerWidth-50, agent.x));
  agent.y = Math.max(40, Math.min(innerHeight-40, agent.y));
  agent.el.style.left = (agent.x - 45) + 'px';
  agent.el.style.top = (agent.y - 35) + 'px';
  const hue = 200 + st * 40;
  agent.el.style.background = `hsla(${hue},70%,40%,0.8)`;
  agent.el.style.borderColor = `hsl(${hue},80%,70%)`;
  agent.el.textContent = STATE_NAMES[st].slice(0,3) + ' ' + agent.genome.fitness.toFixed(1);
  agent.genome.fitness *= 0.995;
}

function checkOverlaps() {
  for (let i=0;i<agents.length;i++) {
    for (let j=i+1;j<agents.length;j++) {
      const a = agents[i], b = agents[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      if (Math.hypot(dx,dy) < 80) {
        if (a.genome.fitness > b.genome.fitness + 0.5) {
          b.genome = mutateGenome(a.genome);
          b.genome.fitness = a.genome.fitness * 0.7;
          postGenome(b.genome);
        } else if (b.genome.fitness > a.genome.fitness + 0.5) {
          a.genome = mutateGenome(b.genome);
          a.genome.fitness = b.genome.fitness * 0.7;
          postGenome(a.genome);
        }
      }
    }
  }
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // state probs for first agent
  if (agents[0]) {
    const b = agents[0].belief;
    for (let i=0;i<N_STATES;i++) {
      ctx.fillStyle = `hsla(${200+i*40},70%,60%,0.7)`;
      ctx.fillRect(10, 80 + i*22, b[i]*120, 18);
      ctx.fillStyle = '#fff';
      ctx.font = '11px sans-serif';
      ctx.fillText(STATE_NAMES[i], 135, 94 + i*22);
    }
  }
  // pointer
  ctx.fillStyle = 'rgba(255,255,100,0.6)';
  ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 6, 0, Math.PI*2); ctx.fill();
}

function loop() {
  pointer.vx = pointer.x - lastPointer.x;
  pointer.vy = pointer.y - lastPointer.y;
  lastPointer.x = pointer.x; lastPointer.y = pointer.y;
  agents.forEach(updateAgent);
  checkOverlaps();
  // track best
  agents.forEach(a => {
    if (a.genome.fitness > bestFitness) {
      bestFitness = a.genome.fitness;
      bestGenome = cloneGenome(a.genome);
    }
  });
  draw();
  statusEl.textContent = `State: ${STATE_NAMES[agents[0]?.state||0]} | Best fit: ${bestFitness.toFixed(2)} | Obs: ${getObservation()}`;
  requestAnimationFrame(loop);
}
loop();

// Events
addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
addEventListener('click', e => {
  agents.forEach(a => {
    const r = a.el.getBoundingClientRect();
    if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) {
      a.genome.fitness += 3;
    }
  });
});

document.getElementById('orient').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => {
      if (p === 'granted') addEventListener('deviceorientation', onOrient);
    });
  } else {
    addEventListener('deviceorientation', onOrient);
  }
};
function onOrient(e) {
  orientation.beta = e.beta || 0;
  orientation.gamma = e.gamma || 0;
}

document.getElementById('seal').onclick = () => {
  if (bestGenome) saveGenome(bestGenome);
  statusEl.textContent = 'Sealed best genome';
};
document.getElementById('reset').onclick = () => { initAgents(); bestFitness = -Infinity; };

// Persistence
const DB_NAME = 'verse-f738';
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes');
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function saveGenome(g) {
  try {
    const db = await openDB();
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(g, 'best');
  } catch (e) { console.debug("lab f738-deviceorientation-hmm-state-dom-portals-mind:", e); }
}
async function loadGenome() {
  try {
    const db = await openDB();
    const tx = db.transaction('genomes', 'readonly');
    const req = tx.objectStore('genomes').get('best');
    req.onsuccess = () => {
      if (req.result && agents[0]) {
        agents[0].genome = req.result;
        bestGenome = req.result;
        bestFitness = req.result.fitness || 1;
      }
    };
  } catch (e) { console.debug("lab f738-deviceorientation-hmm-state-dom-portals-mind:", e); }
}
loadGenome();

// Broadcast
let channel;
try { channel = new BroadcastChannel('f738-genome'); } catch (e) { console.debug("lab f738-deviceorientation-hmm-state-dom-portals-mind:", e); }
function postGenome(g) {
  if (channel) channel.postMessage({ type: 'genome', genome: g });
}
if (channel) channel.onmessage = e => {
  if (e.data.type === 'genome' && agents.length) {
    const weak = agents.reduce((a,b) => a.genome.fitness < b.genome.fitness ? a : b);
    weak.genome = mutateGenome(e.data.genome);
  }
};
