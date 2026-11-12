const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const hudN = document.getElementById('n');
const hudC = document.getElementById('c');
const hudE = document.getElementById('e');
const portalsEl = document.getElementById('portals');

let W = innerWidth, H = innerHeight;
cv.width = W; cv.height = H;
addEventListener('resize', () => { W=cv.width=innerWidth; H=cv.height=innerHeight; });

const N = 180;
let parts = [];
let eps = 1.2, sig = 18, cut = 42;
let mouse = {x: W/2, y: H/2, down: false};
let sealed = null;

function initParts() {
  parts = [];
  for (let i=0; i<N; i++) {
    parts.push({
      x: Math.random()*W, y: Math.random()*H,
      vx: (Math.random()-0.5)*1.2, vy: (Math.random()-0.5)*1.2,
      fx:0, fy:0
    });
  }
}
initParts();

function ljForce(dx, dy, r2) {
  if (r2 < 1 || r2 > cut*cut) return [0,0];
  const r = Math.sqrt(r2);
  const sr = sig / r;
  const sr6 = sr*sr*sr*sr*sr*sr;
  const sr12 = sr6*sr6;
  const fmag = 24 * eps * (2*sr12 - sr6) / r2;
  return [fmag * dx, fmag * dy];
}

function step() {
  let energy = 0;
  for (let i=0; i<N; i++) { parts[i].fx=0; parts[i].fy=0; }
  for (let i=0; i<N; i++) {
    const a = parts[i];
    const mdx = mouse.x - a.x, mdy = mouse.y - a.y;
    const mr2 = mdx*mdx + mdy*mdy;
    if (mr2 < 120*120 && mr2 > 4) {
      const mf = (mouse.down ? -0.8 : 0.15) * 800 / (mr2 + 100);
      a.fx += mf * mdx; a.fy += mf * mdy;
    }
    for (let j=i+1; j<N; j++) {
      const b = parts[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const r2 = dx*dx + dy*dy;
      if (r2 < cut*cut && r2 > 1) {
        const [fx,fy] = ljForce(dx, dy, r2);
        a.fx -= fx; a.fy -= fy;
        b.fx += fx; b.fy += fy;
        const r = Math.sqrt(r2);
        const sr = sig/r; const sr6 = Math.pow(sr,6); const sr12 = sr6*sr6;
        energy += 4*eps*(sr12 - sr6);
      }
    }
  }
  const damp = 0.992;
  for (let p of parts) {
    p.vx = (p.vx + p.fx * 0.05) * damp;
    p.vy = (p.vy + p.fy * 0.05) * damp;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0) { p.x=0; p.vx*=-0.7; }
    if (p.x > W) { p.x=W; p.vx*=-0.7; }
    if (p.y < 0) { p.y=0; p.vy*=-0.7; }
    if (p.y > H) { p.y=H; p.vy*=-0.7; }
  }
  hudE.textContent = energy.toFixed(0);
  return energy;
}

function findClusters() {
  const cell = 40;
  const gx = Math.ceil(W/cell), gy = Math.ceil(H/cell);
  const dens = new Float32Array(gx*gy);
  for (let p of parts) {
    const ix = Math.min(gx-1, Math.max(0, p.x/cell|0));
    const iy = Math.min(gy-1, Math.max(0, p.y/cell|0));
    dens[iy*gx + ix] += 1;
  }
  const clusters = [];
  for (let iy=0; iy<gy; iy++) for (let ix=0; ix<gx; ix++) {
    const d = dens[iy*gx+ix];
    if (d > 4) {
      clusters.push({ x: (ix+0.5)*cell, y: (iy+0.5)*cell, dens: d });
    }
  }
  const merged = [];
  for (let c of clusters) {
    let found = false;
    for (let m of merged) {
      const dx=c.x-m.x, dy=c.y-m.y;
      if (dx*dx+dy*dy < 70*70) { m.x=(m.x+c.x)/2; m.y=(m.y+c.y)/2; m.dens+=c.dens; found=true; break; }
    }
    if (!found) merged.push({...c});
  }
  return merged.slice(0, 6);
}

function updatePortals(clusters) {
  portalsEl.innerHTML = '';
  clusters.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'portal';
    el.style.left = c.x + 'px';
    el.style.top = c.y + 'px';
    el.textContent = 'C' + (i+1) + ' d:' + c.dens.toFixed(0);
    el.style.opacity = Math.min(1, c.dens / 12);
    portalsEl.appendChild(el);
  });
  hudC.textContent = clusters.length;
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#8cf';
  for (let p of parts) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, 6.28);
    ctx.fill();
  }
  ctx.strokeStyle = mouse.down ? '#f66' : '#6af';
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, 12, 0, 6.28);
  ctx.stroke();
}

let last = 0;
function loop(t) {
  if (t - last > 16) {
    step();
    const clusters = findClusters();
    updatePortals(clusters);
    draw();
    hudN.textContent = N;
    last = t;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

cv.addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
cv.addEventListener('pointerdown', () => mouse.down = true);
cv.addEventListener('pointerup', () => mouse.down = false);
cv.addEventListener('pointerleave', () => mouse.down = false);

document.getElementById('reset').onclick = initParts;
document.getElementById('seal').onclick = () => {
  sealed = { eps, sig, cut, ts: Date.now() };
  localStorage.setItem('verse-f710-lj', JSON.stringify(sealed));
  alert('Genome sealed: ε=' + eps + ' σ=' + sig);
};
document.getElementById('load').onclick = () => {
  const s = localStorage.getItem('verse-f710-lj');
  if (s) {
    sealed = JSON.parse(s);
    eps = sealed.eps; sig = sealed.sig; cut = sealed.cut;
    alert('Loaded sealed genome');
  }
};

try {
  const s = localStorage.getItem('verse-f710-lj');
  if (s) { const o=JSON.parse(s); eps=o.eps||eps; sig=o.sig||sig; }
} catch (e) { console.debug("lab f710-webgpu-lennard-jones-cluster-mind:", e); }
