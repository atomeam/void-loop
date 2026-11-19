const W = 64, H = 64, SCALE = 8;
const agents = [];
const field = new Float32Array(W * H);
const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
let pointer = {x:0, y:0};
let tilt = {x:0, y:0};

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize(); addEventListener('resize', resize);

function rand(n=1) { return (Math.random()-0.5)*2*n; }
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }

class MLP {
  constructor() {
    this.w1 = Array.from({length:8}, () => Array.from({length:6}, () => rand(0.5)));
    this.b1 = Array.from({length:8}, () => rand(0.1));
    this.w2 = Array.from({length:4}, () => Array.from({length:8}, () => rand(0.5)));
    this.b2 = Array.from({length:4}, () => rand(0.1));
  }
  forward(x) {
    const h = this.w1.map((row,i) => Math.tanh(row.reduce((s,w,j)=>s+w*x[j], this.b1[i])));
    return this.w2.map((row,i) => Math.tanh(row.reduce((s,w,j)=>s+w*h[j], this.b2[i])));
  }
  crossover(other, rate=0.3) {
    const mix = (a,b) => a.map((v,i) => Math.random()<rate ? b[i] : v);
    this.w1 = this.w1.map((row,i) => mix(row, other.w1[i]));
    this.b1 = mix(this.b1, other.b1);
    this.w2 = this.w2.map((row,i) => mix(row, other.w2[i]));
    this.b2 = mix(this.b2, other.b2);
  }
  mutate(rate=0.05) {
    const mut = arr => arr.map(v => v + (Math.random()<rate ? rand(0.2) : 0));
    this.w1 = this.w1.map(mut);
    this.b1 = mut(this.b1);
    this.w2 = this.w2.map(mut);
    this.b2 = mut(this.b2);
  }
  clone() {
    const m = new MLP();
    m.w1 = this.w1.map(r=>[...r]); m.b1=[...this.b1];
    m.w2 = this.w2.map(r=>[...r]); m.b2=[...this.b2];
    return m;
  }
}

class Agent {
  constructor(i) {
    this.id = i;
    this.mlp = new MLP();
    this.x = Math.random()*innerWidth;
    this.y = Math.random()*innerHeight;
    this.energy = 50;
    this.fitness = 0;
    this.hue = Math.random()*360;
    this.el = document.createElement('div');
    this.el.className = 'agent';
    this.el.textContent = 'A'+i;
    document.getElementById('arena').appendChild(this.el);
  }
  update() {
    const gx = clamp(Math.floor(this.x / SCALE), 0, W-1);
    const gy = clamp(Math.floor(this.y / SCALE), 0, H-1);
    const dens = field[gy*W + gx] || 0;
    const pdx = pointer.x - this.x, pdy = pointer.y - this.y;
    const pdist = Math.hypot(pdx, pdy)/200;
    const inputs = [dens/10, tilt.x, tilt.y, pdist, Math.atan2(pdy,pdx)/Math.PI, this.energy/100];
    const out = this.mlp.forward(inputs);
    this.x = clamp(this.x + out[0]*4 + tilt.x*2, 0, innerWidth-60);
    this.y = clamp(this.y + out[1]*4 + tilt.y*2, 0, innerHeight-60);
    this.energy += dens * 0.5 - 0.2;
    this.energy = clamp(this.energy, 0, 200);
    this.fitness = this.energy;
    field[gy*W + gx] = Math.max(0, field[gy*W + gx] - 0.3);
    this.el.style.left = this.x+'px';
    this.el.style.top = this.y+'px';
    this.el.style.transform = `scale(${0.6 + this.energy/150}) rotate(${out[2]*30}deg)`;
    this.el.style.setProperty('--h', this.hue);
    this.el.style.opacity = 0.7 + this.energy/300;
  }
}

function spawnAgents() {
  for(let i=0;i<6;i++) agents.push(new Agent(i));
}
spawnAgents();

function updateField() {
  for(let i=0;i<field.length;i++) field[i] = field[i]*0.98 + (Math.random()<0.02? Math.random()*5:0);
}
function drawField() {
  const img = ctx.createImageData(canvas.width, canvas.height);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
    const v = Math.min(255, field[y*W+x]*40);
    const px = x*SCALE, py = y*SCALE;
    for(let dy=0;dy<SCALE;dy++) for(let dx=0;dx<SCALE;dx++) {
      const i = ((py+dy)*canvas.width + (px+dx))*4;
      if(i>=0 && i<img.data.length-3) {
        img.data[i]=0; img.data[i+1]=v; img.data[i+2]=v/2; img.data[i+3]=180;
      }
    }
  }
  ctx.putImageData(img,0,0);
}

function capture() {
  for(let i=0;i<agents.length;i++) for(let j=i+1;j<agents.length;j++) {
    const a=agents[i], b=agents[j];
    const d = Math.hypot(a.x-b.x, a.y-b.y);
    if(d<45) {
      if(a.fitness > b.fitness + 5) {
        a.mlp.crossover(b.mlp, 0.35);
        a.energy += 10; b.energy = Math.max(0, b.energy-15);
        a.hue = (a.hue + b.hue*0.2)%360;
        document.getElementById('status').textContent = `A${a.id} captured A${b.id} — genome transferred`;
      } else if(b.fitness > a.fitness + 5) {
        b.mlp.crossover(a.mlp, 0.35);
        b.energy += 10; a.energy = Math.max(0, a.energy-15);
        b.hue = (b.hue + a.hue*0.2)%360;
        document.getElementById('status').textContent = `A${b.id} captured A${a.id} — genome transferred`;
      }
    }
  }
}

let last = 0;
function loop(t) {
  if(t-last > 50) {
    updateField();
    agents.forEach(a => a.update());
    capture();
    drawField();
    last = t;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

addEventListener('pointermove', e => { pointer.x=e.clientX; pointer.y=e.clientY; });
addEventListener('pointerdown', e => { pointer.x=e.clientX; pointer.y=e.clientY; });
if('DeviceOrientationEvent' in window) {
  addEventListener('deviceorientation', e => {
    tilt.x = (e.gamma||0)/45;
    tilt.y = (e.beta||0)/45;
  });
}

const dbName = 'verse-f817-genomes';
let db;
const req = indexedDB.open(dbName,1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes',{keyPath:'id'});
req.onsuccess = e => db = e.target.result;
const bc = new BroadcastChannel('f817-genomes');
bc.onmessage = e => {
  if(e.data.type==='seal' && e.data.fitness > Math.max(...agents.map(a=>a.fitness))) {
    const best = agents.reduce((m,a)=>a.fitness>m.fitness?a:m);
    best.mlp = e.data.mlp;
    best.mlp.mutate(0.1);
    document.getElementById('status').textContent = 'Received higher-fitness genome';
  }
};
document.getElementById('seal').onclick = () => {
  const best = agents.reduce((m,a)=>a.fitness>m.fitness?a:m);
  if(db) {
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put({id:'best', fitness:best.fitness, hue:best.hue, ts:Date.now()});
  }
  bc.postMessage({type:'seal', fitness:best.fitness, hue:best.hue});
  document.getElementById('status').textContent = `Sealed A${best.id} fitness ${best.fitness.toFixed(1)}`;
};
document.getElementById('reset').onclick = () => {
  agents.forEach(a => a.el.remove());
  agents.length=0;
  field.fill(0);
  spawnAgents();
};
