const N = 7;
const POP = 8;
const DIM = 6;
const agents = [];
let tilt = {b:0, g:0};
let pointer = {x:0, y:0};
const channel = new BroadcastChannel('f823-genome');
let db;

function rand(a=0,b=1){ return a + Math.random()*(b-a); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

class Agent {
  constructor(i) {
    this.id = i;
    this.x = rand(80, window.innerWidth-120);
    this.y = rand(80, window.innerHeight-100);
    this.pop = Array.from({length:POP}, () => Array.from({length:DIM}, () => rand(-1,1)));
    this.fit = Array(POP).fill(0);
    this.best = this.pop[0].slice();
    this.bestFit = 0;
    this.clicks = 0;
    this.el = document.createElement('div');
    this.el.className = 'agent';
    this.el.textContent = `A${i}\nfit 0`;
    this.el.style.left = this.x + 'px';
    this.el.style.top = this.y + 'px';
    document.getElementById('stage').appendChild(this.el);
    this.setupDrag();
    this.el.addEventListener('click', e => { e.stopPropagation(); this.clicks += 3; });
  }
  setupDrag() {
    let ox=0, oy=0, dragging=false;
    this.el.onpointerdown = e => {
      dragging = true; ox = e.clientX - this.x; oy = e.clientY - this.y;
      this.el.setPointerCapture(e.pointerId);
    };
    this.el.onpointermove = e => {
      if (!dragging) return;
      this.x = clamp(e.clientX - ox, 0, window.innerWidth-90);
      this.y = clamp(e.clientY - oy, 0, window.innerHeight-70);
      this.el.style.left = this.x + 'px';
      this.el.style.top = this.y + 'px';
    };
    this.el.onpointerup = () => dragging = false;
  }
  step() {
    let dens = 0;
    for (const o of agents) if (o !== this) {
      const d = Math.hypot(o.x - this.x, o.y - this.y);
      if (d < 140) dens += (140-d)/140;
    }
    const f = dens + this.clicks * 0.5;
    this.clicks *= 0.95;
    for (let p=0; p<POP; p++) {
      const w = this.pop[p];
      const dx = (w[0]*tilt.b + w[1]*tilt.g) * 2;
      const dy = (w[2]*tilt.b + w[3]*tilt.g) * 2;
      this.fit[p] = f - Math.hypot(dx,dy)*0.1;
    }
    let bi = 0;
    for (let p=1; p<POP; p++) if (this.fit[p] > this.fit[bi]) bi = p;
    if (this.fit[bi] > this.bestFit) {
      this.bestFit = this.fit[bi];
      this.best = this.pop[bi].slice();
    }
    let wi = 0;
    for (let p=1; p<POP; p++) if (this.fit[p] < this.fit[wi]) wi = p;
    this.pop[wi] = this.best.map(v => clamp(v + rand(-0.3,0.3), -2, 2));
    const w = this.best;
    const dx = (w[0]*tilt.b + w[1]*tilt.g) * 1.8;
    const dy = (w[2]*tilt.b + w[3]*tilt.g) * 1.8;
    this.x = clamp(this.x + dx, 0, window.innerWidth-90);
    this.y = clamp(this.y + dy, 0, window.innerHeight-70);
    const sc = 1 + w[4]*0.15;
    const hue = 200 + w[5]*80;
    this.el.style.left = this.x + 'px';
    this.el.style.top = this.y + 'px';
    this.el.style.transform = `scale(${sc})`;
    this.el.style.background = `hsla(${hue},60%,35%,0.85)`;
    this.el.textContent = `A${this.id}\n${this.bestFit.toFixed(1)}`;
    for (const o of agents) if (o !== this && Math.hypot(o.x-this.x, o.y-this.y) < 100) {
      if (this.bestFit > o.bestFit + 0.5) {
        channel.postMessage({weights: this.best, fit: this.bestFit, from: this.id});
      }
    }
  }
  adopt(weights, fit) {
    if (fit > this.bestFit) {
      this.best = weights.slice();
      this.bestFit = fit;
      this.pop[0] = weights.slice();
    }
  }
}

function init() {
  for (let i=0; i<N; i++) agents.push(new Agent(i));
  const cv = document.getElementById('trail');
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  const ctx = cv.getContext('2d');
  window.addEventListener('deviceorientation', e => {
    tilt.b = clamp((e.beta||0)/45, -1, 1);
    tilt.g = clamp((e.gamma||0)/45, -1, 1);
  });
  window.addEventListener('pointermove', e => {
    pointer.x = e.clientX; pointer.y = e.clientY;
    if (!window.DeviceOrientationEvent) {
      tilt.b = (e.clientY / window.innerHeight - 0.5)*2;
      tilt.g = (e.clientX / window.innerWidth - 0.5)*2;
    }
  });
  channel.onmessage = e => {
    if (e.data && e.data.weights) {
      for (const a of agents) a.adopt(e.data.weights, e.data.fit);
    }
  };
  document.getElementById('seal').onclick = () => {
    let bestA = agents[0];
    for (const a of agents) if (a.bestFit > bestA.bestFit) bestA = a;
    channel.postMessage({weights: bestA.best, fit: bestA.bestFit, from: bestA.id});
    save(bestA.best, bestA.bestFit);
    document.getElementById('status').textContent = `sealed fit ${bestA.bestFit.toFixed(1)}`;
  };
  document.getElementById('reset').onclick = () => {
    for (const a of agents) { a.bestFit = 0; a.pop = Array.from({length:POP}, () => Array.from({length:DIM}, () => rand(-1,1))); }
  };
  openDB();
  function loop() {
    for (const a of agents) a.step();
    ctx.fillStyle = 'rgba(10,10,18,0.08)';
    ctx.fillRect(0,0,cv.width,cv.height);
    for (const a of agents) {
      ctx.fillStyle = `hsla(${200 + a.best[5]*80},70%,50%,0.4)`;
      ctx.beginPath(); ctx.arc(a.x+45, a.y+35, 20, 0, Math.PI*2); ctx.fill();
    }
    const avg = agents.reduce((s,a)=>s+a.bestFit,0)/N;
    document.getElementById('status').textContent = `tilt ${tilt.b.toFixed(2)},${tilt.g.toFixed(2)} · avg fit ${avg.toFixed(1)}`;
    requestAnimationFrame(loop);
  }
  loop();
}

function openDB() {
  const req = indexedDB.open('verse-f823', 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
  req.onsuccess = e => { db = e.target.result; load(); };
}
function save(w, f) {
  if (!db) return;
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put({w, f, t:Date.now()}, 'best');
}
function load() {
  if (!db) return;
  const tx = db.transaction('genomes','readonly');
  const g = tx.objectStore('genomes').get('best');
  g.onsuccess = () => {
    if (g.result) {
      for (const a of agents) a.adopt(g.result.w, g.result.f);
    }
  };
}

init();
