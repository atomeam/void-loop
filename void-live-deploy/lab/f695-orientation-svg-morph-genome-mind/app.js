const N = 8; // agents / segments
const DIM = 3; // in: beta, gamma, phase
const H = 6;
const OUT = 3; // dx, dy, scale
let agents = [];
let bestFitness = -Infinity;
let bestWeights = null;
let orientation = {alpha:0, beta:0, gamma:0};
let phase = 0;
let hasOrient = false;

function randW() { return (Math.random()-0.5)*0.4; }
function makeMLP() {
  return {
    w1: Array(H).fill(0).map(()=>Array(DIM).fill(0).map(randW)),
    b1: Array(H).fill(0).map(randW),
    w2: Array(OUT).fill(0).map(()=>Array(H).fill(0).map(randW)),
    b2: Array(OUT).fill(0).map(randW),
    fitness: 0
  };
}
function sigmoid(x) { return 1/(1+Math.exp(-x)); }
function forward(m, inp) {
  const h = m.b1.map((b,i)=> sigmoid(b + m.w1[i].reduce((s,w,j)=>s+w*inp[j],0)));
  return m.b2.map((b,i)=> b + m.w2[i].reduce((s,w,j)=>s+w*h[j],0));
}
function cloneWeights(m) {
  return {w1:m.w1.map(r=>[...r]), b1:[...m.b1], w2:m.w2.map(r=>[...r]), b2:[...m.b2]};
}
function transfer(src, dst, frac=0.25) {
  for (let i=0;i<H;i++) for (let j=0;j<DIM;j++) dst.w1[i][j] = (1-frac)*dst.w1[i][j] + frac*src.w1[i][j] + (Math.random()-0.5)*0.02;
  for (let i=0;i<H;i++) dst.b1[i] = (1-frac)*dst.b1[i] + frac*src.b1[i] + (Math.random()-0.5)*0.02;
  for (let i=0;i<OUT;i++) for (let j=0;j<H;j++) dst.w2[i][j] = (1-frac)*dst.w2[i][j] + frac*src.w2[i][j] + (Math.random()-0.5)*0.02;
  for (let i=0;i<OUT;i++) dst.b2[i] = (1-frac)*dst.b2[i] + frac*src.b2[i] + (Math.random()-0.5)*0.02;
}

function initAgents() {
  agents = Array(N).fill(0).map(makeMLP);
  bestFitness = -Infinity;
  bestWeights = null;
}

function getPoints() {
  const pts = [];
  const base = [
    [200,80],[250,90],[290,130],[310,180],[290,230],[250,270],[200,280],[150,270],
    [110,230],[90,180],[110,130],[150,90]
  ]; // 12 points, we will morph
  for (let i=0;i<N;i++) {
    const inp = [orientation.beta/90, orientation.gamma/90, Math.sin(phase + i*0.7)];
    const out = forward(agents[i], inp);
    const idx = (i*1) % base.length;
    pts.push([
      base[idx][0] + out[0]*40,
      base[idx][1] + out[1]*40
    ]);
  }
  return pts;
}

function updatePath() {
  const pts = getPoints();
  // simple closed path from 8 points
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i=1;i<pts.length;i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
  d += ' Z';
  document.getElementById('living').setAttribute('d', d);
  // competition: proximity in parameter space
  for (let i=0;i<N;i++) {
    for (let j=i+1;j<N;j++) {
      const dx = pts[i][0]-pts[j][0], dy = pts[i][1]-pts[j][1];
      if (Math.hypot(dx,dy) < 50) {
        const a = agents[i], b = agents[j];
        if (a.fitness > b.fitness) transfer(a, b);
        else if (b.fitness > a.fitness) transfer(b, a);
      }
    }
  }
  // fitness decay + smoothness reward
  agents.forEach(a => a.fitness *= 0.995);
  const pathEl = document.getElementById('living');
  const len = pathEl.getTotalLength();
  agents.forEach(a => a.fitness += Math.max(0, 200 - len/10)); // prefer compact
  const maxF = Math.max(...agents.map(a=>a.fitness));
  if (maxF > bestFitness) {
    bestFitness = maxF;
    bestWeights = agents.map(cloneWeights);
  }
}

function loop() {
  phase += 0.02;
  updatePath();
  requestAnimationFrame(loop);
}

document.getElementById('orient').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(p => {
      if (p === 'granted') startOrient();
    }).catch(()=>{});
  } else startOrient();
};
function startOrient() {
  hasOrient = true;
  window.addEventListener('deviceorientation', e => {
    orientation.alpha = e.alpha || 0;
    orientation.beta = e.beta || 0;
    orientation.gamma = e.gamma || 0;
  });
  document.getElementById('status').textContent = 'Orientation active. Tilt to morph. Click to reward.';
}

document.getElementById('morph').onclick = e => {
  // reward nearest agent roughly
  const rect = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width * 400;
  const y = (e.clientY - rect.top) / rect.height * 400;
  const pts = getPoints();
  let best = 0, bd = Infinity;
  pts.forEach((p,i) => {
    const d = Math.hypot(p[0]-x, p[1]-y);
    if (d < bd) { bd = d; best = i; }
  });
  agents[best].fitness += 5;
  document.getElementById('status').textContent = `Rewarded agent ${best}. Fitness ~${agents[best].fitness.toFixed(1)}`;
};

document.getElementById('seal').onclick = async () => {
  if (!bestWeights) return;
  try {
    const db = await idbOpen();
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put({id:'best', weights:bestWeights, fitness:bestFitness, ts:Date.now()});
    const ch = new BroadcastChannel('f695-genome');
    ch.postMessage({weights:bestWeights, fitness:bestFitness});
    document.getElementById('status').textContent = 'Sealed to IndexedDB + broadcast.';
  } catch(e) { document.getElementById('status').textContent = 'Seal failed (private mode?).'; }
};
function idbOpen() {
  return new Promise((res,rej) => {
    const r = indexedDB.open('verse-f695',1);
    r.onupgradeneeded = () => r.result.createObjectStore('genomes',{keyPath:'id'});
    r.onsuccess = () => res(r.result);
    r.onerror = rej;
  });
}

document.getElementById('reset').onclick = () => { initAgents(); document.getElementById('status').textContent = 'Agents reset.'; };

// restore
(async () => {
  try {
    const db = await idbOpen();
    const tx = db.transaction('genomes','readonly');
    const req = tx.objectStore('genomes').get('best');
    req.onsuccess = () => {
      if (req.result) {
        bestWeights = req.result.weights;
        bestFitness = req.result.fitness;
        agents = bestWeights.map(w => Object.assign(makeMLP(), w));
        document.getElementById('status').textContent = 'Restored sealed genome.';
      }
    };
  } catch (e) { console.debug("lab f695-orientation-svg-morph-genome-mind:", e); }
  const ch = new BroadcastChannel('f695-genome');
  ch.onmessage = ev => {
    if (ev.data.weights) {
      bestWeights = ev.data.weights;
      agents = bestWeights.map(w => Object.assign(makeMLP(), w));
      document.getElementById('status').textContent = 'Received genome from other tab.';
    }
  };
})();

initAgents();
loop();
