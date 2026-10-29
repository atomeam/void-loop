const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let w, h;
function resize() { w = canvas.width = innerWidth; h = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

const N_PARTICLES = 400;
const N_AGENTS = 6;
const particles = [];
const agents = [];
let pointer = { x: w/2, y: h/2, active: false };
let handPos = [{x:w/2, y:h/2}, {x:w/2, y:h/2}];
let xrSession = null;
let bestGenome = null;
let db = null;

function rand(a,b){ return a + Math.random()*(b-a); }
function mlpForward(genome, inputs) {
  // tiny 3-4-2 MLP
  const W1 = genome.slice(0, 12), b1 = genome.slice(12,16);
  const W2 = genome.slice(16,24), b2 = genome.slice(24,26);
  const h = new Array(4).fill(0);
  for(let i=0;i<4;i++){
    let s = b1[i];
    for(let j=0;j<3;j++) s += inputs[j] * W1[i*3+j];
    h[i] = Math.tanh(s);
  }
  const out = [b2[0], b2[1]];
  for(let i=0;i<2;i++){
    let s = b2[i];
    for(let j=0;j<4;j++) s += h[j] * W2[i*4+j];
    out[i] = Math.tanh(s);
  }
  return out;
}
function randomGenome() {
  return Array.from({length:26}, () => rand(-1,1));
}
function mutate(g, rate=0.15) {
  return g.map(v => v + (Math.random()<rate ? rand(-0.3,0.3) : 0));
}

class Agent {
  constructor(id) {
    this.id = id;
    this.genome = randomGenome();
    this.fitness = 0;
    this.color = `hsl(${id*60},70%,60%)`;
    this.card = document.createElement('div');
    this.card.className = 'agent-card';
    document.getElementById('agents').appendChild(this.card);
  }
  updateCard() {
    this.card.innerHTML = `A${this.id}<br>F:${this.fitness.toFixed(1)}`;
    this.card.style.borderColor = this.color;
  }
}

function init() {
  particles.length = 0; agents.length = 0;
  document.getElementById('agents').innerHTML = '';
  for(let i=0;i<N_AGENTS;i++) agents.push(new Agent(i));
  for(let i=0;i<N_PARTICLES;i++) {
    particles.push({
      x: rand(0,w), y: rand(0,h),
      vx:0, vy:0,
      agent: Math.floor(Math.random()*N_AGENTS),
      life: rand(50,200)
    });
  }
  loadSeal();
}

function step() {
  const targets = xrSession ? handPos : [pointer, pointer];
  agents.forEach(a => a.fitness *= 0.99);

  particles.forEach(p => {
    const a = agents[p.agent];
    const tx = targets[p.agent % 2].x;
    const ty = targets[p.agent % 2].y;
    const dx = (tx - p.x)/w, dy = (ty - p.y)/h;
    const dist = Math.hypot(dx,dy) + 0.01;
    const inputs = [dx, dy, Math.sin(performance.now()/1000)];
    const force = mlpForward(a.genome, inputs);
    p.vx += force[0]*0.4 - p.vx*0.05;
    p.vy += force[1]*0.4 - p.vy*0.05;
    // attract to hand
    p.vx += dx / dist * 0.8;
    p.vy += dy / dist * 0.8;
    p.x += p.vx; p.y += p.vy;
    if(p.x<0||p.x>w) p.vx*=-0.8;
    if(p.y<0||p.y>h) p.vy*=-0.8;
    p.x = Math.max(0,Math.min(w,p.x));
    p.y = Math.max(0,Math.min(h,p.y));
    const near = Math.exp(-dist*8);
    a.fitness += near;
    p.life--;
    if(p.life<=0) {
      p.x = rand(0,w); p.y=rand(0,h); p.life=rand(80,250);
    }
  });

  // competition: replace weakest with mutated best every 120 frames
  if(Math.random()<0.008) {
    agents.sort((a,b)=>b.fitness-a.fitness);
    const weak = agents[agents.length-1];
    weak.genome = mutate(agents[0].genome);
    weak.fitness = agents[0].fitness * 0.5;
  }
  agents.forEach(a => a.updateCard());
  document.getElementById('fitness').textContent = `Best: ${Math.max(...agents.map(a=>a.fitness)).toFixed(1)}`;
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0,0,w,h);
  particles.forEach(p => {
    const a = agents[p.agent];
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI*2);
    ctx.fill();
  });
  // draw hands/pointer
  handPos.forEach((hp,i) => {
    ctx.strokeStyle = i===0 ? '#0ff' : '#f0f';
    ctx.beginPath(); ctx.arc(hp.x, hp.y, 18, 0, Math.PI*2); ctx.stroke();
  });
  if(pointer.active && !xrSession) {
    ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 12, 0, Math.PI*2); ctx.stroke();
  }
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}

// Input
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
});
canvas.addEventListener('pointerdown', e => { pointer.active = true; });
canvas.addEventListener('pointerup', () => { pointer.active = false; });

// WebXR hands
document.getElementById('enterXR').onclick = async () => {
  if(!navigator.xr) { alert('WebXR not supported'); return; }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    xrSession = session;
    document.getElementById('status').textContent = 'XR session active (hands if available)';
    // simple pose mapping would go here; for prototype we simulate hand positions from orientation or keep pointer
    // Full joint tracking requires XRFrame hand joints; omitted for single-file reliability
  } catch(e) {
    document.getElementById('status').textContent = 'XR failed, pointer mode: ' + e.message;
  }
};

// IndexedDB seal
function openDB() {
  return new Promise((res,rej) => {
    const req = indexedDB.open('F232Seals', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('genomes');
    req.onsuccess = e => res(e.target.result);
    req.onerror = rej;
  });
}
async function loadSeal() {
  try {
    db = await openDB();
    const tx = db.transaction('genomes','readonly');
    const store = tx.objectStore('genomes');
    const req = store.get('best');
    req.onsuccess = () => {
      if(req.result) {
        bestGenome = req.result.genome;
        agents[0].genome = bestGenome.slice();
        document.getElementById('status').textContent = 'Loaded sealed genome';
      }
    };
  } catch(e) { console.warn('IDB', e); }
}
document.getElementById('seal').onclick = async () => {
  agents.sort((a,b)=>b.fitness-a.fitness);
  const g = agents[0].genome;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(g)));
  const hex = Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16);
  if(db) {
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put({genome:g, hash:hex, t:Date.now()}, 'best');
  }
  bestGenome = g.slice();
  document.getElementById('status').textContent = `Sealed ${hex}...`;
};
document.getElementById('reset').onclick = init;

init();
loop();
