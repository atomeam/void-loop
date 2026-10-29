const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 64;
const dx = 1;
let u = new Float32Array(N*N); // current
let v = new Float32Array(N*N); // previous
let sources = []; // {x,y,freq,amp}

// Attention mind (tiny)
const HIST = 32;
let history = []; // {x,y,e}
let attnW = Array.from({length: 4}, () => Math.random()*0.2 - 0.1); // simple weights

function attentionBias(ptr) {
  if (history.length < 4) return {fx:0, fy:0, freq:0.1};
  const q = [ptr.x, ptr.y, ptr.e || 0];
  let scores = [];
  for (let i = 0; i < Math.min(HIST, history.length); i++) {
    const h = history[history.length - 1 - i];
    const k = [h.x, h.y, h.e];
    let s = 0;
    for (let d=0; d<3; d++) s += q[d]*k[d]*attnW[d%4];
    scores.push(Math.exp(s));
  }
  const sum = scores.reduce((a,b)=>a+b, 1e-6);
  let bx=0, by=0, bf=0;
  scores.forEach((sc, i) => {
    const h = history[history.length - 1 - i];
    const w = sc / sum;
    bx += w * h.x; by += w * h.y; bf += w * (0.05 + Math.abs(h.e)*0.1);
  });
  return {fx: (bx - ptr.x)*0.3, fy: (by - ptr.y)*0.3, freq: Math.min(0.4, bf)};
}

let ptr = {x:0.5, y:0.5, e:0};
canvas.addEventListener('pointermove', e => {
  ptr.x = e.clientX / W;
  ptr.y = e.clientY / H;
});

function stepWave() {
  const next = new Float32Array(N*N);
  const c2 = 0.25; // wave speed
  const damp = 0.995;
  const bias = attentionBias(ptr);
  // inject sources from attention
  const sx = Math.floor((ptr.x + bias.fx) * (N-1));
  const sy = Math.floor((ptr.y + bias.fy) * (N-1));
  const amp = 0.15 + Math.abs(bias.freq)*0.5;
  if (sx>1 && sx<N-2 && sy>1 && sy<N-2) {
    u[sy*N + sx] += amp * Math.sin(performance.now()*0.01 * (1+bias.freq*10));
  }
  for (let y=1; y<N-1; y++) {
    for (let x=1; x<N-1; x++) {
      const i = y*N + x;
      const lap = u[i-1] + u[i+1] + u[i-N] + u[i+N] - 4*u[i];
      next[i] = (2*u[i] - v[i] + c2 * lap) * damp;
    }
  }
  v.set(u);
  u.set(next);
  // energy for history
  let e = 0;
  for (let i=0; i<u.length; i+=16) e += Math.abs(u[i]);
  ptr.e = e / (N*N/16);
  history.push({x:ptr.x, y:ptr.y, e:ptr.e});
  if (history.length > HIST) history.shift();
}

let orbs = [];
function detectCollapse() {
  const thresh = 0.35;
  for (let y=2; y<N-2; y+=4) {
    for (let x=2; x<N-2; x+=4) {
      const i = y*N + x;
      if (Math.abs(u[i]) > thresh && orbs.length < 12) {
        const px = (x / N) * W;
        const py = (y / N) * H;
        const orb = document.createElement('div');
        orb.className = 'orb';
        orb.style.left = (px - 14) + 'px';
        orb.style.top = (py - 14) + 'px';
        orb.dataset.x = x;
        orb.dataset.y = y;
        document.body.appendChild(orb);
        orbs.push({el: orb, x, y, vx:0, vy:0});
        u[i] *= 0.3; // collapse reduces amplitude
        break;
      }
    }
  }
  document.getElementById('orbs').textContent = orbs.length;
}

// Drag orbs to re-inject
let dragging = null;
document.addEventListener('pointerdown', e => {
  if (e.target.classList.contains('orb')) {
    dragging = orbs.find(o => o.el === e.target);
    e.target.setPointerCapture(e.pointerId);
  }
});
document.addEventListener('pointermove', e => {
  if (dragging) {
    dragging.el.style.left = (e.clientX - 14) + 'px';
    dragging.el.style.top = (e.clientY - 14) + 'px';
    const gx = Math.floor((e.clientX / W) * N);
    const gy = Math.floor((e.clientY / H) * N);
    if (gx>1 && gx<N-2 && gy>1 && gy<N-2) {
      u[gy*N + gx] += 0.4; // re-inject
    }
  }
});
document.addEventListener('pointerup', () => { dragging = null; });

function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const img = ctx.createImageData(N, N);
  for (let i=0; i<N*N; i++) {
    const a = Math.min(1, Math.abs(u[i])*2);
    const hue = 200 + u[i]*80;
    img.data[i*4] = Math.floor(a * 100);
    img.data[i*4+1] = Math.floor(a * 180);
    img.data[i*4+2] = Math.floor(a * 255);
    img.data[i*4+3] = 255;
  }
  // upscale
  const tmp = document.createElement('canvas');
  tmp.width = N; tmp.height = N;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, W, H);
  // coherence
  let varn = 0, mean = 0;
  for (let i=0; i<u.length; i+=8) mean += Math.abs(u[i]);
  mean /= (u.length/8);
  for (let i=0; i<u.length; i+=8) varn += (Math.abs(u[i])-mean)**2;
  const coh = Math.max(0, 1 - Math.sqrt(varn/(u.length/8)) / 0.5);
  document.getElementById('coh').textContent = coh.toFixed(2);
  document.body.style.background = `hsl(${200 + coh*40}, ${20+coh*30}%, ${5+coh*8}%)`;
}

function loop() {
  stepWave();
  detectCollapse();
  render();
  requestAnimationFrame(loop);
}
loop();

// Seal / Load via IndexedDB
let db;
const req = indexedDB.open('F323-wave', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('mind');
req.onsuccess = e => { db = e.target.result; };
document.getElementById('seal').onclick = () => {
  if (!db) return;
  const tx = db.transaction('mind', 'readwrite');
  tx.objectStore('mind').put({attnW, history: history.slice(-16), u: Array.from(u.slice(0, 256))}, 'champ');
  alert('Sealed');
};
document.getElementById('load').onclick = () => {
  if (!db) return;
  const tx = db.transaction('mind', 'readonly');
  tx.objectStore('mind').get('champ').onsuccess = e => {
    if (e.target.result) {
      attnW = e.target.result.attnW || attnW;
      if (e.target.result.u) u.set(e.target.result.u);
      alert('Loaded');
    }
  };
};
document.getElementById('reset').onclick = () => { u.fill(0); v.fill(0); orbs.forEach(o => o.el.remove()); orbs = []; };
