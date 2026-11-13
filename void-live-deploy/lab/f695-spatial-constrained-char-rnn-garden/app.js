const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const garden = document.getElementById('garden');
const status = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// Tiny char RNN (Elman-style, simplified)
const VOCAB = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?";
const V = VOCAB.length;
const HIDDEN = 16;
let Wxh = Array(HIDDEN).fill(0).map(() => Array(V).fill(0).map(() => (Math.random()-0.5)*0.1));
let Whh = Array(HIDDEN).fill(0).map(() => Array(HIDDEN).fill(0).map(() => (Math.random()-0.5)*0.1));
let Why = Array(V).fill(0).map(() => Array(HIDDEN).fill(0).map(() => (Math.random()-0.5)*0.1));
let bh = Array(HIDDEN).fill(0);
let by = Array(V).fill(0);
let h = Array(HIDDEN).fill(0);
let logitBias = Array(V).fill(0);

function tanh(x) { return Math.tanh(x); }
function softmax(arr) {
  const m = Math.max(...arr);
  const e = arr.map(x => Math.exp(x - m));
  const s = e.reduce((a,b)=>a+b,0);
  return e.map(x => x/s);
}
function forward(ch) {
  const idx = Math.max(0, VOCAB.indexOf(ch));
  const newH = Array(HIDDEN).fill(0);
  for (let i=0; i<HIDDEN; i++) {
    let s = bh[i];
    for (let j=0; j<V; j++) s += Wxh[i][j] * (j===idx?1:0);
    for (let j=0; j<HIDDEN; j++) s += Whh[i][j] * h[j];
    newH[i] = tanh(s);
  }
  h = newH;
  const logits = Array(V).fill(0);
  for (let i=0; i<V; i++) {
    let s = by[i] + logitBias[i];
    for (let j=0; j<HIDDEN; j++) s += Why[i][j] * h[j];
    logits[i] = s;
  }
  return logits;
}
function sample(logits) {
  const p = softmax(logits);
  let r = Math.random(), cum = 0;
  for (let i=0; i<V; i++) { cum += p[i]; if (r < cum) return VOCAB[i]; }
  return VOCAB[0];
}

// Zones
const zones = [
  { name: 'continue', x: W*0.1, y: H*0.7, w: 140, h: 60, bias: (i) => VOCAB[i]===' ' || /[a-z]/.test(VOCAB[i]) ? 0.4 : 0 },
  { name: 'question', x: W*0.4, y: H*0.7, w: 140, h: 60, bias: (i) => VOCAB[i]==='?' ? 1.5 : 0 },
  { name: 'exclaim', x: W*0.7, y: H*0.7, w: 140, h: 60, bias: (i) => VOCAB[i]==='!' ? 1.5 : 0 }
];
zones.forEach(z => {
  const el = document.createElement('div');
  el.className = 'zone';
  el.textContent = z.name;
  el.style.left = z.x + 'px';
  el.style.top = z.y + 'px';
  el.style.width = z.w + 'px';
  el.style.height = z.h + 'px';
  document.body.appendChild(el);
});

// Cards
let cards = [];
function spawnCard(ch, x, y) {
  const el = document.createElement('div');
  el.className = 'card';
  el.textContent = ch;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  const card = { el, ch, x, y, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2, dragging: false };
  cards.push(card);
  garden.appendChild(el);
  makeDraggable(card);
  return card;
}
function makeDraggable(card) {
  let ox, oy;
  card.el.addEventListener('pointerdown', e => {
    card.dragging = true;
    ox = e.clientX - card.x; oy = e.clientY - card.y;
    card.el.setPointerCapture(e.pointerId);
  });
  card.el.addEventListener('pointermove', e => {
    if (!card.dragging) return;
    card.x = e.clientX - ox; card.y = e.clientY - oy;
    card.el.style.left = card.x + 'px'; card.el.style.top = card.y + 'px';
  });
  card.el.addEventListener('pointerup', e => {
    card.dragging = false;
    // check zones
    for (const z of zones) {
      if (card.x > z.x && card.x < z.x+z.w && card.y > z.y && card.y < z.y+z.h) {
        for (let i=0; i<V; i++) logitBias[i] += z.bias(i) * 0.3;
        status.textContent = `Biased toward ${z.name}`;
        break;
      }
    }
  });
}

