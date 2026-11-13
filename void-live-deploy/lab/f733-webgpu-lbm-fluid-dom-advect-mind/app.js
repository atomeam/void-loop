const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let W = 128, H = 96;
let scale = 6;
canvas.width = W * scale;
canvas.height = H * scale;

// D2Q9 LBM
const Q = 9;
const cx = [0,1,0,-1,0,1,-1,-1,1];
const cy = [0,0,1,0,-1,1,1,-1,-1];
const w = [4/9, 1/9,1/9,1/9,1/9, 1/36,1/36,1/36,1/36];
const opp = [0,3,4,1,2,7,8,5,6];

let f = new Float32Array(W * H * Q);
let rho = new Float32Array(W * H);
let ux = new Float32Array(W * H);
let uy = new Float32Array(W * H);
const tau = 0.8; // relaxation
const omega = 1 / tau;

function idx(x,y,q) { return (y * W + x) * Q + q; }
function pidx(x,y) { return y * W + x; }

function init() {
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    for (let q=0; q<Q; q++) f[idx(x,y,q)] = w[q];
    rho[pidx(x,y)] = 1;
    ux[pidx(x,y)] = 0;
    uy[pidx(x,y)] = 0;
  }
  // seed some velocity
  for (let y=H/2-5; y<H/2+5; y++) for (let x=W/4; x<W/4+10; x++) {
    ux[pidx(x,y)] = 0.1;
    for (let q=0; q<Q; q++) f[idx(x,y,q)] = equilibrium(x,y,q);
  }
}

function equilibrium(x,y,q) {
  const i = pidx(x,y);
  const u2 = ux[i]*ux[i] + uy[i]*uy[i];
  const cu = cx[q]*ux[i] + cy[q]*uy[i];
  return w[q] * rho[i] * (1 + 3*cu + 4.5*cu*cu - 1.5*u2);
}

function step() {
  // Collision + streaming (bounce-back simple walls)
  const nf = new Float32Array(f.length);
  for (let y=1; y<H-1; y++) for (let x=1; x<W-1; x++) {
    for (let q=0; q<Q; q++) {
      const feq = equilibrium(x,y,q);
      const fi = f[idx(x,y,q)];
      const fstar = fi - omega * (fi - feq);
      const nx = x + cx[q], ny = y + cy[q];
      if (nx>0 && nx<W-1 && ny>0 && ny<H-1) {
        nf[idx(nx,ny,q)] = fstar;
      } else {
        // bounce back
        nf[idx(x,y,opp[q])] = fstar;
      }
    }
  }
  f.set(nf);
  // Macroscopic
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    let r=0, uxx=0, uyy=0;
    for (let q=0; q<Q; q++) {
      const fi = f[idx(x,y,q)];
      r += fi;
      uxx += fi * cx[q];
      uyy += fi * cy[q];
    }
    const i = pidx(x,y);
    rho[i] = r;
    ux[i] = uxx / r;
    uy[i] = uyy / r;
  }
}

function render() {
  const img = ctx.createImageData(W*scale, H*scale);
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    const i = pidx(x,y);
    const speed = Math.hypot(ux[i], uy[i]);
    const r = Math.min(255, speed * 1200);
    const g = Math.min(255, rho[i] * 100);
    const b = 180;
    for (let dy=0; dy<scale; dy++) for (let dx=0; dx<scale; dx++) {
      const pi = ((y*scale+dy)*W*scale + x*scale+dx)*4;
      img.data[pi] = r; img.data[pi+1] = g; img.data[pi+2] = b; img.data[pi+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// DOM portals
const portals = [];
function addPortal(x=100, y=100) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'Portal ' + (portals.length+1);
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.appendChild(el);
  portals.push({el, x, y, vx:0, vy:0, genome: {bias: Math.random()*0.2-0.1}});
  makeDraggable(el, portals[portals.length-1]);
}

function makeDraggable(el, p) {
  let ox, oy;
  el.onpointerdown = e => {
    ox = e.clientX - p.x; oy = e.clientY - p.y;
    el.setPointerCapture(e.pointerId);
  };
  el.onpointermove = e => {
    if (e.buttons) {
      p.x = e.clientX - ox; p.y = e.clientY - oy;
      el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
      // inject momentum
      const gx = Math.floor(p.x / scale), gy = Math.floor(p.y / scale);
      if (gx>1 && gx<W-2 && gy>1 && gy<H-2) {
        for (let dy=-2; dy<=2; dy++) for (let dx=-2; dx<=2; dx++) {
          const i = pidx(gx+dx, gy+dy);
          ux[i] += 0.05; uy[i] += 0.02;
        }
      }
    }
  };
}

function updatePortals() {
  for (const p of portals) {
    const gx = Math.max(1, Math.min(W-2, Math.floor(p.x / scale)));
    const gy = Math.max(1, Math.min(H-2, Math.floor(p.y / scale)));
    const i = pidx(gx, gy);
    // advect by fluid velocity
    p.vx = p.vx * 0.9 + ux[i] * scale * 8;
    p.vy = p.vy * 0.9 + uy[i] * scale * 8;
    p.x += p.vx; p.y += p.vy;
    // bounds
    p.x = Math.max(0, Math.min(canvas.width-80, p.x));
    p.y = Math.max(0, Math.min(canvas.height-60, p.y));
    p.el.style.left = p.x + 'px';
    p.el.style.top = p.y + 'px';
    p.el.style.transform = `rotate(${Math.atan2(uy[i], ux[i]) * 30}deg)`;
    p.el.style.background = `rgba(${40+ux[i]*200}, ${60+uy[i]*200}, 120, 0.7)`;
  }
}

// Persistence
const DB = 'verse-f733-lbm';
function seal() {
  const data = { portals: portals.map(p => ({x:p.x,y:p.y,genome:p.genome})), note: 'F733 sealed' };
  localStorage.setItem(DB, JSON.stringify(data));
  status.textContent = 'Genome sealed to localStorage';
  // BroadcastChannel for transfer
  try {
    const bc = new BroadcastChannel('f733-genome');
    bc.postMessage(data);
  } catch (e) { console.debug("lab f733-webgpu-lbm-fluid-dom-advect-mind:", e); }
}

function loadSeal() {
  const s = localStorage.getItem(DB);
  if (s) {
    const data = JSON.parse(s);
    data.portals.forEach(pd => addPortal(pd.x, pd.y));
    status.textContent = 'Loaded sealed genome';
  } else {
    addPortal(200,150);
    addPortal(400,200);
  }
}

// Loop
let running = true;
function loop() {
  if (running) {
    step();
    updatePortals();
    render();
  }
  requestAnimationFrame(loop);
}

// UI
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { init(); status.textContent = 'Fluid reset'; };
document.getElementById('addPortal').onclick = () => addPortal(Math.random()*canvas.width, Math.random()*canvas.height);

// Orientation as gravity
window.addEventListener('deviceorientation', e => {
  if (e.gamma) {
    // mild bias
    const g = e.gamma / 90 * 0.01;
    for (let i=0; i<ux.length; i++) ux[i] += g;
  }
});

// Init
init();
loadSeal();
status.textContent = 'LBM running · drag portals to inject momentum · tilt for gravity · seal to persist';
loop();

// Listen for peer genomes
try {
  const bc = new BroadcastChannel('f733-genome');
  bc.onmessage = e => {
    status.textContent = 'Received genome from peer';
    // could merge
  };
} catch (e) { console.debug("lab f733-webgpu-lbm-fluid-dom-advect-mind:", e); }
