const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H, N = 64, cell;
function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
  cell = Math.min(W, H) / N;
}
resize(); addEventListener('resize', resize);

// Wave lattice
let u = new Float32Array(N*N), v = new Float32Array(N*N);

// Bayesian particle filter (intent: x,y,vx,vy)
const NP = 32;
let particles = Array.from({length: NP}, () => ({x:0.5, y:0.5, vx:0, vy:0, w:1/NP}));
let pointer = {x:0.5, y:0.5, vx:0, vy:0};
let lastPointer = {x:0.5, y:0.5};

// Orbs
const orbs = [];
function spawnOrb(gx, gy, residual) {
  const o = document.createElement('div');
  o.className = 'orb';
  o.style.setProperty('--h', (residual*120|0));
  o.textContent = residual.toFixed(2);
  o.style.left = (gx/N*W - 20) + 'px';
  o.style.top = (gy/N*H - 20) + 'px';
  o.dataset.gx = gx; o.dataset.gy = gy;
  document.body.appendChild(o);
  orbs.push(o);
  // drag
  let dragging = false, ox, oy;
  o.addEventListener('pointerdown', e => { dragging=true; ox=e.clientX-o.offsetLeft; oy=e.clientY-o.offsetTop; o.setPointerCapture(e.pointerId); });
  o.addEventListener('pointermove', e => { if(!dragging) return; o.style.left=(e.clientX-ox)+'px'; o.style.top=(e.clientY-oy)+'px'; });
  o.addEventListener('pointerup', e => { dragging=false; injectObservation(parseFloat(o.dataset.gx), parseFloat(o.dataset.gy), residual); });
}

function injectObservation(gx, gy, strength) {
  const ox = gx/N, oy = gy/N;
  particles.forEach(p => {
    const d = Math.hypot(p.x - ox, p.y - oy);
    p.w *= Math.exp(-d*d / 0.02) * (1 + strength*0.5);
  });
  // normalize + occasional resample
  let sw = particles.reduce((s,p)=>s+p.w,0);
  particles.forEach(p => p.w /= sw);
  if (Math.random()<0.3) resample();
}

function resample() {
  const cum = []; let c=0;
  particles.forEach(p => { c+=p.w; cum.push(c); });
  const np = [];
  for(let i=0;i<NP;i++) {
    const r = Math.random();
    let j=0; while(cum[j]<r) j++;
    np.push({...particles[j], w:1/NP});
  }
  particles = np;
}

function updateFilter() {
  // predict
  particles.forEach(p => {
    p.x += p.vx * 0.05 + (Math.random()-0.5)*0.01;
    p.y += p.vy * 0.05 + (Math.random()-0.5)*0.01;
    p.vx *= 0.95; p.vy *= 0.95;
    p.x = Math.max(0, Math.min(1, p.x));
    p.y = Math.max(0, Math.min(1, p.y));
  });
  // update with pointer
  const lx = pointer.x, ly = pointer.y;
  particles.forEach(p => {
    const d = Math.hypot(p.x - lx, p.y - ly);
    p.w *= Math.exp(-d*d / 0.05);
  });
  let sw = particles.reduce((s,p)=>s+p.w,0) || 1;
  particles.forEach(p => p.w /= sw);
  if (particles.some(p=>p.w>0.4)) resample();
}

function entropy() {
  let e=0;
  particles.forEach(p => { if(p.w>0) e -= p.w * Math.log(p.w); });
  return e / Math.log(NP); // normalized
}

function mean() {
  let mx=0, my=0;
  particles.forEach(p => { mx += p.x*p.w; my += p.y*p.w; });
  return {x:mx, y:my};
}

// Orientation
let tiltX=0, tiltY=0;
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    tiltX = (e.gamma||0)/90;
    tiltY = (e.beta||0)/90;
  });
}

