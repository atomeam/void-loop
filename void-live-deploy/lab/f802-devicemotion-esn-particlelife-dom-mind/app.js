const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const portalsEl = document.getElementById('portals');
const statusEl = document.getElementById('status');
let W=innerWidth, H=innerHeight;
canvas.width=W; canvas.height=H;

// --- ESN ---
const RES = 32;
let seed = Math.random()*1e6|0;
let Wres = new Float32Array(RES*RES);
let readout = new Float32Array(RES*6); // 3 species pairs
let reservoir = new Float32Array(RES);
function initReservoir(s){
  seed=s;
  let rng = ()=> (seed = (seed*16807)%2147483647)/2147483647;
  for(let i=0;i<RES*RES;i++) Wres[i]=(rng()*2-1)*0.3;
  // spectral radius rough scale
  for(let i=0;i<RES*6;i++) readout[i]=(rng()*2-1)*0.1;
  reservoir.fill(0);
}
initReservoir(seed);

function esnStep(input){ // input: [ax,ay,az] or vel
  for(let i=0;i<RES;i++){
    let sum=0;
    for(let j=0;j<RES;j++) sum+=Wres[i*RES+j]*reservoir[j];
    sum += input[0]*0.4 + input[1]*0.3 + input[2]*0.2;
    reservoir[i] = Math.tanh(sum);
  }
  // readout → 6 coeffs
  const out=new Float32Array(6);
  for(let k=0;k<6;k++){
    let s=0;
    for(let i=0;i<RES;i++) s+=readout[k*RES+i]*reservoir[i];
    out[k]=Math.tanh(s);
  }
  return out;
}

function lmsUpdate(reward){
  const lr=0.02*reward;
  for(let k=0;k<6;k++){
    for(let i=0;i<RES;i++) readout[k*RES+i] += lr * reservoir[i];
  }
}

// --- Particle Life ---
const NS=3, NP=70;
const particles=[];
const colors=['#ff6b6b','#4ecdc4','#ffe66d'];
for(let s=0;s<NS;s++) for(let i=0;i<NP;i++){
  particles.push({x:Math.random()*W, y:Math.random()*H, vx:0, vy:0, s});
}
let attract = [0.5,-0.3,0.1, -0.2,0.4,-0.1]; // default

function stepParticles(){
  for(let i=0;i<particles.length;i++){
    const p=particles[i];
    let fx=0,fy=0;
    for(let j=0;j<particles.length;j++) if(i!==j){
      const q=particles[j];
      const dx=q.x-p.x, dy=q.y-p.y;
      const d2=dx*dx+dy*dy+1;
      const d=Math.sqrt(d2);
      if(d>180) continue;
      const idx = p.s*NS + q.s;
      const a = attract[idx] || 0;
      const force = a * (1-d/120) / d;
      fx += dx*force; fy += dy*force;
    }
    p.vx = (p.vx+fx)*0.92; p.vy=(p.vy+fy)*0.92;
    p.x += p.vx; p.y += p.vy;
    if(p.x<0)p.x=W; if(p.x>W)p.x=0; if(p.y<0)p.y=H; if(p.y>H)p.y=0;
  }
}

// --- Portals ---
const portals=[];
for(let i=0;i<4;i++){
  const el=document.createElement('div');
  el.className='portal';
  el.style.setProperty('--hue', (i*90)%360);
  el.addEventListener('click',()=>{ lmsUpdate(1.2); statusEl.textContent='rewarded'; });
  portalsEl.appendChild(el);
  portals.push({el, x:Math.random()*W, y:Math.random()*H, s:i%3});
}

function updatePortals(){
  const dens=Array(NS).fill(0).map(()=>[]);
  particles.forEach(p=> dens[p.s].push(p));
  portals.forEach((por,idx)=>{
    const group=dens[por.s]||[];
    if(group.length){
      const cx=group.reduce((a,p)=>a+p.x,0)/group.length;
      const cy=group.reduce((a,p)=>a+p.y,0)/group.length;
      por.x = por.x*0.7 + cx*0.3; por.y=por.y*0.7+cy*0.3;
      const local=group.filter(p=>Math.hypot(p.x-por.x,p.y-por.y)<80).length;
      por.el.style.setProperty('--s', 0.6+local*0.15);
      por.el.style.setProperty('--r', (local*12)+'deg');
      por.el.style.setProperty('--hue', (por.s*120 + local*8)%360);
    }
    por.el.style.left=por.x+'px';
    por.el.style.top=por.y+'px';
  });
}

// --- Sensors ---
let motion=[0,0,0];
window.addEventListener('devicemotion',e=>{
  const a=e.accelerationIncludingGravity||e.acceleration;
  if(a) motion=[(a.x||0)/10,(a.y||0)/10,(a.z||0)/10];
});
let lastX=0,lastY=0;
window.addEventListener('pointermove',e=>{
  motion=[(e.clientX-lastX)/40, (e.clientY-lastY)/40, 0.1];
  lastX=e.clientX; lastY=e.clientY;
});

// --- Persistence ---
const dbName='f802-esn';
let db;
const req=indexedDB.open(dbName,1);
req.onupgradeneeded=e=>{ e.target.result.createObjectStore('genomes',{keyPath:'id'}); };
req.onsuccess=e=>{ db=e.target.result; loadGenome(); };
function saveGenome(){
  if(!db) return;
  const tx=db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put({id:'main', seed, readout:Array.from(readout), fitness:Date.now()});
  const ch=new BroadcastChannel('f802-genome');
  ch.postMessage({seed, readout:Array.from(readout)});
  statusEl.textContent='sealed';
}
function loadGenome(){
  if(!db) return;
  const tx=db.transaction('genomes','readonly');
  tx.objectStore('genomes').get('main').onsuccess=e=>{
    if(e.target.result){ seed=e.target.result.seed; readout.set(e.target.result.readout); initReservoir(seed); }
  };
}
const ch=new BroadcastChannel('f802-genome');
ch.onmessage=e=>{
  if(e.data.readout){ readout.set(e.data.readout); seed=e.data.seed; initReservoir(seed); statusEl.textContent='adopted'; }
};
document.getElementById('seal').onclick=saveGenome;
document.getElementById('reset').onclick=()=>{ initReservoir(Math.random()*1e6|0); statusEl.textContent='reset'; };

// --- Loop ---
function loop(){
  attract = Array.from(esnStep(motion));
  stepParticles();
  ctx.fillStyle='rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  particles.forEach(p=>{
    ctx.fillStyle=colors[p.s];
    ctx.beginPath(); ctx.arc(p.x,p.y,2.2,0,Math.PI*2); ctx.fill();
  });
  updatePortals();
  requestAnimationFrame(loop);
}
loop();
window.onresize=()=>{ W=innerWidth; H=innerHeight; canvas.width=W; canvas.height=H; };
statusEl.textContent='live';
