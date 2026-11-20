const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.onresize = () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; };

const GW = 64, GH = 48;
let u = new Float32Array(GW*GH);
let uPrev = new Float32Array(GW*GH);
let cField = new Float32Array(GW*GH).fill(0.5);
let portals = [];

class MLP {
  constructor() {
    this.w1 = Array.from({length:18}, () => Math.random()*0.4-0.2);
    this.w2 = Array.from({length:6}, () => Math.random()*0.4-0.2);
  }
  forward(x) { // x: [3]
    let h = [];
    for(let i=0;i<6;i++) {
      let s = this.w1[i*3]*x[0] + this.w1[i*3+1]*x[1] + this.w1[i*3+2]*x[2];
      h[i] = Math.tanh(s);
    }
    let o = 0;
    for(let i=0;i<6;i++) o += this.w2[i]*h[i];
    return Math.tanh(o);
  }
  clone() { let m = new MLP(); m.w1 = [...this.w1]; m.w2 = [...this.w2]; return m; }
}

function initPortals() {
  const container = document.getElementById('portals');
  container.innerHTML = '';
  portals = [];
  for(let i=0;i<4;i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = 'P'+(i+1);
    el.style.left = (20+i*20)+'%';
    el.style.top = (30+i*10)+'%';
    const p = { el, x:0, y:0, mlp: new MLP(), fitness:0, vx:0, vy:0 };
    el.onpointerdown = e => { p.dragging = true; e.target.setPointerCapture(e.pointerId); };
    el.onpointermove = e => {
      if(p.dragging) {
        p.x = e.clientX / W;
        p.y = e.clientY / H;
        el.style.left = (p.x*100)+'%';
        el.style.top = (p.y*100)+'%';
      }
    };
    el.onpointerup = () => p.dragging = false;
    container.appendChild(el);
    portals.push(p);
  }
}
initPortals();

let orient = {beta:0, gamma:0};
window.addEventListener('deviceorientation', e => { orient.beta = e.beta||0; orient.gamma = e.gamma||0; });
let pointer = {x:0.5, y:0.5};
canvas.onpointermove = e => { pointer.x = e.clientX/W; pointer.y = e.clientY/H; };

function idx(x,y) { return y*GW + x; }

function stepWave() {
  const next = new Float32Array(GW*GH);
  const dt2 = 0.25;
  for(let y=1;y<GH-1;y++) for(let x=1;x<GW-1;x++) {
    const i = idx(x,y);
    const lap = u[idx(x-1,y)] + u[idx(x+1,y)] + u[idx(x,y-1)] + u[idx(x,y+1)] - 4*u[i];
    const c2 = cField[i]*cField[i];
    next[i] = 2*u[i] - uPrev[i] + dt2 * c2 * lap;
  }
  // soft walls
  uPrev.set(u);
  u.set(next);
  // source from pointer
  const sx = Math.floor(pointer.x*(GW-1));
  const sy = Math.floor(pointer.y*(GH-1));
  u[idx(sx,sy)] += 0.3 * Math.sin(performance.now()*0.01);
}

function updatePortals() {
  for(const p of portals) {
    if(!p.dragging) {
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.95; p.vy *= 0.95;
      p.x = Math.max(0.05, Math.min(0.95, p.x));
      p.y = Math.max(0.05, Math.min(0.95, p.y));
      p.el.style.left = (p.x*100)+'%';
      p.el.style.top = (p.y*100)+'%';
    }
    // sample local field
    const gx = Math.floor(p.x*(GW-1));
    const gy = Math.floor(p.y*(GH-1));
    const amp = Math.abs(u[idx(gx,gy)]);
    const inputs = [orient.gamma/90, orient.beta/90, amp];
    const out = p.mlp.forward(inputs);
    // inject refractive bias
    const r = 3;
    for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++) {
      const xx = gx+dx, yy = gy+dy;
      if(xx>0&&xx<GW-1&&yy>0&&yy<GH-1) {
        cField[idx(xx,yy)] = 0.3 + 0.4*(out+1)/2;
      }
    }
    p.fitness += amp * 0.01;
    // slight attraction to high amp
    if(amp > 0.1) { p.vx += (pointer.x - p.x)*0.001; }
  }
}

function render() {
  const img = ctx.createImageData(W, H);
  const scaleX = W / GW, scaleY = H / GH;
  for(let y=0;y<GH;y++) for(let x=0;x<GW;x++) {
    const v = Math.min(1, Math.max(0, u[idx(x,y)]*2 + 0.5));
    const r = Math.floor(v*255);
    const g = Math.floor((1-v)*100);
    const b = Math.floor(255*(1-v));
    for(let py=0;py<scaleY;py++) for(let px=0;px<scaleX;px++) {
      const ix = Math.floor(x*scaleX + px);
      const iy = Math.floor(y*scaleY + py);
      if(ix<W && iy<H) {
        const off = (iy*W + ix)*4;
        img.data[off] = r; img.data[off+1] = g; img.data[off+2] = b; img.data[off+3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

let bestFitness = 0;
const channel = new BroadcastChannel('f828-genome');
channel.onmessage = e => {
  if(e.data.fitness > bestFitness) {
    bestFitness = e.data.fitness;
    // simple adopt: mutate current
    portals.forEach(p => p.mlp = new MLP());
    document.getElementById('status').textContent = 'Adopted peer genome';
  }
};

document.getElementById('seal').onclick = () => {
  const best = portals.reduce((a,b) => a.fitness > b.fitness ? a : b);
  if(best.fitness > bestFitness) {
    bestFitness = best.fitness;
    const data = { fitness: best.fitness, weights: {w1:best.mlp.w1, w2:best.mlp.w2} };
    channel.postMessage(data);
    try { localStorage.setItem('verse-f828', JSON.stringify(data)); } catch (e) { console.debug("lab f828-webgpu-fdtd-photonic-orientation-portal-mind:", e); }
    document.getElementById('status').textContent = 'Sealed fitness '+best.fitness.toFixed(2);
  }
};

document.getElementById('reset').onclick = () => { u.fill(0); uPrev.fill(0); cField.fill(0.5); portals.forEach(p=>p.fitness=0); };

function loop() {
  stepWave();
  updatePortals();
  render();
  requestAnimationFrame(loop);
}
loop();

// restore
try {
  const saved = JSON.parse(localStorage.getItem('verse-f828')||'null');
  if(saved) { bestFitness = saved.fitness; document.getElementById('status').textContent = 'Restored sealed'; }
} catch (e) { console.debug("lab f828-webgpu-fdtd-photonic-orientation-portal-mind:", e); }
