const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const portalsEl = document.getElementById('portals');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 8;
const sites = [];
const portals = [];
let mlp = { w: new Float32Array(16), b: new Float32Array(4) }; // simple 4->4->2 or whatever
// Input: px,py,vx,vy (normalized) → forces for sites or global bias
function initMLP() {
  for (let i=0; i<mlp.w.length; i++) mlp.w[i] = (Math.random()-0.5)*0.5;
  for (let i=0; i<mlp.b.length; i++) mlp.b[i] = (Math.random()-0.5)*0.2;
}
initMLP();

function loadSeal() {
  try {
    const s = localStorage.getItem('f780-voronoi-policy');
    if (s) {
      const data = JSON.parse(s);
      mlp.w = new Float32Array(data.w);
      mlp.b = new Float32Array(data.b);
      document.getElementById('status').textContent = 'Sealed genome restored';
    }
  } catch (e) { console.debug("lab f780-webgpu-voronoi-policy-portal-mind:", e); }
}
loadSeal();

for (let i=0; i<N; i++) {
  const x = Math.random()*W, y = Math.random()*H;
  sites.push({ x, y, vx:0, vy:0, id:i });
  const p = document.createElement('div');
  p.className = 'portal';
  p.textContent = `S${i}`;
  p.style.left = (x-36)+'px';
  p.style.top = (y-36)+'px';
  portalsEl.appendChild(p);
  portals.push(p);
  // drag
  let dragging = false, ox=0, oy=0;
  p.addEventListener('pointerdown', e => {
    dragging = true; p.classList.add('dragging');
    ox = e.clientX - sites[i].x; oy = e.clientY - sites[i].y;
    p.setPointerCapture(e.pointerId);
  });
  p.addEventListener('pointermove', e => {
    if (!dragging) return;
    sites[i].x = e.clientX - ox;
    sites[i].y = e.clientY - oy;
    sites[i].vx = 0; sites[i].vy = 0;
    // reward signal: slightly adapt toward current pointer residual
    adapt(0.02);
  });
  p.addEventListener('pointerup', () => { dragging=false; p.classList.remove('dragging'); });
}

let px=W/2, py=H/2, vx=0, vy=0, lastX=px, lastY=py;
canvas.addEventListener('pointermove', e => {
  vx = e.clientX - lastX; vy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  px = e.clientX; py = e.clientY;
});

let orient = { beta:0, gamma:0 };
window.addEventListener('deviceorientation', e => {
  if (e.beta != null) orient.beta = e.beta;
  if (e.gamma != null) orient.gamma = e.gamma;
});

function adapt(lr) {
  // simple online: push weights to attract sites toward pointer on average
  const nx = (px/W-0.5)*2, ny = (py/H-0.5)*2;
  for (let i=0; i<mlp.w.length; i++) mlp.w[i] += lr * (Math.random()-0.5) * nx; // crude
}

function policyForce(site) {
  // tiny MLP: inputs [nx, ny, vx, vy] → dx, dy
  const nx = (px / W - 0.5) * 2;
  const ny = (py / H - 0.5) * 2;
  const nvx = Math.max(-1, Math.min(1, vx/20));
  const nvy = Math.max(-1, Math.min(1, vy/20));
  // simple linear for demo + orientation bias
  let fx = mlp.w[0]*nx + mlp.w[1]*ny + mlp.w[2]*nvx + mlp.w[3]*nvy + mlp.b[0];
  let fy = mlp.w[4]*nx + mlp.w[5]*ny + mlp.w[6]*nvx + mlp.w[7]*nvy + mlp.b[1];
  // orientation tilt
  fx += orient.gamma * 0.002;
  fy += orient.beta * 0.002;
  // repulsion between sites
  for (const other of sites) {
    if (other === site) continue;
    const dx = site.x - other.x, dy = site.y - other.y;
    const d2 = dx*dx + dy*dy + 100;
    const f = 800 / d2;
    fx += dx * f; fy += dy * f;
  }
  // soft attraction to pointer residual
  const dxp = px - site.x, dyp = py - site.y;
  const dist = Math.hypot(dxp, dyp) + 1;
  fx += (dxp / dist) * 0.4 * Math.abs(nvx+nvy);
  fy += (dyp / dist) * 0.4 * Math.abs(nvx+nvy);
  return {fx: fx*0.15, fy: fy*0.15};
}

function step() {
  for (const s of sites) {
    const f = policyForce(s);
    s.vx = s.vx*0.92 + f.fx;
    s.vy = s.vy*0.92 + f.fy;
    s.x += s.vx;
    s.y += s.vy;
    s.x = Math.max(20, Math.min(W-20, s.x));
    s.y = Math.max(20, Math.min(H-20, s.y));
  }
  // update portal positions
  for (let i=0; i<N; i++) {
    portals[i].style.left = (sites[i].x - 36) + 'px';
    portals[i].style.top = (sites[i].y - 36) + 'px';
  }
}

function render() {
  // fast Voronoi approx: for each pixel sample nearest site (downsampled for perf)
  const stepSize = 4;
  const img = ctx.createImageData(W, H);
  const data = img.data;
  for (let y=0; y<H; y+=stepSize) {
    for (let x=0; x<W; x+=stepSize) {
      let best = 0, bestD = 1e9;
      for (let i=0; i<N; i++) {
        const dx = x - sites[i].x, dy = y - sites[i].y;
        const d = dx*dx + dy*dy;
        if (d < bestD) { bestD = d; best = i; }
      }
      const hue = (best * 40) % 360;
      const col = hslToRgb(hue, 0.6, 0.35);
      for (let dy=0; dy<stepSize && y+dy<H; dy++) {
        for (let dx=0; dx<stepSize && x+dx<W; dx++) {
          const idx = ((y+dy)*W + (x+dx)) * 4;
          data[idx] = col[0]; data[idx+1] = col[1]; data[idx+2] = col[2]; data[idx+3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  // draw sites
  ctx.fillStyle = '#fff';
  for (const s of sites) {
    ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI*2); ctx.fill();
  }
}

function hslToRgb(h, s, l) {
  h /= 360;
  const a = s * Math.min(l, 1-l);
  const f = n => {
    const k = (n + h*12) % 12;
    return l - a * Math.max(Math.min(k-3, 9-k, 1), -1);
  };
  return [f(0)*255, f(8)*255, f(4)*255];
}

document.getElementById('seal').onclick = () => {
  localStorage.setItem('f780-voronoi-policy', JSON.stringify({
    w: Array.from(mlp.w), b: Array.from(mlp.b)
  }));
  document.getElementById('status').textContent = 'Genome sealed to localStorage';
};
document.getElementById('reset').onclick = () => {
  initMLP();
  localStorage.removeItem('f780-voronoi-policy');
  document.getElementById('status').textContent = 'Reset';
};

function loop() {
  step();
  render();
  requestAnimationFrame(loop);
}
loop();
