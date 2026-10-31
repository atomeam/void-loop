const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N_IN = 4, N_HID = 6, N_OUT = 2;
function randn() { return (Math.random()*2-1)*0.3; }
function makeMLP() {
  return {
    w1: Float32Array.from({length: N_IN*N_HID}, randn),
    b1: Float32Array.from({length: N_HID}, randn),
    w2: Float32Array.from({length: N_HID*N_OUT}, randn),
    b2: Float32Array.from({length: N_OUT}, randn)
  };
}
function forward(m, x) {
  const h = new Float32Array(N_HID);
  for (let i=0;i<N_HID;i++) {
    let s = m.b1[i];
    for (let j=0;j<N_IN;j++) s += m.w1[i*N_IN+j]*x[j];
    h[i] = Math.tanh(s);
  }
  const o = new Float32Array(N_OUT);
  for (let i=0;i<N_OUT;i++) {
    let s = m.b2[i];
    for (let j=0;j<N_HID;j++) s += m.w2[i*N_HID+j]*h[j];
    o[i] = Math.tanh(s);
  }
  return o;
}
function mutate(m, rate=0.05) {
  const n = makeMLP();
  ['w1','b1','w2','b2'].forEach(k => {
    for (let i=0;i<n[k].length;i++) n[k][i] = m[k][i] + (Math.random()*2-1)*rate;
  });
  return n;
}

let agents = [];
function spawn(n) {
  agents = [];
  for (let i=0;i<n;i++) {
    agents.push({
      x: Math.random()*W, y: Math.random()*H,
      vx: (Math.random()-0.5)*1.2, vy: (Math.random()-0.5)*1.2,
      mlp: makeMLP(),
      residual: 1, energy: 1, hue: Math.random()*360,
      grasped: false
    });
  }
}
spawn(16);

let hand = { x: W/2, y: H/2, px: W/2, py: H/2, grasping: false, present: false };
let orient = { gx: 0, gy: 0 };

// Pointer fallback
canvas.addEventListener('pointerdown', e => { hand.grasping = true; hand.present = true; });
canvas.addEventListener('pointerup', e => { hand.grasping = false; });
canvas.addEventListener('pointermove', e => {
  hand.px = hand.x; hand.py = hand.y;
  hand.x = e.clientX; hand.y = e.clientY;
  hand.present = true;
});

// DeviceOrientation bias
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    orient.gx = (e.gamma || 0) / 45;
    orient.gy = (e.beta || 0) / 45;
  });
}

// WebXR hand (progressive)
let xrSession = null, xrRefSpace = null;
document.getElementById('xrBtn').onclick = async () => {
  if (!navigator.xr) return alert('WebXR not available');
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    xrRefSpace = await xrSession.requestReferenceSpace('local');
    xrSession.addEventListener('end', () => { xrSession = null; });
    xrSession.requestAnimationFrame(onXRFrame);
  } catch (err) { console.warn(err); }
};
function onXRFrame(t, frame) {
  if (!xrSession) return;
  const pose = frame.getViewerPose(xrRefSpace);
  if (pose) {
    const input = xrSession.inputSources[0];
    if (input && input.hand) {
      const wrist = input.hand.get('wrist');
      if (wrist) {
        const p = frame.getJointPose(wrist, xrRefSpace);
        if (p) {
          hand.px = hand.x; hand.py = hand.y;
          hand.x = (p.transform.position.x * 200 + W/2);
          hand.y = (-p.transform.position.y * 200 + H/2);
          hand.present = true;
          const tip = input.hand.get('index-finger-tip');
          const thumb = input.hand.get('thumb-tip');
          if (tip && thumb) {
            const tp = frame.getJointPose(tip, xrRefSpace);
            const thp = frame.getJointPose(thumb, xrRefSpace);
            if (tp && thp) {
              const d = Math.hypot(tp.transform.position.x-thp.transform.position.x, tp.transform.position.y-thp.transform.position.y);
              hand.grasping = d < 0.03;
            }
          }
        }
      }
    }
  }
  xrSession.requestAnimationFrame(onXRFrame);
}

