const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N_AGENTS = 4;
const PARTICLES_PER = 40;
const colors = ['#ff6b6b','#4ecdc4','#ffe66d','#a29bfe','#fd79a8','#00cec9'];
let agents = [];
let particles = [];
let pointer = {x: W/2, y: H/2, px: W/2, py: H/2};
let orient = {beta:0, gamma:0};
let bestGenome = null;
const channel = new BroadcastChannel('verse-f681');

function rand(a,b){ return a + Math.random()*(b-a); }
function sigmoid(x){ return 1/(1+Math.exp(-x)); }

function createMLP() {
  // 4-6-2: inputs residualX, residualY, beta, gamma → forceX, forceY
  const w1 = Array.from({length:4*6}, () => rand(-1,1));
  const b1 = Array.from({length:6}, () => rand(-0.5,0.5));
  const w2 = Array.from({length:6*2}, () => rand(-1,1));
  const b2 = Array.from({length:2}, () => rand(-0.5,0.5));
  return {w1,b1,w2,b2};
}
function mlpForward(m, inp) {
  const h = [];
  for(let i=0;i<6;i++) {
    let s = m.b1[i];
    for(let j=0;j<4;j++) s += inp[j]*m.w1[j*6+i];
    h[i] = sigmoid(s);
  }
  const o = [];
  for(let i=0;i<2;i++) {
    let s = m.b2[i];
    for(let j=0;j<6;j++) s += h[j]*m.w2[j*2+i];
    o[i] = Math.tanh(s);
  }
  return o;
}
function cloneGenome(g) {
  return {w1:g.w1.slice(), b1:g.b1.slice(), w2:g.w2.slice(), b2:g.b2.slice()};
}
function averageGenome(a,b, noise=0.05) {
  const g = cloneGenome(a);
  for(let i=0;i<g.w1.length;i++) g.w1[i] = (a.w1[i]+b.w1[i])/2 + rand(-noise,noise);
  for(let i=0;i<g.b1.length;i++) g.b1[i] = (a.b1[i]+b.b1[i])/2 + rand(-noise,noise);
  for(let i=0;i<g.w2.length;i++) g.w2[i] = (a.w2[i]+b.w2[i])/2 + rand(-noise,noise);
  for(let i=0;i<g.b2.length;i++) g.b2[i] = (a.b2[i]+b.b2[i])/2 + rand(-noise,noise);
  return g;
}

function initAgents() {
  agents = [];
  particles = [];
  for(let a=0; a<N_AGENTS; a++) {
    const genome = createMLP();
    agents.push({id:a, genome, fitness:1, color:colors[a%colors.length]});
    for(let p=0; p<PARTICLES_PER; p++) {
      particles.push({
        agent: a,
        x: rand(0,W), y: rand(0,H),
        vx: rand(-1,1), vy: rand(-1,1),
        life: 1
      });
    }
  }
}

function update() {
  // residual
  const predX = pointer.px + (pointer.x - pointer.px)*0.5;
  const predY = pointer.py + (pointer.y - pointer.py)*0.5;
  const resX = (pointer.x - predX)/W;
  const resY = (pointer.y - predY)/H;
  const inp = [resX*4, resY*4, orient.beta/90, orient.gamma/90];

  // agent forces
  const forces = agents.map(ag => mlpForward(ag.genome, inp));

  // particles
  for(const p of particles) {
    const f = forces[p.agent];
    p.vx += f[0]*0.15;
    p.vy += f[1]*0.15;
    p.vx *= 0.98; p.vy *= 0.98;
    p.x += p.vx; p.y += p.vy;
    if(p.x<0||p.x>W) p.vx*=-1;
    if(p.y<0||p.y>H) p.vy*=-1;
    p.x = Math.max(0,Math.min(W,p.x));
    p.y = Math.max(0,Math.min(H,p.y));
  }

  // collisions for genome transfer
  for(let i=0;i<particles.length;i++) {
    for(let j=i+1;j<particles.length;j++) {
      const a=particles[i], b=particles[j];
      if(a.agent === b.agent) continue;
      const dx=a.x-b.x, dy=a.y-b.y;
      const d2=dx*dx+dy*dy;
      if(d2 < 12*12) {
        const agA = agents[a.agent], agB = agents[b.agent];
        if(agA.fitness >= agB.fitness) {
          agB.genome = averageGenome(agA.genome, agB.genome, 0.08);
          agA.fitness += 0.1;
        } else {
          agA.genome = averageGenome(agB.genome, agA.genome, 0.08);
          agB.fitness += 0.1;
        }
        // separate a bit
        const d=Math.sqrt(d2)||1;
        a.vx += dx/d*0.5; b.vx -= dx/d*0.5;
        a.vy += dy/d*0.5; b.vy -= dy/d*0.5;
      }
    }
  }

  pointer.px = pointer.x; pointer.py = pointer.y;
}

