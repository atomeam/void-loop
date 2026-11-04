const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');
const status = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 32; // grid
let phi = new Float32Array(N*N), rho = new Float32Array(N*N), phiTmp = new Float32Array(N*N);
const agents = [];
let sealed = null;
let selected = null;
let orient = { beta:0, gamma:0 };

class MLP {
  constructor() {
    this.w1 = Array.from({length:4}, () => Array.from({length:3}, () => (Math.random()-0.5)*0.5));
    this.b1 = Array.from({length:4}, () => (Math.random()-0.5)*0.2);
    this.w2 = Array.from({length:1}, () => Array.from({length:4}, () => (Math.random()-0.5)*0.5));
    this.b2 = [(Math.random()-0.5)*0.2];
  }
  forward(x) { // x: [3]
    const h = this.w1.map((row,i) => Math.max(0, row.reduce((s,w,j)=>s+w*x[j], this.b1[i])));
    return this.w2[0].reduce((s,w,j)=>s+w*h[j], this.b2[0]);
  }
  clone() {
    const m = new MLP();
    m.w1 = this.w1.map(r=>r.slice()); m.b1 = this.b1.slice();
    m.w2 = this.w2.map(r=>r.slice()); m.b2 = this.b2.slice();
    return m;
  }
  serialize() { return JSON.stringify({w1:this.w1,b1:this.b1,w2:this.w2,b2:this.b2}); }
}

function hashStr(s) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(buf =>
    Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16)
  );
}

class Agent {
  constructor(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.mlp = new MLP();
    this.el = document.createElement('div');
    this.el.className = 'card';
    this.el.textContent = 'φ';
    this.el.onclick = () => { selected = this; document.querySelectorAll('.card').forEach(c=>c.classList.remove('selected')); this.el.classList.add('selected'); };
    stage.appendChild(this.el);
  }
  update(dt, px, py) {
    const gx = Math.floor(this.x / W * N), gy = Math.floor(this.y / H * N);
    const i = Math.max(0,Math.min(N-1,gy))*N + Math.max(0,Math.min(N-1,gx));
    const gradX = (phi[i+1]||0) - (phi[i-1]||0);
    const gradY = (phi[i+N]||0) - (phi[i-N]||0);
    const speed = Math.hypot(gradX, gradY);
    const pdist = Math.hypot(this.x-px, this.y-py) / Math.hypot(W,H);
    const bias = (orient.beta + orient.gamma) * 0.01;
    const inp = [Math.min(1, speed*2), 1-pdist, bias];
    const charge = this.mlp.forward(inp) * 0.3;
    rho[i] += charge;
    this.vx = -gradX * 40; this.vy = -gradY * 40;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.x < 20) this.x = 20; if (this.x > W-20) this.x = W-20;
    if (this.y < 20) this.y = 20; if (this.y > H-20) this.y = H-20;
    const sc = 1 + Math.min(0.6, speed*0.8);
    const hue = (phi[i]*40 + 200) % 360;
    this.el.style.transform = `translate(${this.x-36}px,${this.y-24}px) scale(${sc})`;
    this.el.style.background = `hsla(${hue},70%,40%,0.85)`;
    this.el.style.filter = `hue-rotate(${hue}deg)`;
  }
  destroy() { this.el.remove(); }
}

function solvePoisson() {
  for (let it=0; it<6; it++) {
    for (let y=1; y<N-1; y++) for (let x=1; x<N-1; x++) {
      const i = y*N+x;
      phiTmp[i] = (phi[i-1] + phi[i+1] + phi[i-N] + phi[i+N] - rho[i]) * 0.25;
    }
    [phi, phiTmp] = [phiTmp, phi];
  }
  rho.fill(0);
}

function drawField() {
  ctx.clearRect(0,0,W,H);
  const img = ctx.createImageData(N, N);
  for (let i=0; i<N*N; i++) {
    const v = Math.max(-1, Math.min(1, phi[i]*2));
    const c = v > 0 ? [40,80,180] : [180,60,40];
    const a = Math.abs(v)*180;
    img.data[i*4] = c[0]; img.data[i*4+1] = c[1]; img.data[i*4+2] = c[2]; img.data[i*4+3] = a;
  }
  const tmp = document.createElement('canvas'); tmp.width=N; tmp.height=N;
  tmp.getContext('2d').putImageData(img,0,0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, W, H);
}

let px=W/2, py=H/2;
addEventListener('pointermove', e => { px=e.clientX; py=e.clientY; });
addEventListener('pointerdown', e => { px=e.clientX; py=e.clientY; });

if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => { orient.beta = e.beta||0; orient.gamma = e.gamma||0; });
}

document.getElementById('nucleate').onclick = () => {
  if (agents.length < 8) agents.push(new Agent(Math.random()*W, Math.random()*H));
};
document.getElementById('sealSel').onclick = async () => {
  if (!selected) return;
  sealed = { mlp: selected.mlp.clone(), hash: await hashStr(selected.mlp.serialize()) };
  status.textContent = `Sealed ${sealed.hash}`;
};
document.getElementById('transfer').onclick = () => {
  if (!sealed || !selected) return;
  selected.mlp = sealed.mlp.clone();
  status.textContent = `Transferred ${sealed.hash}`;
};
document.getElementById('sealAll').onclick = async () => {
  const state = { phi: Array.from(phi), agents: agents.map(a => ({x:a.x,y:a.y,mlp:a.mlp.serialize()})) };
  try {
    const db = await new Promise((res,rej) => { const r=indexedDB.open('f504',1); r.onupgradeneeded=e=>e.target.result.createObjectStore('s'); r.onsuccess=e=>res(e.target.result); r.onerror=rej; });
    const tx = db.transaction('s','readwrite'); tx.objectStore('s').put(state, 'state');
    status.textContent = 'Sealed to IndexedDB';
  } catch(e) { status.textContent = 'IDB fail'; }
};
document.getElementById('restore').onclick = async () => {
  try {
    const db = await new Promise((res,rej) => { const r=indexedDB.open('f504',1); r.onsuccess=e=>res(e.target.result); r.onerror=rej; });
    const state = await new Promise(res => { const tx=db.transaction('s'); const req=tx.objectStore('s').get('state'); req.onsuccess=()=>res(req.result); });
    if (!state) return;
    phi.set(state.phi);
    agents.forEach(a=>a.destroy()); agents.length=0;
    state.agents.forEach(sa => {
      const a = new Agent(sa.x, sa.y);
      const d = JSON.parse(sa.mlp);
      a.mlp.w1=d.w1; a.mlp.b1=d.b1; a.mlp.w2=d.w2; a.mlp.b2=d.b2;
      agents.push(a);
    });
    status.textContent = 'Restored';
  } catch(e) { status.textContent = 'Restore fail'; }
};
document.getElementById('clear').onclick = () => { agents.forEach(a=>a.destroy()); agents.length=0; phi.fill(0); status.textContent = 'Cleared'; };

// seed a few
for (let i=0;i<4;i++) agents.push(new Agent(Math.random()*W, Math.random()*H));

let last = performance.now();
function loop(t) {
  const dt = Math.min(0.05, (t-last)/1000); last=t;
  agents.forEach(a => a.update(dt, px, py));
  solvePoisson();
  drawField();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
