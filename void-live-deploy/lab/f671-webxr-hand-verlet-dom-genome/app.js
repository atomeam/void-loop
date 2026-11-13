const STAGE = document.getElementById('stage');
const STATUS = document.getElementById('status');
const N = 8;
const cards = [];
let model = { w: new Float32Array(2*4 + 4*2), b: new Float32Array(4+2) }; // simple linear 2-4-2
let hand = { x:0, y:0, vx:0, vy:0, active:false };
let orient = { beta:0, gamma:0 };
let lastTime = performance.now();
let db;

function rand(a,b){ return a + Math.random()*(b-a); }
function initModel(){
  for(let i=0;i<model.w.length;i++) model.w[i] = (Math.random()-0.5)*0.4;
  for(let i=0;i<model.b.length;i++) model.b[i] = (Math.random()-0.5)*0.2;
}

async function openDB(){
  return new Promise((res,rej)=>{
    const r = indexedDB.open('verse-f671',1);
    r.onupgradeneeded = e => {
      e.target.result.createObjectStore('genomes',{keyPath:'id'});
    };
    r.onsuccess = e => res(e.target.result);
    r.onerror = () => res(null);
  });
}

async function loadGenome(){
  if(!db) return;
  return new Promise(res=>{
    const tx = db.transaction('genomes','readonly');
    const g = tx.objectStore('genomes').get('best');
    g.onsuccess = () => {
      if(g.result){
        model.w.set(g.result.w);
        model.b.set(g.result.b);
        STATUS.textContent = 'Restored sealed genome';
      }
      res();
    };
    g.onerror = ()=>res();
  });
}

function saveGenome(){
  if(!db) return;
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put({
    id:'best',
    w: Array.from(model.w),
    b: Array.from(model.b),
    t: Date.now()
  });
  STATUS.textContent = 'Genome sealed to IndexedDB';
}

function forward(vx, vy){
  // 2-4-2
  const h = new Float32Array(4);
  for(let i=0;i<4;i++){
    h[i] = model.b[i] + model.w[i*2]*vx + model.w[i*2+1]*vy;
    h[i] = Math.tanh(h[i]);
  }
  let o0 = model.b[4], o1 = model.b[5];
  for(let i=0;i<4;i++){
    o0 += model.w[8 + i]*h[i];
    o1 += model.w[12 + i]*h[i];
  }
  return [Math.tanh(o0)*0.3, Math.tanh(o1)*0.3]; // drag-delta, rest-delta
}

class Body {
  constructor(i){
    this.el = document.createElement('div');
    this.el.className = 'card';
    this.el.textContent = 'Agent '+i;
    this.x = rand(60, window.innerWidth-150);
    this.y = rand(60, window.innerHeight-150);
    this.px = this.x; this.py = this.y;
    this.drag = rand(0.02,0.08);
    this.rest = rand(0.3,0.7);
    this.fitness = 0;
    this.hue = rand(200,280);
    this.el.style.background = `hsl(${this.hue},40%,18%)`;
    this.el.style.borderColor = `hsl(${this.hue},70%,60%)`;
    STAGE.appendChild(this.el);
    this.el.addEventListener('pointerdown', e=>{
      this.fitness += 5;
      this.el.classList.add('rewarded');
      setTimeout(()=>this.el.classList.remove('rewarded'),400);
      e.stopPropagation();
    });
  }
  applyModel(dDrag, dRest){
    this.drag = Math.max(0.01, Math.min(0.2, this.drag + dDrag*0.05));
    this.rest = Math.max(0.1, Math.min(0.95, this.rest + dRest*0.05));
  }
  step(dt, fx, fy){
    const vx = (this.x - this.px) * (1 - this.drag);
    const vy = (this.y - this.py) * (1 - this.drag);
    this.px = this.x; this.py = this.y;
    this.x += vx + fx * dt * 0.05;
    this.y += vy + fy * dt * 0.05;
    // bounds
    if(this.x < 10){ this.x = 10; this.px = this.x + vx*this.rest; }
    if(this.x > window.innerWidth-100){ this.x = window.innerWidth-100; this.px = this.x + vx*this.rest; }
    if(this.y < 10){ this.y = 10; this.py = this.y + vy*this.rest; }
    if(this.y > window.innerHeight-90){ this.y = window.innerHeight-90; this.py = this.y + vy*this.rest; }
    this.el.style.transform = `translate(${this.x}px,${this.y}px)`;
  }
  overlaps(o){
    return Math.abs(this.x - o.x) < 80 && Math.abs(this.y - o.y) < 60;
  }
  separate(o){
    const dx = this.x - o.x, dy = this.y - o.y;
    const d = Math.hypot(dx,dy) || 1;
    const push = 2;
    this.x += dx/d * push; o.x -= dx/d * push;
  }
  sealTo(o){
    if(this.fitness > o.fitness + 2){
      o.drag = this.drag;
      o.rest = this.rest;
      o.hue = this.hue;
      o.el.style.background = `hsl(${o.hue},40%,18%)`;
      o.el.style.borderColor = `hsl(${o.hue},70%,60%)`;
      o.el.textContent = 'Agent ' + cards.indexOf(o) + ' (sealed)';
      // model bias transfer lightly
      for(let i=0;i<4;i++) model.b[i] = model.b[i]*0.8 + (this.drag-0.05)*0.2;
    }
  }
}

