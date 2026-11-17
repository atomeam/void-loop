const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const agentsDiv = document.getElementById('agents');
const status = document.getElementById('status');
let W = innerWidth, H = innerHeight;
function resize() { W = innerWidth; H = innerHeight; cv.width = W; cv.height = H; }
addEventListener('resize', resize); resize();

// Simple MLP
class MLP {
  constructor(inp=5, hid=6, out=2) {
    this.w1 = Array.from({length:hid}, () => Array.from({length:inp}, () => (Math.random()-0.5)*0.6));
    this.b1 = Array.from({length:hid}, () => 0);
    this.w2 = Array.from({length:out}, () => Array.from({length:hid}, () => (Math.random()-0.5)*0.6));
    this.b2 = Array.from({length:out}, () => 0);
  }
  forward(x) {
    const h = this.w1.map((row,i) => Math.tanh(row.reduce((s,w,j)=>s+w*x[j], this.b1[i])));
    return this.w2.map((row,i) => Math.tanh(row.reduce((s,w,j)=>s+w*h[j], this.b2[i])));
  }
  clone() {
    const m = new MLP();
    m.w1 = this.w1.map(r => [...r]); m.b1 = [...this.b1];
    m.w2 = this.w2.map(r => [...r]); m.b2 = [...this.b2];
    return m;
  }
  mutate(rate=0.12) {
    const mut = a => a.map(v => v + (Math.random()-0.5)*rate);
    this.w1 = this.w1.map(mut); this.b1 = mut(this.b1);
    this.w2 = this.w2.map(mut); this.b2 = mut(this.b2);
  }
  serialize() { return {w1:this.w1, b1:this.b1, w2:this.w2, b2:this.b2}; }
  static deserialize(o) {
    const m = new MLP();
    m.w1 = o.w1; m.b1 = o.b1; m.w2 = o.w2; m.b2 = o.b2;
    return m;
  }
}

// Kuramoto grid
const N = 36;
const phases = new Float32Array(N*N);
const omegas = new Float32Array(N*N);
const couplings = new Float32Array(N*N).fill(0.8);
function initGrid() {
  for(let i=0;i<N*N;i++) {
    phases[i] = Math.random()*Math.PI*2;
    omegas[i] = (Math.random()-0.5)*0.4;
  }
}
initGrid();

// Agents
const agents = [];
const NUM = 6;
const colors = ['#ff6b6b','#4ecdc4','#ffe66d','#a8e6cf','#ff8b94','#6c5ce7'];
function spawn(i, genome=null) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = i+1;
  el.style.background = colors[i % colors.length];
  agentsDiv.appendChild(el);
  const a = {
    el, id:i,
    x: Math.random()* (W-40) + 20, y: Math.random()*(H-40)+20,
    vx:0, vy:0,
    mlp: genome ? MLP.deserialize(genome) : new MLP(),
    fitness: 10,
    hue: Math.random()*360
  };
  agents.push(a);
  el.addEventListener('pointerdown', e => { dragging = a; a.fitness += 5; e.preventDefault(); });
  return a;
}
for(let i=0;i<NUM;i++) spawn(i);

let dragging = null;
addEventListener('pointermove', e => {
  if (dragging) {
    dragging.x = e.clientX; dragging.y = e.clientY;
    dragging.fitness += 0.5;
  }
});
addEventListener('pointerup', () => { dragging = null; });

// Orientation
let beta=0, gamma=0, orientGranted=false;
async function requestOrient() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const p = await DeviceOrientationEvent.requestPermission();
      if (p === 'granted') { orientGranted = true; status.textContent = 'Orientation granted. Tilt to bias frequencies.'; }
    } catch(e) { status.textContent = 'Permission denied; using pointer only.'; }
  } else {
    orientGranted = true;
    status.textContent = 'Orientation available. Tilt to influence.';
  }
}
addEventListener('deviceorientation', e => {
  if (orientGranted || !e.beta) return;
  beta = e.beta || 0;
  gamma = e.gamma || 0;
});
document.getElementById('perm').onclick = requestOrient;

// Helpers
function getCell(x, y) {
  const gx = Math.max(0, Math.min(N-1, Math.floor(x / W * N)));
  const gy = Math.max(0, Math.min(N-1, Math.floor(y / H * N)));
  return gy*N + gx;
}
function localMean(gx, gy, rad=2) {
  let sx=0, sy=0, c=0;
  for(let dy=-rad;dy<=rad;dy++) for(let dx=-rad;dx<=rad;dx++) {
    const nx = (gx+dx+N)%N, ny=(gy+dy+N)%N;
    const p = phases[ny*N+nx];
    sx += Math.cos(p); sy += Math.sin(p); c++;
  }
  return Math.atan2(sy/c, sx/c);
}
function localOrder(gx, gy, rad=2) {
  let sx=0, sy=0, c=0;
  for(let dy=-rad;dy<=rad;dy++) for(let dx=-rad;dx<=rad;dx++) {
    const nx = (gx+dx+N)%N, ny=(gy+dy+N)%N;
    const p = phases[ny*N+nx];
    sx += Math.cos(p); sy += Math.sin(p); c++;
  }
  return Math.hypot(sx/c, sy/c);
}

