const status = document.getElementById('status');
const svg = document.getElementById('svg');
const NS = 'http://www.w3.org/2000/svg';
const N = 14;
const agents = [];
let gaze = {x: innerWidth/2, y: innerHeight/2};
let lastGaze = {...gaze};
let mlp = { w1: Array(8).fill(0).map(()=>Math.random()*0.4-0.2), w2: Array(4).fill(0).map(()=>Math.random()*0.4-0.2), b: 0 };
let dwell = Array(N).fill(0);
let bestFitness = 0;
let xrSession = null;
const channel = new BroadcastChannel('f558-genome');

function hashSlice(w) {
  let h = 0;
  for (let i = 0; i < Math.min(6, w.length); i++) h = (h * 31 + Math.round(w[i]*1000)) | 0;
  return h.toString(16);
}

function createAgent(i) {
  const c = document.createElementNS(NS, 'circle');
  c.setAttribute('r', 18 + Math.random()*10);
  c.setAttribute('fill', `hsl(${i*25},70%,55%)`);
  c.classList.add('agent');
  svg.appendChild(c);
  return {
    el: c,
    x: Math.random()*innerWidth,
    y: Math.random()*innerHeight,
    vx: 0, vy: 0,
    q: (Math.random()>0.5?1:-1) * (0.5 + Math.random()),
    fitness: 0
  };
}

function init() {
  for (let i = 0; i < N; i++) agents.push(createAgent(i));
  const g = document.createElementNS(NS, 'circle');
  g.id = 'ghost';
  g.setAttribute('r', 8);
  svg.appendChild(g);
  loadGenome();
  status.textContent = 'ready - move pointer';
  requestAnimationFrame(loop);
}

function predict(dx, dy) {
  const inp = [dx*0.01, dy*0.01, lastGaze.x/innerWidth, lastGaze.y/innerHeight, 0,0,0,0];
  let h = 0;
  for (let i = 0; i < 4; i++) h += inp[i] * mlp.w1[i];
  h = Math.tanh(h + mlp.b);
  const ox = h * mlp.w2[0];
  const oy = h * mlp.w2[1];
  return {x: gaze.x + ox*40, y: gaze.y + oy*40};
}

function forces() {
  const k = 800;
  for (let i = 0; i < N; i++) {
    let fx = 0, fy = 0;
    for (let j = 0; j < N; j++) if (i !== j) {
      const dx = agents[j].x - agents[i].x;
      const dy = agents[j].y - agents[i].y;
      const r2 = dx*dx + dy*dy + 100;
      const r = Math.sqrt(r2);
      const f = k * agents[i].q * agents[j].q / r2;
      fx += f * dx / r;
      fy += f * dy / r;
    }
    // gaze field
    const gdx = gaze.x - agents[i].x;
    const gdy = gaze.y - agents[i].y;
    const gr2 = gdx*gdx + gdy*gdy + 400;
    const gf = 1200 * agents[i].q / gr2;
    fx += gf * gdx / Math.sqrt(gr2);
    fy += gf * gdy / Math.sqrt(gr2);
    agents[i].vx = (agents[i].vx + fx*0.015)*0.92;
    agents[i].vy = (agents[i].vy + fy*0.015)*0.92;
    agents[i].x += agents[i].vx;
    agents[i].y += agents[i].vy;
    if (agents[i].x < 30 || agents[i].x > innerWidth-30) agents[i].vx *= -0.8;
    if (agents[i].y < 30 || agents[i].y > innerHeight-30) agents[i].vy *= -0.8;
    agents[i].x = Math.max(20, Math.min(innerWidth-20, agents[i].x));
    agents[i].y = Math.max(20, Math.min(innerHeight-20, agents[i].y));
  }
}

function updateSVG() {
  agents.forEach(a => {
    a.el.setAttribute('cx', a.x);
    a.el.setAttribute('cy', a.y);
  });
  const pred = predict(gaze.x - lastGaze.x, gaze.y - lastGaze.y);
  document.getElementById('ghost').setAttribute('cx', pred.x);
  document.getElementById('ghost').setAttribute('cy', pred.y);
}

function checkDwell() {
  agents.forEach((a, i) => {
    const d = Math.hypot(a.x - gaze.x, a.y - gaze.y);
    if (d < parseFloat(a.el.getAttribute('r')) + 15) {
      dwell[i]++;
      if (dwell[i] > 50) { // ~800ms
        const frag = hashSlice(mlp.w1);
        channel.postMessage({i, frag, w: mlp.w1.slice(0,4)});
        a.el.setAttribute('stroke', '#0f0');
        a.fitness += 1;
        dwell[i] = 0;
        status.textContent = `Dwell seal on agent ${i} - genome ${frag}`;
        // slight mutation
        for (let k = 0; k < mlp.w1.length; k++) mlp.w1[k] += (Math.random()-0.5)*0.02;
      }
    } else dwell[i] = Math.max(0, dwell[i]-1);
  });
}

channel.onmessage = e => {
  if (e.data.w && e.data.frag) {
    // adopt if better or random
    if (Math.random() > 0.4) {
      for (let k = 0; k < 4; k++) mlp.w1[k] = e.data.w[k] * 0.7 + mlp.w1[k]*0.3;
      status.textContent = `Adopted genome fragment ${e.data.frag}`;
    }
  }
};

function loop() {
  forces();
  updateSVG();
  checkDwell();
  lastGaze = {...gaze};
  requestAnimationFrame(loop);
}

window.addEventListener('pointermove', e => { gaze.x = e.clientX; gaze.y = e.clientY; });

document.getElementById('seal').onclick = seal;
document.getElementById('xr').onclick = tryXR;

async function tryXR() {
  if (!navigator.xr) { status.textContent = 'No WebXR'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', {optionalFeatures:['local']});
    status.textContent = 'XR session started (gaze proxy via viewer)';
    // simplified: in real XR one would use reference space + gaze ray; here we note it
  } catch(e) { status.textContent = 'XR failed: ' + e.message; }
}

function seal() {
  const data = {mlp, agents: agents.map(a => ({x:a.x,y:a.y,q:a.q})), fitness: agents.reduce((s,a)=>s+a.fitness,0)};
  const req = indexedDB.open('f558-gaze-electro', 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('state');
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('state','readwrite');
    tx.objectStore('state').put(data, 'best');
    status.textContent = 'Sealed to IndexedDB';
  };
}

function loadGenome() {
  const req = indexedDB.open('f558-gaze-electro', 1);
  req.onsuccess = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('state')) return;
    const tx = db.transaction('state','readonly');
    const g = tx.objectStore('state').get('best');
    g.onsuccess = () => {
      if (g.result) {
        mlp = g.result.mlp || mlp;
        status.textContent = 'Restored sealed genome';
      }
    };
  };
}

init();
