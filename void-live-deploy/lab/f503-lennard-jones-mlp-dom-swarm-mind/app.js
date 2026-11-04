const stage = document.getElementById('stage');
const status = document.getElementById('status');
const N = 12;
const particles = [];
let sealedGenome = null;
let selected = null;
let gravity = {x:0, y:0.1};
const dt = 0.016;
const sigma = 30;
const baseEps = 1.0;

function rand(a,b){ return a + Math.random()*(b-a); }

class MLP {
  constructor() {
    this.w1 = Array(4).fill(0).map(()=>Array(3).fill(0).map(()=>rand(-0.5,0.5)));
    this.b1 = Array(4).fill(0).map(()=>rand(-0.2,0.2));
    this.w2 = Array(4).fill(0).map(()=>rand(-0.5,0.5));
    this.b2 = rand(-0.2,0.2);
  }
  forward(x) { // x: [density, pdist, 1]
    const h = this.w1.map((row,i)=> Math.max(0, row.reduce((s,w,j)=>s+w*x[j],0) + this.b1[i]));
    return this.w2.reduce((s,w,i)=>s+w*h[i],0) + this.b2;
  }
  clone() {
    const m = new MLP();
    m.w1 = this.w1.map(r=>r.slice());
    m.b1 = this.b1.slice();
    m.w2 = this.w2.slice();
    m.b2 = this.b2;
    return m;
  }
  mutate(rate=0.1) {
    const m = this.clone();
    m.w1 = m.w1.map(r=>r.map(v=>v + rand(-rate,rate)));
    m.b1 = m.b1.map(v=>v + rand(-rate,rate));
    m.w2 = m.w2.map(v=>v + rand(-rate,rate));
    m.b2 += rand(-rate,rate);
    return m;
  }
}

class Particle {
  constructor(i) {
    this.id = i;
    this.x = rand(100, window.innerWidth-100);
    this.y = rand(100, window.innerHeight-100);
    this.vx = rand(-1,1);
    this.vy = rand(-1,1);
    this.mlp = new MLP();
    this.eps = baseEps;
    this.el = document.createElement('div');
    this.el.className = 'particle';
    this.el.textContent = i;
    this.el.style.left = '0px';
    this.el.style.top = '0px';
    this.el.onclick = () => select(this);
    stage.appendChild(this.el);
  }
  density() {
    let c = 0;
    for (const p of particles) {
      if (p===this) continue;
      const dx = p.x - this.x, dy = p.y - this.y;
      if (dx*dx+dy*dy < (sigma*2)**2) c++;
    }
    return c / N;
  }
  updateMLP(px,py) {
    const dens = this.density();
    const dx = px - this.x, dy = py - this.y;
    const pdist = Math.min(1, Math.hypot(dx,dy)/400);
    const delta = this.mlp.forward([dens, pdist, 1]);
    this.eps = Math.max(0.1, baseEps + delta * 0.5);
  }
  forceFrom(other) {
    const dx = other.x - this.x, dy = other.y - this.y;
    const r2 = dx*dx + dy*dy + 1e-4;
    const r = Math.sqrt(r2);
    if (r > sigma*3) return {fx:0,fy:0};
    const sr2 = (sigma*sigma)/r2;
    const sr6 = sr2*sr2*sr2;
    const sr12 = sr6*sr6;
    const fmag = 24 * this.eps / r2 * (2*sr12 - sr6);
    return {fx: fmag * dx, fy: fmag * dy};
  }
  step(px,py) {
    this.updateMLP(px,py);
    let fx = gravity.x * 20, fy = gravity.y * 20;
    for (const p of particles) {
      if (p===this) continue;
      const f = this.forceFrom(p);
      fx += f.fx; fy += f.fy;
    }
    this.vx = (this.vx + fx * dt) * 0.98;
    this.vy = (this.vy + fy * dt) * 0.98;
    this.x += this.vx;
    this.y += this.vy;
    // bounds
    if (this.x < 20) { this.x=20; this.vx*=-0.5; }
    if (this.x > window.innerWidth-20) { this.x=window.innerWidth-20; this.vx*=-0.5; }
    if (this.y < 20) { this.y=20; this.vy*=-0.5; }
    if (this.y > window.innerHeight-20) { this.y=window.innerHeight-20; this.vy*=-0.5; }
    const speed = Math.hypot(this.vx, this.vy);
    const hue = (this.eps * 80 + speed * 20) % 360;
    this.el.style.setProperty('--hue', hue);
    this.el.style.transform = `translate(${this.x-20}px,${this.y-20}px) scale(${1+speed*0.15})`;
  }
}

