const N = 8, DIM_IN = 4, HID = 8, DIM_OUT = 2;
const agents = [];
let orient = {b:0, g:0}, pointer = {x:window.innerWidth/2, y:window.innerHeight/2, vx:0, vy:0, hist:[]};
let bestFitness = -Infinity;
const dbName = 'verse-f693', bc = new BroadcastChannel('f693-genome');

function randn() { return (Math.random()-0.5)*0.2; }
function createMLP() {
  return {
    w1: Array.from({length:HID}, () => Array.from({length:DIM_IN}, randn)),
    b1: Array.from({length:HID}, randn),
    w2: Array.from({length:DIM_OUT}, () => Array.from({length:HID}, randn)),
    b2: Array.from({length:DIM_OUT}, randn)
  };
}
function forward(m, x) {
  const h = m.b1.map((b,i) => Math.tanh(b + m.w1[i].reduce((s,w,j)=>s+w*x[j],0)));
  return m.b2.map((b,i) => Math.tanh(b + m.w2[i].reduce((s,w,j)=>s+w*h[j],0)));
}
function cloneMLP(m) { return JSON.parse(JSON.stringify(m)); }
function mix(a, b, t) { // a receives t fraction from b
  for (let i=0;i<a.w1.length;i++) for (let j=0;j<a.w1[i].length;j++) a.w1[i][j] = a.w1[i][j]*(1-t) + b.w1[i][j]*t + randn()*0.05;
  for (let i=0;i<a.b1.length;i++) a.b1[i] = a.b1[i]*(1-t) + b.b1[i]*t + randn()*0.05;
  for (let i=0;i<a.w2.length;i++) for (let j=0;j<a.w2[i].length;j++) a.w2[i][j] = a.w2[i][j]*(1-t) + b.w2[i][j]*t + randn()*0.05;
  for (let i=0;i<a.b2.length;i++) a.b2[i] = a.b2[i]*(1-t) + b.b2[i]*t + randn()*0.05;
}

function createAgent(i) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.textContent = 'A' + i;
  el.style.left = (Math.random()* (window.innerWidth-80)) + 'px';
  el.style.top = (Math.random()* (window.innerHeight-80)) + 'px';
  el.style.background = `hsl(${i*40},70%,45%)`;
  document.getElementById('stage').appendChild(el);
  return { el, mlp: createMLP(), x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx:0, vy:0, fitness: 1, id:i };
}

for (let i=0;i<N;i++) agents.push(createAgent(i));

window.addEventListener('deviceorientation', e => { orient.b = e.beta||0; orient.g = e.gamma||0; });
window.addEventListener('pointermove', e => {
  const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
  pointer.hist.push({dx,dy}); if (pointer.hist.length>8) pointer.hist.shift();
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.vx = dx; pointer.vy = dy;
});

function residual() {
  if (pointer.hist.length < 2) return [0,0];
  const last = pointer.hist[pointer.hist.length-1];
  const prev = pointer.hist[pointer.hist.length-2];
  const predx = prev.dx * 0.7, predy = prev.dy * 0.7;
  return [last.dx - predx, last.dy - predy];
}

function update() {
  const res = residual();
  const inp = [orient.b/90, orient.g/90, res[0]/20, res[1]/20];
  agents.forEach(a => {
    const out = forward(a.mlp, inp);
    a.vx += out[0]*0.8; a.vy += out[1]*0.8;
    a.vx *= 0.92; a.vy *= 0.92;
    a.x += a.vx; a.y += a.vy;
    a.x = Math.max(0, Math.min(window.innerWidth-72, a.x));
    a.y = Math.max(0, Math.min(window.innerHeight-72, a.y));
    a.el.style.left = a.x + 'px';
    a.el.style.top = a.y + 'px';
    const dx = a.x - pointer.x, dy = a.y - pointer.y;
    a.fitness = 100 / (1 + Math.hypot(dx,dy)/40) + (a.reward||0)*0.1;
    a.el.style.transform = `scale(${1 + Math.min(0.3, a.fitness/200)})`;
    a.el.style.filter = `hue-rotate(${a.fitness*0.5}deg)`;
  });
  // competition
  for (let i=0;i<agents.length;i++) for (let j=i+1;j<agents.length;j++) {
    const d = Math.hypot(agents[i].x-agents[j].x, agents[i].y-agents[j].y);
    if (d < 80) {
      if (agents[i].fitness > agents[j].fitness * 1.1) mix(agents[j].mlp, agents[i].mlp, 0.3);
      else if (agents[j].fitness > agents[i].fitness * 1.1) mix(agents[i].mlp, agents[j].mlp, 0.3);
    }
  }
  const maxF = Math.max(...agents.map(a=>a.fitness));
  if (maxF > bestFitness) bestFitness = maxF;
  document.getElementById('status').textContent = `Best fitness ${bestFitness.toFixed(1)} · Tilt or move · Click to reward`;
  requestAnimationFrame(update);
}
update();

agents.forEach(a => {
  a.el.addEventListener('click', () => { a.reward = (a.reward||0) + 5; a.fitness += 10; });
  let dragging = false, ox, oy;
  a.el.addEventListener('pointerdown', e => { dragging=true; ox=e.clientX-a.x; oy=e.clientY-a.y; a.el.setPointerCapture(e.pointerId); });
  a.el.addEventListener('pointermove', e => { if (dragging) { a.x = e.clientX-ox; a.y = e.clientY-oy; } });
  a.el.addEventListener('pointerup', () => dragging=false);
});

document.getElementById('seal').onclick = async () => {
  const best = agents.reduce((b,a)=>a.fitness>b.fitness?a:b, agents[0]);
  const data = { mlp: best.mlp, fitness: best.fitness, ts: Date.now() };
  try {
    const db = await new Promise((res,rej)=>{ const r=indexedDB.open(dbName,1); r.onupgradeneeded=e=>e.target.result.createObjectStore('genomes'); r.onsuccess=e=>res(e.target.result); r.onerror=rej; });
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put(data, 'best');
    bc.postMessage(data);
    document.getElementById('status').textContent = 'Sealed to IndexedDB + broadcast';
  } catch(e) { console.warn(e); }
};

document.getElementById('reset').onclick = () => agents.forEach(a => { a.mlp = createMLP(); a.fitness=1; a.reward=0; });

bc.onmessage = e => {
  if (e.data && e.data.fitness > bestFitness) {
    const best = agents.reduce((b,a)=>a.fitness>b.fitness?a:b, agents[0]);
    mix(best.mlp, e.data.mlp, 0.5);
    bestFitness = e.data.fitness;
  }
};

// restore
(async () => {
  try {
    const db = await new Promise((res,rej)=>{ const r=indexedDB.open(dbName,1); r.onupgradeneeded=e=>e.target.result.createObjectStore('genomes'); r.onsuccess=e=>res(e.target.result); });
    const tx = db.transaction('genomes');
    const req = tx.objectStore('genomes').get('best');
    req.onsuccess = () => { if (req.result) { agents[0].mlp = req.result.mlp; bestFitness = req.result.fitness || 0; } };
  } catch (e) { console.debug("lab f693-pure-dom-residual-mlp-genome-swarm:", e); }
})();