function spawn(){
  for(let i=0;i<N;i++) cards.push(new Body(i));
}

function loop(now){
  const dt = Math.min(32, now - lastTime); lastTime = now;
  const [dD, dR] = forward(hand.vx*0.01, hand.vy*0.01);
  cards.forEach(c => c.applyModel(dD, dR));
  // forces from hand
  cards.forEach(c => {
    const dx = hand.x - c.x, dy = hand.y - c.y;
    const dist = Math.hypot(dx,dy);
    let fx=0, fy=0;
    if(hand.active && dist < 120){
      const f = (120-dist)/120 * 8;
      fx = dx/dist * f; fy = dy/dist * f;
      c.fitness += 0.05;
    }
    // orientation bias
    fx += orient.gamma * 0.02;
    fy += orient.beta * 0.02;
    c.step(dt, fx, fy);
  });
  // collisions
  for(let i=0;i<cards.length;i++){
    for(let j=i+1;j<cards.length;j++){
      if(cards[i].overlaps(cards[j])){
        cards[i].separate(cards[j]);
        cards[i].sealTo(cards[j]);
        cards[j].sealTo(cards[i]);
      }
    }
  }
  requestAnimationFrame(loop);
}

// Pointer
STAGE.addEventListener('pointermove', e=>{
  const nx = e.clientX, ny = e.clientY;
  hand.vx = nx - hand.x; hand.vy = ny - hand.y;
  hand.x = nx; hand.y = ny; hand.active = true;
});
STAGE.addEventListener('pointerleave', ()=>{ hand.active=false; });

// Orientation
if(window.DeviceOrientationEvent){
  window.addEventListener('deviceorientation', e=>{
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
  });
}

// WebXR hand attempt (progressive)
async function tryXR(){
  if(!navigator.xr) return;
  try{
    const supported = await navigator.xr.isSessionSupported('immersive-vr');
    if(supported){
      STATUS.textContent += ' | WebXR available (pointer fallback active)';
      // Full hand tracking would require session + reference space; keep pointer for broad compatibility
    }
  }catch (e) { console.debug("lab f671-webxr-hand-verlet-dom-genome:", e); }
}

document.getElementById('seal').onclick = saveGenome;
document.getElementById('reset').onclick = ()=>{
  cards.forEach(c=>c.el.remove());
  cards.length=0;
  initModel();
  spawn();
  STATUS.textContent = 'Reset';
};

(async ()=>{
  db = await openDB();
  initModel();
  await loadGenome();
  spawn();
  tryXR();
  STATUS.textContent = 'Ready — move pointer or tilt device';
  requestAnimationFrame(loop);
})();
