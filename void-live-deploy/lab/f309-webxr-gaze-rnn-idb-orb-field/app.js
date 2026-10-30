const N_AGENTS = 4, N_ORBS = 8, HIDDEN = 8, INPUT = 6, OUTPUT = 2;
const canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// Tiny RNN: simple Elman-style, weights serializable
function createRNN() {
  const wih = new Float32Array(HIDDEN * INPUT).map(() => (Math.random() - 0.5) * 0.4);
  const whh = new Float32Array(HIDDEN * HIDDEN).map(() => (Math.random() - 0.5) * 0.3);
  const who = new Float32Array(OUTPUT * HIDDEN).map(() => (Math.random() - 0.5) * 0.5);
  const h = new Float32Array(HIDDEN);
  return { wih, whh, who, h, fitness: 0, id: Math.random().toString(36).slice(2, 7) };
}
function tanh(x) { return Math.tanh(x); }
function stepRNN(rnn, input) {
  const newH = new Float32Array(HIDDEN);
  for (let i = 0; i < HIDDEN; i++) {
    let s = 0;
    for (let j = 0; j < INPUT; j++) s += rnn.wih[i * INPUT + j] * input[j];
    for (let j = 0; j < HIDDEN; j++) s += rnn.whh[i * HIDDEN + j] * rnn.h[j];
    newH[i] = tanh(s);
  }
  rnn.h.set(newH);
  const out = new Float32Array(OUTPUT);
  for (let i = 0; i < OUTPUT; i++) {
    let s = 0;
    for (let j = 0; j < HIDDEN; j++) s += rnn.who[i * HIDDEN + j] * rnn.h[j];
    out[i] = tanh(s);
  }
  return out;
}
function mutate(rnn, rate = 0.08) {
  const m = createRNN();
  m.wih.set(rnn.wih); m.whh.set(rnn.whh); m.who.set(rnn.who);
  for (let a of [m.wih, m.whh, m.who]) for (let i = 0; i < a.length; i++) if (Math.random() < rate) a[i] += (Math.random() - 0.5) * 0.2;
  return m;
}
function serialize(rnn) {
  return { wih: Array.from(rnn.wih), whh: Array.from(rnn.whh), who: Array.from(rnn.who), fitness: rnn.fitness, id: rnn.id };
}
function deserialize(o) {
  const r = createRNN();
  r.wih.set(o.wih); r.whh.set(o.whh); r.who.set(o.who); r.fitness = o.fitness || 0; r.id = o.id || r.id;
  return r;
}

let agents = Array.from({ length: N_AGENTS }, createRNN);
let champIdx = 0;
let orbs = [];
function initOrbs() {
  orbs = Array.from({ length: N_ORBS }, (_, i) => {
    const el = document.createElement('div');
    el.className = 'orb';
    el.textContent = String.fromCharCode(65 + i);
    el.style.left = (Math.random() * (W - 60) + 20) + 'px';
    el.style.top = (Math.random() * (H - 60) + 20) + 'px';
    document.body.appendChild(el);
    return { el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx: 0, vy: 0, agent: i % N_AGENTS };
  });
}
initOrbs();

// Gaze / input
let gx = W / 2, gy = H / 2, gvx = 0, gvy = 0, orient = { beta: 0, gamma: 0 };
let mode = 'pointer';
canvas.addEventListener('pointermove', e => { gx = e.clientX; gy = e.clientY; gvx = e.movementX || 0; gvy = e.movementY || 0; mode = 'pointer'; document.getElementById('mode').textContent = mode; });
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => { orient.beta = e.beta || 0; orient.gamma = e.gamma || 0; if (Math.abs(orient.beta) > 5) mode = 'orient'; document.getElementById('mode').textContent = mode; });
}

// WebXR progressive
let xrSession = null, xrRefSpace = null;
document.getElementById('xr').onclick = async () => {
  if (!navigator.xr) { document.getElementById('hud').textContent = 'WebXR not available'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    xrRefSpace = await xrSession.requestReferenceSpace('local');
    mode = 'webxr';
    document.getElementById('mode').textContent = mode;
    document.getElementById('hud').textContent = 'WebXR session active — gaze via head pose';
    xrSession.addEventListener('end', () => { xrSession = null; mode = 'pointer'; document.getElementById('mode').textContent = mode; });
    const gl = canvas.getContext('webgl2', { xrCompatible: true });
    if (gl) await gl.makeXRCompatible();
    xrSession.updateRenderState({ baseLayer: new XRWebGLLayer(xrSession, gl) });
    xrSession.requestAnimationFrame(onXRFrame);
  } catch (err) { document.getElementById('hud').textContent = 'XR failed: ' + err.message; }
};
function onXRFrame(t, frame) {
  if (!xrSession) return;
  const pose = frame.getViewerPose(xrRefSpace);
  if (pose) {
    const m = pose.transform.matrix;
    // simple gaze direction from view matrix
    gx = W / 2 + m[8] * 200;
    gy = H / 2 + m[9] * 200;
    mode = 'webxr';
  }
  xrSession.requestAnimationFrame(onXRFrame);
}

