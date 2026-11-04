const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const stage = document.getElementById('stage');
const token = document.getElementById('token');
const bestFitEl = document.getElementById('bestFit');
const pressEl = document.getElementById('press');
const nCardsEl = document.getElementById('nCards');
const msg = document.getElementById('msg');

function resize() {
  cv.width = innerWidth; cv.height = innerHeight;
}
addEventListener('resize', resize); resize();

// Simple MLP
function rand(a,b){ return a + Math.random()*(b-a); }
function sigmoid(x){ return 1/(1+Math.exp(-x)); }
function mlpForward(w, x) {
  // 4→6→4
  const h = new Array(6);
  for(let i=0;i<6;i++){
    let s = w[i*5 + 4];
    for(let j=0;j<4;j++) s += w[i*5 + j]*x[j];
    h[i] = sigmoid(s);
  }
  const o = new Array(4);
  const off = 6*5;
  for(let i=0;i<4;i++){
    let s = w[off + i*7 + 6];
    for(let j=0;j<6;j++) s += w[off + i*7 + j]*h[j];
    o[i] = Math.tanh(s);
  }
  return o;
}
function randomWeights(){
  const w = new Float32Array(6*5 + 4*7);
  for(let i=0;i<w.length;i++) w[i] = rand(-1.2,1.2);
  return w;
}
function mutate(w, rate=0.15){
  const n = new Float32Array(w);
  for(let i=0;i<n.length;i++) if(Math.random()<rate) n[i] += rand(-0.3,0.3);
  return n;
}

// Agents
const N_AGENTS = 4;
const agents = Array.from({length:N_AGENTS}, (_,i) => ({
  id:i, w: randomWeights(), fitness:0, color:`hsl(${i*90},70%,55%)`,
  coreX: 0.2 + (i%2)*0.6, coreY: 0.25 + Math.floor(i/2)*0.5
}));

// Cards
let cards = [];
function addCard(x,y){
  const el = document.createElement('div');
  el.className = 'card';
  el.textContent = 'C' + cards.length;
  el.dataset.idx = cards.length;
  stage.appendChild(el);
  const c = { el, x:x||rand(0.1,0.9), y:y||rand(0.1,0.9), vx:0, vy:0, owner:-1, dwell:0 };
  cards.push(c);
  nCardsEl.textContent = cards.length;
  return c;
}
for(let i=0;i<12;i++) addCard();

// Inputs
let pressure = 0, tiltX=0, tiltY=0, beta=0, gamma=0, px=0.5, py=0.5;
let pointerDown = false;

function onPointer(e){
  const r = cv.getBoundingClientRect();
  px = (e.clientX - r.left)/r.width;
  py = (e.clientY - r.top)/r.height;
  pressure = e.pressure || Math.min(1, Math.hypot(e.movementX, e.movementY)/40);
  tiltX = (e.tiltX||0)/90;
  tiltY = (e.tiltY||0)/90;
  if(!e.pressure) { // simulate
    pressure = Math.min(1, Math.hypot(e.movementX||0, e.movementY||0)/30);
    tiltX = (px-0.5)*1.6;
    tiltY = (py-0.5)*1.6;
  }
  pressEl.textContent = pressure.toFixed(2);
  pointerDown = true;
}
cv.addEventListener('pointermove', onPointer);
cv.addEventListener('pointerdown', e => { pointerDown=true; onPointer(e); });
addEventListener('pointerup', () => { pointerDown=false; pressure*=0.9; });

addEventListener('deviceorientation', e => {
  if(e.beta!=null) beta = e.beta/90;
  if(e.gamma!=null) gamma = e.gamma/90;
});

