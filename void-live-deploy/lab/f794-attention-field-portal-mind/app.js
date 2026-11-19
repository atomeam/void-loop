const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N_PORTALS = 4;
const HIST = 48;
const GRID_W = 96, GRID_H = 54;
const field = new Float32Array(GRID_W * GRID_H);
const fieldNext = new Float32Array(GRID_W * GRID_H);

let history = []; // {x,y,vx,vy,tx,ty,e,t}
let pointer = {x: W/2, y: H/2, vx: 0, vy: 0};
let tilt = {x: 0, y: 0};

// Simple genome: Q, K, V weights per head (tiny)
let genome = {
  q: Array.from({length: N_PORTALS}, () => Array.from({length: 4}, () => Math.random()*0.4-0.2)),
  k: Array.from({length: 4}, () => Math.random()*0.4-0.2),
  v: Array.from({length: 4}, () => Math.random()*0.3-0.15),
  bias: Array.from({length: N_PORTALS}, () => Math.random()*0.2-0.1)
};

function loadGenome() {
  try {
    const raw = localStorage.getItem('verse-f794-genome');
    if (raw) genome = JSON.parse(raw);
  } catch (e) { console.debug("lab f794-attention-field-portal-mind:", e); }
}
loadGenome();

function seal() {
  try {
    localStorage.setItem('verse-f794-genome', JSON.stringify(genome));
    document.getElementById('seal').textContent = 'Sealed ✓';
    setTimeout(() => document.getElementById('seal').textContent = 'Seal Genome', 1200);
  } catch (e) { console.debug("lab f794-attention-field-portal-mind:", e); }
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { history = []; genome.q.forEach(q => q.fill(0)); location.reload(); };

function addEvent(e) {
  history.push({...e, t: performance.now()});
  if (history.length > HIST) history.shift();
  document.getElementById('hlen').textContent = history.length;
}

// Pointer
addEventListener('pointermove', ev => {
  const dx = ev.clientX - pointer.x, dy = ev.clientY - pointer.y;
  pointer.vx = dx * 0.3; pointer.vy = dy * 0.3;
  pointer.x = ev.clientX; pointer.y = ev.clientY;
  addEvent({x: pointer.x/W, y: pointer.y/H, vx: pointer.vx, vy: pointer.vy, tx: tilt.x, ty: tilt.y, e: 0.3});
});
addEventListener('pointerdown', ev => {
  addEvent({x: ev.clientX/W, y: ev.clientY/H, vx: 0, vy: 0, tx: tilt.x, ty: tilt.y, e: 1.2});
});

// Orientation
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', ev => {
    tilt.x = (ev.gamma || 0) / 45;
    tilt.y = (ev.beta || 0) / 45;
  });
}

// Portals
const portals = [];
for (let i = 0; i < N_PORTALS; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.innerHTML = `<div class="score">0.00</div><div class="den">0.0</div>`;
  document.body.appendChild(el);
  portals.push({
    el,
    x: Math.random() * W, y: Math.random() * H,
    tx: 0, ty: 0,
    score: 0,
    drag: false
  });
  el.addEventListener('pointerdown', e => { portals[i].drag = true; e.stopPropagation(); });
  el.addEventListener('pointerup', () => portals[i].drag = false);
  el.addEventListener('pointermove', e => {
    if (!portals[i].drag) return;
    portals[i].x = e.clientX; portals[i].y = e.clientY;
    addEvent({x: e.clientX/W, y: e.clientY/H, vx: 0, vy: 0, tx: tilt.x, ty: tilt.y, e: 1.8});
  });
}

