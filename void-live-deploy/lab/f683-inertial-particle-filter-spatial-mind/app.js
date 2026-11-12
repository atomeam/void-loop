const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const status = document.getElementById('status');
const N = 256;
let particles = [];
let landmarks = [];
let trajectory = [];
let mean = {x:0, y:0, theta:0};
let motionOn = false;
let lastTime = performance.now();

function resize() {
  cv.width = window.innerWidth;
  cv.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function initParticles() {
  particles = Array.from({length:N}, () => ({
    x: cv.width/2 + (Math.random()-0.5)*40,
    y: cv.height/2 + (Math.random()-0.5)*40,
    theta: Math.random()*Math.PI*2,
    w: 1/N
  }));
  updateMean();
}
initParticles();

function updateMean() {
  let sx=0, sy=0, st=0, sw=0;
  for (const p of particles) {
    sx += p.x * p.w; sy += p.y * p.w;
    st += p.theta * p.w; sw += p.w;
  }
  if (sw > 0) {
    mean.x = sx/sw; mean.y = sy/sw; mean.theta = st/sw;
  }
}

function addNoise(p, scale=1) {
  p.x += (Math.random()-0.5)*scale*8;
  p.y += (Math.random()-0.5)*scale*8;
  p.theta += (Math.random()-0.5)*scale*0.15;
}

function integrateMotion(dt, ax, ay, omega) {
  const speed = Math.hypot(ax, ay) * 40;
  for (const p of particles) {
    p.theta += omega * dt + (Math.random()-0.5)*0.05;
    const vx = Math.cos(p.theta) * speed * 0.3;
    const vy = Math.sin(p.theta) * speed * 0.3;
    p.x += vx * dt * 60;
    p.y += vy * dt * 60;
    addNoise(p, 0.4);
  }
  updateMean();
  trajectory.push({x:mean.x, y:mean.y});
  if (trajectory.length > 300) trajectory.shift();
}

function resample() {
  const cum = [];
  let c = 0;
  for (const p of particles) { c += p.w; cum.push(c); }
  const newP = [];
  for (let i=0; i<N; i++) {
    const r = Math.random() * c;
    let j = 0;
    while (j < N-1 && cum[j] < r) j++;
    const src = particles[j];
    newP.push({x:src.x, y:src.y, theta:src.theta, w:1/N});
    addNoise(newP[newP.length-1], 0.2);
  }
  particles = newP;
}

function observe() {
  if (landmarks.length === 0) { status.textContent = 'Place a landmark first.'; return; }
  let best = landmarks[0], bd = 1e9;
  for (const lm of landmarks) {
    const d = Math.hypot(lm.x - mean.x, lm.y - mean.y);
    if (d < bd) { bd = d; best = lm; }
  }
  const sigma = 80;
  let tw = 0;
  for (const p of particles) {
    const d = Math.hypot(p.x - best.x, p.y - best.y);
    p.w *= Math.exp(-d*d / (2*sigma*sigma));
    tw += p.w;
  }
  for (const p of particles) p.w /= tw || 1;
  const neff = 1 / particles.reduce((s,p) => s + p.w*p.w, 0);
  if (neff < N/2) resample();
  updateMean();
  status.textContent = `Observed near "${best.name}". N_eff≈${neff.toFixed(0)}`;
}

function placeLandmark() {
  const name = document.getElementById('name').value || 'beacon';
  landmarks.push({id: Date.now(), x: mean.x, y: mean.y, name});
  status.textContent = `Placed "${name}" at (${mean.x.toFixed(0)}, ${mean.y.toFixed(0)})`;
}

async function enableMotion() {
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const perm = await DeviceMotionEvent.requestPermission();
      if (perm !== 'granted') { status.textContent = 'Motion permission denied.'; return; }
    } catch(e) { status.textContent = 'Permission error: ' + e.message; return; }
  }
  motionOn = true;
  window.addEventListener('devicemotion', onMotion);
  status.textContent = 'Motion enabled. Tilt/move device.';
  document.getElementById('btnMotion').textContent = 'Motion On';
}

function onMotion(e) {
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastTime)/1000);
  lastTime = now;
  const acc = e.accelerationIncludingGravity || e.acceleration;
  if (!acc) return;
  const ax = (acc.x || 0) * 0.1;
  const ay = (acc.y || 0) * 0.1;
  const rr = e.rotationRate || {};
  const omega = (rr.alpha || 0) * Math.PI / 180 * 0.5;
  integrateMotion(dt, ax, ay, omega);
}

let dragging = false, lastPtr = null;
cv.addEventListener('pointerdown', e => { dragging=true; lastPtr={x:e.clientX, y:e.clientY}; });
cv.addEventListener('pointerup', () => dragging=false);
cv.addEventListener('pointermove', e => {
  if (!dragging || motionOn) return;
  const dx = e.clientX - lastPtr.x, dy = e.clientY - lastPtr.y;
  lastPtr = {x:e.clientX, y:e.clientY};
  integrateMotion(0.016, dx*0.5, dy*0.5, 0);
});

function draw() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0,0,cv.width,cv.height);
  if (trajectory.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = '#6cf8';
    ctx.lineWidth = 1;
    ctx.moveTo(trajectory[0].x, trajectory[0].y);
    for (const t of trajectory) ctx.lineTo(t.x, t.y);
    ctx.stroke();
  }
  for (const p of particles) {
    ctx.fillStyle = `rgba(100,200,255,${Math.min(0.6, p.w * N * 0.8)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(mean.x, mean.y);
  ctx.rotate(mean.theta);
  ctx.fillStyle = '#f96';
  ctx.beginPath();
  ctx.moveTo(12,0); ctx.lineTo(-8,6); ctx.lineTo(-8,-6); ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff';
  for (const lm of landmarks) {
    ctx.beginPath();
    ctx.arc(lm.x, lm.y, 5, 0, Math.PI*2);
    ctx.fill();
    ctx.font = '11px system-ui';
    ctx.fillText(lm.name, lm.x+8, lm.y-8);
  }
  requestAnimationFrame(draw);
}
draw();

document.getElementById('btnMotion').onclick = enableMotion;
document.getElementById('btnPlace').onclick = placeLandmark;
document.getElementById('btnObserve').onclick = observe;
document.getElementById('btnSeal').onclick = async () => {
  const data = {landmarks, mean, trajectory: trajectory.slice(-50), ts: Date.now()};
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f683', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('maps');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('maps', 'readwrite');
    tx.objectStore('maps').put(data, 'current');
    await new Promise(r => tx.oncomplete = r);
    status.textContent = 'Map sealed to IndexedDB.';
  } catch(e) { status.textContent = 'Seal failed: ' + e.message; }
};
document.getElementById('btnReset').onclick = () => {
  initParticles();
  landmarks = [];
  trajectory = [];
  status.textContent = 'Reset.';
};

(async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f683', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej();
    });
    const tx = db.transaction('maps', 'readonly');
    const req = tx.objectStore('maps').get('current');
    req.onsuccess = () => {
      if (req.result) {
        landmarks = req.result.landmarks || [];
        if (req.result.mean) mean = req.result.mean;
        status.textContent = 'Restored sealed map.';
      }
    };
  } catch (e) { console.debug("lab f683-inertial-particle-filter-spatial-mind:", e); }
})();