// Physics & update
function step(){
  // Agents update fitness and influence
  agents.forEach(a => a.fitness *= 0.98);
  cards.forEach(c => {
    // Find strongest agent influence
    let best = -1, bestInf = 0;
    agents.forEach((a,i) => {
      const dx = c.x - a.coreX, dy = c.y - a.coreY;
      const d = Math.hypot(dx,dy)+0.01;
      const inf = 1/(d*d);
      if(inf > bestInf){ bestInf=inf; best=i; }
    });
    c.owner = best;
    const a = agents[best];
    const inp = [pressure, tiltX, tiltY, beta*0.5 + gamma*0.5];
    const out = mlpForward(a.w, inp);
    const tx = a.coreX + out[0]*0.25;
    const ty = a.coreY + out[1]*0.25;
    const k = 0.08 + Math.abs(out[2])*0.12;
    const damp = 0.85;
    c.vx += (tx - c.x)*k;
    c.vy += (ty - c.y)*k;
    c.vx *= damp; c.vy *= damp;
    c.x += c.vx; c.y += c.vy;
    // bounds
    if(c.x<0.05){ c.x=0.05; c.vx*=-0.5; }
    if(c.x>0.95){ c.x=0.95; c.vx*=-0.5; }
    if(c.y<0.08){ c.y=0.08; c.vy*=-0.5; }
    if(c.y>0.95){ c.y=0.95; c.vy*=-0.5; }
    // dwell
    const err = Math.hypot(c.x-tx, c.y-ty);
    if(err < 0.06 && pressure > 0.2) c.dwell += 1;
    else c.dwell *= 0.95;
    a.fitness += (1-err) * 0.01 + c.dwell * 0.0005;
    // visual
    c.el.style.transform = `translate(${c.x*innerWidth-36}px, ${c.y*innerHeight-24}px)`;
    c.el.style.borderColor = a.color;
    c.el.classList.toggle('claimed', c.dwell > 20);
  });
  // mutual soft collision
  for(let i=0;i<cards.length;i++){
    for(let j=i+1;j<cards.length;j++){
      const a=cards[i], b=cards[j];
      const dx=a.x-b.x, dy=a.y-b.y;
      const d=Math.hypot(dx,dy);
      if(d<0.08 && d>0){
        const f = (0.08-d)*0.4;
        a.vx += dx/d * f; a.vy += dy/d * f;
        b.vx -= dx/d * f; b.vy -= dy/d * f;
      }
    }
  }
  // best fitness
  const bf = Math.max(...agents.map(a=>a.fitness));
  bestFitEl.textContent = bf.toFixed(2);
  // heatmap
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0,0,cv.width,cv.height);
  const g = ctx.createRadialGradient(px*cv.width, py*cv.height, 0, px*cv.width, py*cv.height, 180);
  g.addColorStop(0, `rgba(68,170,255,${pressure*0.4})`);
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,cv.width,cv.height);
  // cores
  agents.forEach(a => {
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.arc(a.coreX*cv.width, a.coreY*cv.height, 8, 0, Math.PI*2);
    ctx.fill();
  });
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// Gene token drag-drop transfer
token.addEventListener('dragstart', e => {
  e.dataTransfer.setData('text/plain', 'gene');
  e.dataTransfer.effectAllowed = 'copy';
});
stage.addEventListener('dragover', e => e.preventDefault());
stage.addEventListener('drop', e => {
  e.preventDefault();
  const idx = +e.target.dataset.idx;
  if(isNaN(idx) || !cards[idx]) return;
  const owner = cards[idx].owner;
  if(owner < 0) return;
  // transfer from best to this owner
  const best = agents.reduce((b,a)=> a.fitness>b.fitness?a:b, agents[0]);
  if(best.id === owner) { msg.textContent = 'Already best agent'; return; }
  agents[owner].w = mutate(best.w, 0.2);
  agents[owner].fitness = best.fitness * 0.6;
  msg.textContent = `Genome transferred ${best.id} → ${owner} (mutated)`;
  setTimeout(()=> msg.textContent = 'Pointer or tilt the device. Drag gene token for transfer.', 2200);
});

// Seal / restore
const DB = 'f501-sculptor';
async function seal(){
  const data = {
    agents: agents.map(a => ({w: Array.from(a.w), fitness:a.fitness, coreX:a.coreX, coreY:a.coreY})),
    cards: cards.map(c => ({x:c.x,y:c.y,owner:c.owner,dwell:c.dwell})),
    t: Date.now()
  };
  try {
    const db = await new Promise((res,rej)=>{
      const r = indexedDB.open(DB,1);
      r.onupgradeneeded = () => r.result.createObjectStore('seal');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('seal','readwrite');
    tx.objectStore('seal').put(data, 'latest');
    await new Promise(r => tx.oncomplete = r);
    msg.textContent = 'Sealed to IndexedDB';
  } catch(e){
    localStorage.setItem(DB, JSON.stringify(data));
    msg.textContent = 'Sealed to localStorage';
  }
  setTimeout(()=> msg.textContent = 'Pointer or tilt the device. Drag gene token for transfer.', 1800);
}
async function restore(){
  try {
    const db = await new Promise((res,rej)=>{
      const r = indexedDB.open(DB,1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('seal','readonly');
    const req = tx.objectStore('seal').get('latest');
    const data = await new Promise(r => req.onsuccess = () => r(req.result));
    if(!data) throw new Error('none');
    applySeal(data);
    msg.textContent = 'Restored from IndexedDB';
  } catch(e){
    const s = localStorage.getItem(DB);
    if(s){ applySeal(JSON.parse(s)); msg.textContent = 'Restored from localStorage'; }
    else msg.textContent = 'No seal found';
  }
  setTimeout(()=> msg.textContent = 'Pointer or tilt the device. Drag gene token for transfer.', 1800);
}
function applySeal(data){
  data.agents.forEach((ad,i) => {
    if(agents[i]){
      agents[i].w = new Float32Array(ad.w);
      agents[i].fitness = ad.fitness;
      agents[i].coreX = ad.coreX;
      agents[i].coreY = ad.coreY;
    }
  });
  data.cards.forEach((cd,i) => {
    if(cards[i]){
      cards[i].x = cd.x; cards[i].y = cd.y;
      cards[i].owner = cd.owner; cards[i].dwell = cd.dwell;
    }
  });
}
document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.getElementById('add').onclick = () => addCard(px, py);
document.getElementById('reset').onclick = () => {
  agents.forEach(a => { a.w = randomWeights(); a.fitness=0; });
  cards.forEach(c => { c.x=rand(0.1,0.9); c.y=rand(0.1,0.9); c.dwell=0; });
  msg.textContent = 'Reset';
};

// position token
token.style.left = '12px';
token.style.bottom = '60px';
