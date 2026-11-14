const W = 96, H = 96;
const Du = 0.16, Dv = 0.08;
const dt = 1.0;
let F0 = 0.035, K0 = 0.065;
const U = new Float32Array(W*H), V = new Float32Array(W*H);
const Ffield = new Float32Array(W*H), Kfield = new Float32Array(W*H);
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const portalsEl = document.getElementById('portals');

// Tiny MLPs
const N_MLP = 12;
const mlps = [];
function randn() { return (Math.random()-0.5)*0.4; }
function makeMLP() {
  return {
    w1: Array.from({length:4*5}, randn), // 5 in → 4 hid
    b1: Array.from({length:4}, randn),
    w2: Array.from({length:2*4}, randn), // 4 → 2 out
    b2: Array.from({length:2}, randn),
    x: Math.random()*W, y: Math.random()*H,
    fitness: 0
  };
}
for (let i=0; i<N_MLP; i++) mlps.push(makeMLP());

function mlpForward(m, inp) {
  const h = new Array(4).fill(0);
  for (let j=0; j<4; j++) {
    let s = m.b1[j];
    for (let k=0; k<5; k++) s += m.w1[j*5+k] * inp[k];
    h[j] = Math.tanh(s);
  }
  const o = [m.b2[0], m.b2[1]];
  for (let j=0; j<2; j++) {
    for (let k=0; k<4; k++) o[j] += m.w2[j*4+k] * h[k];
  }
  return o.map(v => Math.tanh(v)*0.02); // small deltas
}

// Init field
function initField() {
  for (let i=0; i<W*H; i++) { U[i]=1; V[i]=0; Ffield[i]=F0; Kfield[i]=K0; }
  // seed some spots
  for (let s=0; s<8; s++) {
    const cx = (Math.random()*0.6+0.2)*W|0, cy = (Math.random()*0.6+0.2)*H|0;
    for (let dy=-4; dy<=4; dy++) for (let dx=-4; dx<=4; dx++) {
      const x=(cx+dx+W)%W, y=(cy+dy+H)%H;
      if (dx*dx+dy*dy<12) V[y*W+x] = 0.5 + Math.random()*0.3;
    }
  }
}
initField();

// Portals
const portals = [];
for (let i=0; i<8; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'Portal '+(i+1);
  el.style.left = (Math.random()*window.innerWidth*0.8+40)+'px';
  el.style.top = (Math.random()*window.innerHeight*0.7+60)+'px';
  portalsEl.appendChild(el);
  portals.push({el, tx:0, ty:0, activity:0});
  // drag
  let dragging=false, ox=0, oy=0;
  el.addEventListener('pointerdown', e => { dragging=true; ox=e.offsetX; oy=e.offsetY; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (!dragging) return; el.style.left=(e.clientX-ox)+'px'; el.style.top=(e.clientY-oy)+'px'; });
  el.addEventListener('pointerup', () => dragging=false);
}

// Pointer inject
let mx=-1, my=-1;
canvas.addEventListener('pointerdown', e => {
  const rect = canvas.getBoundingClientRect();
  mx = (e.clientX-rect.left)/rect.width * W;
  my = (e.clientY-rect.top)/rect.height * H;
  injectAt(mx, my);
});
canvas.addEventListener('pointermove', e => {
  if (e.buttons) {
    const rect = canvas.getBoundingClientRect();
    mx = (e.clientX-rect.left)/rect.width * W;
    my = (e.clientY-rect.top)/rect.height * H;
    injectAt(mx, my, 0.3);
  }
});
function injectAt(x, y, strength=0.8) {
  const ix=x|0, iy=y|0;
  for (let dy=-3; dy<=3; dy++) for (let dx=-3; dx<=3; dx++) {
    const px=(ix+dx+W)%W, py=(iy+dy+H)%H;
    if (dx*dx+dy*dy<10) V[py*W+px] = Math.min(1, V[py*W+px]+strength);
  }
}
document.getElementById('injectBtn').onclick = () => injectAt(W/2, H/2, 1);

// Orientation
let tiltX=0, tiltY=0;
if (window.DeviceOrientationEvent) {
  window.addEventListener('deviceorientation', e => {
    tiltX = (e.gamma||0)/90;
    tiltY = (e.beta||0)/90;
  });
}

