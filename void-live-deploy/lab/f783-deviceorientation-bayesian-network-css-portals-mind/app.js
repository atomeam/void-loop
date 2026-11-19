const N_PORTALS = 6;
const BINS = 5; // orientation bins
const STATES = 4; // latent states
const portals = [];
let orientation = { beta: 0, gamma: 0 };
let hasOrient = false;

function bin(v, min=-90, max=90) {
  const n = Math.max(0, Math.min(BINS-1, Math.floor(((v - min) / (max - min)) * BINS)));
  return n;
}

class BayesianNetwork {
  constructor() {
    // Simple BN: evidence bins → latent mood, intent
    this.cptMood = Array.from({length: BINS}, () => Array.from({length: BINS}, () => Array.from({length: STATES}, () => 1/STATES)));
    this.cptIntent = Array.from({length: STATES}, () => Array.from({length: STATES}, () => 1/STATES));
    this.fitness = 0;
    this.mutate();
  }
  mutate(rate=0.05) {
    const noise = (arr) => arr.map(row => row.map(col => col.map(p => Math.max(0.01, p + (Math.random()-0.5)*rate))));
    this.cptMood = noise(this.cptMood);
    this.normalize();
  }
  normalize() {
    const norm = (table) => table.forEach(slice => slice.forEach(row => {
      const s = row.reduce((a,b)=>a+b,0);
      for(let i=0;i<row.length;i++) row[i]/=s;
    }));
    norm(this.cptMood);
    this.cptIntent.forEach(row => {
      const s = row.reduce((a,b)=>a+b,0);
      for(let i=0;i<row.length;i++) row[i]/=s;
    });
  }
  infer(betaBin, gammaBin) {
    // Approximate: P(mood|beta,gamma) then sample intent
    const moodProbs = this.cptMood[betaBin][gammaBin];
    let r = Math.random(), cum=0, mood=0;
    for(let i=0;i<STATES;i++){ cum+=moodProbs[i]; if(r<cum){mood=i;break;} }
    const intentProbs = this.cptIntent[mood];
    r=Math.random(); cum=0; let intent=0;
    for(let i=0;i<STATES;i++){ cum+=intentProbs[i]; if(r<cum){intent=i;break;} }
    return { mood, intent, moodProbs, intentProbs };
  }
  clone() {
    const c = new BayesianNetwork();
    c.cptMood = JSON.parse(JSON.stringify(this.cptMood));
    c.cptIntent = JSON.parse(JSON.stringify(this.cptIntent));
    c.fitness = this.fitness;
    return c;
  }
}

function createPortals() {
  const stage = document.getElementById('stage');
  for(let i=0;i<N_PORTALS;i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = `P${i}`;
    el.style.left = (20 + Math.random()*60) + '%';
    el.style.top = (20 + Math.random()*60) + '%';
    el.style.width = '80px';
    el.style.height = '80px';
    stage.appendChild(el);
    const bn = new BayesianNetwork();
    portals.push({ el, bn, x: parseFloat(el.style.left), y: parseFloat(el.style.top) });
    el.addEventListener('click', () => {
      portals[i].bn.fitness += 10;
      portals[i].bn.mutate(0.02);
      updateStatus();
    });
  }
}

function updatePortals() {
  const bBin = bin(orientation.beta);
  const gBin = bin(orientation.gamma);
  portals.forEach((p, i) => {
    const inf = p.bn.infer(bBin, gBin);
    const hue = (inf.mood * 90 + inf.intent * 20) % 360;
    const scale = 0.7 + (inf.moodProbs[inf.mood] * 0.8);
    const rad = 20 + inf.intent * 20;
    p.el.style.setProperty('--hue', hue);
    p.el.style.transform = `scale(${scale}) rotate(${inf.intent*15 - 30}deg)`;
    p.el.style.borderRadius = rad + '%';
    // Gentle drift based on intent
    p.x = (p.x + (inf.intent - 1.5) * 0.3 + 100) % 100;
    p.y = (p.y + (inf.mood - 1.5) * 0.2 + 100) % 100;
    p.el.style.left = p.x + '%';
    p.el.style.top = p.y + '%';
    p.el.textContent = `P${i} m${inf.mood}`;
  });
}

function updateStatus() {
  const best = portals.reduce((a,b) => a.bn.fitness > b.bn.fitness ? a : b);
  document.getElementById('status').textContent =
    `F783 BN Portals | β:${orientation.beta.toFixed(0)} γ:${orientation.gamma.toFixed(0)} | best fitness ${best.bn.fitness.toFixed(0)} | click to reward`;
}

// Orientation
window.addEventListener('deviceorientation', (e) => {
  if (e.beta != null) {
    orientation.beta = e.beta;
    orientation.gamma = e.gamma || 0;
    hasOrient = true;
  }
});

// Pointer fallback
document.addEventListener('pointermove', (e) => {
  if (!hasOrient) {
    orientation.beta = (e.clientY / window.innerHeight - 0.5) * 180;
    orientation.gamma = (e.clientX / window.innerWidth - 0.5) * 180;
  }
});

// Seal / transfer
function sealBest() {
  const best = portals.reduce((a,b) => a.bn.fitness > b.bn.fitness ? a : b);
  const genome = { cptMood: best.bn.cptMood, cptIntent: best.bn.cptIntent, fitness: best.bn.fitness, ts: Date.now() };
  try {
    const req = indexedDB.open('verse-f783-bn', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('genomes', { keyPath: 'ts' });
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('genomes', 'readwrite');
      tx.objectStore('genomes').put(genome);
    };
  } catch (e) { console.debug("lab f783-deviceorientation-bayesian-network-css-portals-mind:", e); }
  try {
    const bc = new BroadcastChannel('f783-genomes');
    bc.postMessage(genome);
  } catch (e) { console.debug("lab f783-deviceorientation-bayesian-network-css-portals-mind:", e); }
  // Adopt into all weaker
  portals.forEach(p => {
    if (p.bn.fitness < best.bn.fitness * 0.8) {
      p.bn.cptMood = JSON.parse(JSON.stringify(best.bn.cptMood));
      p.bn.cptIntent = JSON.parse(JSON.stringify(best.bn.cptIntent));
      p.bn.mutate(0.1);
    }
  });
  updateStatus();
}

// Receive
try {
  const bc = new BroadcastChannel('f783-genomes');
  bc.onmessage = (ev) => {
    const g = ev.data;
    if (g && g.fitness > portals[0].bn.fitness) {
      portals.forEach(p => {
        p.bn.cptMood = JSON.parse(JSON.stringify(g.cptMood));
        p.bn.cptIntent = JSON.parse(JSON.stringify(g.cptIntent));
        p.bn.fitness = g.fitness * 0.9;
        p.bn.mutate(0.05);
      });
    }
  };
} catch (e) { console.debug("lab f783-deviceorientation-bayesian-network-css-portals-mind:", e); }

// UI
const btn = document.createElement('button');
btn.textContent = 'Seal & Transfer Best Genome';
btn.onclick = sealBest;
document.body.appendChild(btn);

createPortals();
setInterval(updatePortals, 100);
setInterval(updateStatus, 500);
setInterval(() => {
  // Slow fitness decay
  portals.forEach(p => p.bn.fitness *= 0.995);
}, 1000);
