const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
addEventListener('resize', resize);

// Tiny MLP: 4 inputs (beta, gamma, sin, cos bias) → 2 outputs (fx, fy global force)
// Hidden 8 units. Pure JS, no deps.
class TinyMLP {
  constructor() {
    this.w1 = Array.from({length:8}, () => Array.from({length:4}, () => (Math.random()-0.5)*0.5));
    this.b1 = Array.from({length:8}, () => 0);
    this.w2 = Array.from({length:2}, () => Array.from({length:8}, () => (Math.random()-0.5)*0.5));
    this.b2 = Array.from({length:2}, () => 0);
  }
  relu(x) { return Math.max(0, x); }
  forward(x) { // x: [4]
    const h = this.w1.map((row,i) => this.relu(row.reduce((s,w,j)=>s+w*x[j], this.b1[i])));
    return this.w2.map((row,i) => row.reduce((s,w,j)=>s+w*h[j], this.b2[i]));
  }
  // Simple online update: reward * error-ish (REINFORCE-like sparse)
  update(x, reward, lr=0.01) {
    const h = this.w1.map((row,i) => this.relu(row.reduce((s,w,j)=>s+w*x[j], this.b1[i])));
    const out = this.w2.map((row,i) => row.reduce((s,w,j)=>s+w*h[j], this.b2[i]));
    // Dummy gradient: push outputs toward 0 if reward high (stability), or scale by reward
    for (let i=0; i<2; i++) {
      for (let j=0; j<8; j++) this.w2[i][j] += lr * reward * h[j] * (0 - out[i]);
      this.b2[i] += lr * reward * (0 - out[i]);
    }
    // Backprop-ish for hidden (approx)
    for (let j=0; j<8; j++) {
      let d = 0;
      for (let i=0; i<2; i++) d += this.w2[i][j] * (0 - out[i]);
      if (h[j] > 0) {
        for (let k=0; k<4; k++) this.w1[j][k] += lr * reward * d * x[k];
        this.b1[j] += lr * reward * d;
      }
    }
  }
  serialize() { return JSON.stringify({w1:this.w1, b1:this.b1, w2:this.w2, b2:this.b2}); }
  deserialize(s) {
    const o = JSON.parse(s);
    this.w1 = o.w1; this.b1 = o.b1; this.w2 = o.w2; this.b2 = o.b2;
  }
}

const mlp = new TinyMLP();
let orient = {beta:0, gamma:0};
let orientEnabled = false;

document.getElementById('perm').onclick = async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const p = await DeviceOrientationEvent.requestPermission();
      if (p === 'granted') startOrient();
      else status.textContent = 'Permission denied';
    } catch(e) { status.textContent = 'Permission error: ' + e.message; }
  } else {
    startOrient(); // desktop or older
  }
};
function startOrient() {
  orientEnabled = true;
  addEventListener('deviceorientation', e => {
    orient.beta = e.beta || 0;
    orient.gamma = e.gamma || 0;
  });
  status.textContent = 'Orientation active. Tilt to inject forces.';
}

// Agents: physical UI elements on canvas
const agents = Array.from({length:12}, (_,i) => ({
  x: Math.random()*canvas.width,
  y: Math.random()*canvas.height,
  vx: 0, vy: 0,
  r: 14 + Math.random()*8,
  hue: (i*30) % 360
}));

let training = false;
document.getElementById('train').onclick = () => { training = !training; status.textContent = training ? 'Training mode: click agents to reward stability' : 'Training off'; };
document.getElementById('reset').onclick = () => { Object.assign(mlp, new TinyMLP()); status.textContent = 'Weights reset'; };

// IndexedDB persistence
const DB_NAME = 'verse-f452-mlp';
const STORE = 'weights';
let db;
function openDB() {
  return new Promise((res,rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
document.getElementById('save').onclick = async () => {
  try {
    db = db || await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(mlp.serialize(), 'current');
    await new Promise(r => tx.oncomplete = r);
    status.textContent = 'Saved to IndexedDB';
  } catch(e) { status.textContent = 'Save failed: ' + e.message; }
};
document.getElementById('load').onclick = async () => {
  try {
    db = db || await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('current');
    req.onsuccess = () => {
      if (req.result) { mlp.deserialize(req.result); status.textContent = 'Loaded from IndexedDB'; }
      else status.textContent = 'No saved weights';
    };
  } catch(e) { status.textContent = 'Load failed: ' + e.message; }
};

// Interaction: click to reward if training
canvas.onclick = e => {
  if (!training) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  let hit = false;
  for (const a of agents) {
    if (Math.hypot(a.x-mx, a.y-my) < a.r + 10) { hit = true; break; }
  }
  const reward = hit ? 1.0 : -0.3; // reward hitting agents (stable config?)
  const inp = [
    Math.tanh(orient.beta / 90),
    Math.tanh(orient.gamma / 90),
    Math.sin(Date.now()/1000),
    1
  ];
  mlp.update(inp, reward);
  status.textContent = `Trained reward=${reward.toFixed(2)}`;
};

// Simulation loop
function tick() {
  const inp = [
    Math.tanh(orient.beta / 90),
    Math.tanh(orient.gamma / 90),
    Math.sin(performance.now()/2000),
    1
  ];
  const [fx, fy] = mlp.forward(inp);
  // Orientation injects "gravity" proportional to tilt; MLP outputs compensating force
  const g = orientEnabled ? 0.15 : 0;
  const gx = Math.sin(orient.gamma * Math.PI/180) * g;
  const gy = Math.sin(orient.beta * Math.PI/180) * g;

  ctx.fillStyle = 'rgba(5,5,16,0.25)';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  for (const a of agents) {
    a.vx += fx * 0.05 + gx;
    a.vy += fy * 0.05 + gy;
    a.vx *= 0.98; a.vy *= 0.98; // damping
    a.x += a.vx; a.y += a.vy;
    // bounce
    if (a.x < a.r) { a.x = a.r; a.vx *= -0.6; }
    if (a.x > canvas.width - a.r) { a.x = canvas.width - a.r; a.vx *= -0.6; }
    if (a.y < a.r) { a.y = a.r; a.vy *= -0.6; }
    if (a.y > canvas.height - a.r) { a.y = canvas.height - a.r; a.vy *= -0.6; }
    // draw
    ctx.beginPath();
    ctx.fillStyle = `hsl(${a.hue},70%,60%)`;
    ctx.arc(a.x, a.y, a.r, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#fff2';
    ctx.stroke();
  }
  // HUD force vector
  ctx.fillStyle = '#aaf';
  ctx.fillText(`MLP force: (${fx.toFixed(2)}, ${fy.toFixed(2)}) | tilt β=${orient.beta.toFixed(0)} γ=${orient.gamma.toFixed(0)}`, 10, canvas.height - 20);

  requestAnimationFrame(tick);
}
tick();

// Auto-try load on start
openDB().then(d => { db = d; status.textContent += ' | DB ready'; }).catch(()=>{});