// Simulation step
function step() {
  // Update params from MLPs
  for (const m of mlps) {
    const ix = m.x|0, iy = m.y|0;
    let sumU=0, sumV=0, cnt=0;
    for (let dy=-2; dy<=2; dy++) for (let dx=-2; dx<=2; dx++) {
      const px=(ix+dx+W)%W, py=(iy+dy+H)%H;
      sumU += U[py*W+px]; sumV += V[py*W+px]; cnt++;
    }
    const lu = sumU/cnt, lv = sumV/cnt;
    const pd = mx>=0 ? Math.hypot(m.x-mx, m.y-my)/W : 1;
    const inp = [lu-0.5, lv, 0, pd, tiltX];
    const [df, dk] = mlpForward(m, inp);
    // apply to neighborhood
    for (let dy=-4; dy<=4; dy++) for (let dx=-4; dx<=4; dx++) {
      const px=(ix+dx+W)%W, py=(iy+dy+H)%H;
      const w = Math.exp(-(dx*dx+dy*dy)/8);
      Ffield[py*W+px] = Math.max(0.01, Math.min(0.08, Ffield[py*W+px] + df*w*0.3));
      Kfield[py*W+px] = Math.max(0.04, Math.min(0.09, Kfield[py*W+px] + dk*w*0.3));
    }
    m.fitness = lv;
    // move MLP slightly toward high V
    m.x = (m.x + (Math.random()-0.5)*2 + tiltX*3 + W) % W;
    m.y = (m.y + (Math.random()-0.5)*2 + tiltY*3 + H) % H;
  }

  // Gray-Scott update (JS)
  const nU = new Float32Array(U), nV = new Float32Array(V);
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    const i = y*W+x;
    const u=U[i], v=V[i], f=Ffield[i], k=Kfield[i];
    // laplacian
    const uL = U[((y-1+H)%H)*W+x] + U[((y+1)%H)*W+x] + U[y*W+(x-1+W)%W] + U[y*W+(x+1)%W] - 4*u;
    const vL = V[((y-1+H)%H)*W+x] + V[((y+1)%H)*W+x] + V[y*W+(x-1+W)%W] + V[y*W+(x+1)%W] - 4*v;
    const uvv = u*v*v;
    nU[i] = u + dt*(Du*uL - uvv + f*(1-u));
    nV[i] = v + dt*(Dv*vL + uvv - (f+k)*v);
    nU[i] = Math.max(0, Math.min(1, nU[i]));
    nV[i] = Math.max(0, Math.min(1, nV[i]));
  }
  U.set(nU); V.set(nV);
}

// Render
function render() {
  const img = ctx.createImageData(W, H);
  for (let i=0; i<W*H; i++) {
    const v = V[i];
    const r = Math.min(255, v*180 + 20);
    const g = Math.min(255, (1-v)*100 + v*40);
    const b = Math.min(255, (1-v)*200 + 40);
    img.data[i*4] = r; img.data[i*4+1]=g; img.data[i*4+2]=b; img.data[i*4+3]=255;
  }
  // upscale
  const tmp = document.createElement('canvas');
  tmp.width=W; tmp.height=H;
  tmp.getContext('2d').putImageData(img,0,0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);

  // Update portals
  portals.forEach((p, idx) => {
    // find a high-V spot near current or random
    let best=0, bx=W/2, by=H/2;
    for (let t=0; t<20; t++) {
      const x=(Math.random()*W)|0, y=(Math.random()*H)|0;
      if (V[y*W+x] > best) { best=V[y*W+x]; bx=x; by=y; }
    }
    const px = (bx / W) * canvas.width;
    const py = (by / H) * canvas.height;
    p.el.style.left = (px - 40)+'px';
    p.el.style.top = (py - 25)+'px';
    const scale = 0.7 + best*0.8;
    p.el.style.transform = `scale(${scale})`;
    const hue = 200 + best*60;
    p.el.style.borderColor = `hsl(${hue},80%,60%)`;
    p.el.style.background = `hsla(${hue},50%,30%,0.6)`;
    p.activity = best;
  });
}

// Loop
let frame=0;
function loop() {
  for (let s=0; s<3; s++) step(); // multiple substeps
  if (frame%2===0) render();
  frame++;
  if (frame%60===0) statusEl.textContent = `Frame ${frame} | MLPs active | Vmax≈${Math.max(...V).toFixed(2)}`;
  requestAnimationFrame(loop);
}

// Resize
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Seal
document.getElementById('sealBtn').onclick = async () => {
  const genomes = mlps.map(m => ({w1:m.w1, b1:m.b1, w2:m.w2, b2:m.b2}));
  const data = {genomes, F0, K0, time:Date.now()};
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f732-rd',1);
      r.onupgradeneeded = () => r.result.createObjectStore('seal');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seal','readwrite');
    tx.objectStore('seal').put(data, 'latest');
    statusEl.textContent = 'Genome sealed to IndexedDB';
  } catch(e) { statusEl.textContent = 'Seal failed (memory only)'; }
};

document.getElementById('resetBtn').onclick = () => { initField(); statusEl.textContent='Pattern reset'; };

// Load if present
(async () => {
  try {
    const db = await new Promise(res => {
      const r = indexedDB.open('verse-f732-rd',1);
      r.onsuccess = () => res(r.result);
    });
    const tx = db.transaction('seal','readonly');
    const req = tx.objectStore('seal').get('latest');
    req.onsuccess = () => {
      if (req.result && req.result.genomes) {
        req.result.genomes.forEach((g,i) => {
          if (mlps[i]) Object.assign(mlps[i], g);
        });
        statusEl.textContent = 'Restored sealed genome';
      }
    };
  } catch (e) { console.debug("lab f732-webgpu-gray-scott-mlp-param-field-dom-portals-mind:", e); }
  statusEl.textContent = 'Running Gray-Scott MLP field';
  loop();
})();
