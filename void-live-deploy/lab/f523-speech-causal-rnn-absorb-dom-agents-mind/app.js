const arena = document.getElementById('arena');
const statusRecog = document.getElementById('recog');
const statusAgents = document.getElementById('agents');
const statusSeal = document.getElementById('seal');
const statusCmd = document.getElementById('cmd');
const typed = document.getElementById('typed');

let agents = [];
let command = [0,0,0,0];
let lastSeal = 'none';
const N = 7;
const keywords = {
  swarm: [1,0,0,0], scatter: [0,1,0,0], focus: [0,0,1,0], orbit: [0,0,0,1],
  left: [-1,0,0,0], right: [1,0,0,0], up: [0,-1,0,0], down: [0,1,0,0]
};

function randn() { return (Math.random()-0.5)*0.2; }
function createWeights() {
  // Simple RNN: input 6 (cmd4 + rel2), hidden 6, out 2
  return {
    Wh: Array.from({length:6}, () => Array.from({length:6}, randn)),
    Wx: Array.from({length:6}, () => Array.from({length:6}, randn)),
    b: Array.from({length:6}, randn),
    Wo: Array.from({length:2}, () => Array.from({length:6}, randn)),
    bo: Array.from({length:2}, randn)
  };
}
function mutate(w, rate=0.05) {
  const nw = JSON.parse(JSON.stringify(w));
  for (let k of Object.keys(nw)) {
    if (Array.isArray(nw[k][0])) {
      for (let i=0;i<nw[k].length;i++) for (let j=0;j<nw[k][i].length;j++) nw[k][i][j] += (Math.random()-0.5)*rate;
    } else {
      for (let i=0;i<nw[k].length;i++) nw[k][i] += (Math.random()-0.5)*rate;
    }
  }
  return nw;
}
function rnnStep(w, h, x) {
  const nh = [];
  for (let i=0;i<6;i++) {
    let s = w.b[i];
    for (let j=0;j<6;j++) s += w.Wh[i][j]*h[j] + w.Wx[i][j]*x[j];
    nh[i] = Math.tanh(s);
  }
  const out = [];
  for (let i=0;i<2;i++) {
    let s = w.bo[i];
    for (let j=0;j<6;j++) s += w.Wo[i][j]*nh[j];
    out[i] = Math.tanh(s);
  }
  return {h: nh, out};
}
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function spawnAgents() {
  arena.innerHTML = '';
  agents = [];
  for (let i=0;i<N;i++) {
    const el = document.createElement('div');
    el.className = 'agent';
    el.textContent = 'A'+(i+1);
    el.style.left = (100 + Math.random()* (window.innerWidth-200)) + 'px';
    el.style.top = (80 + Math.random()* (window.innerHeight-200)) + 'px';
    arena.appendChild(el);
    agents.push({
      el, x: parseFloat(el.style.left), y: parseFloat(el.style.top),
      vx: 0, vy: 0, h: Array(6).fill(0), weights: createWeights(),
      fitness: 0, cool: 0, id: i
    });
  }
  statusAgents.textContent = 'Agents: '+agents.length;
}

function mapCommand(text) {
  text = text.toLowerCase();
  for (let k of Object.keys(keywords)) if (text.includes(k)) return keywords[k].slice();
  return [0,0,0,0];
}

async function sealGenome(ag) {
  const payload = JSON.stringify(ag.weights);
  const hash = await sha256(payload + ag.fitness.toFixed(3));
  lastSeal = hash.slice(0,8);
  statusSeal.textContent = 'Last seal: '+lastSeal;
  // IndexedDB
  const req = indexedDB.open('verse-f523', 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', {keyPath: 'hash'});
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put({hash, weights: ag.weights, fitness: ag.fitness, ts: Date.now()});
  };
  // Broadcast
  try {
    const bc = new BroadcastChannel('verse-f523-genome');
    bc.postMessage({hash, weights: ag.weights, fitness: ag.fitness});
  } catch(e) {}
}

function absorb(winner, loser) {
  loser.weights = mutate(winner.weights, 0.08);
  loser.fitness = winner.fitness * 0.7;
  loser.cool = 90;
  winner.cool = 60;
  sealGenome(winner);
  sealGenome(loser);
}

