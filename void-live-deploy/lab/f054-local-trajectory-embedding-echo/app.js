const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const particles = Array.from({length: 140}, () => ({
  x: Math.random()*W, y: Math.random()*H,
  vx: 0, vy: 0
}));

let trajectory = [];
let lastX = 0, lastY = 0;
let orient = {roll:0, pitch:0};
let mind = {seeds: [[W/2,H/2],[W/2,H/2],[W/2,H/2]], residual: 0.5, conf: 0.5, id: 'none'};

addEventListener('pointermove', e => {
  if (trajectory.length > 64) trajectory.shift();
  trajectory.push([e.clientX - lastX, e.clientY - lastY, orient.roll, orient.pitch]);
  lastX = e.clientX; lastY = e.clientY;
});
addEventListener('deviceorientation', e => {
  orient.roll = (e.gamma || 0) / 90;
  orient.pitch = (e.beta || 0) / 180;
}, true);

const workerCode = `
let weights = Array.from({length: 16*8 + 8*4}, () => Math.random()*0.2-0.1);
let memory = [];
let nextId = 0;
function encode(traj) {
  const flat = new Array(16).fill(0);
  for (let i=0;i<Math.min(16,traj.length);i++) {
    for (let j=0;j<4;j++) flat[i] += (traj[i][j]||0) * 0.25;
  }
  const h = new Array(8).fill(0);
  for (let i=0;i<8;i++) {
    let s=0; for(let j=0;j<16;j++) s += flat[j]*weights[i*16+j];
    h[i] = Math.tanh(s);
  }
  const o = new Array(4).fill(0);
  for (let i=0;i<4;i++) {
    let s=0; for(let j=0;j<8;j++) s += h[j]*weights[16*8 + i*8 + j];
    o[i] = Math.tanh(s);
  }
  let n=0; for(let v of o) n+=v*v; n=Math.sqrt(n)||1;
  return o.map(v=>v/n);
}
function cosine(a,b){ let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; }
self.onmessage = e => {
  const {type, traj, weights: w, memory: m} = e.data;
  if (type==='load') { if(w) weights=w; if(m) memory=m; return; }
  if (!traj || traj.length < 4) return;
  const vec = encode(traj.slice(-16));
  let bestSim = -2, bestItem = null;
  for (const item of memory) {
    const sim = cosine(vec, item.vec);
    if (sim > bestSim) { bestSim=sim; bestItem=item; }
  }
  const residual = 1 - Math.max(0, bestSim);
  const conf = Math.max(0, bestSim);
  if (residual > 0.35 && memory.length < 32) {
    memory.push({vec, id: nextId++, path: traj.slice(-8)});
  }
  let seeds = [[0.5,0.5],[0.5,0.5],[0.5,0.5]];
  if (bestItem && bestItem.path) {
    const p = bestItem.path;
    seeds = [p[0]||[0,0], p[Math.floor(p.length/2)]||[0,0], p[p.length-1]||[0,0]].map(pt => [(pt[0]+1)/2, (pt[1]+1)/2]);
  }
  self.postMessage({seeds, residual, conf, id: bestItem?bestItem.id:'new', memory: memory.slice(-8), weights});
};
`;
const worker = new Worker(URL.createObjectURL(new Blob([workerCode])));
worker.onmessage = e => {
  mind = e.data;
  document.documentElement.style.setProperty('--echo-hue', (mind.conf * 180).toFixed(1));
  document.documentElement.style.setProperty('--echo-scale', (1 + mind.residual * 0.04).toFixed(3));
  document.documentElement.style.setProperty('--residual-blur', (mind.residual * 1.5).toFixed(2)+'px');
  document.getElementById('card0').textContent = 'match #' + mind.id + ' conf ' + mind.conf.toFixed(2);
  document.getElementById('card1').textContent = 'residual ' + mind.residual.toFixed(2);
  document.getElementById('card0').style.transform = `translate(${mind.residual*30}px, ${mind.conf*20}px)`;
  document.getElementById('card1').style.transform = `translate(${-mind.residual*20}px, ${-mind.conf*15}px)`;
};

setInterval(() => {
  if (trajectory.length > 8) worker.postMessage({type:'step', traj: trajectory.slice(-16)});
}, 200);

function step() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  const seeds = mind.seeds.map(s => [s[0]*W, s[1]*H]);
  for (const p of particles) {
    let ax=0, ay=0;
    for (const s of seeds) {
      const dx = s[0]-p.x, dy=s[1]-p.y;
      const d = Math.hypot(dx,dy)+1;
      ax += dx/d * 0.4 * mind.conf;
      ay += dy/d * 0.4 * mind.conf;
    }
    p.vx = (p.vx + ax)*0.92;
    p.vy = (p.vy + ay)*0.92;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>W) p.vx*=-0.5;
    if (p.y<0||p.y>H) p.vy*=-0.5;
    ctx.fillStyle = `hsla(${200 + mind.conf*80},70%,60%,${0.4+mind.conf*0.5})`;
    ctx.beginPath(); ctx.arc(p.x,p.y,1.8,0,6.28); ctx.fill();
  }
  requestAnimationFrame(step);
}
step();

const req = indexedDB.open('f054-echo',1);
req.onupgradeneeded = e => e.target.result.createObjectStore('seal');
document.getElementById('seal').onclick = () => {
  const db = req.result;
  const tx = db.transaction('seal','readwrite');
  tx.objectStore('seal').put({weights: mind.weights||[], memory: mind.memory||[], t: Date.now()}, 'latest');
  alert('Sealed ' + (mind.memory||[]).length + ' echoes');
};
req.onsuccess = () => {
  const db = req.result;
  const tx = db.transaction('seal','readonly');
  const g = tx.objectStore('seal').get('latest');
  g.onsuccess = () => {
    if (g.result) worker.postMessage({type:'load', weights: g.result.weights, memory: g.result.memory});
  };
};
