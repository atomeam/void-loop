const N = 10;
const agents = [];
let orient = { beta: 0, gamma: 0 };
let pointer = { x: 0, y: 0, active: false };
let bestFitness = -Infinity;
let sealedWeights = null;
let db;
const channel = new BroadcastChannel('verse-f776-genome');

function randn() { return (Math.random()*2-1)*0.3; }
function makeMLP() {
  // 8 inputs -> 12 hidden -> 6 outputs
  return {
    w1: Array.from({length:12}, () => Array.from({length:8}, randn)),
    b1: Array.from({length:12}, randn),
    w2: Array.from({length:6}, () => Array.from({length:12}, randn)),
    b2: Array.from({length:6}, randn)
  };
}
function forward(mlp, x) {
  const h = mlp.b1.map((b,i) => Math.tanh(b + mlp.w1[i].reduce((s,w,j)=>s+w*x[j],0)));
  return mlp.b2.map((b,i) => Math.tanh(b + mlp.w2[i].reduce((s,w,j)=>s+w*h[j],0)));
}
function cloneMLP(m) {
  return { w1: m.w1.map(r=>[...r]), b1:[...m.b1], w2: m.w2.map(r=>[...r]), b2:[...m.b2] };
}

async function openDB() {
  return new Promise((res,rej) => {
    const r = indexedDB.open('verse-f776', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes');
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
  });
}
async function saveGenome(w) {
  if (!db) return;
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put(w, 'best');
}
async function loadGenome() {
  if (!db) return null;
  return new Promise(res => {
    const tx = db.transaction('genomes','readonly');
    const g = tx.objectStore('genomes').get('best');
    g.onsuccess = () => res(g.result || null);
    g.onerror = () => res(null);
  });
}

function spawnAgents() {
  document.getElementById('stage').innerHTML = '';
  agents.length = 0;
  for (let i=0; i<N; i++) {
    const el = document.createElement('div');
    el.className = 'agent';
    el.textContent = 'A'+(i+1);
    el.style.left = (Math.random()*70+10)+'%';
    el.style.top = (Math.random()*70+10)+'%';
    document.getElementById('stage').appendChild(el);
    agents.push({
      el, x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight,
      vx:0, vy:0, rot:0, rotv:0, scale:1, hue:180+Math.random()*60,
      mlp: sealedWeights ? cloneMLP(sealedWeights) : makeMLP(),
      fitness: 0, dwell: 0
    });
  }
}

function update() {
  const w = window.innerWidth, h = window.innerHeight;
  agents.forEach((a,i) => {
    // nearest neighbor relative
    let nx=0, ny=0, nd=1e9;
    agents.forEach((b,j) => {
      if (i===j) return;
      const dx = b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy);
      if (d<nd) { nd=d; nx=dx/d; ny=dy/d; }
    });
    const pd = Math.hypot(pointer.x-a.x, pointer.y-a.y);
    const inputs = [
      orient.beta/90, orient.gamma/90,
      nx, ny, Math.min(1, nd/200),
      (pointer.x-a.x)/w, (pointer.y-a.y)/h,
      Math.min(1, 100/pd)
    ];
    const out = forward(a.mlp, inputs);
    a.vx += out[0]*0.8;
    a.vy += out[1]*0.8;
    a.rotv += out[2]*2;
    a.scale = 0.8 + Math.abs(out[3])*0.6;
    a.hue = 180 + out[4]*80;
    // soft repulsion
    agents.forEach((b,j) => {
      if (i===j) return;
      const dx=a.x-b.x, dy=a.y-b.y, d=Math.hypot(dx,dy)+1;
      if (d<120) {
        a.vx += dx/d*1.5;
        a.vy += dy/d*1.5;
      }
    });
    a.vx *= 0.92; a.vy *= 0.92; a.rotv *= 0.9;
    a.x = Math.max(40, Math.min(w-40, a.x + a.vx));
    a.y = Math.max(40, Math.min(h-40, a.y + a.vy));
    a.rot += a.rotv;
    // fitness: diversity + dwell
    a.fitness += (nd > 150 ? 0.02 : -0.01);
    if (pd < 80 && pointer.active) { a.dwell += 1; a.fitness += 0.05; }
    a.el.style.transform = `translate(${a.x-45}px,${a.y-35}px) rotate(${a.rot}deg) scale(${a.scale})`;
    a.el.style.background = `hsla(${a.hue},70%,40%,0.75)`;
    a.el.style.borderColor = a.fitness > bestFitness*0.8 ? '#4f8' : '#4af';
  });
  // track best
  const top = agents.reduce((m,a)=>a.fitness>m.fitness?a:m, agents[0]);
  if (top.fitness > bestFitness) bestFitness = top.fitness;
  document.getElementById('status').textContent =
    `best ${bestFitness.toFixed(1)} | agents ${N} | orient ${orient.beta.toFixed(0)}°/${orient.gamma.toFixed(0)}°`;
  requestAnimationFrame(update);
}

// events
window.addEventListener('deviceorientation', e => {
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
});
window.addEventListener('pointermove', e => { pointer.x=e.clientX; pointer.y=e.clientY; pointer.active=true; });
window.addEventListener('pointerdown', e => { pointer.active=true; });
window.addEventListener('pointerup', e => { pointer.active=false; });

document.getElementById('seal').onclick = async () => {
  const top = agents.reduce((m,a)=>a.fitness>m.fitness?a:m, agents[0]);
  sealedWeights = cloneMLP(top.mlp);
  agents.forEach(a => a.mlp = cloneMLP(sealedWeights));
  await saveGenome(sealedWeights);
  channel.postMessage({ type:'genome', weights:sealedWeights, fitness:top.fitness });
  document.getElementById('status').textContent = 'Sealed! Fitness '+top.fitness.toFixed(1);
};
document.getElementById('reset').onclick = () => { bestFitness=-Infinity; sealedWeights=null; spawnAgents(); };
document.getElementById('xr').onclick = async () => {
  if (!navigator.xr) return alert('WebXR not available');
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures:['hand-tracking'] });
    document.getElementById('status').textContent = 'XR session started (hand tracking optional)';
    // stub: in full XR one would poll frame.getViewerPose and hand joints and feed into inputs
  } catch(e) { alert('XR failed: '+e.message); }
};

channel.onmessage = e => {
  if (e.data.type==='genome' && e.data.fitness > bestFitness) {
    sealedWeights = e.data.weights;
    agents.forEach(a => a.mlp = cloneMLP(sealedWeights));
    bestFitness = e.data.fitness;
  }
};

(async () => {
  db = await openDB();
  sealedWeights = await loadGenome();
  spawnAgents();
  document.getElementById('status').textContent = 'ready — tilt device or move pointer';
  update();
})();
