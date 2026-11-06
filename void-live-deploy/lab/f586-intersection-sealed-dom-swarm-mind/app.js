const STAGE = document.getElementById('stage');
const STATUS = document.getElementById('status');
const INFO = document.getElementById('info');
const N = 7;
const agents = [];
let tiltX = 0, tiltY = 0;
let mouseTilt = false;

// Tiny MLP helpers
function rand(a,b){ return a + Math.random()*(b-a); }
function sigmoid(x){ return 1/(1+Math.exp(-x)); }
function mlpForward(w, x) {
  // 3→4→2
  const h = [0,0,0,0];
  for(let i=0;i<4;i++){
    let s = w.b1[i];
    for(let j=0;j<3;j++) s += w.w1[i][j]*x[j];
    h[i] = sigmoid(s);
  }
  const o = [0,0];
  for(let i=0;i<2;i++){
    let s = w.b2[i];
    for(let j=0;j<4;j++) s += w.w2[i][j]*h[j];
    o[i] = Math.tanh(s);
  }
  return o;
}
function randomWeights(){
  const w1 = Array.from({length:4}, ()=> Array.from({length:3}, ()=> rand(-1,1)));
  const b1 = Array.from({length:4}, ()=> rand(-.5,.5));
  const w2 = Array.from({length:2}, ()=> Array.from({length:4}, ()=> rand(-1,1)));
  const b2 = Array.from({length:2}, ()=> rand(-.5,.5));
  return {w1,b1,w2,b2};
}
function mutateWeights(w, rate=0.15){
  const m = JSON.parse(JSON.stringify(w));
  for(let i=0;i<4;i++) for(let j=0;j<3;j++) m.w1[i][j] += rand(-rate,rate);
  for(let i=0;i<4;i++) m.b1[i] += rand(-rate,rate);
  for(let i=0;i<2;i++) for(let j=0;j<4;j++) m.w2[i][j] += rand(-rate,rate);
  for(let i=0;i<2;i++) m.b2[i] += rand(-rate,rate);
  return m;
}

function createAgent(i){
  const el = document.createElement('div');
  el.className = 'agent';
  el.innerHTML = `<div class="id">A${i}</div><div class="fit">fit 0</div>`; // void-review: ok (built from this file's own constants and numbers, no visitor text)
  STAGE.appendChild(el);
  const genome = {
    hue: rand(0,360),
    scale: rand(0.8,1.4),
    speed: rand(0.4,1.2),
    adhesion: rand(0.2,0.8)
  };
  return {
    id: i, el, genome, weights: randomWeights(),
    x: rand(80, window.innerWidth-160),
    y: rand(80, window.innerHeight-140),
    vx: 0, vy: 0,
    fitness: 0.5, vis: 0,
    pinned: false
  };
}

function styleAgent(a){
  const g = a.genome;
  a.el.style.left = a.x + 'px';
  a.el.style.top = a.y + 'px';
  a.el.style.background = `hsl(${g.hue},70%,42%)`;
  a.el.style.transform = `scale(${g.scale})`;
  a.el.style.filter = `brightness(${0.8 + a.fitness*0.4})`;
  a.el.querySelector('.fit').textContent = `fit ${a.fitness.toFixed(2)}`;
}

function localDensity(a){
  let c = 0;
  for(const b of agents){
    if(a===b) continue;
    const dx = a.x-b.x, dy=a.y-b.y;
    if(dx*dx+dy*dy < 180*180) c++;
  }
  return Math.min(1, c/4);
}

function update(){
  const w = window.innerWidth, h = window.innerHeight;
  for(const a of agents){
    if(a.pinned) continue;
    const dens = localDensity(a);
    const out = mlpForward(a.weights, [tiltX, tiltY, dens]);
    a.vx += out[0] * a.genome.speed * 0.8;
    a.vy += out[1] * a.genome.speed * 0.8;
    // soft walls + damping
    if(a.x < 20) a.vx += 0.4; if(a.x > w-140) a.vx -= 0.4;
    if(a.y < 20) a.vy += 0.4; if(a.y > h-100) a.vy -= 0.4;
    a.vx *= 0.92; a.vy *= 0.92;
    a.x += a.vx; a.y += a.vy;
    // simple repulsion
    for(const b of agents){
      if(a===b) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      const d2 = dx*dx + dy*dy;
      if(d2 < 140*140 && d2 > 1){
        const f = 80 / d2;
        a.vx += dx * f * 0.02;
        a.vy += dy * f * 0.02;
      }
    }
  }
  // overlap genome transfer
  for(let i=0;i<agents.length;i++){
    for(let j=i+1;j<agents.length;j++){
      const a=agents[i], b=agents[j];
      const dx=a.x-b.x, dy=a.y-b.y;
      if(dx*dx+dy*dy < 130*130){
        if(a.fitness > b.fitness + 0.08){
          b.genome = {...a.genome, hue: (a.genome.hue + rand(-20,20)+360)%360};
          b.weights = mutateWeights(a.weights, 0.12);
          b.fitness *= 0.9;
        } else if(b.fitness > a.fitness + 0.08){
          a.genome = {...b.genome, hue: (b.genome.hue + rand(-20,20)+360)%360};
          a.weights = mutateWeights(b.weights, 0.12);
          a.fitness *= 0.9;
        }
      }
    }
  }
  for(const a of agents) styleAgent(a);
  requestAnimationFrame(update);
}

