const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 72;
const leaders = [];
const boids = [];
let mlp = { w1: Array(12).fill(0).map(()=>Math.random()*0.4-0.2), w2: Array(8).fill(0).map(()=>Math.random()*0.4-0.2), fitness:0 };
let orient = { beta:0, gamma:0 };
let pointer = { x:W/2, y:H/2, vx:0, vy:0 };
let bestFitness = -1;

function rand(a,b){ return a + Math.random()*(b-a); }

for(let i=0;i<4;i++){
  const el = document.createElement('div');
  el.className = 'leader';
  el.textContent = 'L'+(i+1);
  el.style.left = rand(80,W-150)+'px';
  el.style.top = rand(80,H-150)+'px';
  document.body.appendChild(el);
  leaders.push({ el, x:parseFloat(el.style.left), y:parseFloat(el.style.top), vx:0, vy:0 });
  el.addEventListener('pointerdown', e => { el.classList.add('grabbed'); el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => {
    if(!el.classList.contains('grabbed')) return;
    const l = leaders[i];
    l.x = e.clientX - 35; l.y = e.clientY - 25;
    el.style.left = l.x+'px'; el.style.top = l.y+'px';
    mlp.fitness += 0.5;
  });
  el.addEventListener('pointerup', () => el.classList.remove('grabbed'));
}

for(let i=0;i<N;i++){
  boids.push({ x:rand(0,W), y:rand(0,H), vx:rand(-1,1), vy:rand(-1,1) });
}

function mlpForward(inputs){
  const h = [0,0,0,0];
  for(let i=0;i<4;i++) for(let j=0;j<4;j++) h[i] += inputs[j] * mlp.w1[i*4+j];
  for(let i=0;i<4;i++) h[i] = Math.tanh(h[i]);
  const o = [0,0,0,0];
  for(let i=0;i<4;i++) for(let j=0;j<4;j++) o[i] += h[j] * mlp.w2[i*4+j];
  return o.map(v => 0.5 + Math.tanh(v)*0.5);
}

addEventListener('deviceorientation', e => { orient.beta = e.beta||0; orient.gamma = e.gamma||0; });
addEventListener('pointermove', e => {
  pointer.vx = e.clientX - pointer.x; pointer.vy = e.clientY - pointer.y;
  pointer.x = e.clientX; pointer.y = e.clientY;
});

function step(){
  const inputs = [
    orient.beta/90, orient.gamma/90,
    Math.tanh(pointer.vx/20), Math.tanh(pointer.vy/20)
  ];
  const [sepW, alignW, cohW, damp] = mlpForward(inputs);

  for(let b of boids){
    let sx=0,sy=0, ax=0,ay=0, cx=0,cy=0, n=0;
    for(let o of boids){
      if(o===b) continue;
      const dx=o.x-b.x, dy=o.y-b.y, d2=dx*dx+dy*dy;
      if(d2<1600 && d2>1){
        sx -= dx/Math.sqrt(d2); sy -= dy/Math.sqrt(d2);
        ax += o.vx; ay += o.vy;
        cx += o.x; cy += o.y; n++;
      }
    }
    if(n){ ax/=n; ay/=n; cx/=n; cy/=n; }
    let lx=0,ly=0;
    for(let l of leaders){
      const dx=l.x+35-b.x, dy=l.y+25-b.y, d=Math.hypot(dx,dy);
      if(d<180){ lx += dx/d; ly += dy/d; }
    }
    b.vx += sepW*sx*0.05 + alignW*(ax-b.vx)*0.02 + cohW*(cx-b.x)*0.001 + lx*0.03;
    b.vy += sepW*sy*0.05 + alignW*(ay-b.vy)*0.02 + cohW*(cy-b.y)*0.001 + ly*0.03;
    const spd = Math.hypot(b.vx,b.vy);
    if(spd>3){ b.vx*=3/spd; b.vy*=3/spd; }
    b.vx *= (1-damp*0.05); b.vy *= (1-damp*0.05);
    b.x += b.vx; b.y += b.vy;
    if(b.x<0||b.x>W) b.vx*=-1; if(b.y<0||b.y>H) b.vy*=-1;
  }

  ctx.fillStyle = 'rgba(10,12,18,0.25)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#8cf';
  for(let b of boids){
    ctx.beginPath(); ctx.arc(b.x,b.y,2.2,0,Math.PI*2); ctx.fill();
  }
  document.getElementById('status').textContent = `fitness: ${mlp.fitness.toFixed(1)} | sep:${sepW.toFixed(2)}`;
  requestAnimationFrame(step);
}
step();

document.getElementById('seal').onclick = async () => {
  if(mlp.fitness > bestFitness){
    bestFitness = mlp.fitness;
    try {
      const db = await new Promise((res,rej)=>{ const r=indexedDB.open('verse-f855',1); r.onupgradeneeded=e=>e.target.result.createObjectStore('g'); r.onsuccess=e=>res(e.target.result); r.onerror=rej; });
      const tx = db.transaction('g','readwrite');
      tx.objectStore('g').put({ mlp, fitness:mlp.fitness }, 'best');
    } catch (e) { console.debug("lab f855-webgpu-boids-mlp-leader-dom-mind:", e); }
    try { new BroadcastChannel('f855-genome').postMessage({ mlp, fitness:mlp.fitness }); } catch (e) { console.debug("lab f855-webgpu-boids-mlp-leader-dom-mind:", e); }
    document.getElementById('status').textContent = 'Sealed! fitness '+mlp.fitness.toFixed(1);
  }
};
document.getElementById('reset').onclick = () => { mlp.fitness=0; for(let b of boids){ b.x=rand(0,W); b.y=rand(0,H); } };

try {
  new BroadcastChannel('f855-genome').onmessage = e => {
    if(e.data.fitness > mlp.fitness){ mlp = e.data.mlp; document.getElementById('status').textContent = 'Adopted better genome'; }
  };
} catch (e) { console.debug("lab f855-webgpu-boids-mlp-leader-dom-mind:", e); }
