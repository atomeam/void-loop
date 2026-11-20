const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const labelsDiv = document.getElementById('labels');
let W = cv.width = innerWidth, H = cv.height = innerHeight;
window.onresize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };

const N = 32;
let pos = new Float32Array(N*2);
let prev = new Float32Array(N*2);
let rest = 40;
let damp = 0.98;
// init chain
for (let i=0; i<N; i++) {
  pos[i*2] = 100 + i*30;
  pos[i*2+1] = H/2;
  prev[i*2] = pos[i*2];
  prev[i*2+1] = pos[i*2+1];
}

// Tiny MLP 4-8-2
let w1 = Float32Array.from({length:4*8}, () => (Math.random()-0.5)*0.5);
let b1 = new Float32Array(8);
let w2 = Float32Array.from({length:8*2}, () => (Math.random()-0.5)*0.5);
let b2 = new Float32Array(2);
let fitness = 0;

function mlp(x) { // x: [a,b,px,py]
  const h = new Float32Array(8);
  for (let j=0; j<8; j++) {
    let s = b1[j];
    for (let i=0; i<4; i++) s += x[i] * w1[i*8+j];
    h[j] = Math.tanh(s);
  }
  const o = new Float32Array(2);
  for (let k=0; k<2; k++) {
    let s = b2[k];
    for (let j=0; j<8; j++) s += h[j] * w2[j*2+k];
    o[k] = Math.tanh(s);
  }
  return o;
}

let orient = [0,0,0];
window.addEventListener('deviceorientation', e => {
  orient = [(e.alpha||0)/180, (e.beta||0)/90, (e.gamma||0)/90];
});
let ptr = [0.5, 0.5];
window.addEventListener('pointermove', e => {
  ptr = [e.clientX/W, e.clientY/H];
});

function step() {
  const inp = [orient[0], orient[1], ptr[0]*2-1, ptr[1]*2-1];
  const out = mlp(inp);
  rest = 30 + out[0]*20;
  damp = 0.9 + out[1]*0.09;

  // Verlet + constraints (JS fallback always for simplicity/reliability)
  for (let i=0; i<N; i++) {
    const x = pos[i*2], y = pos[i*2+1];
    const vx = (x - prev[i*2]) * damp;
    const vy = (y - prev[i*2+1]) * damp + 0.2; // gravity
    prev[i*2] = x; prev[i*2+1] = y;
    pos[i*2] = x + vx;
    pos[i*2+1] = y + vy;
    // bounds
    if (pos[i*2+1] > H-10) { pos[i*2+1] = H-10; prev[i*2+1] = pos[i*2+1]; }
  }
  // distance constraints
  for (let iter=0; iter<4; iter++) {
    for (let i=0; i<N-1; i++) {
      let dx = pos[(i+1)*2] - pos[i*2];
      let dy = pos[(i+1)*2+1] - pos[i*2+1];
      const d = Math.hypot(dx,dy) || 1;
      const diff = (d - rest) / d * 0.5;
      dx *= diff; dy *= diff;
      pos[i*2] += dx; pos[i*2+1] += dy;
      pos[(i+1)*2] -= dx; pos[(i+1)*2+1] -= dy;
    }
  }
  // fixed ends lightly
  pos[0] = 80; pos[1] = H/2;
  pos[(N-1)*2] = W-80; pos[(N-1)*2+1] = H/2;
}

function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = '#4af';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pos[0], pos[1]);
  for (let i=1; i<N; i++) ctx.lineTo(pos[i*2], pos[i*2+1]);
  ctx.stroke();
  ctx.fillStyle = '#8cf';
  for (let i=0; i<N; i+=4) {
    ctx.beginPath();
    ctx.arc(pos[i*2], pos[i*2+1], 4, 0, Math.PI*2);
    ctx.fill();
  }
  // labels
  labelsDiv.innerHTML = '';
  for (let k=0; k<4; k++) {
    const i = Math.floor(k * (N-1)/3);
    const lab = document.createElement('div');
    lab.className = 'label';
    lab.textContent = 'L'+k;
    lab.style.left = pos[i*2]+'px';
    lab.style.top = pos[i*2+1]+'px';
    labelsDiv.appendChild(lab);
  }
}

function loop() {
  step();
  render();
  requestAnimationFrame(loop);
}
loop();

// reward / update
cv.addEventListener('pointerdown', e => {
  const mx = e.clientX, my = e.clientY;
  let minD = 999;
  for (let i=0; i<N; i++) {
    const d = Math.hypot(mx-pos[i*2], my-pos[i*2+1]);
    if (d < minD) minD = d;
  }
  if (minD < 40) {
    fitness += 1;
    document.getElementById('fit').textContent = fitness;
    // simple update: nudge weights toward current out being positive
    const inp = [orient[0], orient[1], ptr[0]*2-1, ptr[1]*2-1];
    const out = mlp(inp);
    const target = [0.5, 0.5]; // prefer mid
    const lr = 0.01;
    // crude SGD on output error
    for (let k=0; k<2; k++) {
      const err = target[k] - out[k];
      b2[k] += lr * err;
      for (let j=0; j<8; j++) w2[j*2+k] += lr * err * 0.1; // approx
    }
  }
  // impulse
  for (let i=0; i<N; i++) {
    const d = Math.hypot(mx-pos[i*2], my-pos[i*2+1]);
    if (d < 60) {
      prev[i*2] -= (mx - pos[i*2])*0.1;
      prev[i*2+1] -= (my - pos[i*2+1])*0.1;
    }
  }
});

// seal
const dbName = 'f846-mlp-chain';
let db;
const req = indexedDB.open(dbName, 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', {keyPath:'id'});
req.onsuccess = e => { db = e.target.result; load(); };
function seal() {
  if (!db) return;
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put({
    id: 'best',
    w1: Array.from(w1), b1: Array.from(b1),
    w2: Array.from(w2), b2: Array.from(b2),
    fitness, ts: Date.now()
  });
  const bc = new BroadcastChannel('f846-genome');
  bc.postMessage({w1:Array.from(w1),b1:Array.from(b1),w2:Array.from(w2),b2:Array.from(b2),fitness});
}
function load() {
  if (!db) return;
  db.transaction('genomes').objectStore('genomes').get('best').onsuccess = e => {
    if (e.target.result && e.target.result.fitness > fitness) adopt(e.target.result);
  };
}
function adopt(g) {
  w1 = Float32Array.from(g.w1); b1 = Float32Array.from(g.b1);
  w2 = Float32Array.from(g.w2); b2 = Float32Array.from(g.b2);
  fitness = g.fitness;
  document.getElementById('fit').textContent = fitness;
}
const bc = new BroadcastChannel('f846-genome');
bc.onmessage = e => { if (e.data.fitness > fitness) adopt(e.data); };

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => location.reload();
document.getElementById('mode').textContent = 'JS Verlet (WebGPU optional)';
