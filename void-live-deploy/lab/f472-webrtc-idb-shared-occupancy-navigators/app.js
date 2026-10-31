const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hudEnt = document.getElementById('ent');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const GRID = 32;
const CELL = () => Math.min(W, H) / GRID;
let occ = new Float32Array(GRID * GRID);
let navigators = [];
let attractor = null;
let tilt = {x:0, y:0};
const channel = new BroadcastChannel('verse-occupancy-f472');

function idx(x, y) { return Math.max(0, Math.min(GRID-1, y)) * GRID + Math.max(0, Math.min(GRID-1, x)); }

class MLP {
  constructor() {
    this.w1 = new Float32Array(3*4);
    this.b1 = new Float32Array(4);
    this.w2 = new Float32Array(4*2);
    this.b2 = new Float32Array(2);
    for (let i=0; i<this.w1.length; i++) this.w1[i] = (Math.random()-0.5)*0.8;
    for (let i=0; i<this.w2.length; i++) this.w2[i] = (Math.random()-0.5)*0.8;
  }
  forward(nx, ny, bias) {
    const h = new Float32Array(4);
    for (let j=0; j<4; j++) {
      h[j] = Math.tanh(this.w1[j*3]*nx + this.w1[j*3+1]*ny + this.w1[j*3+2]*bias + this.b1[j]);
    }
    let vx= this.b2[0], vy= this.b2[1];
    for (let j=0; j<4; j++) {
      vx += this.w2[j*2] * h[j];
      vy += this.w2[j*2+1] * h[j];
    }
    return [Math.tanh(vx)*0.8, Math.tanh(vy)*0.8];
  }
}

function spawnNavs() {
  navigators = [];
  for (let i=0; i<4; i++) {
    navigators.push({
      x: Math.random()*GRID, y: Math.random()*GRID,
      vx:0, vy:0, mlp: new MLP(), color: `hsl(${i*90},70%,60%)`
    });
  }
}
spawnNavs();

function entropy() {
  let e=0, sum=0;
  for (let v of occ) sum += v;
  if (sum<0.01) return 0;
  for (let v of occ) if (v>0.01) { const p=v/sum; e -= p*Math.log2(p); }
  return Math.min(1, e / 8);
}

function update() {
  for (const n of navigators) {
    const nx = n.x / GRID - 0.5, ny = n.y / GRID - 0.5;
    const bias = tilt.x * 0.5 + tilt.y * 0.5;
    const [dvx, dvy] = n.mlp.forward(nx, ny, bias);
    n.vx = n.vx*0.85 + dvx*0.15;
    n.vy = n.vy*0.85 + dvy*0.15;
    if (attractor) {
      const dx = attractor.x - n.x, dy = attractor.y - n.y;
      const d = Math.hypot(dx,dy)+0.1;
      n.vx += (dx/d)*0.4;
      n.vy += (dy/d)*0.4;
    }
    n.x += n.vx; n.y += n.vy;
    n.x = (n.x + GRID) % GRID; n.y = (n.y + GRID) % GRID;
    const ix = Math.floor(n.x), iy = Math.floor(n.y);
    const i = idx(ix, iy);
    if (occ[i] < 1) {
      occ[i] = Math.min(1, occ[i] + 0.12);
      channel.postMessage({type:'delta', ix, iy, v: occ[i]});
    }
  }
  for (let i=0; i<occ.length; i++) occ[i] *= 0.998;
  const ent = entropy();
  document.documentElement.style.setProperty('--entropy', ent);
  document.documentElement.style.setProperty('--hue', 180 + ent*120);
  hudEnt.textContent = ent.toFixed(2);
}

function draw() {
  ctx.fillStyle = '#050510';
  ctx.fillRect(0,0,W,H);
  const cs = CELL();
  const ox = (W - GRID*cs)/2, oy = (H - GRID*cs)/2;
  for (let y=0; y<GRID; y++) for (let x=0; x<GRID; x++) {
    const v = occ[idx(x,y)];
    if (v>0.02) {
      ctx.fillStyle = `hsla(${200 + v*60}, 70%, ${20+v*50}%, ${0.3+v*0.6})`;
      ctx.fillRect(ox + x*cs, oy + y*cs, cs-1, cs-1);
    }
  }
  for (const n of navigators) {
    ctx.beginPath();
    ctx.arc(ox + n.x*cs, oy + n.y*cs, cs*0.6, 0, Math.PI*2);
    ctx.fillStyle = n.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }
  if (attractor) {
    ctx.beginPath();
    ctx.arc(ox + attractor.x*cs, oy + attractor.y*cs, cs*0.4, 0, Math.PI*2);
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();

canvas.addEventListener('click', e => {
  const cs = CELL();
  const ox = (W - GRID*cs)/2, oy = (H - GRID*cs)/2;
  const x = (e.clientX - ox) / cs, y = (e.clientY - oy) / cs;
  if (x>=0 && x<GRID && y>=0 && y<GRID) {
    attractor = {x, y};
    setTimeout(() => attractor = null, 2500);
    const i = idx(Math.floor(x), Math.floor(y));
    occ[i] = Math.min(1, occ[i] + 0.4);
    channel.postMessage({type:'delta', ix:Math.floor(x), iy:Math.floor(y), v:occ[i]});
  }
});

channel.onmessage = e => {
  if (e.data.type === 'delta') {
    const i = idx(e.data.ix, e.data.iy);
    occ[i] = Math.max(occ[i], e.data.v);
  }
};

if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    tilt.x = (e.gamma || 0) / 45;
    tilt.y = (e.beta || 0) / 45;
  });
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    document.body.addEventListener('click', () => DeviceOrientationEvent.requestPermission().then(p => p==='granted' && console.log('orient ok')), {once:true});
  }
}

const DB_NAME = 'verse-f472';
async function seal() {
  const db = await new Promise((res,rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('state');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
  const tx = db.transaction('state', 'readwrite');
  tx.objectStore('state').put({occ: Array.from(occ), navs: navigators.map(n=>({x:n.x,y:n.y,w1:Array.from(n.mlp.w1),w2:Array.from(n.mlp.w2)}))}, 'living');
  await new Promise(r => tx.oncomplete = r);
  alert('Sealed living field to IndexedDB');
}
document.getElementById('seal').onclick = seal;

(async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('state', 'readonly');
    const req = tx.objectStore('state').get('living');
    req.onsuccess = () => {
      if (req.result) {
        occ.set(req.result.occ);
        req.result.navs.forEach((s,i) => { if (navigators[i]) { navigators[i].x=s.x; navigators[i].y=s.y; } });
        console.log('Restored from IDB');
      }
    };
  } catch(e) {}
})();
