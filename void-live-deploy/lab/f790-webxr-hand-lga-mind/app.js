const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const statusEl = document.getElementById('status');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

// Simple LGA: square lattice approximation of hexagonal for simplicity (6 dirs: N NE SE S SW NW)
const W = 80, H = 50;
let density = new Float32Array(W * H);
let vx = new Float32Array(W * H);
let vy = new Float32Array(W * H);

function idx(x,y) { return (y%H+H)%H * W + (x%W+W)%W; }

function stepLGA() {
  const nextD = new Float32Array(W*H);
  const nextVx = new Float32Array(W*H);
  const nextVy = new Float32Array(W*H);
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    const i = idx(x,y);
    // Streaming (simple advection + diffusion)
    const d = density[i];
    const vxx = vx[i], vyy = vy[i];
    const nx = Math.round(x + vxx*0.8);
    const ny = Math.round(y + vyy*0.8);
    const ni = idx(nx, ny);
    nextD[ni] += d * 0.7;
    nextVx[ni] += vxx * 0.6;
    nextVy[ni] += vyy * 0.6;
    // Collision / relaxation toward rest
    nextD[i] += d * 0.3 * 0.5;
    nextVx[i] *= 0.85;
    nextVy[i] *= 0.85;
  }
  // Normalize a bit
  for (let i=0; i<W*H; i++) {
    density[i] = Math.min(1.5, nextD[i] * 0.9 + 0.01);
    vx[i] = nextVx[i] * 0.9;
    vy[i] = nextVy[i] * 0.9;
  }
}

// Tiny MLP
class MLP {
  constructor() {
    this.w1 = Array.from({length:12}, () => Array.from({length:6}, () => Math.random()*0.4-0.2));
    this.b1 = Array.from({length:12}, () => Math.random()*0.2-0.1);
    this.w2 = Array.from({length:3}, () => Array.from({length:12}, () => Math.random()*0.4-0.2));
    this.b2 = Array.from({length:3}, () => Math.random()*0.2-0.1);
    this.fitness = 0;
  }
  forward(inp) {
    const h = this.w1.map((row,i) => Math.tanh(row.reduce((s,w,j)=>s+w*inp[j], this.b1[i])));
    return this.w2.map((row,i) => row.reduce((s,w,j)=>s+w*h[j], this.b2[i]));
  }
  mutate(rate=0.1) {
    const m = new MLP();
    m.w1 = this.w1.map(r => r.map(w => w + (Math.random()-0.5)*rate));
    m.w2 = this.w2.map(r => r.map(w => w + (Math.random()-0.5)*rate));
    return m;
  }
  serialize() { return JSON.stringify({w1:this.w1, w2:this.w2, b1:this.b1, b2:this.b2, fitness:this.fitness}); }
  static deserialize(s) { const o=JSON.parse(s); const m=new MLP(); Object.assign(m,o); return m; }
}

let agents = Array.from({length:4}, () => new MLP());
let best = agents[0];

const portals = [];
for (let i=0; i<6; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = '•';
  el.style.left = (20+i*12)+'%';
  el.style.top = (30+ (i%2)*20)+'%';
  document.body.appendChild(el);
  portals.push({el, x:0, y:0, agent: agents[i%4]});
  el.addEventListener('pointerdown', e => { e.target.classList.add('reward'); portals.find(p=>p.el===e.target).agent.fitness += 1; setTimeout(()=>e.target.classList.remove('reward'), 400); });
}

let pointer = {x:0.5, y:0.5, vx:0, vy:0};
let orient = {beta:0, gamma:0};
addEventListener('pointermove', e => {
  pointer.vx = (e.clientX / innerWidth - pointer.x)*2;
  pointer.vy = (e.clientY / innerHeight - pointer.y)*2;
  pointer.x = e.clientX / innerWidth;
  pointer.y = e.clientY / innerHeight;
});
addEventListener('deviceorientation', e => { orient.beta = e.beta||0; orient.gamma = e.gamma||0; });

// XR stub
let xrSession = null;
async function tryXR() {
  if (!navigator.xr) return;
  try {
    const ok = await navigator.xr.isSessionSupported('immersive-vr');
    if (ok) statusEl.textContent = 'XR available (hand tracking progressive)';
  } catch (e) { console.debug("lab f790-webxr-hand-lga-mind:", e); }
}
tryXR();

// Persistence
const DB = 'verse-f790';
async function seal() {
  const champ = agents.reduce((a,b)=> a.fitness>b.fitness?a:b);
  const data = champ.serialize();
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data)).then(b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,8));
  const req = indexedDB.open(DB,1);
  req.onupgradeneeded = () => req.result.createObjectStore('seal');
  req.onsuccess = () => {
    const tx = req.result.transaction('seal','readwrite');
    tx.objectStore('seal').put({data, hash, fitness:champ.fitness}, 'best');
    statusEl.textContent = 'Sealed '+hash;
  };
  const bc = new BroadcastChannel('f790-genome');
  bc.postMessage({data, hash});
}
document.getElementById('seal').onclick = seal;

new BroadcastChannel('f790-genome').onmessage = e => {
  const m = MLP.deserialize(e.data.data);
  if (m.fitness > best.fitness) { agents[0] = m; best = m; statusEl.textContent = 'Received '+e.data.hash; }
};

function loop() {
  stepLGA();
  // Inject from pointer / orient via MLPs
  agents.forEach((ag, ai) => {
    const inp = [pointer.x-0.5, pointer.y-0.5, pointer.vx, pointer.vy, orient.beta/90, orient.gamma/90];
    const out = ag.forward(inp);
    const ix = Math.floor((pointer.x + out[0]*0.1) * W);
    const iy = Math.floor((pointer.y + out[1]*0.1) * H);
    const i = idx(ix, iy);
    density[i] = Math.min(1.5, density[i] + 0.15);
    vx[i] += out[0]*0.3 + pointer.vx*0.5;
    vy[i] += out[1]*0.3 + pointer.vy*0.5;
    ag.fitness *= 0.995;
  });

  // Render
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  const cw = canvas.width / W, ch = canvas.height / H;
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    const d = density[idx(x,y)];
    if (d > 0.05) {
      ctx.fillStyle = `hsla(${200 + d*80}, 70%, ${30+d*40}%, ${0.4+d*0.5})`;
      ctx.fillRect(x*cw, y*ch, cw+1, ch+1);
    }
  }

  // Move portals to density peaks (simple)
  portals.forEach((p, pi) => {
    let maxD = 0, mx=0, my=0;
    for (let k=0; k<20; k++) {
      const sx = Math.floor(Math.random()*W), sy = Math.floor(Math.random()*H);
      const d = density[idx(sx,sy)];
      if (d > maxD) { maxD=d; mx=sx/W; my=sy/H; }
    }
    p.x += (mx - p.x)*0.05;
    p.y += (my - p.y)*0.05;
    p.el.style.left = (p.x*100)+'%';
    p.el.style.top = (p.y*100)+'%';
    p.el.style.transform = `scale(${0.6 + maxD})`;
  });

  requestAnimationFrame(loop);
}
loop();
