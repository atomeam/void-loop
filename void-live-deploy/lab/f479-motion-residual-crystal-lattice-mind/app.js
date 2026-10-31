const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = 64, H = 40;
let grid = new Float32Array(W*H);
let next = new Float32Array(W*H);
let residual = [0,0,0];
let entropy = 0.3;

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize(); addEventListener('resize', resize);

// Worker for residual predictors
const workerCode = `
let pop = [];
function rand() { return Math.random()*2-1; }
function makePred() {
  return { w: [rand(),rand(),rand()], b: [rand(),rand(),rand()], fit: 1 };
}
for(let i=0;i<8;i++) pop.push(makePred());
let best = pop[0];
self.onmessage = e => {
  if(e.data.type === 'observe') {
    const { vx,vy,vz, ax,ay,az } = e.data;
    let minRes = Infinity;
    pop.forEach(p => {
      const px = p.w[0]*vx + p.b[0];
      const py = p.w[1]*vy + p.b[1];
      const pz = p.w[2]*vz + p.b[2];
      const r = Math.hypot(px-ax, py-ay, pz-az);
      p.fit = r;
      if(r < minRes) { minRes = r; best = p; }
    });
    // evolve
    pop.sort((a,b)=>a.fit-b.fit);
    for(let i=4;i<8;i++) {
      const parent = pop[i%4];
      pop[i] = { w: parent.w.map(v=>v + (Math.random()-0.5)*0.2), b: parent.b.map(v=>v + (Math.random()-0.5)*0.2), fit:1 };
    }
    self.postMessage({ residual: [best.fit, best.w[0], best.w[1]], entropy: Math.random()*0.3 + best.fit*0.2 });
  }
};
`;
const blob = new Blob([workerCode], {type:'application/javascript'});
const worker = new Worker(URL.createObjectURL(blob));
worker.onmessage = e => {
  residual = e.data.residual || residual;
  entropy = e.data.entropy || entropy;
  document.documentElement.style.setProperty('--res', Math.min(1, residual[0]*2));
  document.documentElement.style.setProperty('--ent', entropy);
  document.getElementById('resv').textContent = residual[0].toFixed(2);
  document.getElementById('entv').textContent = entropy.toFixed(2);
};

let last = {x:0,y:0,z:0, t:0};
function onMotion(e) {
  const a = e.accelerationIncludingGravity || e.acceleration || {};
  const ax = a.x||0, ay=a.y||0, az=a.z||0;
  const now = performance.now();
  if(now - last.t > 50) {
    const vx = ax - last.x, vy = ay - last.y, vz = az - last.z;
    worker.postMessage({type:'observe', vx,vy,vz, ax,ay,az});
    last = {x:ax,y:ay,z:az,t:now};
  }
}
if(typeof DeviceMotionEvent !== 'undefined') {
  if(typeof DeviceMotionEvent.requestPermission === 'function') {
    document.body.addEventListener('click', () => DeviceMotionEvent.requestPermission().then(p => { if(p==='granted') addEventListener('devicemotion', onMotion); }), {once:true});
  } else addEventListener('devicemotion', onMotion);
}

// Crystal CA
function stepCA() {
  const rx = residual[1]||0, ry = residual[2]||0;
  for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++) {
    let sum=0, c=0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
      if(dx||dy) { sum += grid[(y+dy)*W + (x+dx)]; c++; }
    }
    const maj = sum / c;
    const bias = (rx * (x-W/2) + ry * (y-H/2)) * 0.01;
    let n = maj * 0.85 + bias + (Math.random()<0.002 ? 0.4 : 0);
    next[y*W+x] = Math.max(0, Math.min(1, n));
  }
  [grid, next] = [next, grid];
}

// Facets
const facets = [];
const fdiv = document.getElementById('facets');
for(let i=0;i<6;i++) {
  const el = document.createElement('div');
  el.className = 'facet';
  el.textContent = 'facet '+(i+1);
  el.style.left = (20+i*12)+'%';
  el.style.top = (30+ (i%2)*20)+'%';
  fdiv.appendChild(el);
  facets.push({el, x:0.2+i*0.12, y:0.3+(i%2)*0.2, g:0.3});
  el.addEventListener('pointerdown', e => { /* drag later */ });
}

function updateFacets() {
  facets.forEach(f => {
    const ix = Math.floor(f.x * W), iy = Math.floor(f.y * H);
    const g = grid[iy*W+ix] || 0;
    f.g = g;
    f.el.style.setProperty('--g', g);
    f.el.style.setProperty('--hue', g*120);
    f.el.style.transform = `translate(${(f.x*innerWidth-45)}px, ${(f.y*innerHeight-27)}px) scale(${0.7+g*0.6})`;
  });
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  const cw = canvas.width / W, ch = canvas.height / H;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
    const v = grid[y*W+x];
    if(v > 0.05) {
      ctx.fillStyle = `hsla(${180 + v*80}, 70%, ${30+v*40}%, ${v})`;
      ctx.fillRect(x*cw, y*ch, cw+1, ch+1);
    }
  }
  updateFacets();
  stepCA();
  requestAnimationFrame(draw);
}
draw();

// Pointer nucleation
canvas.addEventListener('pointerdown', e => {
  const x = Math.floor(e.clientX / canvas.width * W);
  const y = Math.floor(e.clientY / canvas.height * H);
  for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) {
    const nx=x+dx, ny=y+dy;
    if(nx>0&&nx<W-1&&ny>0&&ny<H-1) grid[ny*W+nx] = Math.max(grid[ny*W+nx], 0.7);
  }
});

// Seal / Restore
const DB = 'f479-crystal';
function seal() {
  const req = indexedDB.open(DB,1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('state');
  req.onsuccess = e => {
    const tx = e.target.result.transaction('state','readwrite');
    tx.objectStore('state').put({grid: Array.from(grid), residual, entropy, facets: facets.map(f=>({x:f.x,y:f.y,g:f.g})) }, 'live');
  };
}
function restore() {
  const req = indexedDB.open(DB,1);
  req.onsuccess = e => {
    const tx = e.target.result.transaction('state','readonly');
    const g = tx.objectStore('state').get('live');
    g.onsuccess = () => {
      if(g.result) {
        grid.set(g.result.grid);
        residual = g.result.residual || residual;
        entropy = g.result.entropy || entropy;
      }
    };
  };
}
document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = restore;
document.addEventListener('keydown', e => { if(e.key==='s'||e.key==='S') seal(); if(e.key==='r'||e.key==='R') restore(); });

// Synthetic fallback motion
setInterval(() => {
  if(!residual[0]) worker.postMessage({type:'observe', vx:Math.sin(Date.now()/1000)*0.5, vy:Math.cos(Date.now()/800)*0.3, vz:0, ax:0,ay:0,az:0});
}, 200);
