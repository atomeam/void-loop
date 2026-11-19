const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = cv.width = innerWidth, H = cv.height = innerHeight;
addEventListener('resize', () => { W = cv.width = innerWidth; H = cv.height = innerHeight; });

const N = 400, A = 6;
const particles = Array.from({length:N}, () => ({x:Math.random()*W, y:Math.random()*H, vx:0, vy:0}));
const attractors = Array.from({length:A}, (_,i) => ({
  x: W*(0.2+0.6*Math.random()), y: H*(0.2+0.6*Math.random()),
  force: 0.04 + Math.random()*0.04, damp: 0.96,
  mlp: { w: Array.from({length:6*8+8*3}, () => (Math.random()-0.5)*0.3), b: Array.from({length:8+3}, () => 0) },
  fitness: 0, hue: 200 + i*30
}));
const portals = Array.from({length:A}, (_,i) => {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'P'+(i+1);
  el.dataset.i = i;
  document.body.appendChild(el);
  return el;
});

let orient = {b:0, g:0}, pointer = {x:W/2, y:H/2, vx:0, vy:0, prevX:W/2, prevY:H/2};
let dragging = null, dragOff = {x:0,y:0};

addEventListener('pointermove', e => {
  pointer.vx = e.clientX - pointer.prevX; pointer.vy = e.clientY - pointer.prevY;
  pointer.prevX = pointer.x = e.clientX; pointer.prevY = pointer.y = e.clientY;
  if (dragging !== null) {
    const a = attractors[dragging];
    a.x = e.clientX - dragOff.x; a.y = e.clientY - dragOff.y;
    a.fitness += 0.5;
  }
});
portals.forEach((p,i) => {
  p.addEventListener('pointerdown', e => { dragging = i; dragOff.x = e.clientX - attractors[i].x; dragOff.y = e.clientY - attractors[i].y; e.preventDefault(); });
});
addEventListener('pointerup', () => dragging = null);

if (typeof DeviceOrientationEvent !== 'undefined') {
  addEventListener('deviceorientation', e => { orient.b = e.beta||0; orient.g = e.gamma||0; });
}

function mlpForward(m, inp) {
  const h = new Array(8).fill(0);
  for (let i=0;i<8;i++) {
    let s = m.b[i];
    for (let j=0;j<6;j++) s += inp[j] * m.w[i*6+j];
    h[i] = Math.tanh(s);
  }
  const o = new Array(3).fill(0);
  for (let i=0;i<3;i++) {
    let s = m.b[8+i];
    for (let j=0;j<8;j++) s += h[j] * m.w[48 + i*8 + j];
    o[i] = Math.tanh(s);
  }
  return o;
}

function step() {
  const res = Math.hypot(pointer.vx, pointer.vy);
  attractors.forEach((a, ai) => {
    const inp = [orient.b/90, orient.g/90, pointer.vx/20, pointer.vy/20, res/30, (a.fitness%10)/10];
    const o = mlpForward(a.mlp, inp);
    a.force = 0.03 + o[0]*0.03;
    a.damp = 0.94 + o[1]*0.04;
    a.hue = 180 + o[2]*80;
    a.fitness *= 0.995;
  });

  particles.forEach(p => {
    let fx=0, fy=0;
    attractors.forEach(a => {
      const dx = a.x - p.x, dy = a.y - p.y, d2 = dx*dx+dy*dy+100;
      const d = Math.sqrt(d2);
      const f = a.force * 80 / d;
      fx += dx/d * f; fy += dy/d * f;
    });
    // soft repulsion
    particles.forEach(q => {
      if (p===q) return;
      const dx = p.x-q.x, dy=p.y-q.y, d2=dx*dx+dy*dy;
      if (d2 < 400) { const f = 0.8 / (d2+10); fx += dx*f; fy += dy*f; }
    });
    p.vx = (p.vx + fx) * 0.96;
    p.vy = (p.vy + fy) * 0.96;
    p.x += p.vx; p.y += p.vy;
    if (p.x<0||p.x>W) p.vx *= -0.5;
    if (p.y<0||p.y>H) p.vy *= -0.5;
    p.x = Math.max(0, Math.min(W, p.x));
    p.y = Math.max(0, Math.min(H, p.y));
  });

  // cluster binding
  attractors.forEach((a,i) => {
    let cx=0, cy=0, c=0, dens=0;
    particles.forEach(p => {
      const d = Math.hypot(p.x-a.x, p.y-a.y);
      if (d < 120) { cx+=p.x; cy+=p.y; c++; dens += 1/(d+20); }
    });
    if (c>0) { a.cx = cx/c; a.cy = cy/c; } else { a.cx = a.x; a.cy = a.y; }
    a.fitness += dens * 0.01 - Math.abs(a.force-0.05)*0.1;
    const el = portals[i];
    el.style.left = (a.cx-36) + 'px';
    el.style.top = (a.cy-36) + 'px';
    el.style.background = `hsla(${a.hue},70%,50%,0.35)`;
    el.style.borderColor = `hsl(${a.hue},80%,70%)`;
  });

  document.getElementById('fit').textContent = attractors.reduce((s,a)=>s+a.fitness,0).toFixed(1);
}

function draw() {
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  particles.forEach(p => {
    ctx.fillStyle = '#8cf';
    ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, 6.28); ctx.fill();
  });
  attractors.forEach(a => {
    ctx.strokeStyle = `hsl(${a.hue},70%,60%)`;
    ctx.beginPath(); ctx.arc(a.x, a.y, 8, 0, 6.28); ctx.stroke();
  });
}

function loop() { step(); draw(); requestAnimationFrame(loop); }
loop();

// Seal
document.getElementById('seal').onclick = async () => {
  const best = attractors.reduce((b,a)=>a.fitness>b.fitness?a:b, attractors[0]);
  attractors.forEach(a => { a.mlp = JSON.parse(JSON.stringify(best.mlp)); a.fitness = best.fitness * 0.8; });
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f791', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result); r.onerror = rej;
    });
    const tx = db.transaction('genomes','readwrite');
    tx.objectStore('genomes').put({mlp: best.mlp, t: Date.now()}, 'sealed');
  } catch (e) { console.debug("lab f791-webgpu-particle-attractor-mind:", e); }
  try { new BroadcastChannel('verse-f791').postMessage({mlp: best.mlp}); } catch (e) { console.debug("lab f791-webgpu-particle-attractor-mind:", e); }
};
document.getElementById('reset').onclick = () => location.reload();

// Restore
(async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('verse-f791', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result); r.onerror = () => res(null);
    });
    if (!db) return;
    const tx = db.transaction('genomes');
    const req = tx.objectStore('genomes').get('sealed');
    req.onsuccess = () => { if (req.result) attractors.forEach(a => a.mlp = req.result.mlp); };
  } catch (e) { console.debug("lab f791-webgpu-particle-attractor-mind:", e); }
})();