// Pointer
canvas.addEventListener('pointermove', e => {
  lastPointer = {...pointer};
  pointer.x = e.clientX / W;
  pointer.y = e.clientY / H;
  pointer.vx = pointer.x - lastPointer.x;
  pointer.vy = pointer.y - lastPointer.y;
});

// Wave step
function stepWave() {
  const next = new Float32Array(N*N);
  const m = mean();
  const srcX = (m.x * N)|0, srcY = (m.y * N)|0;
  const ent = entropy();
  for(let y=1;y<N-1;y++) for(let x=1;x<N-1;x++) {
    const i = y*N+x;
    const lap = u[i-1]+u[i+1]+u[i-N]+u[i+N] - 4*u[i];
    let force = 0.18 * lap - 0.02 * v[i];
    // source from belief
    const dx = x-srcX, dy=y-srcY;
    if (dx*dx+dy*dy < 9) force += 0.3 * (1-ent) * Math.sin(Date.now()/200);
    // tilt
    force += tiltX*0.01*(x-N/2)/N + tiltY*0.01*(y-N/2)/N;
    v[i] = (v[i] + force) * 0.98;
    next[i] = u[i] + v[i];
  }
  u = next;
  // collapse check
  if (ent > 0.6 && Math.random()<0.05) {
    let maxA=0, mx=0,my=0;
    for(let i=0;i<N*N;i++) if(Math.abs(u[i])>maxA){ maxA=Math.abs(u[i]); mx=i%N; my=i/N|0; }
    if(maxA>0.5) {
      u[my*N+mx] *= 0.2;
      spawnOrb(mx, my, ent);
    }
  }
}

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,W,H);
  for(let y=0;y<N;y++) for(let x=0;x<N;x++) {
    const a = u[y*N+x];
    const h = 200 + a*80;
    ctx.fillStyle = `hsla(${h},60%,${40+Math.abs(a)*30}%,.7)`;
    ctx.fillRect(x*cell, y*cell, cell-1, cell-1);
  }
  // particles
  ctx.fillStyle = '#fff';
  particles.forEach(p => {
    ctx.globalAlpha = p.w*2;
    ctx.beginPath(); ctx.arc(p.x*W, p.y*H, 3, 0, 7); ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function loop() {
  updateFilter();
  stepWave();
  draw();
  document.getElementById('ent').textContent = entropy().toFixed(2);
  // morph UI
  document.body.style.filter = `hue-rotate(${entropy()*60}deg)`;
  requestAnimationFrame(loop);
}
loop();

// Seal
document.getElementById('seal').onclick = async () => {
  const data = {particles, u: Array.from(u)};
  try {
    const db = await new Promise((res,rej)=>{ const r=indexedDB.open('verse-f466',1); r.onupgradeneeded=e=>e.target.result.createObjectStore('belief'); r.onsuccess=e=>res(e.target.result); r.onerror=rej; });
    const tx = db.transaction('belief','readwrite');
    tx.objectStore('belief').put(data, 'champ');
    await new Promise(r=>tx.oncomplete=r);
    alert('Belief sealed');
  } catch(e) { console.warn(e); alert('IDB unavailable, memory only'); }
};
document.getElementById('load').onclick = async () => {
  try {
    const db = await new Promise((res,rej)=>{ const r=indexedDB.open('verse-f466',1); r.onsuccess=e=>res(e.target.result); r.onerror=rej; });
    const tx = db.transaction('belief');
    const req = tx.objectStore('belief').get('champ');
    req.onsuccess = () => {
      if(req.result) {
        particles = req.result.particles;
        u.set(req.result.u);
        alert('Loaded');
      }
    };
  } catch(e) { alert('No seal or IDB'); }
};
document.getElementById('reset').onclick = () => {
  u.fill(0); v.fill(0);
  particles = Array.from({length: NP}, () => ({x:0.5, y:0.5, vx:0, vy:0, w:1/NP}));
  orbs.forEach(o=>o.remove()); orbs.length=0;
};