// Particles for hidden viz
const particles = Array(180).fill(0).map(() => ({
  x: Math.random()*W, y: Math.random()*H,
  vx: 0, vy: 0
}));

let windX = 0, windY = 0;
let lastGen = ' ';

function stepGen() {
  const logits = forward(lastGen);
  const next = sample(logits);
  lastGen = next;
  spawnCard(next, Math.random()*W*0.8+20, Math.random()*H*0.5+40);
  status.textContent = `Generated: ${next} | cards: ${cards.length}`;
}

document.getElementById('gen').onclick = () => {
  const seed = document.getElementById('seed').value || ' ';
  for (const c of seed) {
    forward(c);
    spawnCard(c, Math.random()*W*0.6+30, Math.random()*H*0.4+30);
  }
  lastGen = seed[seed.length-1] || ' ';
  status.textContent = `Seeded ${seed.length} chars`;
};
document.getElementById('step').onclick = stepGen;
document.getElementById('reset').onclick = () => {
  cards.forEach(c => c.el.remove()); cards = [];
  logitBias.fill(0); h.fill(0); lastGen = ' ';
  status.textContent = 'Reset';
};
document.getElementById('orient').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission().then(p => { if (p==='granted') addEventListener('deviceorientation', onOrient); });
  } else addEventListener('deviceorientation', onOrient);
  status.textContent = 'Orientation requested';
};
function onOrient(e) {
  windX = (e.gamma || 0) * 0.02;
  windY = (e.beta || 0) * 0.02;
}

// IndexedDB
let db;
const req = indexedDB.open('verse-f695', 1);
req.onupgradeneeded = e => e.target.result.createObjectStore('garden');
req.onsuccess = e => { db = e.target.result; load(); };
function seal() {
  if (!db) return;
  const tx = db.transaction('garden','readwrite');
  tx.objectStore('garden').put({ Wxh, Whh, Why, bh, by, logitBias, cards: cards.map(c=>({ch:c.ch,x:c.x,y:c.y})), lastGen }, 'state');
  status.textContent = 'Sealed to IndexedDB';
}
function load() {
  if (!db) return;
  const tx = db.transaction('garden');
  const g = tx.objectStore('garden').get('state');
  g.onsuccess = () => {
    if (g.result) {
      const s = g.result;
      Wxh = s.Wxh; Whh = s.Whh; Why = s.Why; bh = s.bh; by = s.by; logitBias = s.logitBias; lastGen = s.lastGen;
      s.cards.forEach(c => spawnCard(c.ch, c.x, c.y));
      status.textContent = 'Restored from seal';
    }
  };
}
document.getElementById('seal').onclick = seal;

// Loop
function loop() {
  ctx.fillStyle = 'rgba(10,10,18,0.2)';
  ctx.fillRect(0,0,W,H);
  // particles from hidden
  particles.forEach((p,i) => {
    const hs = h[i % HIDDEN] || 0;
    p.vx += (hs * 0.5 - 0.25) * 0.1 + windX * 0.05;
    p.vy += (Math.sin(i + Date.now()*0.001) * 0.2) + windY * 0.05;
    p.vx *= 0.98; p.vy *= 0.98;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>W) p.vx *= -1;
    if (p.y<0||p.y>H) p.vy *= -1;
    ctx.fillStyle = `hsl(${(hs*180+180)%360},70%,60%)`;
    ctx.fillRect(p.x, p.y, 2, 2);
  });
  // cards physics
  cards.forEach(card => {
    if (card.dragging) return;
    card.vx += windX * 0.1; card.vy += windY * 0.1;
    card.vx *= 0.95; card.vy *= 0.95;
    card.x += card.vx; card.y += card.vy;
    if (card.x < 10) card.x = 10; if (card.x > W-40) card.x = W-40;
    if (card.y < 10) card.y = 10; if (card.y > H-40) card.y = H-40;
    card.el.style.left = card.x + 'px';
    card.el.style.top = card.y + 'px';
  });
  requestAnimationFrame(loop);
}
loop();
status.textContent = 'Garden ready. Seed then Generate / Step. Drag cards into zones to constrain. Seal persists.';
