const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 160;
const boids = [];
const portals = [];
let mlp = { w1: [], b1: [], w2: [], b2: [] }; // 6→8→4
let fitness = 0;
let pointer = { x: W/2, y: H/2, px: W/2, py: H/2 };
let residual = { x: 0, y: 0, mag: 0 };
let tilt = { beta: 0, gamma: 0 };
let oriEnabled = false;

function rand(a,b){ return a + Math.random()*(b-a); }
function initMLP() {
  mlp.w1 = Array.from({length:8}, () => Array.from({length:6}, () => rand(-0.5,0.5)));
  mlp.b1 = Array.from({length:8}, () => rand(-0.1,0.1));
  mlp.w2 = Array.from({length:4}, () => Array.from({length:8}, () => rand(-0.5,0.5)));
  mlp.b2 = Array.from({length:4}, () => rand(-0.1,0.1));
}
function forward(inputs) {
  const h = mlp.b1.map((b,i) => Math.tanh(mlp.w1[i].reduce((s,w,j)=>s+w*inputs[j], b)));
  return mlp.b2.map((b,i) => Math.tanh(mlp.w2[i].reduce((s,w,j)=>s+w*h[j], b)));
}
function mutate() {
  const rate = 0.08;
  for (let i=0;i<mlp.w1.length;i++) for (let j=0;j<mlp.w1[i].length;j++) mlp.w1[i][j] += rand(-rate,rate);
  for (let i=0;i<mlp.w2.length;i++) for (let j=0;j<mlp.w2[i].length;j++) mlp.w2[i][j] += rand(-rate,rate);
}

function initBoids() {
  boids.length = 0;
  for (let i=0;i<N;i++) {
    boids.push({
      x: rand(0,W), y: rand(0,H),
      vx: rand(-2,2), vy: rand(-2,2),
      color: `hsl(${rand(180,240)},80%,60%)`
    });
  }
}
function initPortals() {
  document.querySelectorAll('.portal').forEach(p => p.remove());
  portals.length = 0;
  for (let i=0;i<5;i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = 'Leader '+(i+1);
    el.style.left = rand(100,W-100)+'px';
    el.style.top = rand(100,H-100)+'px';
    document.body.appendChild(el);
    const p = { el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx:0, vy:0 };
    portals.push(p);
    makeDraggable(el, p);
    el.addEventListener('click', () => { fitness++; mutate(); document.getElementById('fitness').textContent = 'Fitness: '+fitness; });
  }
}
function makeDraggable(el, p) {
  let dragging = false, ox=0, oy=0;
  el.addEventListener('pointerdown', e => { dragging=true; ox=e.clientX-p.x; oy=e.clientY-p.y; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (!dragging) return; p.x = e.clientX-ox; p.y = e.clientY-oy; el.style.left=p.x+'px'; el.style.top=p.y+'px'; });
  el.addEventListener('pointerup', () => dragging=false);
}

