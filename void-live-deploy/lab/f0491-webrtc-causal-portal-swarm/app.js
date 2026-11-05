const N = 10;
const portals = [];
let ori = {beta:0, gamma:0, alpha:0};
let prevOri = {...ori};
let pointer = {x:0, y:0, vx:0, vy:0};
let lastPointer = {x:0, y:0};
let globalFitness = 0;
const channel = new BroadcastChannel('f0491-genome');

function randn() { return (Math.random()-0.5)*2; }
function randWeights(n) { return Array.from({length:n}, () => randn()*0.5); }

class Portal {
  constructor(i) {
    this.id = i;
    this.el = document.createElement('div');
    this.el.className = 'portal';
    this.el.textContent = 'P'+i;
    document.body.appendChild(this.el);
    this.x = Math.random()*window.innerWidth;
    this.y = Math.random()*window.innerHeight;
    this.vx = 0; this.vy = 0;
    this.mlp = {
      w1: randWeights(5*6), b1: randWeights(6),
      w2: randWeights(6*3), b2: randWeights(3)
    };
    this.fitness = 0.5;
    this.collisions = 0;
    this.hue = (i*36)%360;
    this.updateStyle();
  }
  updateStyle() {
    this.el.style.background = `hsl(${this.hue},70%,45%)`;
    this.el.style.color = '#fff';
  }
  mlpForward(input) {
    // 5→6→3
    const h = new Array(6).fill(0);
    for(let i=0;i<6;i++) {
      let s = this.mlp.b1[i];
      for(let j=0;j<5;j++) s += input[j]*this.mlp.w1[j*6+i];
      h[i] = Math.tanh(s);
    }
    const out = new Array(3).fill(0);
    for(let i=0;i<3;i++) {
      let s = this.mlp.b2[i];
      for(let j=0;j<6;j++) s += h[j]*this.mlp.w2[j*3+i];
      out[i] = Math.tanh(s);
    }
    return out; // repel, center, damp
  }
  step(dt, all) {
    const dBeta = ori.beta - prevOri.beta;
    const dGamma = ori.gamma - prevOri.gamma;
    const dAlpha = ori.alpha - prevOri.alpha;
    const input = [dBeta*0.05, dGamma*0.05, dAlpha*0.05, pointer.vx*0.01, pointer.vy*0.01];
    const [repelG, centerG, dampG] = this.mlpForward(input).map(v => (v+1)*0.5); // 0-1
    let fx=0, fy=0;
    // mutual repulsion
    for(const p of all) {
      if(p===this) continue;
      const dx = this.x - p.x, dy = this.y - p.y;
      const d2 = dx*dx + dy*dy + 100;
      const d = Math.sqrt(d2);
      if(d < 90) {
        const f = (90-d)/d * repelG * 80;
        fx += dx/d * f; fy += dy/d * f;
        this.collisions++;
      }
    }
    // center attract
    const cx = window.innerWidth/2, cy = window.innerHeight/2;
    fx += (cx - this.x) * centerG * 0.02;
    fy += (cy - this.y) * centerG * 0.02;
    // integrate
    this.vx = this.vx * (1 - dampG*0.1) + fx * dt;
    this.vy = this.vy * (1 - dampG*0.1) + fy * dt;
    this.vx *= 0.98; this.vy *= 0.98;
    this.x += this.vx; this.y += this.vy;
    // bounds
    this.x = Math.max(36, Math.min(window.innerWidth-36, this.x));
    this.y = Math.max(36, Math.min(window.innerHeight-36, this.y));
    this.el.style.transform = `translate(${this.x-36}px, ${this.y-36}px)`;
    // fitness
    this.fitness = Math.max(0, 1 - this.collisions*0.002);
    if(this.fitness > 0.8) this.el.classList.add('high'); else this.el.classList.remove('high');
  }
  genome() {
    return {w1:this.mlp.w1, b1:this.mlp.b1, w2:this.mlp.w2, b2:this.mlp.b2, fitness:this.fitness};
  }
  adopt(g, mutate=0.05) {
    if(g.fitness <= this.fitness) return false;
    this.mlp.w1 = g.w1.map(w => w + randn()*mutate);
    this.mlp.b1 = g.b1.map(w => w + randn()*mutate);
    this.mlp.w2 = g.w2.map(w => w + randn()*mutate);
    this.mlp.b2 = g.b2.map(w => w + randn()*mutate);
    this.fitness = g.fitness * 0.95;
    this.hue = (this.hue + 20) % 360;
    this.updateStyle();
    return true;
  }
}

for(let i=0;i<N;i++) portals.push(new Portal(i));

window.addEventListener('deviceorientation', e => {
  prevOri = {...ori};
  ori = {beta:e.beta||0, gamma:e.gamma||0, alpha:e.alpha||0};
});
window.addEventListener('pointermove', e => {
  pointer.vx = e.clientX - lastPointer.x;
  pointer.vy = e.clientY - lastPointer.y;
  lastPointer = {x:e.clientX, y:e.clientY};
  pointer.x = e.clientX; pointer.y = e.clientY;
});

channel.onmessage = e => {
  const g = e.data;
  if(!g || !g.fitness) return;
  let adopted = 0;
  for(const p of portals) if(p.adopt(g)) adopted++;
  if(adopted) document.getElementById('status').textContent = `adopted genome f=${g.fitness.toFixed(2)}`;
};

function seal() {
  const best = portals.reduce((a,b) => a.fitness > b.fitness ? a : b);
  const g = best.genome();
  channel.postMessage(g);
  // IndexedDB
  const req = indexedDB.open('f0491-portal-swarm', 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put(g, 'best');
  };
  document.getElementById('status').textContent = `sealed f=${g.fitness.toFixed(2)}`;
}
function restore() {
  const req = indexedDB.open('f0491-portal-swarm', 1);
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('genomes','readonly');
    const get = tx.objectStore('genomes').get('best');
    get.onsuccess = () => {
      if(get.result) {
        for(const p of portals) p.adopt(get.result, 0);
        document.getElementById('status').textContent = 'restored';
      }
    };
  };
}
window.addEventListener('keydown', e => {
  if(e.key==='s' || e.key==='S') seal();
  if(e.key==='r' || e.key==='R') restore();
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now-last)/1000);
  last = now;
  for(const p of portals) p.step(dt, portals);
  globalFitness = portals.reduce((s,p)=>s+p.fitness,0)/N;
  document.documentElement.style.setProperty('--fit', globalFitness);
  document.getElementById('status').textContent = `fit ${globalFitness.toFixed(2)} | S seal R restore`;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Optional WebRTC stub (signaling via BroadcastChannel for demo)
// In multi-device, replace with real signaling; here multi-tab uses BC directly.