// IndexedDB
let db;
const req = indexedDB.open('f309-orb-field', 1);
req.onupgradeneeded = e => {
  const d = e.target.result;
  if (!d.objectStoreNames.contains('field')) d.createObjectStore('field');
  if (!d.objectStoreNames.contains('genomes')) d.createObjectStore('genomes', { keyPath: 'id' });
};
req.onsuccess = e => { db = e.target.result; loadField(); };
function sealGenome() {
  if (!db) return;
  const tx = db.transaction('genomes', 'readwrite');
  const s = serialize(agents[champIdx]);
  s.sealedAt = Date.now();
  tx.objectStore('genomes').put(s);
  document.getElementById('hud').textContent = 'Sealed champ genome ' + s.id;
}
function loadSealed() {
  if (!db) return;
  const tx = db.transaction('genomes', 'readonly');
  const r = tx.objectStore('genomes').getAll();
  r.onsuccess = () => {
    const all = r.result || [];
    if (all.length) {
      const best = all.sort((a, b) => (b.fitness || 0) - (a.fitness || 0))[0];
      agents[0] = deserialize(best);
      champIdx = 0;
      document.getElementById('hud').textContent = 'Loaded sealed ' + best.id + ' fit ' + (best.fitness || 0).toFixed(1);
    }
  };
}
function saveField() {
  if (!db) return;
  const tx = db.transaction('field', 'readwrite');
  tx.objectStore('field').put({ orbs: orbs.map(o => ({ x: o.x, y: o.y, agent: o.agent })), agents: agents.map(serialize) }, 'current');
}
function loadField() {
  if (!db) return;
  const tx = db.transaction('field', 'readonly');
  const r = tx.objectStore('field').get('current');
  r.onsuccess = () => {
    if (r.result) {
      const d = r.result;
      if (d.agents) agents = d.agents.map(deserialize);
      if (d.orbs) d.orbs.forEach((p, i) => { if (orbs[i]) { orbs[i].x = p.x; orbs[i].y = p.y; orbs[i].agent = p.agent; } });
      document.getElementById('hud').textContent = 'Restored persistent field';
    }
  };
}

// Interaction: click orb rewards its agent
document.body.addEventListener('click', e => {
  if (e.target.classList.contains('orb')) {
    const idx = Array.from(document.querySelectorAll('.orb')).indexOf(e.target);
    if (idx >= 0) agents[orbs[idx].agent].fitness += 5;
  }
});

// Main loop
let last = 0;
function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
  // input vector: normalized gaze, vel, orient
  const input = [
    (gx / W - 0.5) * 2, (gy / H - 0.5) * 2,
    Math.tanh(gvx * 0.05), Math.tanh(gvy * 0.05),
    Math.tanh(orient.beta / 45), Math.tanh(orient.gamma / 45)
  ];
  // step all agents
  const outs = agents.map(a => stepRNN(a, input));
  // update orbs with their agent's output as velocity bias
  orbs.forEach((o, i) => {
    const out = outs[o.agent];
    o.vx += out[0] * 40 * dt;
    o.vy += out[1] * 40 * dt;
    o.vx *= 0.92; o.vy *= 0.92;
    o.x += o.vx; o.y += o.vy;
    if (o.x < 20) { o.x = 20; o.vx *= -0.5; }
    if (o.x > W - 60) { o.x = W - 60; o.vx *= -0.5; }
    if (o.y < 20) { o.y = 20; o.vy *= -0.5; }
    if (o.y > H - 60) { o.y = H - 60; o.vy *= -0.5; }
    o.el.style.left = o.x + 'px';
    o.el.style.top = o.y + 'px';
    // fitness: proximity to gaze
    const dx = o.x + 24 - gx, dy = o.y + 24 - gy;
    const dist = Math.hypot(dx, dy);
    if (dist < 80) agents[o.agent].fitness += (1 - dist / 80) * dt * 2;
  });
  // champ
  champIdx = agents.reduce((b, a, i) => a.fitness > agents[b].fitness ? i : b, 0);
  orbs.forEach(o => o.el.classList.toggle('champ', o.agent === champIdx));
  // canvas field: faint trails or density
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4af6';
  orbs.forEach(o => {
    ctx.beginPath(); ctx.arc(o.x + 24, o.y + 24, 6, 0, 7); ctx.fill();
  });
  ctx.fillStyle = '#f808';
  ctx.beginPath(); ctx.arc(gx, gy, 8, 0, 7); ctx.fill();
  // HUD
  document.getElementById('champFit').textContent = agents[champIdx].fitness.toFixed(1);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Controls
document.getElementById('evolve').onclick = () => {
  const champ = agents[champIdx];
  for (let i = 0; i < N_AGENTS; i++) if (i !== champIdx) agents[i] = mutate(champ);
  agents.forEach(a => a.fitness *= 0.5);
  document.getElementById('hud').textContent = 'Evolved from champ ' + champ.id;
  saveField();
};
document.getElementById('seal').onclick = sealGenome;
document.getElementById('load').onclick = loadSealed;
document.getElementById('reset').onclick = () => {
  agents = Array.from({ length: N_AGENTS }, createRNN);
  orbs.forEach(o => { o.x = Math.random() * (W - 60) + 20; o.y = Math.random() * (H - 60) + 20; });
  saveField();
  document.getElementById('hud').textContent = 'Field reset';
};

// auto-save periodically
setInterval(saveField, 8000);
window.__f309 = { agents, orbs, get mode() { return mode; }, sealGenome, loadSealed };
