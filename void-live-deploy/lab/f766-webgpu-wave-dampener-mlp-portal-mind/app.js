const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 48;
const h = new Float32Array(N*N);
const v = new Float32Array(N*N);
const damp = new Float32Array(N*N);
let c2 = 0.18;
let baseDamp = 0.02;
let dt = 1.0;

function idx(i,j) { return (i+N)%N * N + (j+N)%N; }

function laplacian(i,j) {
  return h[idx(i+1,j)] + h[idx(i-1,j)] + h[idx(i,j+1)] + h[idx(i,j-1)] - 4*h[idx(i,j)];
}

let pointerX = W/2, pointerY = H/2;
let sourceStrength = 0;

canvas.addEventListener('pointermove', e => {
  pointerX = e.clientX; pointerY = e.clientY;
  sourceStrength = 0.8;
});
canvas.addEventListener('pointerdown', e => { sourceStrength = 1.5; });
canvas.addEventListener('pointerup', e => { sourceStrength = 0.2; });

let orientBeta = 0, orientGamma = 0;
window.addEventListener('deviceorientation', e => {
  if (e.beta != null) orientBeta = e.beta / 90;
  if (e.gamma != null) orientGamma = e.gamma / 90;
}, true);

// Tiny MLP: 4 -> 6 -> 3
function createMLP() {
  return {
    w1: Array.from({length:4*6}, () => (Math.random()-0.5)*0.8),
    b1: Array(6).fill(0),
    w2: Array.from({length:6*3}, () => (Math.random()-0.5)*0.6),
    b2: Array(3).fill(0),
    fitness: 0
  };
}
function sigmoid(x) { return 1/(1+Math.exp(-x)); }
function forward(m, inp) {
  const h1 = [];
  for (let i=0; i<6; i++) {
    let s = m.b1[i];
    for (let j=0; j<4; j++) s += inp[j] * m.w1[j*6 + i];
    h1[i] = sigmoid(s);
  }
  const out = [];
  for (let i=0; i<3; i++) {
    let s = m.b2[i];
    for (let j=0; j<6; j++) s += h1[j] * m.w2[j*3 + i];
    out[i] = Math.tanh(s);
  }
  return out;
}

const portals = [];
const NUM = 5;
for (let k=0; k<NUM; k++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'D'+(k+1);
  document.body.appendChild(el);
  portals.push({
    el,
    x: Math.random()*0.8+0.1,
    y: Math.random()*0.8+0.1,
    mlp: createMLP(),
    dragging: false
  });
}

let dragPortal = null;
portals.forEach(p => {
  p.el.addEventListener('pointerdown', e => {
    e.stopPropagation();
    dragPortal = p;
    p.dragging = true;
    p.el.classList.add('dragging');
    p.mlp.fitness += 0.5;
  });
});
window.addEventListener('pointermove', e => {
  if (dragPortal) {
    dragPortal.x = e.clientX / W;
    dragPortal.y = e.clientY / H;
    dragPortal.mlp.fitness += 0.02;
  }
});
window.addEventListener('pointerup', () => {
  if (dragPortal) {
    dragPortal.dragging = false;
    dragPortal.el.classList.remove('dragging');
    dragPortal = null;
  }
});

