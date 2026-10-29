const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const ui = document.getElementById('ui');
const status = document.getElementById('status');
let W, H;
function resize(){ W=canvas.width=innerWidth; H=canvas.height=innerHeight; }
resize(); addEventListener('resize', resize);

const N_AGENTS = 4;
const PARTICLES_PER = 80;
const TOTAL = N_AGENTS * PARTICLES_PER;
let tiltX = 0, tiltY = 0;
let genomes = []; // each: Float32Array of weights for MLP 5->6->2
let fitness = new Array(N_AGENTS).fill(0);
let particles = { x:new Float32Array(TOTAL), y:new Float32Array(TOTAL), vx:new Float32Array(TOTAL), vy:new Float32Array(TOTAL), agent:new Uint8Array(TOTAL) };
let energyWells = [];
let frame = 0;
let hasWebGPU = false;
let sealed = [];

// Tiny MLP: inputs [relEnergyX, relEnergyY, tiltX, tiltY, speed] -> [fx, fy]
function makeGenome() {
  const w1 = 5*6, w2=6*2, b1=6, b2=2;
  const g = new Float32Array(w1+w2+b1+b2);
  for(let i=0;i<g.length;i++) g[i] = (Math.random()-0.5)*0.8;
  return g;
}
function mlp(genome, inp) {
  // hidden
  const h = new Float32Array(6);
  let o1=0, o2=5*6, b1=o2+6*2, b2=b1+6;
  for(let i=0;i<6;i++){
    let s = genome[b1+i];
    for(let j=0;j<5;j++) s += inp[j]*genome[o1 + i*5 + j];
    h[i] = Math.tanh(s);
  }
  const out = [genome[b2], genome[b2+1]];
  for(let i=0;i<2;i++){
    let s = out[i];
    for(let j=0;j<6;j++) s += h[j]*genome[o2 + i*6 + j];
    out[i] = Math.tanh(s);
  }
  return out;
}
function mutate(g, rate=0.15) {
  const ng = g.slice();
  for(let i=0;i<ng.length;i++) if(Math.random()<0.3) ng[i] += (Math.random()-0.5)*rate;
  return ng;
}