function draw() {
  ctx.fillStyle = 'rgba(5,5,16,0.25)';
  ctx.fillRect(0,0,W,H);
  for(const p of particles) {
    ctx.fillStyle = agents[p.agent].color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI*2);
    ctx.fill();
  }
  // pointer
  ctx.strokeStyle = '#fff';
  ctx.beginPath();
  ctx.arc(pointer.x, pointer.y, 8, 0, Math.PI*2);
  ctx.stroke();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY;
});
canvas.addEventListener('pointerdown', e => {
  const x=e.clientX, y=e.clientY;
  let best=null, bd=30;
  for(const p of particles) {
    const d=Math.hypot(p.x-x, p.y-y);
    if(d<bd) { bd=d; best=p; }
  }
  if(best) {
    agents[best.agent].fitness += 1;
    document.getElementById('status').textContent = `Rewarded agent ${best.agent} (fitness ${agents[best.agent].fitness.toFixed(1)})`;
  }
});

document.getElementById('ori').onclick = () => {
  if(typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => {
      if(p==='granted') addEventListener('deviceorientation', onOri);
    });
  } else {
    addEventListener('deviceorientation', onOri);
  }
};
function onOri(e) {
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
}

document.getElementById('seal').onclick = async () => {
  const best = agents.reduce((a,b) => a.fitness > b.fitness ? a : b);
  bestGenome = cloneGenome(best.genome);
  const data = {genome: bestGenome, fitness: best.fitness, id: best.id, ts: Date.now()};
  try {
    const db = await idbOpen();
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put(data, 'best');
  } catch (e) { console.debug("lab f681-multiagent-collision-genome-particle-mind:", e); }
  channel.postMessage({type:'genome', data});
  document.getElementById('status').textContent = `Sealed agent ${best.id} fitness ${best.fitness.toFixed(1)}`;
};

document.getElementById('reset').onclick = () => { initAgents(); };

channel.onmessage = e => {
  if(e.data.type === 'genome' && e.data.data) {
    const g = e.data.data.genome;
    // apply to weakest
    const weak = agents.reduce((a,b) => a.fitness < b.fitness ? a : b);
    weak.genome = cloneGenome(g);
    weak.fitness = Math.max(weak.fitness, e.data.data.fitness * 0.5);
    document.getElementById('status').textContent = 'Received sealed genome from peer tab';
  }
};

function idbOpen() {
  return new Promise((res,rej) => {
    const r = indexedDB.open('verse-f681',1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function loadBest() {
  try {
    const db = await idbOpen();
    const tx = db.transaction('genomes');
    const req = tx.objectStore('genomes').get('best');
    req.onsuccess = () => {
      if(req.result) {
        bestGenome = req.result.genome;
        // seed one agent
        if(agents.length) agents[0].genome = cloneGenome(bestGenome);
      }
    };
  } catch (e) { console.debug("lab f681-multiagent-collision-genome-particle-mind:", e); }
}

initAgents();
loadBest();
loop();