function attention() {
  if (history.length < 4) return;
  const keys = history.slice(-16);
  for (let p = 0; p < N_PORTALS; p++) {
    const portal = portals[p];
    const qx = portal.x / W, qy = portal.y / H;
    let scores = [];
    for (let h = 0; h < 4; h++) {
      const qv = genome.q[p][h];
      let logits = [];
      for (const k of keys) {
        const kv = genome.k[h] * (k.x * 0.5 + k.y * 0.3 + k.e * 0.4 + k.tx * 0.2);
        logits.push(qv * kv + genome.bias[p]);
      }
      const maxL = Math.max(...logits);
      const exps = logits.map(l => Math.exp(l - maxL));
      const sum = exps.reduce((a,b)=>a+b, 1e-8);
      scores.push(exps.map(e => e/sum));
    }
    // Average heads → target
    let tx = 0, ty = 0, total = 0;
    for (let i = 0; i < keys.length; i++) {
      let w = 0;
      for (let h = 0; h < 4; h++) w += scores[h][i];
      w /= 4;
      tx += keys[i].x * w;
      ty += keys[i].y * w;
      total += w;
    }
    if (total > 0) {
      portal.tx = tx / total * W;
      portal.ty = ty / total * H;
    }
    // Score as max attention
    portal.score = Math.max(...scores.flat());
    // Soft mutate genome slightly toward recent high-energy
    if (Math.random() < 0.02) {
      const hi = keys.reduce((a,b,i) => b.e > a.e ? {e:b.e,i} : a, {e:0,i:0});
      if (hi.e > 0.5) genome.q[p][hi.i % 4] += (Math.random()-0.5)*0.01;
    }
  }
}

function updateField() {
  // Diffusion + decay
  for (let y = 1; y < GRID_H-1; y++) {
    for (let x = 1; x < GRID_W-1; x++) {
      const i = y*GRID_W + x;
      const n = field[(y-1)*GRID_W+x] + field[(y+1)*GRID_W+x] + field[y*GRID_W+x-1] + field[y*GRID_W+x+1];
      fieldNext[i] = field[i]*0.82 + n*0.045;
    }
  }
  field.set(fieldNext);

  // Inject sources from portals + recent high energy
  for (const p of portals) {
    const gx = Math.floor(p.x / W * GRID_W);
    const gy = Math.floor(p.y / H * GRID_H);
    if (gx>=0 && gx<GRID_W && gy>=0 && gy<GRID_H) {
      field[gy*GRID_W + gx] += p.score * 0.4;
    }
  }
  const recent = history.slice(-3);
  for (const e of recent) {
    if (e.e > 0.4) {
      const gx = Math.floor(e.x * GRID_W);
      const gy = Math.floor(e.y * GRID_H);
      if (gx>=0 && gx<GRID_W && gy>=0 && gy<GRID_H)
        field[gy*GRID_W + gx] += e.e * 0.6;
    }
  }

  // Decay overall
  for (let i = 0; i < field.length; i++) field[i] *= 0.985;
}

function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  const img = ctx.createImageData(GRID_W, GRID_H);
  let energy = 0;
  for (let i = 0; i < field.length; i++) {
    const v = Math.min(1, field[i]);
    energy += v;
    const c = Math.floor(v * 255);
    img.data[i*4] = c * 0.3;
    img.data[i*4+1] = c * 0.6;
    img.data[i*4+2] = c;
    img.data[i*4+3] = 255;
  }
  // Scale up
  const tmp = document.createElement('canvas');
  tmp.width = GRID_W; tmp.height = GRID_H;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, W, H);

  document.getElementById('en').textContent = energy.toFixed(1);

  // Update portals
  for (const p of portals) {
    if (!p.drag) {
      p.x += (p.tx - p.x) * 0.08;
      p.y += (p.ty - p.y) * 0.08;
    }
    p.el.style.left = (p.x - 45) + 'px';
    p.el.style.top = (p.y - 24) + 'px';
    p.el.style.transform = `scale(${0.85 + p.score * 0.6})`;
    p.el.style.borderColor = `hsl(${200 + p.score*80}, 80%, 60%)`;
    const gx = Math.floor(p.x / W * GRID_W);
    const gy = Math.floor(p.y / H * GRID_H);
    const den = (gx>=0 && gy>=0) ? field[gy*GRID_W+gx].toFixed(2) : '0';
    p.el.innerHTML = `<div class="score">${p.score.toFixed(2)}</div><div class="den">d ${den}</div>`;
  }
}

function loop() {
  attention();
  updateField();
  render();
  requestAnimationFrame(loop);
}
loop();

// Initial seed
for (let i = 0; i < 8; i++) addEvent({x: Math.random(), y: Math.random(), vx:0, vy:0, tx:0, ty:0, e: 0.5});