let bc;
try {
  bc = new BroadcastChannel('verse-f523-genome');
  bc.onmessage = e => {
    const g = e.data;
    if (!g || !g.weights) return;
    // replace lowest fitness
    let low = agents.reduce((a,b)=> a.fitness < b.fitness ? a : b);
    if (g.fitness > low.fitness) {
      low.weights = g.weights;
      low.fitness = g.fitness * 0.9;
      low.el.style.borderColor = '#ff0';
      setTimeout(()=> low.el.style.borderColor = '', 800);
    }
  };
} catch(e) {}

function step() {
  const cx = window.innerWidth/2, cy = window.innerHeight/2;
  let sumx=0, sumy=0;
  agents.forEach(a => { sumx+=a.x; sumy+=a.y; });
  const mx = sumx/agents.length, my = sumy/agents.length;

  agents.forEach(a => {
    if (a.cool>0) a.cool--;
    const relx = (a.x - mx)/300, rely = (a.y - my)/200;
    const x = [...command, relx, rely];
    const {h, out} = rnnStep(a.weights, a.h, x);
    a.h = h;
    a.vx += out[0]*0.4;
    a.vy += out[1]*0.4;
    // repulsion
    agents.forEach(b => {
      if (a===b) return;
      const dx = a.x-b.x, dy=a.y-b.y;
      const d2 = dx*dx+dy*dy+1;
      const d = Math.sqrt(d2);
      if (d < 80) {
        const f = 120 / d2;
        a.vx += dx/d * f;
        a.vy += dy/d * f;
        if (d < 36 && a.cool===0 && b.cool===0 && a.fitness > b.fitness*1.15) absorb(a,b);
      }
    });
    a.vx *= 0.92; a.vy *= 0.92;
    a.x += a.vx; a.y += a.vy;
    a.x = Math.max(20, Math.min(window.innerWidth-90, a.x));
    a.y = Math.max(50, Math.min(window.innerHeight-80, a.y));
    a.el.style.left = a.x+'px';
    a.el.style.top = a.y+'px';
    // fitness: alignment
    const cmdMag = Math.hypot(...command.slice(0,2)) || 1;
    const align = (a.vx*command[0] + a.vy*command[1]) / (Math.hypot(a.vx,a.vy)+0.1) / cmdMag;
    a.fitness = a.fitness*0.98 + Math.max(0, align)*0.02;
    if (a.fitness > 0.4) a.el.classList.add('high'); else a.el.classList.remove('high');
  });
  requestAnimationFrame(step);
}

document.getElementById('send').onclick = () => {
  command = mapCommand(typed.value);
  statusCmd.textContent = 'Cmd: '+command.map(v=>v.toFixed(1)).join(',');
};
document.getElementById('sealbtn').onclick = () => {
  const best = agents.reduce((a,b)=> a.fitness>b.fitness?a:b);
  sealGenome(best);
};
document.getElementById('reset').onclick = spawnAgents;

let recog;
document.getElementById('listen').onclick = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { statusRecog.textContent = 'Speech: unsupported'; return; }
  recog = new SR();
  recog.continuous = true;
  recog.interimResults = false;
  recog.onresult = e => {
    const t = e.results[e.results.length-1][0].transcript;
    command = mapCommand(t);
    statusCmd.textContent = 'Cmd: '+command.map(v=>v.toFixed(1)).join(',')+' ('+t.slice(0,20)+')';
    statusRecog.textContent = 'Speech: heard';
  };
  recog.onerror = () => statusRecog.textContent = 'Speech: error';
  recog.onend = () => statusRecog.textContent = 'Speech: ended';
  recog.start();
  statusRecog.textContent = 'Speech: listening';
};

// pointer fallback: drag sets command from velocity
let lastP = null;
arena.addEventListener('pointermove', e => {
  if (!e.buttons) { lastP=null; return; }
  if (lastP) {
    const dx = e.clientX - lastP.x, dy = e.clientY - lastP.y;
    command = [Math.tanh(dx/20), Math.tanh(dy/20), 0, 0];
    statusCmd.textContent = 'Cmd: '+command.map(v=>v.toFixed(1)).join(',');
  }
  lastP = {x:e.clientX, y:e.clientY};
});

spawnAgents();
step();