// IntersectionObserver fitness
const io = new IntersectionObserver((entries)=>{
  for(const e of entries){
    const a = agents.find(x=>x.el===e.target);
    if(a){
      a.vis = e.intersectionRatio;
      a.fitness = a.fitness*0.92 + (e.intersectionRatio * a.genome.scale)*0.08;
    }
  }
}, {threshold: [0,0.25,0.5,0.75,1]});

// Drag
let drag = null, offX=0, offY=0;
function onPointerDown(e){
  const a = agents.find(x=>x.el===e.target || x.el.contains(e.target));
  if(!a) return;
  drag = a; a.pinned = true; a.fitness = Math.min(1, a.fitness+0.15);
  const r = a.el.getBoundingClientRect();
  offX = e.clientX - r.left; offY = e.clientY - r.top;
  a.el.setPointerCapture(e.pointerId);
}
function onPointerMove(e){
  if(!drag) return;
  drag.x = e.clientX - offX;
  drag.y = e.clientY - offY;
  styleAgent(drag);
}
function onPointerUp(e){
  if(drag){ drag.pinned=false; drag.el.releasePointerCapture(e.pointerId); }
  drag=null;
}
STAGE.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);

// Orientation
function onOrient(e){
  mouseTilt=false;
  tiltX = Math.max(-1, Math.min(1, (e.gamma||0)/40));
  tiltY = Math.max(-1, Math.min(1, (e.beta||0)/40));
  STATUS.textContent = `Tilt ${tiltX.toFixed(2)}, ${tiltY.toFixed(2)} — drag agents, overlaps transfer genomes`;
}
if(window.DeviceOrientationEvent){
  window.addEventListener('deviceorientation', onOrient);
  STATUS.textContent = 'Requesting orientation… tilt or move mouse';
} else {
  mouseTilt=true;
}
window.addEventListener('mousemove', e=>{
  if(!mouseTilt && Math.abs(tiltX)+Math.abs(tiltY)>0.1) return;
  mouseTilt=true;
  tiltX = (e.clientX / window.innerWidth - 0.5)*2;
  tiltY = (e.clientY / window.innerHeight - 0.5)*2;
});

// IndexedDB
const DB = 'verse-f586';
function openDB(){
  return new Promise((res,rej)=>{
    const r = indexedDB.open(DB,1);
    r.onupgradeneeded = ()=> r.result.createObjectStore('swarm');
    r.onsuccess = ()=> res(r.result);
    r.onerror = ()=> rej(r.error);
  });
}
async function seal(){
  try{
    const db = await openDB();
    const tx = db.transaction('swarm','readwrite');
    const data = agents.map(a=>({
      id:a.id, x:a.x, y:a.y, fitness:a.fitness,
      genome:a.genome, weights:a.weights
    }));
    tx.objectStore('swarm').put(data, 'snapshot');
    await new Promise(r=>tx.oncomplete=r);
    STATUS.textContent = 'Sealed to IndexedDB';
  }catch(e){ STATUS.textContent = 'Seal failed (IDB): '+e.message; }
}
async function load(){
  try{
    const db = await openDB();
    const tx = db.transaction('swarm','readonly');
    const req = tx.objectStore('swarm').get('snapshot');
    req.onsuccess = ()=>{
      const data = req.result;
      if(!data) { STATUS.textContent='No sealed snapshot'; return; }
      data.forEach((d,i)=>{
        if(agents[i]){
          Object.assign(agents[i], {x:d.x, y:d.y, fitness:d.fitness||0.5, genome:d.genome, weights:d.weights});
          styleAgent(agents[i]);
        }
      });
      STATUS.textContent = 'Loaded sealed swarm';
    };
  }catch(e){ STATUS.textContent='Load failed'; }
}
document.getElementById('seal').onclick = seal;
document.getElementById('load').onclick = load;

// Boot
for(let i=0;i<N;i++){
  const a = createAgent(i);
  agents.push(a);
  io.observe(a.el);
  styleAgent(a);
}
update();
INFO.textContent = `${N} agents · IntersectionObserver fitness · overlap genome transfer`;
