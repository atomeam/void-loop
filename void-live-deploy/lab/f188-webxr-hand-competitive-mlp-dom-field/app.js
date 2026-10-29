const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
resize(); addEventListener('resize', resize);

const N = 3;
const HID = 8;
const IN = 9;
const OUT = 4;

function rand(a=0, b=1) { return a + Math.random()*(b-a); }
function randn() { return (Math.random()+Math.random()+Math.random()-1.5)*2; }

class MLP {
  constructor() {
    this.W1 = Array.from({length: HID}, () => Array.from({length: IN}, () => randn()*0.4));
    this.b1 = Array.from({length: HID}, () => randn()*0.1);
    this.W2 = Array.from({length: OUT}, () => Array.from({length: HID}, () => randn()*0.3));
    this.b2 = Array.from({length: OUT}, () => 0);
  }
  forward(x) {
    const h = new Array(HID);
    for (let i=0;i<HID;i++) {
      let s = this.b1[i];
      for (let j=0;j<IN;j++) s += this.W1[i][j]*x[j];
      h[i] = Math.max(0, s); // ReLU
    }
    const y = new Array(OUT);
    for (let i=0;i<OUT;i++) {
      let s = this.b2[i];
      for (let j=0;j<HID;j++) s += this.W2[i][j]*h[j];
      y[i] = Math.tanh(s);
    }
    return y;
  }
  cloneMutate(noise=0.08) {
    const m = new MLP();
    m.W1 = this.W1.map(r => r.map(v => v + randn()*noise));
    m.b1 = this.b1.map(v => v + randn()*noise);
    m.W2 = this.W2.map(r => r.map(v => v + randn()*noise));
    m.b2 = this.b2.map(v => v + randn()*noise);
    return m;
  }
  serialize() {
    return {W1:this.W1, b1:this.b1, W2:this.W2, b2:this.b2};
  }
  static deserialize(d) {
    const m = new MLP();
    m.W1 = d.W1; m.b1 = d.b1; m.W2 = d.W2; m.b2 = d.b2;
    return m;
  }
}

const agents = Array.from({length:N}, (_,i) => ({
  mlp: new MLP(),
  x: rand(0.2,0.8)*W, y: rand(0.2,0.8)*H,
  rot: 0, scale: 1,
  vx:0, vy:0,
  fitness: 0,
  trail: [],
  card: null
}));

const cards = [];
agents.forEach((a,i) => {
  const el = document.createElement('div');
  el.className = 'card';
  el.textContent = `Agent ${i+1}\nfitness —`;
  document.body.appendChild(el);
  a.card = el;
  cards.push(el);
});

// Pointer / fallback hand
let hand = { px: W/2, py: H/2, vx:0, vy:0, tx:W/2, ty:H/2, thumbx:W/2, thumby:H/2 };
let lastPx = hand.px, lastPy = hand.py;
canvas.addEventListener('pointermove', e => {
  hand.px = e.clientX; hand.py = e.clientY;
  hand.vx = hand.px - lastPx; hand.vy = hand.py - lastPy;
  lastPx = hand.px; lastPy = hand.py;
  hand.tx = hand.px + 40; hand.ty = hand.py - 20;
  hand.thumbx = hand.px - 30; hand.thumby = hand.py + 10;
});

// XR
let xrSession = null, refSpace = null;
document.getElementById('xr').onclick = async () => {
  if (!navigator.xr) { status.textContent = 'No WebXR'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['hand-tracking'] });
    refSpace = await xrSession.requestReferenceSpace('local');
    xrSession.requestAnimationFrame(onXRFrame);
    status.textContent = 'XR active';
  } catch(e) {
    status.textContent = 'XR failed: ' + e.message;
  }
};

function onXRFrame(t, frame) {
  if (!xrSession) return;
  const pose = frame.getViewerPose(refSpace);
  // Simplified: use input sources for hands if available
  const sources = xrSession.inputSources;
  for (const src of sources) {
    if (src.hand) {
      const palm = src.hand.get('wrist') || src.hand.get('palm');
      const index = src.hand.get('index-finger-tip');
      const thumb = src.hand.get('thumb-tip');
      if (palm && index) {
        const pPose = frame.getPose(palm, refSpace);
        const iPose = frame.getPose(index, refSpace);
        if (pPose && iPose) {
          // Project roughly to screen (demo mapping)
          hand.px = (pPose.transform.position.x * 200 + W/2);
          hand.py = (-pPose.transform.position.y * 200 + H/2);
          hand.tx = (iPose.transform.position.x * 200 + W/2);
          hand.ty = (-iPose.transform.position.y * 200 + H/2);
          if (thumb) {
            const tPose = frame.getPose(thumb, refSpace);
            if (tPose) {
              hand.thumbx = tPose.transform.position.x * 200 + W/2;
              hand.thumby = -tPose.transform.position.y * 200 + H/2;
            }
          }
        }
      }
    }
  }
  update();
  xrSession.requestAnimationFrame(onXRFrame);
}

