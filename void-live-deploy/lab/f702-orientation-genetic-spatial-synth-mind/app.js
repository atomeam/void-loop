const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

let audioCtx, agents = [], orientation = { beta: 0, gamma: 0 }, running = false;
const N = 5;
const DB_NAME = 'verse-f702';
const BC = new BroadcastChannel('f702-genome');

function rand(a,b){ return a + Math.random()*(b-a); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

class Agent {
  constructor(genes) {
    this.genes = genes || {
      freqs: [rand(100,800), rand(100,800), rand(100,800)],
      amps: [rand(0.1,0.4), rand(0.1,0.4), rand(0.1,0.4)],
      pos: [rand(-1,1), rand(-1,1), rand(-0.5,0.5)]
    };
    this.fitness = 0.5;
    this.oscs = [];
    this.gains = [];
    this.panner = null;
    this.card = document.createElement('div');
    this.card.className = 'card';
    this.card.textContent = 'Agent';
    document.body.appendChild(this.card);
    this.card.onclick = () => this.reward();
  }
  start(ctx) {
    this.panner = ctx.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.connect(ctx.destination);
    this.genes.freqs.forEach((f,i) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = f;
      osc.type = ['sine','triangle','sawtooth'][i%3];
      const g = ctx.createGain();
      g.gain.value = this.genes.amps[i] * 0.3;
      osc.connect(g);
      g.connect(this.panner);
      osc.start();
      this.oscs.push(osc);
      this.gains.push(g);
    });
    this.updatePanner();
  }
  updatePanner() {
    if (!this.panner) return;
    const [x,y,z] = this.genes.pos;
    this.panner.positionX.value = x * 2;
    this.panner.positionY.value = y * 2;
    this.panner.positionZ.value = z * 2;
  }
  updateFromOri(beta, gamma) {
    const align = 1 - Math.abs(Math.sin(beta*0.02) - this.genes.pos[1]) * 0.3;
    this.fitness = clamp(this.fitness * 0.98 + align * 0.02, 0, 1);
    this.genes.pos[0] = clamp(this.genes.pos[0] + gamma * 0.0005, -1, 1);
    this.genes.pos[1] = clamp(this.genes.pos[1] + beta * 0.0005, -1, 1);
    this.updatePanner();
  }
  reward() {
    this.fitness = Math.min(1, this.fitness + 0.3);
    this.evolve();
  }
  evolve() {
    const other = agents[Math.floor(Math.random()*agents.length)];
    if (other && other !== this && other.fitness > this.fitness) {
      for (let i=0; i<3; i++) {
        if (Math.random()<0.4) this.genes.freqs[i] = (this.genes.freqs[i] + other.genes.freqs[i])/2 + rand(-20,20);
        if (Math.random()<0.3) this.genes.amps[i] = clamp((this.genes.amps[i] + other.genes.amps[i])/2 + rand(-0.05,0.05), 0.05, 0.5);
      }
    } else {
      this.genes.freqs.forEach((f,i) => this.genes.freqs[i] = clamp(f + rand(-30,30), 50, 1200));
      this.genes.amps.forEach((a,i) => this.genes.amps[i] = clamp(a + rand(-0.08,0.08), 0.05, 0.5));
    }
    if (this.oscs.length) {
      this.oscs.forEach((o,i) => o.frequency.setTargetAtTime(this.genes.freqs[i], audioCtx.currentTime, 0.1));
      this.gains.forEach((g,i) => g.gain.setTargetAtTime(this.genes.amps[i]*0.3, audioCtx.currentTime, 0.1));
    }
  }
  draw(ctx) {
    const x = W/2 + this.genes.pos[0]*W*0.35;
    const y = H/2 + this.genes.pos[1]*H*0.35;
    this.card.style.left = (x - 40) + 'px';
    this.card.style.top = (y - 20) + 'px';
    this.card.textContent = `F${this.fitness.toFixed(2)}`;
    this.card.style.opacity = 0.4 + this.fitness*0.6;
    this.card.style.borderColor = `hsl(${this.fitness*120},80%,60%)`;
  }
  toJSON() { return { genes: this.genes, fitness: this.fitness }; }
  static fromJSON(o) { const a = new Agent(o.genes); a.fitness = o.fitness; return a; }
}

function initAgents(saved) {
  agents.forEach(a => a.card.remove());
  agents = [];
  if (saved && saved.length) {
    saved.forEach(s => agents.push(Agent.fromJSON(s)));
  } else {
    for (let i=0; i<N; i++) agents.push(new Agent());
  }
}

async function startAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  await audioCtx.resume();
  agents.forEach(a => a.start(audioCtx));
  running = true;
  document.getElementById('status').textContent = 'Spatial synth live. Tilt to evolve. Click cards to reward.';
}

function loop() {
  requestAnimationFrame(loop);
  if (!running) return;
  agents.forEach(a => a.updateFromOri(orientation.beta, orientation.gamma));
  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = '#4af';
  ctx.beginPath();
  agents.forEach((a,i) => {
    const amp = a.fitness * 80;
    const x = (i+0.5)*W/agents.length;
    ctx.moveTo(x, H/2 - amp);
    ctx.lineTo(x, H/2 + amp);
  });
  ctx.stroke();
  agents.forEach(a => a.draw(ctx));
}

if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    orientation.beta = e.beta || 0;
    orientation.gamma = e.gamma || 0;
  });
}
let px=0, py=0;
addEventListener('pointermove', e => {
  px = (e.clientX/W - 0.5)*2;
  py = (e.clientY/H - 0.5)*2;
  orientation.gamma = px * 45;
  orientation.beta = py * 45;
});

document.getElementById('start').onclick = startAudio;
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initAgents(); if (running) agents.forEach(a => a.start(audioCtx)); };

function seal() {
  const data = agents.map(a => a.toJSON());
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(data, 'best');
    BC.postMessage({ type: 'genome', data });
    document.getElementById('status').textContent = 'Sealed to IndexedDB + BroadcastChannel.';
  };
}

function load() {
  const req = indexedDB.open(DB_NAME, 1);
  req.onsuccess = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('genomes')) { initAgents(); return; }
    const tx = db.transaction('genomes', 'readonly');
    const get = tx.objectStore('genomes').get('best');
    get.onsuccess = () => {
      initAgents(get.result);
    };
  };
  req.onerror = () => initAgents();
}

BC.onmessage = e => {
  if (e.data.type === 'genome') initAgents(e.data.data);
};

load();
loop();
