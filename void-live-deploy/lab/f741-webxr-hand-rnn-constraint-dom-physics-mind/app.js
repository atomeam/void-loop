const N = 10;
const bodies = [];
const portals = [];
let hand = {x: innerWidth/2, y: innerHeight/2};
let usingXR = false;
let session = null;
let frameId = 0;
const DB = 'verse-f741-rnn';
const BC = new BroadcastChannel('f741-genomes');
let bestFitness = -Infinity;
let bestGenome = null;

function makeRNN() {
  const resSize = 8;
  const W = new Float32Array(resSize * resSize);
  for (let i = 0; i < W.length; i++) W[i] = (Math.random() - 0.5) * 0.4;
  const Win = new Float32Array(resSize * 4); // 2 pos + 2 vel history-ish
  for (let i = 0; i < Win.length; i++) Win[i] = (Math.random() - 0.5) * 0.8;
  const Wout = new Float32Array(3 * resSize); // dx, dy, stiff
  for (let i = 0; i < Wout.length; i++) Wout[i] = (Math.random() - 0.5) * 0.5;
  return { resSize, W, Win, Wout, state: new Float32Array(resSize) };
}

function stepRNN(rnn, input) {
  const s = rnn.state;
  const ns = new Float32Array(rnn.resSize);
  for (let i = 0; i < rnn.resSize; i++) {
    let acc = 0;
    for (let j = 0; j < rnn.resSize; j++) acc += rnn.W[i * rnn.resSize + j] * s[j];
    for (let k = 0; k < 4; k++) acc += rnn.Win[i * 4 + k] * input[k];
    ns[i] = Math.tanh(acc);
  }
  rnn.state.set(ns);
  const out = [0,0,0];
  for (let o = 0; o < 3; o++) {
    let acc = 0;
    for (let i = 0; i < rnn.resSize; i++) acc += rnn.Wout[o * rnn.resSize + i] * ns[i];
    out[o] = Math.tanh(acc) * (o < 2 ? 40 : 0.5) + (o < 2 ? 0 : 0.3);
  }
  return out;
}

function init() {
  document.getElementById('world').innerHTML = '';
  bodies.length = 0;
  portals.length = 0;
  for (let i = 0; i < N; i++) {
    const b = {
      x: Math.random() * innerWidth * 0.8 + innerWidth * 0.1,
      y: Math.random() * innerHeight * 0.7 + innerHeight * 0.15,
      vx: 0, vy: 0,
      mass: 1 + Math.random() * 0.5,
      energy: 0,
      fitness: 0,
      rnn: makeRNN(),
      targetX: 0, targetY: 0, stiff: 0.3
    };
    bodies.push(b);
    const p = document.createElement('div');
    p.className = 'portal';
    p.textContent = `A${i}\n0`;
    p.onclick = () => reward(i);
    document.getElementById('world').appendChild(p);
    portals.push(p);
  }
  bestFitness = -Infinity;
  bestGenome = null;
  updateInfo();
}

function reward(i) {
  const b = bodies[i];
  b.fitness += 10;
  b.energy += 5;
  // simple mutation toward current output
  const r = b.rnn;
  for (let k = 0; k < r.Wout.length; k++) {
    if (Math.random() < 0.15) r.Wout[k] += (Math.random() - 0.5) * 0.08;
  }
  if (b.fitness > bestFitness) {
    bestFitness = b.fitness;
    bestGenome = serialize(b);
  }
  updateInfo();
}

function serialize(b) {
  return {
    fitness: b.fitness,
    W: Array.from(b.rnn.W),
    Win: Array.from(b.rnn.Win),
    Wout: Array.from(b.rnn.Wout)
  };
}

function applyGenome(g) {
  if (!g || g.fitness <= bestFitness) return;
  bestFitness = g.fitness;
  bestGenome = g;
  // apply to all for simplicity, or best
  bodies.forEach(b => {
    b.rnn.W.set(g.W);
    b.rnn.Win.set(g.Win);
    b.rnn.Wout.set(g.Wout);
    b.fitness = g.fitness * 0.8;
  });
  updateInfo();
}

function updateInfo() {
  document.getElementById('info').textContent = `bodies: ${N} | best: ${bestFitness.toFixed(1)}`;
}

