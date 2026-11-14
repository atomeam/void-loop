const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

class MLP {
  constructor() {
    this.w1 = Array.from({length:4}, () => Array.from({length:3}, () => Math.random()*0.4-0.2));
    this.b1 = Array(4).fill(0);
    this.w2 = Array.from({length:4}, () => Array.from({length:4}, () => Math.random()*0.4-0.2));
    this.b2 = Array(4).fill(0);
  }
  forward(x) {
    const h = this.w1.map((row,i) => Math.tanh(row.reduce((s,w,j)=>s+w*x[j], this.b1[i])));
    return this.w2.map((row,i) => row.reduce((s,w,j)=>s+w*h[j], this.b2[i]));
  }
  clone() {
    const m = new MLP();
    m.w1 = this.w1.map(r=>[...r]); m.b1=[...this.b1];
    m.w2 = this.w2.map(r=>[...r]); m.b2=[...this.b2];
    return m;
  }
}

class Agent {
  constructor(id, x, y) {
    this.id = id;
    this.mlp = new MLP();
    this.points = Array.from({length:6}, (_,i) => ({
      x: x + Math.cos(i)*30, y: y + Math.sin(i)*30,
      px: x + Math.cos(i)*30, py: y + Math.sin(i)*30,
      vx:0, vy:0
    }));
    this.constraints = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,3],[1,4],[2,5]];
    this.fitness = 0;
    this.stiffness = 0.8;
  }
  step(handX, handY) {
    const feats = [
      (handX - this.points[0].x)/200,
      (handY - this.points[0].y)/200,
      Math.hypot(handX-this.points[0].x, handY-this.points[0].y)/300
    ];
    const out = this.mlp.forward(feats);
    this.stiffness = 0.5 + Math.tanh(out[0])*0.4;
    const damp = 0.92 + Math.tanh(out[1])*0.05;
    this.points.forEach(p => {
      p.vx += (handX - p.x)*0.0002;
      p.vy += (handY - p.y)*0.0002;
      p.vx *= damp; p.vy *= damp;
      p.px = p.x; p.py = p.y;
      p.x += p.vx; p.y += p.vy;
    });
    for(let iter=0; iter<4; iter++) {
      this.constraints.forEach(([a,b]) => {
        const pa = this.points[a], pb = this.points[b];
        const dx = pb.x - pa.x, dy = pb.y - pa.y;
        const dist = Math.hypot(dx,dy) || 1;
        const diff = (dist - 40) / dist * this.stiffness * 0.5;
        pa.x += dx * diff; pa.y += dy * diff;
        pb.x -= dx * diff; pb.y -= dy * diff;
      });
    }
    const vel = this.points.reduce((s,p)=>s+Math.hypot(p.vx,p.vy),0);
    const prox = Math.hypot(handX - this.points[0].x, handY - this.points[0].y);
    this.fitness = this.fitness * 0.99 + (100/(1+vel) + 50/(1+prox/100));
  }
  draw(ctx) {
    ctx.strokeStyle = `hsl(${this.id*120},70%,60%)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.points.forEach((p,i) => i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    this.points.forEach(p => { ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2); ctx.fill(); });
  }
}

let agents = [];
let handX = innerWidth/2, handY = innerHeight/2;
let bestFitness = 0;

function initAgents() {
  agents = [
    new Agent(0, innerWidth*0.3, innerHeight*0.4),
    new Agent(1, innerWidth*0.5, innerHeight*0.6),
    new Agent(2, innerWidth*0.7, innerHeight*0.4)
  ];
}
initAgents();

canvas.addEventListener('pointermove', e => { handX = e.clientX; handY = e.clientY; });

let db;
const req = indexedDB.open('verse-f748', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', {keyPath:'id'});
req.onsuccess = e => { db = e.target.result; };

function sealBest() {
  const best = agents.reduce((a,b)=> a.fitness > b.fitness ? a : b);
  if (best.fitness > bestFitness) {
    bestFitness = best.fitness;
    if (db) {
      const tx = db.transaction('genomes','readwrite');
      tx.objectStore('genomes').put({id:'best', mlp: best.mlp, fitness: bestFitness, ts: Date.now()});
    }
    channel.postMessage({type:'sealed', mlp: best.mlp, fitness: bestFitness});
    status.textContent = `Sealed genome fitness ${bestFitness.toFixed(1)} and broadcast.`;
  } else status.textContent = 'Current not better than sealed.';
}

const channel = new BroadcastChannel('f748-sealed');
channel.onmessage = e => {
  if (e.data.type === 'sealed' && e.data.fitness > bestFitness) {
    bestFitness = e.data.fitness;
    const weak = agents.reduce((a,b)=>a.fitness < b.fitness ? a : b);
    weak.mlp = Object.assign(new MLP(), e.data.mlp);
    status.textContent = `Adopted remote sealed genome (fit ${bestFitness.toFixed(1)}).`;
  }
};

document.getElementById('seal').onclick = sealBest;
document.getElementById('reset').onclick = () => { initAgents(); status.textContent='Agents reset.'; };

document.getElementById('startXR').onclick = async () => {
  if (!navigator.xr) { status.textContent='WebXR not available; using mouse.'; return; }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', {optionalFeatures:['hand-tracking']});
    status.textContent='WebXR session started (hand tracking if supported).';
    session.end();
  } catch(err) { status.textContent='WebXR failed: '+err.message+'. Using mouse proxy.'; }
};

function loop() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(handX, handY, 8, 0, Math.PI*2); ctx.fill();
  ctx.fillText('Hand', handX+12, handY);
  agents.forEach(a => { a.step(handX, handY); a.draw(ctx); });
  agents.forEach(a => {
    ctx.fillStyle = '#aaa';
    ctx.fillText(`A${a.id} fit:${a.fitness.toFixed(0)} stiff:${a.stiffness.toFixed(2)}`, a.points[0].x, a.points[0].y-20);
  });
  requestAnimationFrame(loop);
}
loop();