// IndexedDB
let db;
const req = indexedDB.open('F188', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('seal');
req.onsuccess = e => {
  db = e.target.result;
  const tx = db.transaction('seal','readonly');
  const g = tx.objectStore('seal').get('champion');
  g.onsuccess = () => {
    if (g.result) {
      agents[0].mlp = MLP.deserialize(g.result.weights);
      status.textContent += ' · restored';
    }
  };
};

document.getElementById('seal').onclick = () => {
  if (!db) return;
  const best = agents.reduce((a,b) => a.fitness > b.fitness ? a : b);
  const tx = db.transaction('seal','readwrite');
  tx.objectStore('seal').put({weights: best.mlp.serialize(), fitness: best.fitness, t: Date.now()}, 'champion');
  status.textContent = 'Sealed fitness ' + best.fitness.toFixed(1);
};

function transfer() {
  agents.sort((a,b) => b.fitness - a.fitness);
  const champ = agents[0];
  agents[agents.length-1].mlp = champ.mlp.cloneMutate(0.1);
  agents[agents.length-1].fitness *= 0.5;
  status.textContent = 'Transferred · champ ' + champ.fitness.toFixed(1);
}
document.getElementById('transfer').onclick = transfer;
setInterval(transfer, 8000);

document.getElementById('reset').onclick = () => {
  agents.forEach(a => { a.mlp = new MLP(); a.x = rand(0.2,0.8)*W; a.y = rand(0.2,0.8)*H; a.fitness=0; });
};

const status = document.getElementById('status');
let frame = 0;

function update() {
  frame++;
  const energy = Math.min(1, Math.hypot(hand.vx, hand.vy)/20);
  const input = [
    (hand.px/W)*2-1, (hand.py/H)*2-1,
    (hand.tx/W)*2-1, (hand.ty/H)*2-1,
    hand.vx/50, hand.vy/50,
    (hand.thumbx/W)*2-1, (hand.thumby/H)*2-1,
    energy
  ];

  agents.forEach((a,i) => {
    const y = a.mlp.forward(input);
    a.vx = a.vx*0.85 + y[0]*6;
    a.vy = a.vy*0.85 + y[1]*6;
    a.x = Math.max(20, Math.min(W-20, a.x + a.vx));
    a.y = Math.max(20, Math.min(H-20, a.y + a.vy));
    a.rot += y[2]*0.15;
    a.scale = Math.max(0.6, Math.min(1.8, a.scale + y[3]*0.05));

    // fitness: proximity to index tip + stability
    const dx = a.x - hand.tx, dy = a.y - hand.ty;
    const dist = Math.hypot(dx,dy);
    const prox = Math.max(0, 200 - dist);
    const stab = Math.max(0, 30 - Math.hypot(a.vx,a.vy));
    a.fitness = a.fitness*0.95 + (prox + stab)*0.05;

    // card
    a.card.style.left = (a.x - 70) + 'px';
    a.card.style.top = (a.y - 45) + 'px';
    a.card.style.transform = `rotate(${a.rot}rad) scale(${a.scale})`;
    a.card.style.borderColor = `hsl(${210 + i*40}, 70%, 50%)`;
    a.card.textContent = `Agent ${i+1}\nfit ${a.fitness.toFixed(1)}`;

    a.trail.push({x:a.x, y:a.y});
    if (a.trail.length > 40) a.trail.shift();
  });

  // draw
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  // hand
  ctx.strokeStyle = '#6af';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(hand.px, hand.py, 8, 0, Math.PI*2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hand.px, hand.py);
  ctx.lineTo(hand.tx, hand.ty);
  ctx.stroke();
  ctx.fillStyle = '#f6a';
  ctx.beginPath(); ctx.arc(hand.tx, hand.ty, 5, 0, Math.PI*2); ctx.fill();
  // trails
  agents.forEach((a,i) => {
    ctx.strokeStyle = `hsla(${210+i*40},70%,60%,0.5)`;
    ctx.beginPath();
    a.trail.forEach((p,k) => k===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
    ctx.stroke();
  });

  if (frame % 30 === 0) {
    const best = Math.max(...agents.map(a=>a.fitness));
    status.textContent = (xrSession ? 'XR' : 'Pointer') + ` · best fit ${best.toFixed(1)}`;
  }
}

function loop() {
  if (!xrSession) update();
  requestAnimationFrame(loop);
}
loop();