function physicsStep(dt) {
  // RNN drive
  const hx = (hand.x / innerWidth - 0.5) * 2;
  const hy = (hand.y / innerHeight - 0.5) * 2;
  bodies.forEach(b => {
    const input = [hx, hy, b.vx * 0.01, b.vy * 0.01];
    const out = stepRNN(b.rnn, input);
    b.targetX = hand.x + out[0];
    b.targetY = hand.y + out[1];
    b.stiff = Math.max(0.05, Math.min(0.8, out[2]));
    // spring to target
    const dx = b.targetX - b.x;
    const dy = b.targetY - b.y;
    const f = b.stiff * 0.15;
    b.vx += dx * f / b.mass;
    b.vy += dy * f / b.mass;
    // energy from proximity
    const dist = Math.hypot(hand.x - b.x, hand.y - b.y);
    if (dist < 120) {
      b.energy += (120 - dist) * 0.01;
      b.fitness += 0.05;
    }
  });
  // constraints: pairwise soft springs between nearby
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const a = bodies[i], c = bodies[j];
      const dx = c.x - a.x, dy = c.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 140) {
        const rest = 90;
        const force = (d - rest) * 0.002;
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        a.vx += fx / a.mass;
        a.vy += fy / a.mass;
        c.vx -= fx / c.mass;
        c.vy -= fy / c.mass;
      }
    }
  }
  // integrate
  bodies.forEach(b => {
    b.vx *= 0.92;
    b.vy *= 0.92;
    b.x += b.vx * dt * 60;
    b.y += b.vy * dt * 60;
    // bounds
    if (b.x < 40) { b.x = 40; b.vx *= -0.5; }
    if (b.x > innerWidth - 40) { b.x = innerWidth - 40; b.vx *= -0.5; }
    if (b.y < 40) { b.y = 40; b.vy *= -0.5; }
    if (b.y > innerHeight - 40) { b.y = innerHeight - 40; b.vy *= -0.5; }
  });
  // render portals
  bodies.forEach((b, i) => {
    const p = portals[i];
    p.style.left = (b.x - 45) + 'px';
    p.style.top = (b.y - 35) + 'px';
    p.style.transform = `scale(${1 + Math.min(b.energy, 20) * 0.01})`;
    p.className = b.fitness > bestFitness * 0.7 ? 'portal high' : 'portal';
    p.innerHTML = `A${i}<br>${b.fitness.toFixed(0)}`;
  });
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  physicsStep(dt);
  // simple trail
  const ctx = document.getElementById('trail').getContext('2d');
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0,0,innerWidth,innerHeight);
  ctx.fillStyle = '#6af';
  bodies.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI*2);
    ctx.fill();
  });
  requestAnimationFrame(loop);
}

// pointer
document.addEventListener('pointermove', e => {
  if (!usingXR) {
    hand.x = e.clientX;
    hand.y = e.clientY;
  }
});

// XR
document.getElementById('xr').onclick = async () => {
  if (!navigator.xr) { alert('WebXR not available; using pointer.'); return; }
  try {
    session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    usingXR = true;
    document.getElementById('xr').textContent = 'In XR';
    session.addEventListener('end', () => { usingXR = false; document.getElementById('xr').textContent = 'Enter XR'; });
    // simple frame loop for hand
    const ref = await session.requestReferenceSpace('local');
    function onXRFrame(t, frame) {
      const pose = frame.getViewerPose(ref);
      if (pose && frame.session.inputSources) {
        for (const src of frame.session.inputSources) {
          if (src.hand) {
            const joint = src.hand.get('index-finger-tip') || src.hand.get('wrist');
            if (joint) {
              const jp = frame.getJointPose(joint, ref);
              if (jp) {
                // project roughly
                hand.x = innerWidth/2 + jp.transform.position.x * 200;
                hand.y = innerHeight/2 - jp.transform.position.y * 200;
              }
            }
          }
        }
      }
      session.requestAnimationFrame(onXRFrame);
    }
    session.requestAnimationFrame(onXRFrame);
  } catch (err) {
    console.warn(err);
    alert('XR failed; pointer fallback active.');
  }
};

// seal / load
async function seal() {
  if (!bestGenome) return;
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
  const tx = db.transaction('genomes', 'readwrite');
  tx.objectStore('genomes').put(bestGenome, 'best');
  BC.postMessage({ type: 'genome', data: bestGenome });
  document.getElementById('status').textContent = 'Genome sealed and broadcast.';
}

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = init;

BC.onmessage = e => {
  if (e.data.type === 'genome') applyGenome(e.data.data);
};

// load
async function load() {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readonly');
    const g = await new Promise(res => {
      const req = tx.objectStore('genomes').get('best');
      req.onsuccess = () => res(req.result);
    });
    if (g) applyGenome(g);
  } catch (e) { console.debug("lab f741-webxr-hand-rnn-constraint-dom-physics-mind:", e); }
}

window.addEventListener('resize', () => {
  const c = document.getElementById('trail');
  c.width = innerWidth;
  c.height = innerHeight;
});
document.getElementById('trail').width = innerWidth;
document.getElementById('trail').height = innerHeight;

init();
load();
requestAnimationFrame(loop);
