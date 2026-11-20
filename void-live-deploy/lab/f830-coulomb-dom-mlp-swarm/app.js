const N = 8;
const agents = [];
const stage = document.getElementById('stage');
const trails = document.getElementById('trails');
const ctx = trails.getContext('2d');
let W = innerWidth, H = innerHeight;
trails.width = W; trails.height = H;

function rand(a,b){ return a + Math.random()*(b-a); }
function sigmoid(x){ return 1/(1+Math.exp(-x)); }

class Agent {
  constructor(i) {
    this.id = i;
    this.x = rand(80, W-80);
    this.y = rand(80, H-80);
    this.vx = 0; this.vy = 0;
    this.charge = rand(-1,1);
    this.scale = 1;
    this.fitness = 0.5;
    this.el = document.createElement('div');
    this.el.className = 'agent';
    this.el.textContent = i;
    this.el.style.width = this.el.style.height = '42px';
    stage.appendChild(this.el);
    // MLP: 4 -> 6 -> 2
    this.w1 = Array.from({length:4*6}, () => rand(-0.5,0.5));
    this.b1 = Array.from({length:6}, () => rand(-0.2,0.2));
    this.w2 = Array.from({length:6*2}, () => rand(-0.5,0.5));
    this.b2 = Array.from({length:2}, () => rand(-0.2,0.2));
    this.el.addEventListener('pointerdown', e => this.dragStart(e));
    this.el.addEventListener('click', e => { e.stopPropagation(); reward(this); });
  }
  forward(dx, dy, ox, oy) {
    const inp = [dx*0.01, dy*0.01, ox, oy];
    const h = new Array(6);
    for(let i=0;i<6;i++){
      let s = this.b1[i];
      for(let j=0;j<4;j++) s += inp[j]*this.w1[j*6+i];
      h[i] = Math.tanh(s);
    }
    let o0=this.b2[0], o1=this.b2[1];
    for(let i=0;i<6;i++){
      o0 += h[i]*this.w2[i*2];
      o1 += h[i]*this.w2[i*2+1];
    }
    this.charge = Math.tanh(o0)*1.5;
    this.scale = 0.5 + sigmoid(o1);
    return this.charge;
  }
  applyForce(fx, fy) {
    this.vx += fx * 0.05;
    this.vy += fy * 0.05;
  }
  integrate() {
    this.vx *= 0.92; this.vy *= 0.92;
    this.x += this.vx; this.y += this.vy;
    if(this.x < 30){ this.x=30; this.vx*=-0.5; }
    if(this.x > W-30){ this.x=W-30; this.vx*=-0.5; }
    if(this.y < 30){ this.y=30; this.vy*=-0.5; }
    if(this.y > H-30){ this.y=H-30; this.vy*=-0.5; }
    const size = 28 + this.fitness * 24;
    this.el.style.left = (this.x - size/2) + 'px';
    this.el.style.top = (this.y - size/2) + 'px';
    this.el.style.width = this.el.style.height = size + 'px';
    const hue = this.charge > 0 ? 200 : 20;
    const sat = Math.min(100, Math.abs(this.charge)*60 + 40);
    this.el.style.background = `hsl(${hue},${sat}%,50%)`;
    this.el.style.transform = `scale(${this.scale})`;
  }
  dragStart(e) {
    e.preventDefault();
    const startX = e.clientX - this.x, startY = e.clientY - this.y;
    const move = ev => {
      this.x = ev.clientX - startX;
      this.y = ev.clientY - startY;
      this.vx = this.vy = 0;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  genome() {
    return { w1:this.w1, b1:this.b1, w2:this.w2, b2:this.b2, fitness:this.fitness };
  }
  loadGenome(g) {
    if(!g) return;
    this.w1 = g.w1.slice(); this.b1 = g.b1.slice();
    this.w2 = g.w2.slice(); this.b2 = g.b2.slice();
    this.fitness = g.fitness || 0.5;
  }
}

for(let i=0;i<N;i++) agents.push(new Agent(i));

let px = W/2, py = H/2;
let ox=0, oy=0;
window.addEventListener('pointermove', e => { px=e.clientX; py=e.clientY; });
window.addEventListener('deviceorientation', e => {
  ox = (e.gamma||0)/90;
  oy = (e.beta||0)/90;
});

function reward(a) {
  a.fitness = Math.min(1, a.fitness + 0.15);
  // mild Hebbian-ish reinforce
  for(let i=0;i<a.w2.length;i++) a.w2[i] += rand(-0.05,0.05);
  status();
}

function physics() {
  // Coulomb
  for(let i=0;i<N;i++){
    for(let j=i+1;j<N;j++){
      const a=agents[i], b=agents[j];
      let dx=b.x-a.x, dy=b.y-a.y;
      let d2=dx*dx+dy*dy+100;
      let d=Math.sqrt(d2);
      let f = (a.charge * b.charge * 800) / d2;
      let fx = f * dx / d, fy = f * dy / d;
      a.applyForce(-fx, -fy);
      b.applyForce(fx, fy);
    }
  }
  // attractor to pointer (soft)
  for(const a of agents){
    let dx=px-a.x, dy=py-a.y;
    let dist=Math.hypot(dx,dy)+1;
    a.fitness = 0.7*a.fitness + 0.3*(1/(1+dist/200));
    a.applyForce(dx*0.002, dy*0.002);
    a.forward(dx, dy, ox, oy);
    a.integrate();
  }
}

function drawTrails() {
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0,0,W,H);
  for(const a of agents){
    ctx.beginPath();
    ctx.arc(a.x, a.y, 3, 0, Math.PI*2);
    ctx.fillStyle = a.charge>0 ? '#4af' : '#f84';
    ctx.fill();
  }
}

function status() {
  const best = Math.max(...agents.map(a=>a.fitness));
  document.getElementById('status').textContent = `agents: ${N} | best fitness: ${best.toFixed(2)}`;
}

function loop() {
  physics();
  drawTrails();
  status();
  requestAnimationFrame(loop);
}
loop();

// Seal / persistence
const DB = 'f830-coulomb-mlp';
const CH = new BroadcastChannel('f830-genome');
let db;
const req = indexedDB.open(DB, 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', {keyPath:'id'});
req.onsuccess = e => { db = e.target.result; loadBest(); };

function seal() {
  const best = agents.reduce((a,b)=> a.fitness>b.fitness?a:b);
  const g = best.genome();
  if(db){
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put({id:'best', ...g, ts:Date.now()});
  }
  CH.postMessage(g);
  document.getElementById('seal').textContent = 'Sealed!';
  setTimeout(()=>document.getElementById('seal').textContent='Seal Genome', 1200);
}
document.getElementById('seal').onclick = seal;

CH.onmessage = e => {
  const g = e.data;
  if(!g || !g.fitness) return;
  const worst = agents.reduce((a,b)=> a.fitness<b.fitness?a:b);
  if(g.fitness > worst.fitness + 0.05){
    worst.loadGenome(g);
    worst.fitness = g.fitness * 0.95;
  }
};

function loadBest() {
  if(!db) return;
  const tx = db.transaction('genomes','readonly');
  const r = tx.objectStore('genomes').get('best');
  r.onsuccess = () => {
    if(r.result) agents[0].loadGenome(r.result);
  };
}

document.getElementById('reset').onclick = () => location.reload();

addEventListener('resize', ()=>{ W=innerWidth; H=innerHeight; trails.width=W; trails.height=H; });