function init() {
  for(let a=0;a<N_AGENTS;a++) genomes.push(makeGenome());
  for(let i=0;i<TOTAL;i++){
    const a = i % N_AGENTS;
    particles.agent[i] = a;
    particles.x[i] = Math.random()*W;
    particles.y[i] = Math.random()*H;
    particles.vx[i] = (Math.random()-0.5)*2;
    particles.vy[i] = (Math.random()-0.5)*2;
  }
  // energy wells
  for(let k=0;k<3;k++) energyWells.push({x:Math.random()*W, y:Math.random()*H, life:999});
  // UI badges
  for(let a=0;a<N_AGENTS;a++){
    const d = document.createElement('div');
    d.className = 'badge';
    d.id = 'b'+a;
    d.innerHTML = `Agent ${a}: <span>0</span> <button data-a="${a}">Seal</button>`;
    ui.appendChild(d);
  }
  document.querySelectorAll('button[data-a]').forEach(b=>b.onclick = e => seal(+e.target.dataset.a));
  // orientation
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    const btn = document.createElement('button');
    btn.textContent = 'Enable Orientation';
    btn.style.pointerEvents='auto';
    btn.onclick = async () => {
      try { await DeviceOrientationEvent.requestPermission(); window.addEventListener('deviceorientation', onOrient); btn.remove(); }
      catch(e){ status.textContent = 'Orientation denied'; }
    };
    ui.appendChild(btn);
  } else {
    window.addEventListener('deviceorientation', onOrient);
  }
  // WebGPU detect
  if (navigator.gpu) navigator.gpu.requestAdapter().then(a => { hasWebGPU = !!a; status.textContent += ' | WebGPU: '+(hasWebGPU?'yes (CPU path active)':'no'); });
  // IndexedDB
  openDB();
}
function onOrient(e){
  tiltX = (e.gamma||0)/45; // -1..1 approx
  tiltY = (e.beta||0)/45;
}
let db;
function openDB(){
  const req = indexedDB.open('f251',1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('seals', {keyPath:'id', autoIncrement:true});
  req.onsuccess = e => { db = e.target.result; };
}
function seal(a){
  if(!db) return;
  const tx = db.transaction('seals','readwrite');
  tx.objectStore('seals').add({agent:a, genome:Array.from(genomes[a]), fitness:fitness[a], ts:Date.now()});
  status.textContent = `Sealed agent ${a} genome (fitness ${fitness[a].toFixed(1)})`;
}

function step(){
  frame++;
  // evolve every 300 frames
  if(frame % 300 === 0){
    let best=0; for(let a=1;a<N_AGENTS;a++) if(fitness[a]>fitness[best]) best=a;
    for(let a=0;a<N_AGENTS;a++) if(a!==best && fitness[a] < fitness[best]*0.6) genomes[a] = mutate(genomes[best]);
    fitness.fill(0);
  }
  // move energy wells slightly with tilt
  energyWells.forEach(w=>{
    w.x = (w.x + tiltX*0.8 + W) % W;
    w.y = (w.y + tiltY*0.8 + H) % H;
  });
  // update particles
  for(let i=0;i<TOTAL;i++){
    const a = particles.agent[i];
    // nearest energy
    let bestD=1e9, relx=0, rely=0;
    for(const w of energyWells){
      const dx=w.x-particles.x[i], dy=w.y-particles.y[i];
      const d=dx*dx+dy*dy;
      if(d<bestD){ bestD=d; relx=dx; rely=dy; }
    }
    const spd = Math.hypot(particles.vx[i], particles.vy[i]);
    const inp = [relx/200, rely/200, tiltX, tiltY, spd/10];
    const force = mlp(genomes[a], inp);
    // forces
    particles.vx[i] += force[0]*0.4 + tiltX*0.15;
    particles.vy[i] += force[1]*0.4 + tiltY*0.15;
    // attract to energy
    if(bestD<1e9){
      const d = Math.sqrt(bestD)+1;
      particles.vx[i] += (relx/d)*0.08;
      particles.vy[i] += (rely/d)*0.08;
      if(d<40) fitness[a] += 0.02;
    }
    // damping
    particles.vx[i] *= 0.96;
    particles.vy[i] *= 0.96;
    particles.x[i] += particles.vx[i];
    particles.y[i] += particles.vy[i];
    // walls
    if(particles.x[i]<0||particles.x[i]>W){ particles.vx[i]*=-0.8; particles.x[i]=Math.max(0,Math.min(W,particles.x[i])); }
    if(particles.y[i]<0||particles.y[i]>H){ particles.vy[i]*=-0.8; particles.y[i]=Math.max(0,Math.min(H,particles.y[i])); }
  }
  // update badges
  let maxF=0, champ=-1;
  for(let a=0;a<N_AGENTS;a++){
    if(fitness[a]>maxF){ maxF=fitness[a]; champ=a; }
    const el = document.getElementById('b'+a);
    if(el){
      el.querySelector('span').textContent = fitness[a].toFixed(1);
      el.classList.toggle('champ', a===champ);
    }
  }
}

function draw(){
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  // wells
  energyWells.forEach(w=>{
    ctx.beginPath();
    ctx.arc(w.x,w.y,18,0,Math.PI*2);
    ctx.fillStyle = 'rgba(255,200,50,0.6)';
    ctx.fill();
  });
  // particles
  const colors = ['#4af','#f4a','#4fa','#fa4'];
  for(let i=0;i<TOTAL;i++){
    ctx.fillStyle = colors[particles.agent[i]%4];
    ctx.fillRect(particles.x[i]-1.5, particles.y[i]-1.5, 3, 3);
  }
}

function loop(){
  step();
  draw();
  requestAnimationFrame(loop);
}
init();
loop();
