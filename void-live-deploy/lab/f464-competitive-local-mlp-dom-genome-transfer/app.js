const N = 10;
const agents = [];
const field = document.getElementById('field');
const statusEl = document.getElementById('status');
const orientEl = document.getElementById('orient');
let gamma = 0, beta = 0; // device orientation
let pointer = {x:0, y:0, active:false};
const bc = new BroadcastChannel('f464-genome');

function randn() { return (Math.random()-0.5)*2; }

class Agent {
  constructor(i) {
    this.id = i;
    this.el = document.createElement('div');
    this.el.className = 'agent';
    this.el.textContent = 'A'+i;
    field.appendChild(this.el);
    this.x = Math.random()*window.innerWidth*0.8 + 50;
    this.y = Math.random()*window.innerHeight*0.7 + 80;
    this.vx = 0; this.vy = 0;
    this.fitness = 0.5;
    // Tiny MLP: 4→6→2  (inputs: gx, gy, px, py normalized)
    this.w1 = Array.from({length:4*6}, randn);
    this.b1 = Array.from({length:6}, randn);
    this.w2 = Array.from({length:6*2}, randn);
    this.b2 = Array.from({length:2}, randn);
    this.el.addEventListener('pointerdown', () => this.reward());
  }
  forward(inputs) {
    // hidden
    const h = new Array(6).fill(0);
    for(let i=0;i<6;i++) {
      let s = this.b1[i];
      for(let j=0;j<4;j++) s += inputs[j]*this.w1[j*6+i];
      h[i] = Math.tanh(s);
    }
    // out
    const o = new Array(2).fill(0);
    for(let i=0;i<2;i++) {
      let s = this.b2[i];
      for(let j=0;j<6;j++) s += h[j]*this.w2[j*2+i];
      o[i] = Math.tanh(s)*2.5; // velocity scale
    }
    return o;
  }
  step() {
    const nx = (this.x / window.innerWidth)*2-1;
    const ny = (this.y / window.innerHeight)*2-1;
    const gx = gamma / 90;
    const gy = beta / 180;
    const outs = this.forward([gx, gy, nx, ny]);
    this.vx = this.vx*0.85 + outs[0]*0.4;
    this.vy = this.vy*0.85 + outs[1]*0.4;
    // orientation gravity bias
    this.vx += gx * 0.15;
    this.vy += gy * 0.15;
    this.x += this.vx;
    this.y += this.vy;
    // bounds
    if(this.x<20) {this.x=20; this.vx*=-0.5;}
    if(this.x>window.innerWidth-80) {this.x=window.innerWidth-80; this.vx*=-0.5;}
    if(this.y<60) {this.y=60; this.vy*=-0.5;}
    if(this.y>window.innerHeight-80) {this.y=window.innerHeight-80; this.vy*=-0.5;}
    // fitness: stability (low speed) + proximity to center
    const speed = Math.hypot(this.vx, this.vy);
    const cx = window.innerWidth/2, cy = window.innerHeight/2;
    const distc = Math.hypot(this.x-cx, this.y-cy)/Math.hypot(cx,cy);
    this.fitness = this.fitness*0.98 + (1-Math.min(1,speed*0.3))*0.1 + (1-distc)*0.05;
    if(pointer.active && Math.hypot(this.x-pointer.x, this.y-pointer.y)<80) this.fitness += 0.02;
    this.el.style.transform = `translate(${this.x}px,${this.y}px)`;
    this.el.className = 'agent ' + (this.fitness>0.65?'highfit':this.fitness<0.4?'lowfit':'');
    this.el.textContent = 'A'+this.id+'\n'+this.fitness.toFixed(2);
  }
  reward() { this.fitness = Math.min(1, this.fitness+0.15); }
  transferFrom(other, rate=0.15) {
    // blend weights toward other
    for(let i=0;i<this.w1.length;i++) this.w1[i] = this.w1[i]*(1-rate) + other.w1[i]*rate;
    for(let i=0;i<this.b1.length;i++) this.b1[i] = this.b1[i]*(1-rate) + other.b1[i]*rate;
    for(let i=0;i<this.w2.length;i++) this.w2[i] = this.w2[i]*(1-rate) + other.w2[i]*rate;
    for(let i=0;i<this.b2.length;i++) this.b2[i] = this.b2[i]*(1-rate) + other.b2[i]*rate;
  }
  serialize() {
    return {w1:this.w1, b1:this.b1, w2:this.w2, b2:this.b2, fitness:this.fitness};
  }
  load(g) {
    if(!g) return;
    this.w1 = g.w1.slice(); this.b1=g.b1.slice();
    this.w2 = g.w2.slice(); this.b2=g.b2.slice();
  }
}

