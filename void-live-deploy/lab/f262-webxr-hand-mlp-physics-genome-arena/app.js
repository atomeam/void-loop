const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
resize(); addEventListener('resize', resize);

const N = 12;
const agents = [];
let selected = 0;
let handPos = null;
let xrSession = null;
let xrRefSpace = null;

function rand(a= -1, b=1) { return a + Math.random()*(b-a); }

class TinyMLP {
  constructor() {
    this.w1 = Array.from({length:8}, () => Array.from({length:6}, () => rand(-0.5,0.5)));
    this.b1 = Array.from({length:8}, () => rand(-0.1,0.1));
    this.w2 = Array.from({length:2}, () => Array.from({length:8}, () => rand(-0.5,0.5)));
    this.b2 = Array.from({length:2}, () => rand(-0.1,0.1));
  }
  forward(x) {
    const h = this.b1.map((b,i) => Math.tanh(b + this.w1[i].reduce((s,w,j)=>s+w*x[j],0)));
    return this.b2.map((b,i) => Math.tanh(b + this.w2[i].reduce((s,w,j)=>s+w*h[j],0)));
  }
  clone() {
    const m = new TinyMLP();
    m.w1 = this.w1.map(r=>r.slice()); m.b1 = this.b1.slice();
    m.w2 = this.w2.map(r=>r.slice()); m.b2 = this.b2.slice();
    return m;
  }
  serialize() {
    return {w1:this.w1, b1:this.b1, w2:this.w2, b2:this.b2};
  }
  static deserialize(o) {
    const m = new TinyMLP();
    m.w1 = o.w1; m.b1 = o.b1; m.w2 = o.w2; m.b2 = o.b2;
    return m;
  }
}

function initAgents() {
  agents.length = 0;
  for(let i=0;i<N;i++) {
    agents.push({
      id: i,
      x: rand(0.2,0.8)*W, y: rand(0.2,0.8)*H,
      vx: rand(-1,1), vy: rand(-1,1),
      energy: 50 + Math.random()*50,
      mlp: new TinyMLP(),
      color: `hsl(${i*30},70%,60%)`,
      sealed: false
    });
  }
}
initAgents();

function step() {
  const target = handPos || {x: W/2, y: H/2};
  for(let a of agents) {
    const dx = (target.x - a.x)/W;
    const dy = (target.y - a.y)/H;
    const inputs = [
      dx, dy,
      a.vx/5, a.vy/5,
      a.energy/100,
      Math.sin(performance.now()/1000 + a.id)
    ];
    const [fx, fy] = a.mlp.forward(inputs);
    a.vx += fx * 0.4;
    a.vy += fy * 0.4;
    a.vx *= 0.96; a.vy *= 0.96;
    a.x += a.vx; a.y += a.vy;
    if(a.x < 20 || a.x > W-20) a.vx *= -0.8;
    if(a.y < 20 || a.y > H-20) a.vy *= -0.8;
    a.x = Math.max(20, Math.min(W-20, a.x));
    a.y = Math.max(20, Math.min(H-20, a.y));
    a.energy = Math.max(10, a.energy - 0.05 + Math.abs(fx+fy)*0.1);
  }
  for(let i=0;i<agents.length;i++) for(let j=i+1;j<agents.length;j++) {
    const a=agents[i], b=agents[j];
    const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy);
    if(d<40 && d>0) {
      const nx=dx/d, ny=dy/d, force=(40-d)*0.05;
      a.vx -= nx*force; a.vy -= ny*force;
      b.vx += nx*force; b.vy += ny*force;
    }
  }
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  if(handPos) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(handPos.x, handPos.y, 12, 0, 6.28); ctx.fill();
  }
  agents.forEach((a,i) => {
    ctx.fillStyle = a.color;
    ctx.beginPath(); ctx.arc(a.x, a.y, 16 + a.energy/20, 0, 6.28); ctx.fill();
    if(i===selected) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth=3; ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.fillText(a.id + (a.sealed?'*':''), a.x-6, a.y+4);
  });
  requestAnimationFrame(loop);
}

function loop() { step(); draw(); }

canvas.addEventListener('pointermove', e => {
  if(!xrSession) handPos = {x: e.clientX, y: e.clientY};
});
canvas.addEventListener('pointerdown', e => {
  const x=e.clientX, y=e.clientY;
  let best=0, bd=1e9;
  agents.forEach((a,i)=>{ const d=Math.hypot(a.x-x,a.y-y); if(d<bd){bd=d;best=i;} });
  if(bd<50) selected = best;
  statusEl.textContent = `Selected agent ${selected}. ${xrSession?'XR hand active':'Pointer mode'}`;
});

document.getElementById('xrBtn').onclick = async () => {
  if(!navigator.xr) { statusEl.textContent='WebXR not available'; return; }
  try {
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hand-tracking'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: document.body }
    });
    xrSession = session;
    xrRefSpace = await session.requestReferenceSpace('local');
    statusEl.textContent = 'WebXR hand session started. Point hand into scene.';
    session.addEventListener('end', () => { xrSession=null; statusEl.textContent='XR ended. Pointer mode.'; });
    const gl = canvas.getContext('webgl2', {xrCompatible:true});
    await gl.makeXRCompatible();
    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
    const onFrame = (t, frame) => {
      session.requestAnimationFrame(onFrame);
      const pose = frame.getViewerPose(xrRefSpace);
      if(!pose) return;
      for(const input of session.inputSources) {
        if(input.hand) {
          const joints = input.hand;
          const tip = joints.get('index-finger-tip');
          if(tip) {
            const p = frame.getJointPose(tip, xrRefSpace);
            if(p) {
              handPos = { x: W/2 + p.transform.position.x * 400, y: H/2 - p.transform.position.y * 400 };
            }
          }
        }
      }
    };
    session.requestAnimationFrame(onFrame);
  } catch(e) {
    statusEl.textContent = 'XR failed: ' + e.message + '. Using pointer.';
  }
};

const DB_NAME = 'f262-genomes';
function openDB() {
  return new Promise((res,rej) => {
    const r = indexedDB.open(DB_NAME,1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('genomes',{keyPath:'id'});
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
document.getElementById('sealBtn').onclick = async () => {
  const a = agents[selected];
  const data = a.mlp.serialize();
  const json = JSON.stringify(data);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json + Date.now()));
  const hex = [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16);
  const db = await openDB();
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put({id: hex, agent: selected, weights: data, ts: Date.now()});
  a.sealed = true;
  statusEl.textContent = `Sealed genome ${hex} for agent ${selected}`;
};
document.getElementById('loadBtn').onclick = async () => {
  const db = await openDB();
  const tx = db.transaction('genomes','readonly');
  const req = tx.objectStore('genomes').getAll();
  req.onsuccess = () => {
    const all = req.result;
    if(!all.length) { statusEl.textContent='No sealed genomes'; return; }
    const last = all[all.length-1];
    const mlp = TinyMLP.deserialize(last.weights);
    agents.forEach(a => a.mlp = mlp.clone());
    statusEl.textContent = `Loaded sealed ${last.id} into all agents`;
  };
};
document.getElementById('resetBtn').onclick = () => { initAgents(); statusEl.textContent='Agents reset'; };

loop();
