const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W, H, particles = [], orbs = [];
const N = 24;
let rnn = { w: [], h: new Float32Array(8), out: new Float32Array(3) };
let mode = 'flat';
let handForce = { x:0, y:0, z:0, active:false };
let orient = { beta:0, gamma:0 };

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
addEventListener('resize', resize); resize();

// Tiny RNN: input 6 (hand vel or pointer + orient) → hidden 8 → out 3 (fx, fy, mode)
function initRNN() {
  rnn.w = Array.from({length: 6*8 + 8*8 + 8*3}, () => (Math.random()-0.5)*0.3);
}
function rnnStep(input) {
  const h = rnn.h, w = rnn.w;
  let idx = 0;
  const nh = new Float32Array(8);
  for (let i=0;i<8;i++) {
    let s = 0;
    for (let j=0;j<6;j++) s += input[j] * w[idx++];
    for (let j=0;j<8;j++) s += h[j] * w[idx++];
    nh[i] = Math.tanh(s);
  }
  rnn.h.set(nh);
  const o = rnn.out;
  for (let i=0;i<3;i++) {
    let s = 0;
    for (let j=0;j<8;j++) s += nh[j] * w[idx++];
    o[i] = Math.tanh(s);
  }
  return o;
}

function initParticles() {
  particles = [];
  orbs.forEach(o => o.remove());
  orbs = [];
  for (let i=0;i<N;i++) {
    const p = {
      x: Math.random()*W, y: Math.random()*H,
      vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
      mass: 0.8 + Math.random()*0.4
    };
    particles.push(p);
    const el = document.createElement('div');
    el.className = 'orb';
    el.textContent = i;
    document.body.appendChild(el);
    orbs.push(el);
  }
}
initRNN(); initParticles();

// Pointer / touch as fallback causal input
let pointer = { x: W/2, y: H/2, vx:0, vy:0, active:false };
canvas.addEventListener('pointerdown', e => { pointer.active=true; pointer.x=e.clientX; pointer.y=e.clientY; });
canvas.addEventListener('pointermove', e => {
  if (!pointer.active && !handForce.active) return;
  const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
  pointer.vx = dx*0.3; pointer.vy = dy*0.3;
  pointer.x = e.clientX; pointer.y = e.clientY;
});
canvas.addEventListener('pointerup', () => pointer.active=false);
canvas.addEventListener('pointerleave', () => pointer.active=false);

// DeviceOrientation causal
addEventListener('deviceorientation', e => {
  if (e.beta != null) {
    orient.beta = e.beta; orient.gamma = e.gamma;
  }
});

// WebXR hand tracking
let xrSession = null;
document.getElementById('xrBtn').onclick = async () => {
  if (!navigator.xr) { statusEl.textContent = 'No WebXR'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    statusEl.textContent = 'XR active · hand tracking';
    mode = 'xr';
    xrSession.addEventListener('end', () => { mode='flat'; statusEl.textContent='Flat mode'; xrSession=null; });
    const gl = canvas.getContext('webgl2'); // minimal for XR
    await gl.makeXRCompatible();
    const ref = await xrSession.requestReferenceSpace('local');
    const loop = (time, frame) => {
      if (!xrSession) return;
      xrSession.requestAnimationFrame(loop);
      const pose = frame.getViewerPose(ref);
      if (!pose) return;
      // Hand input (simplified: first hand joints)
      const inputSources = xrSession.inputSources;
      handForce.active = false;
      for (const src of inputSources) {
        if (src.hand) {
          const wrist = src.hand.get('wrist');
          if (wrist) {
            const p = frame.getJointPose(wrist, ref);
            if (p) {
              handForce.x = p.transform.position.x * 200;
              handForce.y = -p.transform.position.y * 200;
              handForce.active = true;
            }
          }
        }
      }
    };
    xrSession.requestAnimationFrame(loop);
  } catch (e) { statusEl.textContent = 'XR failed: ' + e.message; }
};

// Physics step (Canvas2D; WebGPU path stubbed for length — full compute would replace this loop)
function step() {
  const input = new Float32Array(6);
  if (handForce.active) {
    input[0] = handForce.x / W; input[1] = handForce.y / H; input[2] = 0;
  } else if (pointer.active) {
    input[0] = pointer.vx / 20; input[1] = pointer.vy / 20; input[2] = 1;
  }
  input[3] = orient.beta / 90; input[4] = orient.gamma / 90; input[5] = mode==='xr'?1:0;
  const ctrl = rnnStep(input); // [fx, fy, mode]

  const fx = ctrl[0] * 0.8, fy = ctrl[1] * 0.8;
  const damp = 0.92 + ctrl[2]*0.05;

  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0,0,W,H);

  for (let i=0;i<particles.length;i++) {
    const p = particles[i];
    // Spring to neighbors + control force
    let ax=fx, ay=fy;
    for (let j=0;j<particles.length;j++) if (i!==j) {
      const o = particles[j];
      const dx=o.x-p.x, dy=o.y-p.y;
      const d2=dx*dx+dy*dy+10;
      const d=Math.sqrt(d2);
      const f = (d-80)/d * 0.002;
      ax += dx*f; ay += dy*f;
    }
    p.vx = (p.vx + ax) * damp;
    p.vy = (p.vy + ay) * damp;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>W) p.vx*=-0.8;
    if (p.y<0||p.y>H) p.vy*=-0.8;
    p.x = Math.max(0,Math.min(W,p.x));
    p.y = Math.max(0,Math.min(H,p.y));

    // Draw trail
    ctx.fillStyle = `hsla(${200+ctrl[2]*40},60%,50%,0.6)`;
    ctx.beginPath(); ctx.arc(p.x,p.y,4,0,6.28); ctx.fill();

    // DOM embodiment
    const el = orbs[i];
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.style.setProperty('--hue', 180 + ctrl[0]*40);
    el.style.transform = `translate(-50%,-50%) scale(${0.8+Math.abs(ctrl[2])*0.4})`;
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// IndexedDB seal of genome
const DB = 'f200-genome';
function openDB() {
  return new Promise((res,rej) => {
    const r = indexedDB.open(DB,1);
    r.onupgradeneeded = () => r.result.createObjectStore('weights');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
document.getElementById('sealBtn').onclick = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction('weights','readwrite');
    tx.objectStore('weights').put(Array.from(rnn.w), 'genome');
    statusEl.textContent = 'Genome sealed';
  } catch(e) { statusEl.textContent = 'Seal failed'; }
};
document.getElementById('resetBtn').onclick = () => { initRNN(); initParticles(); statusEl.textContent='Reset'; };

// Load sealed if present
(async () => {
  try {
    const db = await openDB();
    const tx = db.transaction('weights');
    const req = tx.objectStore('weights').get('genome');
    req.onsuccess = () => { if (req.result) { rnn.w = req.result; statusEl.textContent += ' · genome loaded'; } };
  } catch(e) {}
})();
