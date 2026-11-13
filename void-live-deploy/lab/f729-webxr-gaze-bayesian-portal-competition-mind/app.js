const stage = document.getElementById('stage');
const info = document.getElementById('info');
const status = document.getElementById('status');
let portals = [];
let gaze = { x: window.innerWidth/2, y: window.innerHeight/2 };
let xrSession = null;
const channel = new BroadcastChannel('f729-genomes');
const DB_NAME = 'verse-f729-bayes';
const STORE = 'posteriors';

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function seal(id, data) {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(data, id);
  return tx.complete;
}

async function loadSeals() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    return new Promise(r => { req.onsuccess = () => r(req.result || []); });
  } catch { return []; }
}

class Portal {
  constructor(x, y, label = 'Belief') {
    this.el = document.createElement('div');
    this.el.className = 'portal';
    this.el.innerHTML = `<h4>${label}</h4><p>μ:0.5 σ:0.2</p>`;
    stage.appendChild(this.el);
    this.x = x; this.y = y;
    this.mu = 0.5; this.sigma = 0.25;
    this.fitness = 0;
    this.dwell = 0;
    this.updateVisual();
    this.el.addEventListener('pointerdown', e => this.dragStart(e));
    portals.push(this);
  }
  updateVisual() {
    const conf = Math.max(0, 1 - this.sigma * 3);
    this.el.style.left = this.x + 'px';
    this.el.style.top = this.y + 'px';
    this.el.style.transform = `scale(${0.85 + conf*0.4}) rotate(${(this.mu-0.5)*20}deg)`;
    this.el.style.opacity = 0.5 + conf*0.5;
    this.el.style.filter = `hue-rotate(${this.mu*180}deg) brightness(${0.8+conf*0.4})`;
    this.el.querySelector('p').textContent = `μ:${this.mu.toFixed(2)} σ:${this.sigma.toFixed(2)} fit:${this.fitness.toFixed(1)}`;
  }
  observe(evidence) {
    const varPrior = this.sigma * this.sigma;
    const varLik = 0.08;
    const postVar = 1 / (1/varPrior + 1/varLik);
    this.mu = postVar * (this.mu / varPrior + evidence / varLik);
    this.sigma = Math.sqrt(postVar);
    this.fitness += evidence * 0.1;
    if (this.sigma < 0.08 && Math.random() < 0.02) this.proposeTransfer();
    this.updateVisual();
  }
  proposeTransfer() {
    const best = portals.reduce((a,b) => a.fitness > b.fitness ? a : b, this);
    if (best === this) {
      info.textContent = `Portal proposes sealed transfer (μ=${this.mu.toFixed(2)}). Dwell or click to accept.`;
      this.el.style.borderColor = '#f80';
      setTimeout(() => { this.el.style.borderColor = '#446'; }, 3000);
      channel.postMessage({ type: 'propose', mu: this.mu, sigma: this.sigma, fitness: this.fitness });
    }
  }
  dragStart(e) {
    const startX = e.clientX - this.x, startY = e.clientY - this.y;
    const move = ev => { this.x = ev.clientX - startX; this.y = ev.clientY - startY; this.updateVisual(); this.fitness += 0.05; };
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }
}

function spawn(n=4) {
  for (let i=0; i<n; i++) new Portal(100 + Math.random()*window.innerWidth*0.7, 100 + Math.random()*window.innerHeight*0.6, 'Portal '+portals.length);
}

function loop() {
  portals.forEach(p => {
    const dx = gaze.x - (p.x + 70), dy = gaze.y - (p.y + 45);
    const dist = Math.hypot(dx, dy);
    if (dist < 120) {
      const evidence = Math.max(0, 1 - dist/120);
      p.dwell += 0.016;
      if (p.dwell > 0.4) p.observe(evidence * 0.6 + 0.2);
    } else p.dwell = Math.max(0, p.dwell - 0.02);
    const pull = (p.mu - 0.5) * 0.3;
    p.x += pull * Math.sin(Date.now()/1000 + p.mu*10) * 0.4;
    p.y += (0.5 - p.mu) * Math.cos(Date.now()/800) * 0.3;
    p.x = Math.max(10, Math.min(window.innerWidth-150, p.x));
    p.y = Math.max(10, Math.min(window.innerHeight-100, p.y));
  });
  requestAnimationFrame(loop);
}

document.addEventListener('pointermove', e => { gaze.x = e.clientX; gaze.y = e.clientY; });

document.getElementById('addBtn').onclick = () => new Portal(gaze.x-70, gaze.y-45, 'New');
document.getElementById('sealBtn').onclick = async () => {
  const best = portals.reduce((a,b)=>a.fitness>b.fitness?a:b, portals[0]);
  if (best) {
    await seal('best', { mu: best.mu, sigma: best.sigma, fitness: best.fitness, t: Date.now() });
    info.textContent = 'Best sealed to IndexedDB.';
  }
};
document.getElementById('shareBtn').onclick = () => {
  const best = portals.reduce((a,b)=>a.fitness>b.fitness?a:b, portals[0]);
  if (best) channel.postMessage({ type: 'share', mu: best.mu, sigma: best.sigma, fitness: best.fitness });
  info.textContent = 'Genome shared via BroadcastChannel.';
};
document.getElementById('resetBtn').onclick = () => { portals.forEach(p=>p.el.remove()); portals=[]; spawn(5); };

channel.onmessage = e => {
  if (e.data.type === 'share' || e.data.type === 'propose') {
    const p = portals[Math.floor(Math.random()*portals.length)];
    if (p && e.data.fitness > p.fitness) {
      p.mu = (p.mu + e.data.mu)/2; p.sigma = Math.min(p.sigma, e.data.sigma+0.05);
      p.fitness += 0.2; p.updateVisual();
      info.textContent = 'Adopted shared genome.';
    }
  }
};

async function tryXR() {
  if (!navigator.xr) { status.textContent = 'No WebXR. Using pointer gaze.'; return; }
  try {
    const supported = await navigator.xr.isSessionSupported('immersive-vr');
    if (!supported) { status.textContent = 'Immersive XR unsupported. Pointer fallback.'; return; }
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    status.textContent = 'XR session active (gaze proxy via pose).';
    const onFrame = () => {
      if (!xrSession) return;
      xrSession.requestAnimationFrame(onFrame);
    };
    xrSession.requestAnimationFrame(onFrame);
    xrSession.addEventListener('end', () => { xrSession = null; status.textContent = 'XR ended. Pointer gaze.'; });
  } catch(e) { status.textContent = 'XR denied or unavailable. Pointer mode.'; }
}
document.getElementById('xrBtn').onclick = tryXR;

(async () => {
  const seals = await loadSeals();
  spawn(4);
  if (seals.length) {
    const s = seals[0];
    portals[0].mu = s.mu || 0.5; portals[0].sigma = s.sigma || 0.2;
    portals[0].updateVisual();
    info.textContent = 'Loaded sealed prior.';
  }
  loop();
})();