// Seal / reset
function seal() {
  if (!agents.length) return;
  const best = agents.reduce((a,b) => a.fitness > b.fitness ? a : b);
  const g = best.mlp.serialize();
  agents.forEach(a => { a.mlp = MLP.deserialize(g); a.el.classList.add('transfer'); });
  setTimeout(() => agents.forEach(a => a.el.classList.remove('transfer')), 800);
  try { localStorage.setItem('verse-f770-genome', JSON.stringify(g)); } catch (e) { console.debug("lab f770-webgpu-kuramoto-phase-mlp-dom-agents-mind:", e); }
  status.textContent = `Sealed genome from agent ${best.id+1} (fitness ${best.fitness.toFixed(1)}).`;
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => {
  initGrid();
  agents.forEach(a => a.el.remove());
  agents.length = 0;
  for(let i=0;i<NUM;i++) spawn(i);
  status.textContent = 'Reset. New random genomes.';
};

// Load sealed
try {
  const saved = localStorage.getItem('verse-f770-genome');
  if (saved) {
    const g = JSON.parse(saved);
    agents.forEach(a => a.mlp = MLP.deserialize(g));
    status.textContent = 'Restored sealed genome.';
  }
} catch (e) { console.debug("lab f770-webgpu-kuramoto-phase-mlp-dom-agents-mind:", e); }

// Animation
let last = 0;
function step(ts) {
  const dt = Math.min(0.05, (ts - last)/1000 || 0.016);
  last = ts;

  // Agents act
  agents.forEach(a => {
    const cell = getCell(a.x, a.y);
    const gx = cell % N, gy = Math.floor(cell / N);
    const meanP = localMean(gx, gy);
    const order = localOrder(gx, gy);
    const px = (a.x - (dragging ? 0 : innerWidth/2)) / W;
    const py = (a.y - innerHeight/2) / H;
    const inp = [Math.sin(meanP), Math.cos(meanP), beta/90, gamma/90, Math.hypot(px,py)];
    const out = a.mlp.forward(inp);
    const freqBias = out[0] * 0.3;
    const coupBias = out[1] * 0.4;

    // Apply local bias
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
      const nx = (gx+dx+N)%N, ny=(gy+dy+N)%N;
      const idx = ny*N + nx;
      omegas[idx] += freqBias * 0.1;
      couplings[idx] = Math.max(0.1, Math.min(2.0, couplings[idx] + coupBias * 0.05));
    }

    // Drift toward higher order (simple)
    a.vx += (Math.random()-0.5)*0.2;
    a.vy += (Math.random()-0.5)*0.2;
    a.vx *= 0.92; a.vy *= 0.92;
    a.x = Math.max(20, Math.min(W-20, a.x + a.vx));
    a.y = Math.max(20, Math.min(H-20, a.y + a.vy));

    a.fitness += order * 0.5;
    a.el.style.left = (a.x-16)+'px';
    a.el.style.top = (a.y-16)+'px';
    a.el.style.background = `hsl(${(meanP*180/Math.PI + 180)|0}, 70%, 55%)`;
    a.el.style.transform = `scale(${0.8 + order*0.4})`;
  });

  // Kuramoto step
  const newPhases = new Float32Array(phases);
  for(let y=0;y<N;y++) for(let x=0;x<N;x++) {
    const i = y*N + x;
    let sumSin = 0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
      if (dx===0 && dy===0) continue;
      const nx = (x+dx+N)%N, ny=(y+dy+N)%N;
      const j = ny*N + nx;
      sumSin += Math.sin(phases[j] - phases[i]);
    }
    const K = couplings[i];
    newPhases[i] = phases[i] + dt * (omegas[i] + (K/8) * sumSin);
    newPhases[i] = ((newPhases[i] % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
  }
  phases.set(newPhases);

  // Render
  const img = ctx.createImageData(N, N);
  for(let i=0;i<N*N;i++) {
    const h = (phases[i] / (Math.PI*2)) * 360;
    const [r,g,b] = hslToRgb(h, 0.8, 0.5);
    const p = i*4;
    img.data[p] = r; img.data[p+1] = g; img.data[p+2] = b; img.data[p+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.drawImage(cv, 0, 0, N, N, 0, 0, W, H);

  requestAnimationFrame(step);
}
function hslToRgb(h, s, l) {
  h /= 360;
  const a = s * Math.min(l, 1-l);
  const f = n => {
    const k = (n + h*12) % 12;
    return l - a * Math.max(Math.min(k-3, 9-k, 1), -1);
  };
  return [f(0)*255|0, f(8)*255|0, f(4)*255|0];
}
requestAnimationFrame(step);

// Pointer inject phase
addEventListener('pointerdown', e => {
  if (e.target.classList.contains('agent')) return;
  const cell = getCell(e.clientX, e.clientY);
  phases[cell] = 0;
  for(let k=0;k<4;k++) phases[(cell+k)% (N*N)] = 0;
});