function step() {
  const hx = (hand.x / W - 0.5)*2, hy = (hand.y / H - 0.5)*2;
  const dhx = (hand.x - hand.px)/W, dhy = (hand.y - hand.py)/H;

  agents.forEach(a => {
    const inp = [hx - (a.x/W-0.5)*2, hy - (a.y/H-0.5)*2, a.vx*0.1, a.vy*0.1];
    const pred = forward(a.mlp, inp);
    const res = Math.hypot(pred[0] - dhx*5, pred[1] - dhy*5);
    a.residual = a.residual*0.9 + res*0.1;
    a.energy = Math.max(0.1, 1.2 - a.residual);

    a.vx += pred[0]*0.15 + orient.gx*0.05 + (Math.random()-0.5)*0.02;
    a.vy += pred[1]*0.15 + orient.gy*0.05 + (Math.random()-0.5)*0.02;
    a.vx *= 0.98; a.vy *= 0.98;
    a.x += a.vx; a.y += a.vy;
    if (a.x < 10 || a.x > W-10) a.vx *= -1;
    if (a.y < 10 || a.y > H-10) a.vy *= -1;
    a.x = Math.max(10, Math.min(W-10, a.x));
    a.y = Math.max(10, Math.min(H-10, a.y));

    const dhand = Math.hypot(a.x-hand.x, a.y-hand.y);
    a.grasped = hand.grasping && dhand < 40;
  });

  for (let i=0;i<agents.length;i++) {
    for (let j=i+1;j<agents.length;j++) {
      const a = agents[i], b = agents[j];
      const d = Math.hypot(a.x-b.x, a.y-b.y);
      if (d < 28 && (a.grasped || b.grasped)) {
        if (a.residual < b.residual) {
          b.mlp = mutate(a.mlp, 0.08);
          b.residual = a.residual * 1.1;
        } else {
          a.mlp = mutate(b.mlp, 0.08);
          a.residual = b.residual * 1.1;
        }
        const nx = (a.x-b.x)/d, ny = (a.y-b.y)/d;
        a.x += nx*4; b.x -= nx*4;
      }
    }
  }

  const avgRes = agents.reduce((s,a)=>s+a.residual,0)/agents.length;
  document.documentElement.style.setProperty('--hue', (200 + avgRes*40)|0);
  document.documentElement.style.setProperty('--energy', Math.min(1, 1.5-avgRes));
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  agents.forEach(a => {
    ctx.beginPath();
    ctx.arc(a.x, a.y, 10 + a.energy*6, 0, Math.PI*2);
    ctx.fillStyle = `hsla(${a.hue},70%,${50+a.energy*20}%,0.85)`;
    ctx.fill();
    if (a.grasped) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
  if (hand.present) {
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, hand.grasping ? 18 : 8, 0, Math.PI*2);
    ctx.strokeStyle = hand.grasping ? '#0f0' : '#888';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  requestAnimationFrame(loop);
}
function loop() { step(); draw(); }
loop();

const DB = 'f471-genome';
function openDB() {
  return new Promise((res,rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('seal');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
document.getElementById('sealBtn').onclick = async () => {
  const db = await openDB();
  const tx = db.transaction('seal','readwrite');
  tx.objectStore('seal').put({
    agents: agents.map(a => ({
      x:a.x, y:a.y, vx:a.vx, vy:a.vy,
      residual:a.residual, energy:a.energy, hue:a.hue,
      mlp: { w1:[...a.mlp.w1], b1:[...a.mlp.b1], w2:[...a.mlp.w2], b2:[...a.mlp.b2] }
    })),
    t: Date.now()
  }, 'latest');
  document.getElementById('status').textContent = 'Sealed living population.';
};
document.getElementById('restoreBtn').onclick = async () => {
  const db = await openDB();
  const req = db.transaction('seal').objectStore('seal').get('latest');
  req.onsuccess = () => {
    const d = req.result;
    if (!d) return;
    agents = d.agents.map(a => ({
      ...a,
      mlp: { w1: Float32Array.from(a.mlp.w1), b1: Float32Array.from(a.mlp.b1),
             w2: Float32Array.from(a.mlp.w2), b2: Float32Array.from(a.mlp.b2) },
      grasped: false
    }));
    document.getElementById('status').textContent = 'Restored sealed population.';
  };
};
document.getElementById('nAgents').oninput = e => spawn(+e.target.value);