function updateBoids() {
  const inputs = [residual.x, residual.y, residual.mag, tilt.beta/90, tilt.gamma/90, portals.length/5];
  const out = forward(inputs);
  const sepW = 1.2 + out[0]*0.8;
  const alignW = 0.8 + out[1]*0.6;
  const cohW = 0.6 + out[2]*0.5;
  const bias = out[3]*0.4;

  const sepR=25, alignR=50, cohR=60, maxSpd=3.5, maxF=0.15;

  for (let i=0;i<boids.length;i++) {
    const b = boids[i];
    let sepX=0,sepY=0, alignX=0,alignY=0, cohX=0,cohY=0, countS=0,countA=0,countC=0;

    for (let j=0;j<boids.length;j++) if (i!==j) {
      const o = boids[j];
      const dx=b.x-o.x, dy=b.y-o.y, d=Math.hypot(dx,dy);
      if (d<sepR && d>0) { sepX+=dx/d; sepY+=dy/d; countS++; }
      if (d<alignR) { alignX+=o.vx; alignY+=o.vy; countA++; }
      if (d<cohR) { cohX+=o.x; cohY+=o.y; countC++; }
    }
    if (countS) { sepX/=countS; sepY/=countS; }
    if (countA) { alignX/=countA; alignY/=countA; alignX-=b.vx; alignY-=b.vy; }
    if (countC) { cohX/=countC; cohY/=countC; cohX-=b.x; cohY-=b.y; }

    // leader attraction
    let leadX=0, leadY=0;
    portals.forEach(p => {
      const dx=p.x-b.x, dy=p.y-b.y, d=Math.hypot(dx,dy);
      if (d<120) { leadX += dx/(d+1); leadY += dy/(d+1); }
    });

    let fx = sepX*sepW + alignX*alignW + cohX*cohW + leadX*0.8 + bias*tilt.gamma/30;
    let fy = sepY*sepW + alignY*alignW + cohY*cohW + leadY*0.8 + bias*tilt.beta/30;
    const fmag = Math.hypot(fx,fy);
    if (fmag>maxF) { fx*=maxF/fmag; fy*=maxF/fmag; }

    b.vx += fx; b.vy += fy;
    const spd = Math.hypot(b.vx,b.vy);
    if (spd>maxSpd) { b.vx*=maxSpd/spd; b.vy*=maxSpd/spd; }
    b.x += b.vx; b.y += b.vy;

    if (b.x<0) b.x=W; if (b.x>W) b.x=0;
    if (b.y<0) b.y=H; if (b.y>H) b.y=0;
  }
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  boids.forEach(b => {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.2, 0, Math.PI*2);
    ctx.fill();
    // velocity hint
    ctx.strokeStyle = b.color;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x+b.vx*3, b.y+b.vy*3);
    ctx.stroke();
  });
}

function loop() {
  // residual
  const predX = pointer.px + (pointer.x - pointer.px)*0.5;
  const predY = pointer.py + (pointer.y - pointer.py)*0.5;
  residual.x = (pointer.x - predX)/W;
  residual.y = (pointer.y - predY)/H;
  residual.mag = Math.hypot(residual.x, residual.y);
  pointer.px = pointer.x; pointer.py = pointer.y;

  updateBoids();
  draw();
  requestAnimationFrame(loop);
}

// events
canvas.addEventListener('pointermove', e => { pointer.x=e.clientX; pointer.y=e.clientY; });
document.getElementById('oriBtn').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => { if (p==='granted') oriEnabled=true; }).catch(()=>{});
  } else oriEnabled=true;
};
window.addEventListener('deviceorientation', e => {
  if (!oriEnabled) return;
  tilt.beta = e.beta || 0;
  tilt.gamma = e.gamma || 0;
});
document.getElementById('sealBtn').onclick = async () => {
  const data = { mlp, fitness, portals: portals.map(p=>({x:p.x,y:p.y})), ts: Date.now() };
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f690',1);
      r.onupgradeneeded = () => r.result.createObjectStore('seal');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seal','readwrite');
    tx.objectStore('seal').put(data, 'genome');
    await new Promise(r => tx.oncomplete=r);
    const bc = new BroadcastChannel('verse-f690');
    bc.postMessage(data);
    document.getElementById('status').textContent = 'Sealed to IndexedDB + BroadcastChannel';
  } catch(e) { document.getElementById('status').textContent = 'Seal failed (private mode?) — session only'; }
};
document.getElementById('resetBtn').onclick = () => { initMLP(); initBoids(); fitness=0; document.getElementById('fitness').textContent='Fitness: 0'; };

async function loadSeal() {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f690',1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seal','readonly');
    const req = tx.objectStore('seal').get('genome');
    const data = await new Promise(r => req.onsuccess=()=>r(req.result));
    if (data && data.mlp) { mlp=data.mlp; fitness=data.fitness||0; document.getElementById('fitness').textContent='Fitness: '+fitness; }
  } catch (e) { console.debug("lab f690-webgpu-boids-flocking-causal-mlp-portal-mind:", e); }
}

initMLP();
initBoids();
initPortals();
loadSeal().then(() => loop());
