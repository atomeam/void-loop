const stage = document.getElementById('stage');
const countEl = document.getElementById('count');
const bestEl = document.getElementById('best');
const statusEl = document.getElementById('status');
const channel = new BroadcastChannel('verse-f598-genome');
const DB_NAME = 'verse-f598';
const STORE = 'genomes';
let agents = [];
let bestFitness = 0;
let orient = {a:0, b:0, g:0};
let pointer = {x:0.5, y:0.5};

// Tiny Elman RNN: input 6 (orient + pointer + time), hidden 8, output 4 (dx,dy,scale,hue)
function createRNN(weights) {
  const h = 8, i = 6, o = 4;
  const w = weights || {
    Wh: Array.from({length: h*h}, () => (Math.random()-0.5)*0.3),
    Wi: Array.from({length: h*i}, () => (Math.random()-0.5)*0.4),
    Wo: Array.from({length: o*h}, () => (Math.random()-0.5)*0.5),
    bh: Array.from({length: h}, () => 0),
    bo: Array.from({length: o}, () => 0),
    h: Array.from({length: h}, () => 0)
  };
  return {
    w,
    step(inp) {
      const {Wh, Wi, Wo, bh, bo, h} = w;
      const nh = new Array(h).fill(0);
      for (let j=0; j<h; j++) {
        let s = bh[j];
        for (let k=0; k<h; k++) s += Wh[j*h+k] * h[k];
        for (let k=0; k<i; k++) s += Wi[j*i+k] * inp[k];
        nh[j] = Math.tanh(s);
      }
      const out = new Array(o).fill(0);
      for (let j=0; j<o; j++) {
        let s = bo[j];
        for (let k=0; k<h; k++) s += Wo[j*h+k] * nh[k];
        out[j] = Math.tanh(s);
      }
      w.h = nh;
      return out;
    },
    cloneWeights() {
      return JSON.parse(JSON.stringify(w));
    },
    seal() {
      const s = JSON.stringify(w);
      return { weights: w, hash: btoa(s).slice(0,16) };
    }
  };
}

function createAgent(x, y, weights) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = '•';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  stage.appendChild(el);
  const rnn = createRNN(weights);
  const agent = {
    el, rnn,
    x, y, vx:0, vy:0,
    fitness: Math.random()*0.2,
    hue: Math.random()*360,
    id: Math.random().toString(36).slice(2,7)
  };
  el.style.setProperty('--h', agent.hue);
  // drag
  let dragging = false, ox, oy;
  el.addEventListener('pointerdown', e => { dragging=true; ox=e.clientX-agent.x; oy=e.clientY-agent.y; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if(dragging){ agent.x=e.clientX-ox; agent.y=e.clientY-oy; } });
  el.addEventListener('pointerup', () => dragging=false);
  agents.push(agent);
  return agent;
}

function updateAgents() {
  const t = performance.now() / 1000;
  const inp = [
    Math.sin(orient.a * Math.PI/180), Math.cos(orient.b * Math.PI/180),
    Math.sin(orient.g * Math.PI/180), pointer.x, pointer.y, Math.sin(t)
  ];
  for (const a of agents) {
    const out = a.rnn.step(inp);
    a.vx += out[0] * 0.8;
    a.vy += out[1] * 0.8;
    a.vx *= 0.92; a.vy *= 0.92;
    a.x += a.vx; a.y += a.vy;
    // bounds
    a.x = Math.max(20, Math.min(window.innerWidth-80, a.x));
    a.y = Math.max(20, Math.min(window.innerHeight-80, a.y));
    const sc = 0.8 + out[2]*0.4;
    a.hue = (a.hue + out[3]*2) % 360;
    a.el.style.left = a.x + 'px';
    a.el.style.top = a.y + 'px';
    a.el.style.transform = `scale(${sc})`;
    a.el.style.setProperty('--h', a.hue);
    // fitness: proximity to center + stability
    const cx = window.innerWidth/2, cy = window.innerHeight/2;
    const dist = Math.hypot(a.x-cx, a.y-cy);
    a.fitness = Math.max(0, 1 - dist / (Math.min(cx,cy))) + Math.abs(out[2])*0.1;
    if (a.fitness > bestFitness) { bestFitness = a.fitness; bestEl.textContent = bestFitness.toFixed(2); }
    a.el.textContent = a.fitness.toFixed(2);
  }
  // collisions → sealed transfer
  for (let i=0; i<agents.length; i++) {
    for (let j=i+1; j<agents.length; j++) {
      const a=agents[i], b=agents[j];
      const d = Math.hypot(a.x-b.x, a.y-b.y);
      if (d < 70 && Math.abs(a.fitness - b.fitness) > 0.05) {
        const winner = a.fitness > b.fitness ? a : b;
        const loser = winner === a ? b : a;
        const sealed = winner.rnn.seal();
        channel.postMessage({ type:'genome', from:winner.id, to:loser.id, sealed, fitness:winner.fitness });
        // local apply with mutation
        const mut = winner.rnn.cloneWeights();
        mut.Wh = mut.Wh.map(v => v + (Math.random()-0.5)*0.05);
        loser.rnn.w = mut;
        loser.fitness *= 0.7;
        statusEl.textContent = `Genome sealed & transferred ${winner.id} → ${loser.id}`;
      }
    }
  }
  countEl.textContent = agents.length;
  requestAnimationFrame(updateAgents);
}

channel.onmessage = e => {
  if (e.data.type === 'genome') {
    statusEl.textContent = `Received sealed genome from peer (hash ${e.data.sealed.hash})`;
    // could apply to a random local agent
    if (agents.length && Math.random() < 0.3) {
      const a = agents[Math.floor(Math.random()*agents.length)];
      a.rnn.w = JSON.parse(JSON.stringify(e.data.sealed.weights));
    }
  }
};

window.addEventListener('deviceorientation', e => {
  orient.a = e.alpha || 0; orient.b = e.beta || 0; orient.g = e.gamma || 0;
});
window.addEventListener('pointermove', e => {
  pointer.x = e.clientX / window.innerWidth;
  pointer.y = e.clientY / window.innerHeight;
});

document.getElementById('spawn').onclick = () => {
  const x = 100 + Math.random()*(window.innerWidth-200);
  const y = 100 + Math.random()*(window.innerHeight-200);
  createAgent(x, y);
};
document.getElementById('reset').onclick = () => {
  agents.forEach(a => a.el.remove());
  agents = []; bestFitness = 0;
};

// IndexedDB persistence of best
async function saveBest() {
  if (!agents.length) return;
  const best = agents.reduce((m,a) => a.fitness > m.fitness ? a : m, agents[0]);
  const db = await new Promise((res,rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(best.rnn.cloneWeights(), 'best');
}

setInterval(saveBest, 5000);

// initial agents
for (let i=0; i<4; i++) createAgent(200+i*120, 200+i*40);
requestAnimationFrame(updateAgents);

statusEl.textContent = 'Ready. Tilt device or drag. Open second tab for genome exchange.';
