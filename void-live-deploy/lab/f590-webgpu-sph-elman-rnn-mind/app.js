const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

// ---- Elman RNN ----
const IN = 4, HID = 16, OUT = 4;
let Wxh = Array.from({length:HID}, () => Array.from({length:IN}, () => (Math.random()-0.5)*0.4));
let Whh = Array.from({length:HID}, () => Array.from({length:HID}, () => (Math.random()-0.5)*0.3));
let Why = Array.from({length:OUT}, () => Array.from({length:HID}, () => (Math.random()-0.5)*0.5));
let bh = Array(HID).fill(0);
let by = Array(OUT).fill(0);
let h = Array(HID).fill(0);

function tanh(x){ return Math.tanh(x); }
function rnnStep(input){
  const newH = Array(HID).fill(0);
  for(let i=0;i<HID;i++){
    let s = bh[i];
    for(let j=0;j<IN;j++) s += Wxh[i][j]*input[j];
    for(let j=0;j<HID;j++) s += Whh[i][j]*h[j];
    newH[i] = tanh(s);
  }
  h = newH;
  const out = Array(OUT).fill(0);
  for(let i=0;i<OUT;i++){
    let s = by[i];
    for(let j=0;j<HID;j++) s += Why[i][j]*h[j];
    out[i] = tanh(s);
  }
  return out;
}

// ---- SPH-like particles ----
const N = 72;
const particles = [];
function initParticles(){
  particles.length = 0;
  for(let i=0;i<N;i++){
    particles.push({
      x: Math.random()*canvas.width*0.6 + canvas.width*0.2,
      y: Math.random()*canvas.height*0.6 + canvas.height*0.2,
      vx: (Math.random()-0.5)*0.5,
      vy: (Math.random()-0.5)*0.5,
      density: 1,
      pressure: 0
    });
  }
}
initParticles();

// ---- Orientation / pointer ----
let tiltX = 0, tiltY = 0;
let pointerX = canvas.width/2, pointerY = canvas.height/2;
if (window.DeviceOrientationEvent) {
  addEventListener('deviceorientation', e => {
    tiltX = (e.gamma || 0) / 45;
    tiltY = (e.beta || 0) / 45;
  });
}
addEventListener('pointermove', e => {
  pointerX = e.clientX; pointerY = e.clientY;
  if (!window.DeviceOrientationEvent || Math.abs(tiltX)+Math.abs(tiltY)<0.05) {
    tiltX = (e.clientX / canvas.width - 0.5) * 2;
    tiltY = (e.clientY / canvas.height - 0.5) * 2;
  }
});

// ---- Droplets ----
const droplets = [];
function spawnDroplet(x,y){
  if (droplets.length >= 5) return;
  const d = document.createElement('div');
  d.className = 'droplet';
  d.style.left = (x-14)+'px';
  d.style.top = (y-14)+'px';
  d.dataset.vx = 0; d.dataset.vy = 0;
  document.body.appendChild(d);
  droplets.push({el:d, x, y, age:0});
  let dragging = false, ox=0, oy=0;
  d.addEventListener('pointerdown', e => { dragging=true; ox=e.clientX-x; oy=e.clientY-y; d.setPointerCapture(e.pointerId); });
  d.addEventListener('pointermove', e => {
    if (!dragging) return;
    x = e.clientX - ox; y = e.clientY - oy;
    d.style.left = (x-14)+'px'; d.style.top = (y-14)+'px';
    // inject momentum to nearby particles
    for (const p of particles) {
      const dx = p.x - x, dy = p.y - y;
      const dist2 = dx*dx + dy*dy;
      if (dist2 < 3600) {
        const f = 80 / (dist2 + 100);
        p.vx += (e.movementX||0) * f * 0.15;
        p.vy += (e.movementY||0) * f * 0.15;
      }
    }
  });
  d.addEventListener('pointerup', () => { dragging=false; });
}