for(let i=0;i<N;i++) agents.push(new Agent(i));

function collide() {
  for(let i=0;i<N;i++) for(let j=i+1;j<N;j++) {
    const a=agents[i], b=agents[j];
    const d = Math.hypot(a.x-b.x, a.y-b.y);
    if(d<70) {
      if(a.fitness > b.fitness + 0.05) b.transferFrom(a);
      else if(b.fitness > a.fitness + 0.05) a.transferFrom(b);
      // separate
      const ang = Math.atan2(b.y-a.y, b.x-a.x);
      const push = (70-d)*0.5;
      a.x -= Math.cos(ang)*push; b.x += Math.cos(ang)*push;
      a.y -= Math.sin(ang)*push; b.y += Math.sin(ang)*push;
    }
  }
}

function loop() {
  agents.forEach(a => a.step());
  collide();
  const top = agents.reduce((m,a)=>a.fitness>m.fitness?a:m, agents[0]);
  statusEl.innerHTML = `Top fitness: A${top.id} ${top.fitness.toFixed(2)}<br>Agents competing · genome transfer on contact<br>Click agent to reward · tilt device for bias`;
  requestAnimationFrame(loop);
}
loop();

window.addEventListener('deviceorientation', e => {
  gamma = e.gamma || 0;
  beta = e.beta || 0;
  orientEl.textContent = `Orient γ:${gamma.toFixed(0)} β:${beta.toFixed(0)}`;
});

window.addEventListener('pointermove', e => { pointer.x=e.clientX; pointer.y=e.clientY; pointer.active=true; });
window.addEventListener('pointerleave', () => pointer.active=false);

document.getElementById('reset').onclick = () => agents.forEach(a => { a.x=Math.random()*window.innerWidth*0.8+40; a.y=Math.random()*window.innerHeight*0.7+60; a.vx=a.vy=0; });

document.getElementById('seal').onclick = async () => {
  const top = agents.reduce((m,a)=>a.fitness>m.fitness?a:m, agents[0]);
  const data = top.serialize();
  try {
    const db = await new Promise((res,rej)=>{ const r=indexedDB.open('f464',1); r.onupgradeneeded=e=>e.target.result.createObjectStore('genomes'); r.onsuccess=e=>res(e.target.result); r.onerror=rej; });
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put(data, 'top');
    statusEl.innerHTML += '<br>Sealed top genome to IndexedDB';
  } catch(e) { statusEl.innerHTML += '<br>IndexedDB unavailable'; }
};

document.getElementById('share').onclick = () => {
  const top = agents.reduce((m,a)=>a.fitness>m.fitness?a:m, agents[0]);
  bc.postMessage(top.serialize());
  statusEl.innerHTML += '<br>Broadcast top genome';
};

bc.onmessage = e => {
  // inject into lowest fitness
  const low = agents.reduce((m,a)=>a.fitness<m.fitness?a:m, agents[0]);
  low.load(e.data);
  low.fitness = Math.max(low.fitness, 0.4);
  statusEl.innerHTML += '<br>Received genome → lowest';
};

// auto load seal
(async () => {
  try {
    const db = await new Promise((res,rej)=>{ const r=indexedDB.open('f464',1); r.onupgradeneeded=e=>e.target.result.createObjectStore('genomes'); r.onsuccess=e=>res(e.target.result); r.onerror=()=>res(null); });
    if(!db) return;
    const tx = db.transaction('genomes','readonly');
    const req = tx.objectStore('genomes').get('top');
    req.onsuccess = () => { if(req.result) { agents[0].load(req.result); statusEl.innerHTML += '<br>Loaded sealed genome into A0'; } };
  } catch(e){}
})();
