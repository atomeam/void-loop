const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W=64, H=64, scale=1;
let density = new Float32Array(W*H);
let vx = new Float32Array(W*H);
let vy = new Float32Array(W*H);
let dens0 = new Float32Array(W*H);
let vx0 = new Float32Array(W*H);
let vy0 = new Float32Array(W*H);

// Simple multi-head attention over pointer history
const WIN = 16;
const hist = [];
let attnW = Array.from({length:4}, ()=>Math.random()*0.2-0.1); // tiny projection
let sealed = false;

function recordPointer(e) {
  const x = e.clientX / innerWidth;
  const y = e.clientY / innerHeight;
  const last = hist[hist.length-1] || {x,y,vx:0,vy:0};
  const vx = (x - last.x)*60;
  const vy = (y - last.y)*60;
  hist.push({x,y,vx,vy,t:performance.now()});
  if (hist.length > WIN) hist.shift();
}

function attentionForce() {
  if (hist.length < 2) return {fx:0, fy:0, mag:0};
  // ultra-simple "attention": weighted sum of recent velocities by learnable weights
  let fx=0, fy=0, wsum=0;
  for (let i=0; i<hist.length; i++) {
    const w = Math.tanh(attnW[0]*hist[i].vx + attnW[1]*hist[i].vy + attnW[2]*i/WIN + attnW[3]);
    const a = Math.max(0, w);
    fx += a * hist[i].vx;
    fy += a * hist[i].vy;
    wsum += a;
  }
  const mag = Math.hypot(fx,fy);
  return {fx: fx*0.8, fy: fy*0.8, mag};
}

function inject(force) {
  const cx = Math.floor(force.x * W) || Math.floor(hist.at(-1)?.x * W) || W/2;
  const cy = Math.floor(force.y * H) || Math.floor(hist.at(-1)?.y * H) || H/2;
  const r = 3;
  for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++) {
    const x=cx+dx, y=cy+dy;
    if (x<0||x>=W||y<0||y>=H) continue;
    const i = y*W+x;
    const d = Math.exp(-(dx*dx+dy*dy)/(r*r));
    density[i] += d * (0.4 + force.mag*0.1);
    vx[i] += force.fx * d * 0.05;
    vy[i] += force.fy * d * 0.05;
  }
}

// Minimal stable-fluid step (very simplified advection + diffusion)
function fluidStep() {
  // diffuse density a bit
  for (let i=0;i<W*H;i++) dens0[i]=density[i], vx0[i]=vx[i], vy0[i]=vy[i];
  for (let y=1;y<H-1;y++) for (let x=1;x<W-1;x++) {
    const i=y*W+x;
    density[i] = (dens0[i] + 0.15*(dens0[i-1]+dens0[i+1]+dens0[i-W]+dens0[i+W])) / 1.6;
    vx[i] = (vx0[i] + 0.1*(vx0[i-1]+vx0[i+1]+vx0[i-W]+vx0[i+W])) / 1.4;
    vy[i] = (vy0[i] + 0.1*(vy0[i-1]+vy0[i+1]+vy0[i-W]+vy0[i+W])) / 1.4;
  }
  // simple advection
  for (let y=1;y<H-1;y++) for (let x=1;x<W-1;x++) {
    const i=y*W+x;
    let nx = x - vx[i]*0.8, ny = y - vy[i]*0.8;
    nx = Math.max(0,Math.min(W-1,nx)); ny = Math.max(0,Math.min(H-1,ny));
    const ix=Math.floor(nx), iy=Math.floor(ny);
    density[i] *= 0.98;
    // weak decay
    vx[i] *= 0.96; vy[i] *= 0.96;
  }
}