// ---- Simple SPH step ----
const H = 28; // smoothing length
function sphStep(gx, gy, visc){
  // density
  for (const p of particles) p.density = 0;
  for (let i=0;i<N;i++){
    for (let j=i;j<N;j++){
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const r2 = dx*dx + dy*dy;
      if (r2 < H*H) {
        const w = Math.max(0, 1 - Math.sqrt(r2)/H);
        particles[i].density += w;
        if (i!==j) particles[j].density += w;
      }
    }
  }
  // pressure & forces
  for (const p of particles) {
    p.pressure = Math.max(0, p.density - 4) * 0.8;
  }
  for (let i=0;i<N;i++){
    let fx=0, fy=0;
    const pi = particles[i];
    for (let j=0;j<N;j++){
      if (i===j) continue;
      const pj = particles[j];
      const dx = pi.x - pj.x, dy = pi.y - pj.y;
      const r2 = dx*dx + dy*dy + 1e-4;
      if (r2 < H*H) {
        const r = Math.sqrt(r2);
        const press = (pi.pressure + pj.pressure) * 0.5;
        const f = press * (H - r) / r2;
        fx += dx * f;
        fy += dy * f;
        // viscosity
        fx += (pj.vx - pi.vx) * visc * 0.1;
        fy += (pj.vy - pi.vy) * visc * 0.1;
      }
    }
    pi.vx += (fx + gx * 0.4) * 0.016;
    pi.vy += (fy + gy * 0.4 + 0.08) * 0.016; // slight gravity
    pi.vx *= 0.98; pi.vy *= 0.98;
    pi.x += pi.vx; pi.y += pi.vy;
    // bounds
    if (pi.x < 10) { pi.x=10; pi.vx*=-0.5; }
    if (pi.x > canvas.width-10) { pi.x=canvas.width-10; pi.vx*=-0.5; }
    if (pi.y < 10) { pi.y=10; pi.vy*=-0.5; }
    if (pi.y > canvas.height-10) { pi.y=canvas.height-10; pi.vy*=-0.5; }
  }
}

// ---- Main loop ----
let frame = 0;
let energy = 0;
function loop(){
  frame++;
  const input = [tiltX, tiltY, energy*0.1, (frame%120)/120];
  const out = rnnStep(input);
  const gx = out[0] * 2.2;
  const gy = out[1] * 2.2;
  const visc = 0.3 + (out[2]+1)*0.4;
  sphStep(gx, gy, visc);

  // energy & spawn
  energy = 0;
  for (const p of particles) energy += p.density;
  energy /= N;
  if (frame % 40 === 0 && energy > 5.5) {
    const hot = particles.reduce((a,b)=> a.density>b.density?a:b);
    spawnDroplet(hot.x, hot.y);
  }
  // age droplets
  for (let i=droplets.length-1;i>=0;i--){
    droplets[i].age++;
    if (droplets[i].age > 280) {
      droplets[i].el.remove();
      droplets.splice(i,1);
    }
  }

  // draw
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  for (const p of particles) {
    const a = Math.min(1, p.density/8);
    ctx.fillStyle = `hsla(${200 + p.density*12},80%,${50+a*30}%,${0.4+a*0.5})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3 + p.density*0.4, 0, Math.PI*2);
    ctx.fill();
  }
  statusEl.textContent = `RNN hidden energy ${h.reduce((s,v)=>s+Math.abs(v),0).toFixed(1)} | fluid dens ${energy.toFixed(2)} | droplets ${droplets.length}`;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---- Seal / IndexedDB ----
function openDB(){
  return new Promise((res,rej)=>{
    const r = indexedDB.open('verse-f590',1);
    r.onupgradeneeded = () => r.result.createObjectStore('state');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function seal(){
  try {
    const db = await openDB();
    const tx = db.transaction('state','readwrite');
    tx.objectStore('state').put({
      Wxh, Whh, Why, bh, by, h,
      particles: particles.map(p=>({x:p.x,y:p.y,vx:p.vx,vy:p.vy})),
      t: Date.now()
    }, 'mind');
    await tx.complete;
    statusEl.textContent = 'Sealed to IndexedDB';
  } catch(e){ statusEl.textContent = 'Seal failed (memory only)'; }
}
document.getElementById('seal').onclick = seal;
document.getElementById('reset').onclick = () => { initParticles(); h.fill(0); statusEl.textContent='Reset'; };

// restore attempt
(async ()=>{
  try {
    const db = await openDB();
    const tx = db.transaction('state','readonly');
    const req = tx.objectStore('state').get('mind');
    req.onsuccess = () => {
      const s = req.result;
      if (s) {
        Wxh=s.Wxh; Whh=s.Whh; Why=s.Why; bh=s.bh; by=s.by; h=s.h;
        s.particles.forEach((p,i)=>{ if(particles[i]) Object.assign(particles[i],p); });
        statusEl.textContent = 'Restored sealed mind';
      } else statusEl.textContent = 'Ready – tilt or move mouse';
    };
  } catch(e){ statusEl.textContent = 'Ready (no IDB)'; }
})();

// WebGPU note: full compute SPH kernel would replace sphStep with compute shader
// when navigator.gpu available; current CPU path is the working interactive prototype.
if (navigator.gpu) statusEl.textContent += ' | WebGPU available (CPU SPH active)';
