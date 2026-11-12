const N = 6;
const agents = [];
const scene = document.getElementById('scene');
let policy = initPolicy(); // {w1: Float32Array, b1, w2, b2}
let bestFit = 0;
let totalFit = 0;
const channel = new BroadcastChannel('f706-genome');
let gaze = {x:0, y:0}; // normalized -1..1
let xrSession = null;

function initPolicy() {
  const h = 4, inD = 6, outD = 2;
  return {
    w1: new Float32Array(inD * h).map(() => (Math.random()-0.5)*0.5),
    b1: new Float32Array(h).map(() => (Math.random()-0.5)*0.1),
    w2: new Float32Array(h * outD).map(() => (Math.random()-0.5)*0.5),
    b2: new Float32Array(outD).map(() => (Math.random()-0.5)*0.1)
  };
}

function forward(p, input) { // input 6
  const h = 4;
  const hid = new Float32Array(h);
  for (let i=0; i<h; i++) {
    let s = p.b1[i];
    for (let j=0; j<6; j++) s += input[j] * p.w1[j*h + i];
    hid[i] = Math.tanh(s);
  }
  const out = new Float32Array(2);
  for (let i=0; i<2; i++) {
    let s = p.b2[i];
    for (let j=0; j<h; j++) s += hid[j] * p.w2[j*2 + i];
    out[i] = Math.tanh(s) * 0.8;
  }
  return out;
}

function initAgents() {
  scene.innerHTML = '';
  agents.length = 0;
  for (let i=0; i<N; i++) {
    const el = document.createElement('div');
    el.className = 'card';
    el.textContent = 'A' + i;
    el.dataset.i = i;
    scene.appendChild(el);
    agents.push({
      el, x: (Math.random()-0.5)*600, y: (Math.random()-0.5)*400, z: Math.random()*100,
      vx:0, vy:0, vz:0, fit:0
    });
  }
  document.getElementById('n').textContent = N;
}

function applyPhysics() {
  const dt = 0.016;
  const k = 0.02, damp = 0.95, wall = 0.1;
  for (let i=0; i<agents.length; i++) {
    const a = agents[i];
    // springs to neighbors
    for (let j=i+1; j<agents.length; j++) {
      const b = agents[j];
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const dist = Math.hypot(dx,dy,dz) || 1;
      const rest = 180;
      const force = k * (dist - rest) / dist;
      a.vx += force * dx; a.vy += force * dy; a.vz += force * dz;
      b.vx -= force * dx; b.vy -= force * dy; b.vz -= force * dz;
    }
    // walls
    if (Math.abs(a.x) > 400) a.vx -= Math.sign(a.x) * wall;
    if (Math.abs(a.y) > 300) a.vy -= Math.sign(a.y) * wall;
    // integrate
    a.vx *= damp; a.vy *= damp; a.vz *= damp;
    a.x += a.vx * 20; a.y += a.vy * 20; a.z += a.vz * 5;
    // CSS transform
    a.el.style.transform = `translate3d(${a.x}px, ${a.y}px, ${a.z}px) rotateY(${a.x*0.05}deg)`;
  }
}

function step() {
  // gaze update already done
  for (let i=0; i<agents.length; i++) {
    const a = agents[i];
    const input = new Float32Array([gaze.x, gaze.y, a.x/400, a.y/300, a.vx, a.vy]);
    const force = forward(policy, input);
    a.vx += force[0] * 0.5;
    a.vy += force[1] * 0.5;
    // dwell fitness
    const dist = Math.hypot(a.x - gaze.x*300, a.y - gaze.y*200);
    if (dist < 120) {
      a.fit += 0.01;
      a.el.classList.add('focused');
    } else a.el.classList.remove('focused');
  }
  applyPhysics();
  totalFit = agents.reduce((s,a) => s + a.fit, 0);
  document.getElementById('fit').textContent = totalFit.toFixed(1);
  requestAnimationFrame(step);
}

function seal() {
  const genome = {
    w1: Array.from(policy.w1), b1: Array.from(policy.b1),
    w2: Array.from(policy.w2), b2: Array.from(policy.b2),
    fit: totalFit, ts: Date.now()
  };
  localStorage.setItem('verse-f706-policy', JSON.stringify(genome)); // IndexedDB fallback simple
  channel.postMessage(genome);
  bestFit = Math.max(bestFit, totalFit);
  alert('Sealed. Fitness ' + totalFit.toFixed(1));
}

function adopt(g) {
  if (g.fit > totalFit) {
    policy.w1.set(g.w1); policy.b1.set(g.b1);
    policy.w2.set(g.w2); policy.b2.set(g.b2);
    totalFit = g.fit;
  }
}

channel.onmessage = e => adopt(e.data);

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { policy = initPolicy(); initAgents(); totalFit=0; };
document.getElementById('reward').onclick = () => {
  let nearest = agents[0], md = 1e9;
  agents.forEach(a => {
    const d = Math.hypot(a.x - gaze.x*300, a.y - gaze.y*200);
    if (d < md) { md = d; nearest = a; }
  });
  nearest.fit += 1;
};

// Pointer as gaze fallback
window.addEventListener('pointermove', e => {
  gaze.x = (e.clientX / innerWidth - 0.5) * 2;
  gaze.y = (e.clientY / innerHeight - 0.5) * 2;
  document.getElementById('gaze').textContent = 'pointer';
});

// Optional WebXR gaze attempt (graceful)
if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-vr').then(supported => {
    if (supported) document.getElementById('gaze').textContent = 'WebXR ready';
  });
}

initAgents();
// restore
try {
  const saved = JSON.parse(localStorage.getItem('verse-f706-policy'));
  if (saved) adopt(saved);
} catch (e) { console.debug("lab f706-webxr-gaze-rigid-dom-policy-mind:", e); }
step();