function render() {
  canvas.width = innerWidth; canvas.height = innerHeight;
  const img = ctx.createImageData(W, H);
  for (let i=0;i<W*H;i++) {
    const d = Math.min(1, density[i]*2);
    const sp = Math.hypot(vx[i],vy[i])*4;
    img.data[i*4]   = d*80 + sp*100;
    img.data[i*4+1] = d*160;
    img.data[i*4+2] = d*255;
    img.data[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.drawImage(canvas, 0, 0, W, H, 0, 0, canvas.width, canvas.height);
}

// Portals + Houdini attempt
const portals = [];
function makePortals() {
  for (let i=0;i<5;i++) {
    const el = document.createElement('div');
    el.className = 'portal';
    el.textContent = 'Portal '+(i+1);
    el.style.left = (20+i*18)+'%';
    el.style.top = (30+ (i%2)*25)+'%';
    el.onclick = () => reward(el, i);
    document.body.appendChild(el);
    portals.push(el);
  }
}

function sample(el) {
  const r = el.getBoundingClientRect();
  const cx = (r.left+r.width/2)/innerWidth;
  const cy = (r.top+r.height/2)/innerHeight;
  const ix = Math.floor(cx*W), iy = Math.floor(cy*H);
  const i = Math.max(0,Math.min(W*H-1, iy*W+ix));
  return {d:density[i], v:Math.hypot(vx[i],vy[i]), x:cx, y:cy};
}

function updatePortals() {
  portals.forEach(el => {
    const s = sample(el);
    el.style.setProperty('--d', s.d);
    el.style.setProperty('--v', s.v);
    el.style.transform = `scale(${1+s.d*0.4}) rotate(${s.v*20}deg)`;
    el.style.background = `hsla(${200+s.d*80}, 70%, ${30+s.v*40}%, 0.7)`;
    el.style.filter = `blur(${s.d*2}px)`;
  });
}

function reward(el, idx) {
  const s = sample(el);
  const rew = 0.1 + s.d;
  // delta rule on attention weights toward current hist
  if (hist.length) {
    const last = hist.at(-1);
    attnW[0] += 0.02 * rew * last.vx;
    attnW[1] += 0.02 * rew * last.vy;
    attnW[2] += 0.01 * rew;
    attnW[3] += 0.005 * rew;
  }
  statusEl.textContent = `reward ${rew.toFixed(2)} on portal ${idx+1}`;
  el.style.boxShadow = '0 0 20px #4af';
  setTimeout(()=>el.style.boxShadow='', 300);
}

async function seal() {
  try {
    const db = await new Promise((res,rej)=>{
      const r = indexedDB.open('verse-f873',1);
      r.onupgradeneeded = ()=>r.result.createObjectStore('mind');
      r.onsuccess = ()=>res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mind','readwrite');
    tx.objectStore('mind').put({attnW, t:Date.now()}, 'weights');
    await new Promise(r=>tx.oncomplete=r);
    statusEl.textContent = 'Mind sealed to IndexedDB';
  } catch(e) { statusEl.textContent = 'Seal failed (IDB)'; }
}

async function load() {
  try {
    const db = await new Promise((res,rej)=>{
      const r = indexedDB.open('verse-f873',1);
      r.onsuccess = ()=>res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mind');
    const req = tx.objectStore('mind').get('weights');
    req.onsuccess = ()=> {
      if (req.result) { attnW = req.result.attnW; statusEl.textContent = 'Mind restored'; }
      else statusEl.textContent = 'New mind';
    };
  } catch(e) { statusEl.textContent = 'No prior mind'; }
}

document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = ()=>{ density.fill(0); vx.fill(0); vy.fill(0); attnW=attnW.map(()=>Math.random()*0.2-0.1); statusEl.textContent='reset'; };

window.addEventListener('pointermove', e => { recordPointer(e); });
window.addEventListener('resize', ()=>{});

makePortals();
load();

function loop() {
  const f = attentionForce();
  if (hist.length) {
    f.x = hist.at(-1).x; f.y = hist.at(-1).y;
    inject(f);
  }
  fluidStep();
  render();
  updatePortals();
  requestAnimationFrame(loop);
}
statusEl.textContent = 'ready — move pointer';
loop();
