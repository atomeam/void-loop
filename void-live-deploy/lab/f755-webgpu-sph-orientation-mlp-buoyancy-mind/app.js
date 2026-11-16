const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const portalsEl = document.getElementById('portals');
const statusEl = document.getElementById('status');
let W = cv.width = innerWidth, H = cv.height = innerHeight;
window.onresize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };

const N = 180;
const particles = [];
const portals = [];
let gen = 0, fitness = 0;

// Tiny MLP: 4 -> 6 -> 2
let W1 = Array.from({length:6}, () => Array.from({length:4}, () => (Math.random()-0.5)*0.5));
let B1 = Array.from({length:6}, () => 0);
let W2 = Array.from({length:2}, () => Array.from({length:6}, () => (Math.random()-0.5)*0.5));
let B2 = Array.from({length:2}, () => 0);

function relu(x) { return Math.max(0, x); }
function mlp(inputs) {
  const h = B1.map((b,i) => relu(W1[i].reduce((s,w,j)=>s+w*inputs[j], b)));
  return B2.map((b,i) => Math.tanh(W2[i].reduce((s,w,j)=>s+w*h[j], b)));
}

function mutate(rate=0.1) {
  const mut = arr => arr.map(row => row.map(v => v + (Math.random()-0.5)*rate));
  W1 = mut(W1); W2 = mut(W2);
  B1 = B1.map(v => v + (Math.random()-0.5)*rate);
  B2 = B2.map(v => v + (Math.random()-0.5)*rate);
  gen++;
}

function initParticles() {
  particles.length = 0;
  for (let i=0; i<N; i++) {
    particles.push({
      x: Math.random()*W, y: Math.random()*H,
      vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2,
      d: 0
    });
  }
}

function initPortals() {
  portalsEl.innerHTML = '';
  portals.length = 0;
  for (let i=0; i<4; i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = 'Buoy '+(i+1);
    el.style.left = (20+i*20)+'%';
    el.style.top = (30+i*15)+'%';
    portalsEl.appendChild(el);
    portals.push({el, x: parseFloat(el.style.left)/100*W, y: parseFloat(el.style.top)/100*H, vx:0, vy:0, dens:0});
  }
}

let orient = {beta:0, gamma:0};
window.addEventListener('deviceorientation', e => {
  orient.beta = e.beta || 0;
  orient.gamma = e.gamma || 0;
});
let mouse = {x:W/2, y:H/2, down:false};
cv.onmousemove = e => { mouse.x = e.clientX; mouse.y = e.clientY; };
cv.onmousedown = () => mouse.down = true;
cv.onmouseup = () => mouse.down = false;

function computeDensity() {
  const h = 40; // smoothing radius
  particles.forEach(p => p.d = 0);
  for (let i=0; i<N; i++) {
    for (let j=i+1; j<N; j++) {
      const a = particles[i], b = particles[j];
      const dx = a.x-b.x, dy = a.y-b.y;
      const r2 = dx*dx + dy*dy;
      if (r2 < h*h) {
        const w = Math.exp(-r2/(h*h*0.5));
        a.d += w; b.d += w;
      }
    }
  }
  portals.forEach(po => {
    po.dens = 0;
    particles.forEach(p => {
      const dx = p.x - po.x, dy = p.y - po.y;
      const r2 = dx*dx + dy*dy;
      if (r2 < h*h) po.dens += Math.exp(-r2/(h*h*0.5));
    });
  });
}

function step() {
  const inputs = [
    orient.beta / 90,
    orient.gamma / 90,
    mouse.x / W - 0.5,
    mouse.y / H - 0.5
  ];
  const [gx, gy] = mlp(inputs).map(v => v * 0.15);

  computeDensity();

  // Forces
  const h = 40;
  particles.forEach(p => {
    let fx = gx, fy = gy + 0.02; // gravity + mlp
    particles.forEach(q => {
      if (p === q) return;
      const dx = p.x - q.x, dy = p.y - q.y;
      const r2 = dx*dx + dy*dy + 1e-4;
      if (r2 < h*h) {
        const r = Math.sqrt(r2);
        const pressure = (p.d - 2) * 0.05;
        fx += pressure * dx / r;
        fy += pressure * dy / r;
        // viscosity
        fx += (q.vx - p.vx) * 0.01;
        fy += (q.vy - p.vy) * 0.01;
      }
    });
    if (mouse.down) {
      const dx = mouse.x - p.x, dy = mouse.y - p.y;
      const r2 = dx*dx + dy*dy;
      if (r2 < 10000) { fx += dx*0.002; fy += dy*0.002; }
    }
    p.vx = (p.vx + fx) * 0.98;
    p.vy = (p.vy + fy) * 0.98;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -0.8;
    if (p.y < 0 || p.y > H) p.vy *= -0.8;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
  });

  // Portals seek density (buoyancy-like)
  portals.forEach(po => {
    let fx = 0, fy = 0;
    particles.forEach(p => {
      const dx = p.x - po.x, dy = p.y - po.y;
      const r2 = dx*dx + dy*dy + 100;
      if (r2 < 8000) {
        const f = (p.d * 0.001) / r2;
        fx += dx * f; fy += dy * f;
      }
    });
    po.vx = (po.vx + fx) * 0.9;
    po.vy = (po.vy + fy) * 0.9;
    po.x += po.vx; po.y += po.vy;
    po.x = Math.max(40, Math.min(W-40, po.x));
    po.y = Math.max(30, Math.min(H-30, po.y));
    po.el.style.left = po.x + 'px';
    po.el.style.top = po.y + 'px';
    po.el.style.transform = `scale(${1 + po.dens*0.05})`;
  });

  fitness = portals.reduce((s,po) => s + po.dens, 0) / portals.length;
  statusEl.textContent = `Particles: ${N} | Fitness: ${fitness.toFixed(2)} | Gen: ${gen}`;
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.3)';
  ctx.fillRect(0,0,W,H);
  particles.forEach(p => {
    const a = Math.min(1, p.d * 0.3);
    ctx.fillStyle = `hsla(${200 + p.d*10}, 70%, 60%, ${a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2 + p.d*0.5, 0, Math.PI*2);
    ctx.fill();
  });
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}

document.getElementById('seal').onclick = () => {
  if (fitness > 1.5) {
    mutate(0.08);
    localStorage.setItem('f755-genome', JSON.stringify({W1,W2,B1,B2,gen}));
  } else mutate(0.15);
};
document.getElementById('reset').onclick = () => { initParticles(); initPortals(); };

// Load genome if any
try {
  const saved = JSON.parse(localStorage.getItem('f755-genome') || 'null');
  if (saved) { W1=saved.W1; W2=saved.W2; B1=saved.B1; B2=saved.B2; gen=saved.gen||0; }
} catch (e) { console.debug("lab f755-webgpu-sph-orientation-mlp-buoyancy-mind:", e); }

initParticles();
initPortals();
loop();
