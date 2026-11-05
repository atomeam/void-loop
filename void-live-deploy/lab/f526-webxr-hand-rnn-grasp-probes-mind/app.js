const N = 6;
const probes = [];
const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const handEl = document.getElementById('hand');
let hand = { x: window.innerWidth/2, y: window.innerHeight/2, vx: 0, vy: 0, active: false, grasping: null };
let xrSession = null;
let lastTime = performance.now();
let db = null;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('f526-genomes') : null;

function createRNN() {
  const w1 = Array.from({length: 6*8}, () => (Math.random()-0.5)*0.5);
  const b1 = Array.from({length: 8}, () => 0);
  const w2 = Array.from({length: 8*4}, () => (Math.random()-0.5)*0.5);
  const b2 = Array.from({length: 4}, () => 0);
  return { w1, b1, w2, b2, h: Array(8).fill(0) };
}
function rnnForward(rnn, input) {
  const h = [];
  for (let i = 0; i < 8; i++) {
    let s = rnn.b1[i];
    for (let j = 0; j < 6; j++) s += input[j] * rnn.w1[j*8 + i];
    h[i] = Math.tanh(s + 0.3 * rnn.h[i]);
  }
  rnn.h = h;
  const out = [];
  for (let i = 0; i < 4; i++) {
    let s = rnn.b2[i];
    for (let j = 0; j < 8; j++) s += h[j] * rnn.w2[j*4 + i];
    out[i] = Math.tanh(s);
  }
  return out;
}

function initProbes() {
  canvas.querySelectorAll('.probe').forEach(el => el.remove());
  probes.length = 0;
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'probe';
    el.innerHTML = `<div class="label">P${i}<br>fit:0</div>`;
    canvas.appendChild(el);
    const p = {
      el,
      x: Math.random() * (window.innerWidth - 100) + 50,
      y: Math.random() * (window.innerHeight - 100) + 50,
      vx: 0, vy: 0, rot: 0,
      rnn: createRNN(),
      fitness: 0,
      graspCount: 0,
      id: i
    };
    probes.push(p);
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); tryGrasp(p); });
  }
}

function tryGrasp(p) {
  const dist = Math.hypot(hand.x - p.x, hand.y - p.y);
  if (dist < 80) {
    hand.grasping = p;
    p.el.classList.add('grasping');
    p.graspCount++;
  }
}

function updatePhysics(dt) {
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  probes.forEach(p => {
    const input = [
      (hand.x - p.x) / 400,
      (hand.y - p.y) / 400,
      hand.vx / 200,
      hand.vy / 200,
      p.vx / 100,
      p.vy / 100
    ];
    const out = rnnForward(p.rnn, input);
    let ax = out[0] * 80, ay = out[1] * 80;
    p.rot += out[2] * 2;
    const hue = (out[3] * 180 + 180) % 360;
    p.el.style.borderColor = `hsl(${hue}, 80%, 60%)`;
    p.el.style.transform = `translate(${p.x - 40}px, ${p.y - 30}px) rotate(${p.rot}deg) scale(${0.8 + Math.abs(out[3])*0.4})`;

    if (hand.grasping === p) {
      const dx = hand.x - p.x, dy = hand.y - p.y;
      ax += dx * 8; ay += dy * 8;
      p.vx *= 0.7; p.vy *= 0.7;
    } else {
      p.vx += ax * dt; p.vy += ay * dt;
      p.vx *= 0.92; p.vy *= 0.92;
    }
    p.x += p.vx * dt * 60; p.y += p.vy * dt * 60;
    p.x = Math.max(40, Math.min(window.innerWidth - 40, p.x));
    p.y = Math.max(40, Math.min(window.innerHeight - 40, p.y));

    const dCenter = Math.hypot(p.x - cx, p.y - cy);
    p.fitness = p.fitness * 0.95 + (1 / (1 + dCenter/200) + (hand.grasping === p ? 2 : 0) + p.graspCount * 0.1) * 0.05;
    p.el.querySelector('.label').textContent = `P${p.id}\nfit:${p.fitness.toFixed(2)}`;
  });
}

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  updatePhysics(dt);
  handEl.style.left = (hand.x - 20) + 'px';
  handEl.style.top = (hand.y - 20) + 'px';
  handEl.classList.toggle('active', hand.active);
  requestAnimationFrame(loop);
}

canvas.addEventListener('pointermove', e => {
  if (xrSession) return;
  const dx = e.clientX - hand.x, dy = e.clientY - hand.y;
  hand.vx = dx * 0.5; hand.vy = dy * 0.5;
  hand.x = e.clientX; hand.y = e.clientY;
  hand.active = true;
});
canvas.addEventListener('pointerdown', e => {
  if (xrSession) return;
  hand.active = true;
  let nearest = null, nd = 80;
  probes.forEach(p => {
    const d = Math.hypot(hand.x - p.x, hand.y - p.y);
    if (d < nd) { nd = d; nearest = p; }
  });
  if (nearest) tryGrasp(nearest);
});
window.addEventListener('pointerup', () => {
  if (hand.grasping) {
    hand.grasping.el.classList.remove('grasping');
    hand.grasping = null;
  }
});

async function sealGenome(p) {
  if (!p) p = probes.reduce((a,b) => a.fitness > b.fitness ? a : b);
  const data = { weights: [...p.rnn.w1, ...p.rnn.b1, ...p.rnn.w2, ...p.rnn.b2], fitness: p.fitness, graspCount: p.graspCount, ts: Date.now() };
  const str = JSON.stringify(data);
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
  if (db) {
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put({ hash, data, id: hash });
  }
  if (channel) channel.postMessage({ type: 'genome', hash, data });
  statusEl.textContent = `Sealed genome ${hash.slice(0,8)}… fitness ${p.fitness.toFixed(2)}`;
  return hash;
}
document.getElementById('sealBtn').onclick = () => sealGenome();

if (channel) {
  channel.onmessage = (ev) => {
    if (ev.data.type === 'genome') {
      const worst = probes.reduce((a,b) => a.fitness < b.fitness ? a : b);
      statusEl.textContent = `Adopted remote genome ${ev.data.hash.slice(0,8)}…`;
      worst.rnn = createRNN();
      worst.fitness = ev.data.data.fitness * 0.8;
    }
  };
}

const req = indexedDB.open('f526', 1);
req.onupgradeneeded = e => {
  e.target.result.createObjectStore('genomes', { keyPath: 'id' });
};
req.onsuccess = e => { db = e.target.result; };

document.getElementById('xrBtn').onclick = async () => {
  if (!navigator.xr) { statusEl.textContent = 'WebXR not supported — using pointer hand'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    statusEl.textContent = 'WebXR session started (hand tracking if available)';
    xrSession.addEventListener('end', () => { xrSession = null; statusEl.textContent = 'XR ended — pointer mode'; });
  } catch (err) {
    statusEl.textContent = 'WebXR failed: ' + err.message + ' — pointer mode';
  }
};

document.getElementById('resetBtn').onclick = initProbes;

initProbes();
requestAnimationFrame(loop);
statusEl.textContent = 'Verse probes ready — move pointer as hand, click near probe to grasp, Seal to store genome. Multi-tab via BroadcastChannel.';
