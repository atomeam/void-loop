const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 16, DIM = 8;
const agents = [];
let gaze = { x: W/2, y: H/2, active: false, sustained: 0 };
let xrSession = null, xrRefSpace = null, xrViewer = null;

function rand(a,b){ return a + Math.random()*(b-a); }
function hashStr(s){ let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return (h>>>0).toString(16); }

class Agent {
  constructor(i) {
    this.id = i;
    this.x = rand(50, W-50); this.y = rand(50, H-50);
    this.vx = 0; this.vy = 0;
    this.energy = 0.5;
    this.weights = new Float32Array(DIM*DIM).map(() => rand(-0.2,0.2));
    this.state = new Float32Array(DIM).map(() => rand(0,1));
    this.activation = 0;
  }
  hebbianUpdate(cue) {
    for(let i=0;i<DIM;i++) for(let j=0;j<DIM;j++) {
      this.weights[i*DIM+j] += 0.05 * cue[i] * this.state[j] * this.energy;
      this.weights[i*DIM+j] *= 0.995;
    }
    for(let i=0;i<DIM;i++) this.state[i] = this.state[i]*0.8 + cue[i]*0.2;
    this.activation = this.state.reduce((a,b)=>a+b,0)/DIM;
  }
  sealedFragment() {
    const w = Array.from(this.weights.slice(0,16)).map(v=>v.toFixed(3)).join(',');
    return hashStr(w + this.id);
  }
  receiveSealed(other) {
    for(let k=0;k<32;k++) {
      const idx = Math.floor(Math.random()*this.weights.length);
      this.weights[idx] = other.weights[idx] * (0.9 + Math.random()*0.2);
    }
    this.energy = Math.min(1, this.energy + 0.1);
  }
}

for(let i=0;i<N;i++) agents.push(new Agent(i));

function projectGaze() {
  const cue = new Float32Array(DIM);
  const nx = gaze.x / W, ny = gaze.y / H;
  for(let i=0;i<DIM;i++) cue[i] = Math.sin(nx* (i+1)*3.14) * Math.cos(ny*(i+1)*2.7) * (gaze.active?1:0.2);
  return cue;
}

function step() {
  const cue = projectGaze();
  let totE=0, totA=0;
  agents.forEach(a => {
    const dx = gaze.x - a.x, dy = gaze.y - a.y, d = Math.hypot(dx,dy)||1;
    if (gaze.active && d < 180) {
      a.hebbianUpdate(cue);
      const f = 0.08 * (180-d)/180 * a.energy;
      a.vx += (dx/d)*f; a.vy += (dy/d)*f;
      a.energy = Math.min(1, a.energy + 0.002);
    } else {
      a.energy *= 0.998;
    }
    agents.forEach(b => {
      if (a===b) return;
      const ddx = a.x-b.x, ddy=a.y-b.y, dd=Math.hypot(ddx,ddy)||1;
      if (dd < 40) {
        a.vx += (ddx/dd)*0.4; a.vy += (ddy/dd)*0.4;
        if (gaze.sustained > 30 && dd < 28 && a.activation > b.activation) {
          b.receiveSealed(a);
        }
      }
    });
    a.vx *= 0.92; a.vy *= 0.92;
    a.x = Math.max(20, Math.min(W-20, a.x + a.vx));
    a.y = Math.max(20, Math.min(H-20, a.y + a.vy));
    totE += a.energy; totA += a.activation;
  });
  if (gaze.active) gaze.sustained = Math.min(60, gaze.sustained+1); else gaze.sustained = Math.max(0, gaze.sustained-2);
  document.documentElement.style.setProperty('--energy', (totE/N).toFixed(2));
  document.documentElement.style.setProperty('--assoc', (totA/N).toFixed(2));
  document.getElementById('energy').textContent = (totE/N).toFixed(2);
  document.getElementById('assoc').textContent = (totA/N).toFixed(2);
}

