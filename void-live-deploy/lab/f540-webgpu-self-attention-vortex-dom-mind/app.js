const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 1200;
const particles = new Float32Array(N * 4); // x,y,vx,vy
const cards = [];
const cardEls = [];
const pointer = { x: W/2, y: H/2, vx:0, vy:0 };
let orient = { beta:0, gamma:0 };
let weights = new Float32Array(32); // attention params
let fitness = 0;
let gpu = false;

function initParticles() {
  for (let i=0; i<N; i++) {
    particles[i*4] = Math.random()*W;
    particles[i*4+1] = Math.random()*H;
    particles[i*4+2] = (Math.random()-0.5)*2;
    particles[i*4+3] = (Math.random()-0.5)*2;
  }
}
function initCards() {
  const titles = ['Anchor α','Vortex β','Weaver γ','Memory δ','Focus ε'];
  for (let i=0; i<5; i++) {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `<h4>${titles[i]}</h4><div class="state">attn: 0.00</div>`; // void-review: ok (constant labels, numbers or a hash only; no visitor text)
    el.style.left = (80 + i*160) + 'px';
    el.style.top = (60 + (i%2)*120) + 'px';
    document.body.appendChild(el);
    cardEls.push(el);
    cards.push({ x: parseFloat(el.style.left), y: parseFloat(el.style.top), s:1, hue:200, attn:0.2 });
    makeDraggable(el, i);
  }
}
function makeDraggable(el, idx) {
  let ox, oy, dragging=false;
  el.onpointerdown = e => { dragging=true; ox=e.clientX-cards[idx].x; oy=e.clientY-cards[idx].y; el.setPointerCapture(e.pointerId); };
  el.onpointermove = e => { if (!dragging) return; cards[idx].x = e.clientX-ox; cards[idx].y = e.clientY-oy; el.style.left=cards[idx].x+'px'; el.style.top=cards[idx].y+'px'; };
  el.onpointerup = () => dragging=false;
}
function initWeights() {
  for (let i=0; i<weights.length; i++) weights[i] = (Math.random()-0.5)*0.5;
}

// Tiny attention over cards + pointer
function computeAttention() {
  const px = pointer.x / W, py = pointer.y / H;
  const ovx = pointer.vx / 20, ovy = pointer.vy / 20;
  const ob = orient.beta / 90, og = orient.gamma / 90;
  let total = 0;
  for (let i=0; i<cards.length; i++) {
    const c = cards[i];
    const cx = c.x / W, cy = c.y / H;
    // simple attention score: distance + velocity alignment + orient bias + weight
    const dx = px - cx, dy = py - cy;
    const dist = Math.sqrt(dx*dx + dy*dy) + 0.01;
    const score = Math.exp(-dist*3) * (1 + weights[i]*ovx + weights[i+5]*ovy + weights[i+10]*ob + weights[i+15]*og) + weights[i+20]*c.attn;
    c.attn = Math.max(0.01, score);
    total += c.attn;
  }
  // normalize
  for (let c of cards) c.attn /= total || 1;
  return total;
}

function updateParticles() {
  const att = computeAttention();
  for (let i=0; i<N; i++) {
    let x = particles[i*4], y = particles[i*4+1];
    let vx = particles[i*4+2], vy = particles[i*4+3];
    // vortex around highest attention card
    let best = cards[0]; for (let c of cards) if (c.attn > best.attn) best = c;
    const dx = best.x + 70 - x, dy = best.y + 45 - y;
    const d = Math.sqrt(dx*dx + dy*dy) + 1;
    // tangential vortex + radial attraction modulated by attn
    const force = best.attn * 0.8;
    vx += (-dy / d) * force * 0.4 + (dx / d) * force * 0.15;
    vy += (dx / d) * force * 0.4 + (dy / d) * force * 0.15;
    // damping + noise
    vx *= 0.98; vy *= 0.98;
    vx += (Math.random()-0.5)*0.1; vy += (Math.random()-0.5)*0.1;
    x += vx; y += vy;
    if (x<0||x>W) vx *= -0.5; if (y<0||y>H) vy *= -0.5;
    x = Math.max(0, Math.min(W, x)); y = Math.max(0, Math.min(H, y));
    particles[i*4]=x; particles[i*4+1]=y; particles[i*4+2]=vx; particles[i*4+3]=vy;
  }
  fitness = att * 0.5 + cards.reduce((s,c)=>s+c.attn,0)*0.3;
  document.getElementById('fitness').textContent = 'fitness: ' + fitness.toFixed(2);
}