function seal() {
  let best = portals.reduce((a,b) => a.mlp.fitness > b.mlp.fitness ? a : b);
  portals.forEach(p => {
    if (p !== best) {
      p.mlp.w1 = best.mlp.w1.slice();
      p.mlp.b1 = best.mlp.b1.slice();
      p.mlp.w2 = best.mlp.w2.slice();
      p.mlp.b2 = best.mlp.b2.slice();
    }
  });
  try {
    localStorage.setItem('verse-f766-genome', JSON.stringify({
      w1: best.mlp.w1, b1: best.mlp.b1, w2: best.mlp.w2, b2: best.mlp.b2, fitness: best.mlp.fitness
    }));
    status.textContent = 'Sealed best genome (fitness '+best.mlp.fitness.toFixed(1)+')';
  } catch(e) { status.textContent = 'Seal failed (storage)'; }
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => {
  portals.forEach(p => p.mlp = createMLP());
  status.textContent = 'Weights reset';
};

// restore
try {
  const saved = localStorage.getItem('verse-f766-genome');
  if (saved) {
    const g = JSON.parse(saved);
    portals.forEach(p => {
      p.mlp.w1 = g.w1.slice(); p.mlp.b1 = g.b1.slice();
      p.mlp.w2 = g.w2.slice(); p.mlp.b2 = g.b2.slice();
    });
    status.textContent = 'Restored sealed genome';
  }
} catch (e) { console.debug("lab f766-webgpu-wave-dampener-mlp-portal-mind:", e); }

function step() {
  // inject source
  const si = Math.floor(pointerY / H * N);
  const sj = Math.floor(pointerX / W * N);
  if (sourceStrength > 0) {
    h[idx(si,sj)] += sourceStrength * 0.15;
    sourceStrength *= 0.92;
  }
  // orientation bias as weak gravity on velocity
  const gforce = orientBeta * 0.001;

  // apply portal dampening
  damp.fill(baseDamp);
  portals.forEach(p => {
    const pi = Math.floor(p.y * N);
    const pj = Math.floor(p.x * N);
    const localH = h[idx(pi,pj)];
    const localV = v[idx(pi,pj)];
    const pdist = Math.hypot(p.x - pointerX/W, p.y - pointerY/H);
    const inp = [localH*2, localV*2, pdist*2-1, orientBeta];
    const out = forward(p.mlp, inp);
    const extraDamp = 0.05 + (out[0]+1)*0.08;
    // local damp around portal
    for (let di=-2; di<=2; di++) for (let dj=-2; dj<=2; dj++) {
      const d = damp[idx(pi+di,pj+dj)];
      damp[idx(pi+di,pj+dj)] = Math.min(0.4, d + extraDamp * 0.3);
    }
    // mild position attract to high amplitude via MLP
    p.x += out[1] * 0.008;
    p.y += out[2] * 0.008;
    p.x = Math.max(0.05, Math.min(0.95, p.x));
    p.y = Math.max(0.05, Math.min(0.95, p.y));
    p.mlp.fitness += Math.abs(localH) * 0.01;
    // visual
    const scale = 0.8 + Math.abs(localH)*3 + (out[0]+1)*0.3;
    p.el.style.transform = `translate(${p.x*W-24}px,${p.y*H-24}px) scale(${scale})`;
    p.el.style.background = `radial-gradient(circle, hsl(${(out[0]+1)*180},80%,60%), #06f)`;
  });

  // wave update
  const nh = new Float32Array(N*N);
  const nv = new Float32Array(N*N);
  for (let i=0; i<N; i++) for (let j=0; j<N; j++) {
    const id = idx(i,j);
    const lap = laplacian(i,j);
    const acc = c2 * lap - damp[id] * v[id] + gforce;
    nv[id] = v[id] + acc * dt;
    nh[id] = h[id] + nv[id] * dt;
  }
  h.set(nh);
  v.set(nv);

  // render
  const img = ctx.createImageData(N, N);
  for (let k=0; k<N*N; k++) {
    const val = Math.max(-1, Math.min(1, h[k]*3));
    const r = val > 0 ? 255*val : 0;
    const b = val < 0 ? -255*val : 0;
    const g = 40 + Math.abs(val)*80;
    img.data[k*4] = r; img.data[k*4+1] = g; img.data[k*4+2] = b; img.data[k*4+3] = 255;
  }
  // scale up
  const tmp = document.createElement('canvas');
  tmp.width = N; tmp.height = N;
  tmp.getContext('2d').putImageData(img,0,0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, W, H);

  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// WebXR stub
if (navigator.xr) {
  status.textContent += ' | WebXR available (hand stub)';
}