function draw() {
  ctx.fillStyle = 'rgba(10,12,20,0.25)';
  ctx.fillRect(0,0,W,H);
  if (gaze.active) {
    ctx.beginPath(); ctx.arc(gaze.x, gaze.y, 12 + gaze.sustained*0.3, 0, Math.PI*2);
    ctx.strokeStyle = `hsla(160,70%,60%,0.7)`; ctx.lineWidth=2; ctx.stroke();
  }
  agents.forEach(a => {
    const r = 8 + a.energy*6;
    ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, Math.PI*2);
    ctx.fillStyle = `hsla(${200 + a.activation*80}, 70%, ${40+a.energy*30}%, 0.85)`;
    ctx.fill();
    ctx.strokeStyle = a.activation>0.5 ? '#fff' : '#666'; ctx.stroke();
  });
}

function loop() { step(); draw(); requestAnimationFrame(loop); }
loop();

canvas.addEventListener('pointermove', e => { gaze.x = e.clientX; gaze.y = e.clientY; gaze.active = true; });
canvas.addEventListener('pointerleave', () => gaze.active = false);
canvas.addEventListener('pointerdown', e => { gaze.active = true; gaze.sustained = 20; });

document.getElementById('xrBtn').onclick = async () => {
  if (!navigator.xr) { alert('WebXR not available; using pointer.'); return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-ar', { optionalFeatures: ['hand-tracking'] });
    xrRefSpace = await xrSession.requestReferenceSpace('local');
    xrSession.addEventListener('end', () => { xrSession = null; });
    const gl = canvas.getContext('webgl2', { xrCompatible: true });
    await gl.makeXRCompatible();
    xrSession.updateRenderState({ baseLayer: new XRWebGLLayer(xrSession, gl) });
    xrSession.requestAnimationFrame(onXRFrame);
  } catch(e) { console.warn(e); alert('XR failed; pointer active.'); }
};

function onXRFrame(t, frame) {
  if (!xrSession) return;
  const pose = frame.getViewerPose(xrRefSpace);
  if (pose) {
    gaze.x = W/2 + Math.sin(t*0.001)*100;
    gaze.y = H/2 + Math.cos(t*0.001)*80;
    gaze.active = true;
  }
  xrSession.requestAnimationFrame(onXRFrame);
}

const DB = 'f477-hebbian';
function openDB() {
  return new Promise((res,rej) => {
    const r = indexedDB.open(DB,1);
    r.onupgradeneeded = () => r.result.createObjectStore('state');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}
async function seal() {
  const db = await openDB();
  const data = agents.map(a => ({
    id:a.id, x:a.x, y:a.y, energy:a.energy,
    weights: Array.from(a.weights), state: Array.from(a.state)
  }));
  const tx = db.transaction('state','readwrite');
  tx.objectStore('state').put({ agents:data, t:Date.now() }, 'pop');
  await new Promise(r => tx.oncomplete = r);
  document.getElementById('status').textContent = 'Sealed to IndexedDB.';
}
async function restore() {
  const db = await openDB();
  const tx = db.transaction('state');
  const req = tx.objectStore('state').get('pop');
  req.onsuccess = () => {
    const d = req.result;
    if (!d) { document.getElementById('status').textContent = 'No seal found.'; return; }
    d.agents.forEach((s,i) => {
      if (agents[i]) {
        agents[i].x = s.x; agents[i].y = s.y; agents[i].energy = s.energy;
        agents[i].weights.set(s.weights); agents[i].state.set(s.state);
      }
    });
    document.getElementById('status').textContent = 'Restored from seal.';
  };
}
document.getElementById('sealBtn').onclick = seal;
document.getElementById('restoreBtn').onclick = restore;
addEventListener('keydown', e => {
  if (e.key==='s' || e.key==='S') seal();
  if (e.key==='r' || e.key==='R') restore();
});