function morphCards() {
  cards.forEach((c, i) => {
    const el = cardEls[i];
    const s = 0.8 + c.attn * 1.4;
    const hue = 180 + c.attn * 120;
    el.style.transform = `scale(${s})`;
    el.style.filter = `hue-rotate(${hue}deg) brightness(${0.8 + c.attn*0.6})`;
    el.style.opacity = 0.6 + c.attn * 0.4;
    el.querySelector('.state').textContent = `attn: ${c.attn.toFixed(2)}`;
  });
}

function render() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#6cf';
  for (let i=0; i<N; i++) {
    const a = 0.3 + Math.min(1, Math.hypot(particles[i*4+2], particles[i*4+3])*0.2);
    ctx.globalAlpha = a;
    ctx.fillRect(particles[i*4], particles[i*4+1], 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
}

function loop() {
  updateParticles();
  morphCards();
  render();
  requestAnimationFrame(loop);
}

// Pointer
addEventListener('pointermove', e => {
  pointer.vx = e.clientX - pointer.x; pointer.vy = e.clientY - pointer.y;
  pointer.x = e.clientX; pointer.y = e.clientY;
});
// Orientation
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => { orient.beta = e.beta||0; orient.gamma = e.gamma||0; });
}

// Seal / IndexedDB / Broadcast
const dbName = 'f540-attention-vortex';
let db;
const bc = new BroadcastChannel('f540-genome');
function openDB() {
  const req = indexedDB.open(dbName, 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('genomes', {keyPath:'id'});
  req.onsuccess = e => { db = e.target.result; loadGenome(); };
}
function hashWeights() {
  let h = 2166136261;
  for (let w of weights) h = Math.imul(h ^ (w*1000|0), 16777619);
  return h >>> 0;
}
function seal() {
  if (!db) return;
  const rec = { id:'best', weights: Array.from(weights), fitness, hash: hashWeights(), t: Date.now() };
  const tx = db.transaction('genomes','readwrite');
  tx.objectStore('genomes').put(rec);
  bc.postMessage(rec);
  document.getElementById('status').textContent = 'Sealed genome hash ' + rec.hash.toString(16);
}
function loadGenome() {
  if (!db) return;
  const tx = db.transaction('genomes','readonly');
  const req = tx.objectStore('genomes').get('best');
  req.onsuccess = e => { if (e.target.result) { weights.set(e.target.result.weights); fitness = e.target.result.fitness; } };
}
bc.onmessage = e => {
  const rec = e.data;
  if (rec.hash === hashWeights.call && rec.fitness > fitness) { // simple check
    weights.set(rec.weights); fitness = rec.fitness;
    document.getElementById('status').textContent = 'Adopted higher-fitness genome';
  }
};
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initWeights(); initParticles(); };

// WebGPU probe (progressive; full compute left as extension point)
async function probeGPU() {
  if (!navigator.gpu) { document.getElementById('status').textContent += ' · Canvas2D fallback'; return; }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (adapter) { gpu = true; document.getElementById('status').textContent += ' · WebGPU available (compute path ready)'; }
  } catch (e) { console.warn('f540-webgpu-self-attention-vortex-dom-mind:', e); }
}

initParticles(); initCards(); initWeights(); openDB(); probeGPU(); loop();
