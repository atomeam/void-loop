const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// --- Local tiny MLP (8 in → 16 hidden → 4 out) ---
// Inputs: 4 joint vel residuals + 2 hand pos + 2 orient
// Outputs: stiffness, damping, attract, noise
class TinyMLP {
  constructor() {
    this.w1 = new Float32Array(8*16).map(() => (Math.random()-0.5)*0.4);
    this.b1 = new Float32Array(16);
    this.w2 = new Float32Array(16*4).map(() => (Math.random()-0.5)*0.4);
    this.b2 = new Float32Array(4);
    this.h = new Float32Array(16);
  }
  forward(x) { // x: Float32Array(8)
    for (let i=0; i<16; i++) {
      let s = this.b1[i];
      for (let j=0; j<8; j++) s += x[j] * this.w1[i*8+j];
      this.h[i] = Math.tanh(s);
    }
    const out = new Float32Array(4);
    for (let i=0; i<4; i++) {
      let s = this.b2[i];
      for (let j=0; j<16; j++) s += this.h[j] * this.w2[i*16+j];
      out[i] = Math.tanh(s) * 0.5 + 0.5; // 0..1
    }
    return out;
  }
  async seal() {
    const data = new Uint8Array(this.w1.buffer.byteLength + this.w2.buffer.byteLength);
    // simple hash proxy
    let h = 0;
    for (let i=0; i<this.w1.length; i++) h = (h * 31 + (this.w1[i]*1000|0)) | 0;
    for (let i=0; i<this.w2.length; i++) h = (h * 31 + (this.w2[i]*1000|0)) | 0;
    return 'mlp-' + Math.abs(h).toString(16);
  }
}
const mlp = new TinyMLP();
let sealedId = 'unsealed';

// --- Particles with simple PBD-like constraints ---
const N = 180;
const particles = [];
for (let i=0; i<N; i++) {
  particles.push({
    x: Math.random()*W, y: Math.random()*H,
    px: 0, py: 0, // previous for verlet
    vx: 0, vy: 0,
    m: 0.8 + Math.random()*0.4,
    c: `hsl(${180+Math.random()*80},70%,55%)`
  });
}
// init previous
particles.forEach(p => { p.px = p.x; p.py = p.y; });

let handX = W/2, handY = H/2;
let handVx = 0, handVy = 0;
let joints = []; // proxy joints
let gravityX = 0, gravityY = 0.08;
let xrSession = null, xrRefSpace = null;

// Pointer as hand proxy
canvas.addEventListener('pointermove', e => {
  if (xrSession) return;
  const nx = e.clientX, ny = e.clientY;
  handVx = nx - handX; handVy = ny - handY;
  handX = nx; handY = ny;
  // generate 4 proxy joints around hand
  joints = [
    {x: handX, y: handY, vx: handVx, vy: handVy},
    {x: handX+30, y: handY-20, vx: handVx*0.8, vy: handVy*0.8},
    {x: handX-25, y: handY+15, vx: handVx*0.9, vy: handVy*0.7},
    {x: handX+10, y: handY+40, vx: handVx*0.6, vy: handVy*1.1}
  ];
});
canvas.addEventListener('pointerdown', e => { handX = e.clientX; handY = e.clientY; });

// DeviceOrientation as gravity bias
addEventListener('deviceorientation', e => {
  if (e.gamma != null) gravityX = e.gamma / 90 * 0.25;
  if (e.beta != null) gravityY = Math.max(0, e.beta / 90) * 0.2 + 0.04;
});

// WebXR hand tracking attempt
async function tryXR() {
  if (!navigator.xr) { document.getElementById('status').textContent = 'WebXR not available — using pointer proxy'; return; }
  try {
    const ok = await navigator.xr.isSessionSupported('immersive-vr');
    if (!ok) throw new Error('immersive-vr unsupported');
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    xrRefSpace = await xrSession.requestReferenceSpace('local');
    xrSession.addEventListener('end', () => { xrSession = null; document.getElementById('status').textContent = 'XR ended'; });
    document.getElementById('status').textContent = 'WebXR Hand session active';
    xrSession.requestAnimationFrame(onXRFrame);
  } catch (err) {
    document.getElementById('status').textContent = 'XR failed: ' + err.message + ' — pointer proxy';
  }
}
function onXRFrame(t, frame) {
  if (!xrSession) return;
  const pose = frame.getViewerPose(xrRefSpace);
  if (pose) {
    // extract hand joints if available
    const hands = [];
    for (const src of frame.session.inputSources) {
      if (src.hand) {
        const wrist = frame.getJointPose(src.hand.get('wrist'), xrRefSpace);
        if (wrist) {
          // project roughly to screen (simplified)
          const p = wrist.transform.position;
          hands.push({x: (p.x + 1)*W/2, y: (1 - p.y)*H/2, vx: 0, vy: 0});
        }
      }
    }
    if (hands.length) {
      joints = hands.slice(0,4);
      handX = joints[0].x; handY = joints[0].y;
    }
  }
  xrSession.requestAnimationFrame(onXRFrame);
}
document.getElementById('xrBtn').onclick = tryXR;
document.getElementById('resetBtn').onclick = () => {
  particles.forEach(p => { p.x = Math.random()*W; p.y = Math.random()*H; p.px=p.x; p.py=p.y; p.vx=p.vy=0; });
};
document.getElementById('sealBtn').onclick = async () => {
  sealedId = await mlp.seal();
  document.getElementById('status').textContent = 'Sealed: ' + sealedId;
};