function select(p) {
  if (selected) selected.el.classList.remove('sealed');
  selected = p;
  p.el.classList.add('sealed');
  status.textContent = `Selected particle ${p.id} ε≈${p.eps.toFixed(2)}`;
}

function nucleate() {
  particles.forEach(p=>p.el.remove());
  particles.length = 0;
  for (let i=0;i<N;i++) particles.push(new Particle(i));
  status.textContent = `Nucleated ${N} particles`;
}

let pointer = {x: window.innerWidth/2, y: window.innerHeight/2};
stage.onpointermove = e => { pointer.x = e.clientX; pointer.y = e.clientY; };
stage.onpointerdown = e => {
  // kick nearest
  let nearest = null, dmin=1e9;
  for (const p of particles) {
    const d = Math.hypot(p.x-e.clientX, p.y-e.clientY);
    if (d < dmin) { dmin=d; nearest=p; }
  }
  if (nearest && dmin < 60) {
    nearest.vx += (e.clientX - nearest.x)*0.1;
    nearest.vy += (e.clientY - nearest.y)*0.1;
  }
};

window.addEventListener('deviceorientation', e => {
  if (e.gamma != null) gravity.x = (e.gamma / 90) * 0.5;
  if (e.beta != null) gravity.y = (e.beta / 90) * 0.5;
});

document.getElementById('nucleate').onclick = nucleate;
document.getElementById('sealSel').onclick = () => {
  if (!selected) return;
  sealedGenome = selected.mlp.clone();
  status.textContent = `Sealed genome from ${selected.id}`;
};
document.getElementById('transfer').onclick = () => {
  if (!selected || !sealedGenome) return;
  selected.mlp = sealedGenome.mutate(0.05);
  status.textContent = `Transferred (mutated) genome to ${selected.id}`;
};
document.getElementById('sealAll').onclick = async () => {
  const state = particles.map(p=>({x:p.x,y:p.y,vx:p.vx,vy:p.vy,eps:p.eps}));
  try {
    const db = await idbOpen();
    const tx = db.transaction('seals','readwrite');
    tx.objectStore('seals').put({id:'latest', state, t:Date.now()});
    status.textContent = 'Sealed full state to IndexedDB';
  } catch(e) { status.textContent = 'Seal failed (IDB)'; }
};
document.getElementById('restore').onclick = async () => {
  try {
    const db = await idbOpen();
    const tx = db.transaction('seals','readonly');
    const req = tx.objectStore('seals').get('latest');
    req.onsuccess = () => {
      const rec = req.result;
      if (!rec) return;
      nucleate();
      rec.state.forEach((s,i)=>{
        if (particles[i]) {
          particles[i].x=s.x; particles[i].y=s.y;
          particles[i].vx=s.vx; particles[i].vy=s.vy;
        }
      });
      status.textContent = 'Restored sealed state';
    };
  } catch(e) { status.textContent = 'Restore failed'; }
};
document.getElementById('clear').onclick = () => {
  particles.forEach(p=>p.el.remove());
  particles.length=0;
  status.textContent = 'Cleared';
};

function idbOpen() {
  return new Promise((res,rej)=>{
    const r = indexedDB.open('f503-lj',1);
    r.onupgradeneeded = () => r.result.createObjectStore('seals',{keyPath:'id'});
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function loop() {
  for (const p of particles) p.step(pointer.x, pointer.y);
  requestAnimationFrame(loop);
}
nucleate();
loop();
