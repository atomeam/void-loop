const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const W = 72, H = 48;
const CELL = 10;
canvas.width = W * CELL;
canvas.height = H * CELL;

const DX = [0,1,0,-1], DY = [-1,0,1,0];
let particles = new Uint8Array(W * H * 4);
let density = new Float32Array(W * H);
let vx = new Float32Array(W * H), vy = new Float32Array(W * H);

let w1 = new Float32Array(5*6), b1 = new Float32Array(6);
let w2 = new Float32Array(6*3), b2 = new Float32Array(3);
function randInit() {
  for (let i=0;i<w1.length;i++) w1[i] = (Math.random()-0.5)*0.8;
  for (let i=0;i<w2.length;i++) w2[i] = (Math.random()-0.5)*0.8;
  for (let i=0;i<b1.length;i++) b1[i] = (Math.random()-0.5)*0.2;
  for (let i=0;i<b2.length;i++) b2[i] = (Math.random()-0.5)*0.2;
}
randInit();

function mlp(inputs) {
  const h = new Float32Array(6);
  for (let j=0;j<6;j++) {
    let s = b1[j];
    for (let i=0;i<5;i++) s += inputs[i] * w1[i*6+j];
    h[j] = Math.tanh(s);
  }
  const o = new Float32Array(3);
  for (let k=0;k<3;k++) {
    let s = b2[k];
    for (let j=0;j<6;j++) s += h[j] * w2[j*3+k];
    o[k] = Math.tanh(s);
  }
  return o;
}

let ori = {beta:0, gamma:0, db:0, dg:0};
let pointer = {x:0, y:0, vx:0, vy:0};
let fitness = 0;
const channel = new BroadcastChannel('f537-genome');

function initParticles() {
  particles.fill(0);
  for (let i=0;i<W*H*0.35;i++) {
    const c = (Math.random()*W*H)|0;
    const d = (Math.random()*4)|0;
    particles[c*4 + d] = 1;
  }
}
initParticles();

function occupancy() {
  const occ = new Uint8Array(W*H);
  document.querySelectorAll('.card').forEach(card => {
    const r = card.getBoundingClientRect();
    const x0 = Math.max(0, Math.floor((r.left / window.innerWidth) * W));
    const y0 = Math.max(0, Math.floor((r.top / window.innerHeight) * H));
    const x1 = Math.min(W, Math.ceil(((r.left+r.width) / window.innerWidth) * W));
    const y1 = Math.min(H, Math.ceil(((r.top+r.height) / window.innerHeight) * H));
    for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++) occ[y*W+x] = 1;
  });
  return occ;
}

function step() {
  const occ = occupancy();
  const next = new Uint8Array(W*H*4);
  let curlSum = 0, count = 0;
  const params = mlp([ori.db*0.02, ori.dg*0.02, pointer.vx*0.01, pointer.vy*0.01, density[Math.floor(H/2)*W + Math.floor(W/2)] || 0]);
  const biasX = params[0], biasY = params[1], restP = (params[2]+1)*0.15;

  for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
    const i = y*W + x;
    if (occ[i]) continue;
    let dens = 0, cvx=0, cvy=0;
    for (let d=0;d<4;d++) {
      if (particles[i*4 + d]) {
        dens++;
        let nx = x + DX[d], ny = y + DY[d];
        let nd = d;
        if (nx<0||nx>=W||ny<0||ny>=H||occ[ny*W+nx]) {
          nd = (d+2)%4;
          nx = x; ny = y;
        } else {
          if (Math.random() < Math.abs(biasX)*0.3) nd = biasX>0 ? 1 : 3;
          if (Math.random() < Math.abs(biasY)*0.3) nd = biasY>0 ? 2 : 0;
        }
        if (Math.random() < restP) continue;
        next[ny*W*4 + nx*4 + nd] = 1;
        cvx += DX[d]; cvy += DY[d];
      }
    }
    density[i] = dens;
    vx[i] = cvx; vy[i] = cvy;
    count += dens;
    if (x>0 && y>0) curlSum += Math.abs(vx[i]-vx[i-1]) + Math.abs(vy[i]-vy[(y-1)*W+x]);
  }
  particles = next;
  fitness = 0.98*fitness + 0.02*(curlSum / Math.max(1,count));
  document.getElementById('seal').disabled = fitness < 0.15;
  document.getElementById('status').textContent =
    `fitness ${fitness.toFixed(3)}  particles ~${count}  bias (${biasX.toFixed(2)},${biasY.toFixed(2)})`;
}

function render() {
  const img = ctx.createImageData(W*CELL, H*CELL);
  const data = img.data;
  for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
    const d = density[y*W+x];
    const vmag = Math.hypot(vx[y*W+x], vy[y*W+x]);
    const r = Math.min(255, d*60 + vmag*40);
    const g = Math.min(255, 40 + d*30);
    const b = Math.min(255, 180 - d*20 + vmag*30);
    for (let py=0;py<CELL;py++) for (let px=0;px<CELL;px++) {
      const idx = ((y*CELL+py)*W*CELL + x*CELL+px)*4;
      data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

let lastX=0, lastY=0;
window.addEventListener('pointermove', e => {
  pointer.vx = e.clientX - lastX; pointer.vy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
});
window.addEventListener('deviceorientation', e => {
  const nb = e.beta||0, ng = e.gamma||0;
  ori.db = nb - ori.beta; ori.dg = ng - ori.gamma;
  ori.beta = nb; ori.gamma = ng;
});

document.querySelectorAll('.card').forEach(card => {
  let ox=0, oy=0, dragging=false;
  card.addEventListener('pointerdown', e => { dragging=true; ox=e.clientX-card.offsetLeft; oy=e.clientY-card.offsetTop; card.setPointerCapture(e.pointerId); });
  card.addEventListener('pointermove', e => { if (!dragging) return; card.style.left = (e.clientX-ox)+'px'; card.style.top = (e.clientY-oy)+'px'; });
  card.addEventListener('pointerup', () => dragging=false);
});

document.getElementById('seal').onclick = () => {
  const payload = { w1: Array.from(w1), w2: Array.from(w2), b1: Array.from(b1), b2: Array.from(b2), fitness };
  try { localStorage.setItem('f537-genome', JSON.stringify(payload)); } catch(e){}
  channel.postMessage(payload);
  document.getElementById('status').textContent += ' · sealed';
};
document.getElementById('reset').onclick = () => { randInit(); initParticles(); fitness=0; };

channel.onmessage = e => {
  if (e.data.fitness > fitness + 0.02) {
    w1.set(e.data.w1); w2.set(e.data.w2); b1.set(e.data.b1); b2.set(e.data.b2);
    fitness = e.data.fitness * 0.9;
  }
};

function loop() { step(); render(); requestAnimationFrame(loop); }
loop();

try {
  const saved = JSON.parse(localStorage.getItem('f537-genome')||'null');
  if (saved && saved.w1) { w1.set(saved.w1); w2.set(saved.w2); b1.set(saved.b1); b2.set(saved.b2); fitness = saved.fitness||0; }
} catch(e){}