// Simulation step (PBD-inspired: integrate + constraint projection to hand joints)
function step() {
  // MLP input: residual velocities of up to 4 joints + hand pos norm + orient
  const inp = new Float32Array(8);
  for (let i=0; i<4; i++) {
    const j = joints[i] || {vx:0,vy:0};
    inp[i] = Math.tanh(j.vx * 0.05);
    inp[i+4] = Math.tanh(j.vy * 0.05); // wait, better packing
  }
  // fix packing: 4 vels + 2 pos + 2 grav
  inp[0] = Math.tanh((joints[0]?.vx||0)*0.04);
  inp[1] = Math.tanh((joints[0]?.vy||0)*0.04);
  inp[2] = Math.tanh((joints[1]?.vx||0)*0.04);
  inp[3] = Math.tanh((joints[1]?.vy||0)*0.04);
  inp[4] = (handX / W - 0.5) * 2;
  inp[5] = (handY / H - 0.5) * 2;
  inp[6] = gravityX * 4;
  inp[7] = gravityY * 4;
  const ctrl = mlp.forward(inp); // [stiffness, damping, attract, noise]
  const stiff = 0.15 + ctrl[0] * 0.6;
  const damp = 0.82 + ctrl[1] * 0.15;
  const attract = 0.02 + ctrl[2] * 0.12;
  const noise = ctrl[3] * 0.4;

  for (const p of particles) {
    // gravity + noise
    p.vx += gravityX + (Math.random()-0.5)*noise*0.1;
    p.vy += gravityY + (Math.random()-0.5)*noise*0.1;
    // verlet-ish
    const nx = p.x + p.vx;
    const ny = p.y + p.vy;
    p.vx = (nx - p.px) * damp;
    p.vy = (ny - p.py) * damp;
    p.px = p.x; p.py = p.y;
    p.x = nx; p.y = ny;

    // constraint projection toward nearest hand joint (PBD-style distance)
    if (joints.length) {
      let best = joints[0], bd = 1e9;
      for (const j of joints) {
        const d = (p.x-j.x)**2 + (p.y-j.y)**2;
        if (d < bd) { bd = d; best = j; }
      }
      const dx = best.x - p.x, dy = best.y - p.y;
      const dist = Math.sqrt(dx*dx+dy*dy) || 1;
      const target = 40 + Math.random()*30;
      const corr = (dist - target) * stiff * attract / p.m;
      p.x += dx / dist * corr;
      p.y += dy / dist * corr;
      // velocity inheritance
      p.vx += best.vx * 0.05;
      p.vy += best.vy * 0.05;
    }
    // bounds
    if (p.x < 0) { p.x = 0; p.vx *= -0.5; }
    if (p.x > W) { p.x = W; p.vx *= -0.5; }
    if (p.y < 0) { p.y = 0; p.vy *= -0.5; }
    if (p.y > H) { p.y = H; p.vy *= -0.5; }
  }
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  // joints
  for (const j of joints) {
    ctx.beginPath(); ctx.arc(j.x, j.y, 8, 0, Math.PI*2);
    ctx.fillStyle = '#4af'; ctx.fill();
  }
  // particles
  for (const p of particles) {
    ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, Math.PI*2);
    ctx.fillStyle = p.c; ctx.fill();
  }
  // hand marker
  ctx.beginPath(); ctx.arc(handX, handY, 18, 0, Math.PI*2);
  ctx.strokeStyle = '#8cf'; ctx.lineWidth = 2; ctx.stroke();
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}
loop();

// IndexedDB persistence stub for sealed weights
const dbName = 'f458-mlp';
indexedDB.open(dbName, 1).onsuccess = e => {
  const db = e.target.result;
  if (!db.objectStoreNames.contains('weights')) {
    // upgrade handled on open version
  }
};
