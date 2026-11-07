const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const cardsEl = document.getElementById('cards');
const status = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 280, D = 4;
let particles = [];
let kernel = Array(D*D).fill(0).map(() => (Math.random()-0.5)*0.4);
const labels = ['void','verse','mind','lattice','seal','agent','light','echo'];
let cards = [];

function initParticles() {
  particles = [];
  for (let i = 0; i < N; i++) {
    particles.push({
      x: Math.random()*W, y: Math.random()*H,
      vx: (Math.random()-0.5)*0.5, vy: (Math.random()-0.5)*0.5,
      emb: Array(D).fill(0).map(() => Math.random()*2-1)
    });
  }
}
function initCards() {
  cardsEl.innerHTML = '';
  cards = [];
  for (let i = 0; i < 7; i++) {
    const el = document.createElement('div');
    el.className = 'card';
    el.textContent = labels[i];
    el.style.left = (Math.random()* (W-140)) + 'px';
    el.style.top = (Math.random()* (H-90)) + 'px';
    cardsEl.appendChild(el);
    cards.push({ el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), emb: Array(D).fill(0).map(() => Math.random()*2-1) });
  }
}

function cosine(a, b) {
  let dot=0, na=0, nb=0;
  for (let i=0; i<D; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return dot / (Math.sqrt(na*nb)+1e-6);
}

function step() {
  for (let i=0; i<N; i++) {
    let fx=0, fy=0;
    const p = particles[i];
    for (let j=0; j<N; j+=4) {
      if (i===j) continue;
      const q = particles[j];
      const sim = cosine(p.emb, q.emb);
      const force = sim * 0.15 + kernel[0]*0.05;
      const dx = q.x - p.x, dy = q.y - p.y;
      const d2 = dx*dx + dy*dy + 100;
      const inv = 1 / Math.sqrt(d2);
      fx += dx * inv * force;
      fy += dy * inv * force;
    }
    p.vx = (p.vx + fx)*0.96;
    p.vy = (p.vy + fy)*0.96;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>W) p.vx *= -1;
    if (p.y<0||p.y>H) p.vy *= -1;
  }
  for (const c of cards) {
    let tx=0, ty=0, w=0;
    for (let k=0; k<40; k++) {
      const p = particles[Math.floor(Math.random()*N)];
      const s = Math.max(0, cosine(c.emb, p.emb));
      tx += p.x * s; ty += p.y * s; w += s;
    }
    if (w>0.1) {
      tx /= w; ty /= w;
      c.x += (tx - c.x)*0.04;
      c.y += (ty - c.y)*0.04;
      c.el.style.left = c.x+'px';
      c.el.style.top = c.y+'px';
      c.el.style.opacity = 0.5 + Math.min(0.5, w*0.3);
    }
  }
}

function render() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  for (const p of particles) {
    const hue = (p.emb[0]+1)*180;
    ctx.fillStyle = `hsl(${hue},70%,60%)`;
    ctx.fillRect(p.x, p.y, 2, 2);
  }
}

let gen = 0;
function evolve() {
  for (let i=0; i<kernel.length; i++) kernel[i] += (Math.random()-0.5)*0.08;
  kernel = kernel.map(v => Math.max(-1, Math.min(1, v)));
  gen++;
  status.textContent = `gen ${gen} | particles ${N} | kernel[0]=${kernel[0].toFixed(2)}`;
}

function inject(x, y, vx, vy) {
  const emb = Array(D).fill(0).map((_,i) => Math.sin(vx*0.1 + i) * Math.cos(vy*0.1));
  particles.push({ x, y, vx, vy, emb });
  if (particles.length > N+50) particles.shift();
}

canvas.addEventListener('pointermove', e => {
  if (e.buttons) inject(e.clientX, e.clientY, e.movementX, e.movementY);
});

document.getElementById('seal').onclick = async () => {
  const db = await new Promise(r => {
    const req = indexedDB.open('f548', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('k');
    req.onsuccess = () => r(req.result);
  });
  const tx = db.transaction('k','readwrite');
  tx.objectStore('k').put({kernel, gen}, 'seal');
  status.textContent = 'sealed';
};

document.getElementById('reset').onclick = () => { initParticles(); initCards(); kernel = kernel.map(()=>(Math.random()-0.5)*0.4); };

async function loadSeal() {
  try {
    const db = await new Promise(r => {
      const req = indexedDB.open('f548', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('k');
      req.onsuccess = () => r(req.result);
    });
    const tx = db.transaction('k');
    const req = tx.objectStore('k').get('seal');
    req.onsuccess = () => { if (req.result) { kernel = req.result.kernel; gen = req.result.gen; status.textContent = 'restored'; } };
  } catch (e) { console.debug("lab f548-webgpu-semantic-embedding-swarm-mind:", e); }
}

initParticles(); initCards(); loadSeal();
setInterval(evolve, 1800);
function loop() { step(); render(); requestAnimationFrame(loop); }
loop();
status.textContent = 'running (JS fallback; WebGPU compute path noted)';
