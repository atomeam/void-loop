const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
let W = cv.width = innerWidth, H = cv.height = innerHeight;
addEventListener('resize', () => { W = cv.width = innerWidth; H = cv.height = innerHeight; });

const portals = [];
for (let i = 0; i < 4; i++) {
  const el = document.createElement('div');
  el.className = 'portal';
  el.textContent = 'Portal ' + (i+1);
  el.style.left = (100 + i*160) + 'px';
  el.style.top = (100 + (i%2)*200) + 'px';
  document.body.appendChild(el);
  portals.push({ el, x:100+i*160, y:100+(i%2)*200, pair: i^1, amp: Math.random()*0.5+0.5, phase: Math.random()*Math.PI*2 });
  el.addEventListener('pointerdown', e => { e.target.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => {
    if (e.buttons) {
      const p = portals.find(p => p.el === e.target);
      if (p) { p.x = e.clientX - 60; p.y = e.clientY - 40; p.el.style.left = p.x+'px'; p.el.style.top = p.y+'px'; }
    }
  });
  el.addEventListener('click', e => {
    const p = portals.find(p => p.el === e.target);
    if (p) collapse(p);
  });
}

let mlp = { w1: Array(24).fill(0).map(()=>Math.random()*0.2-0.1), w2: Array(12).fill(0).map(()=>Math.random()*0.2-0.1) };
let pointerHist = [];
let particles = Array.from({length:80}, () => ({x:Math.random()*W, y:Math.random()*H, vx:0, vy:0, life:1}));

function mlpForward(input) {
  const h = [];
  for (let i=0; i<6; i++) {
    let s = 0;
    for (let j=0; j<4; j++) s += input[j] * mlp.w1[i*4+j];
    h.push(Math.tanh(s));
  }
  const o = [];
  for (let i=0; i<2; i++) {
    let s = 0;
    for (let j=0; j<6; j++) s += h[j] * mlp.w2[i*6+j];
    o.push(Math.tanh(s));
  }
  return o;
}

function collapse(p) {
  const partner = portals[p.pair];
  const residual = pointerHist.length > 2 ? Math.hypot(pointerHist[0]-pointerHist[2], pointerHist[1]-pointerHist[3]) / 100 : 0.5;
  const [basis, strength] = mlpForward([residual, p.amp, Math.sin(p.phase), Math.cos(partner.phase)]);
  p.amp *= 0.7 + 0.3 * Math.abs(basis);
  partner.amp = Math.sqrt(1 - p.amp*p.amp) * (0.5 + strength*0.5);
  partner.phase += basis * 0.5;
  p.el.classList.add('collapsed');
  partner.el.classList.add('collapsed');
  partner.el.style.background = `hsla(${(partner.phase*40)%360},70%,50%,0.8)`;
  partner.el.style.transform = `scale(${0.8 + partner.amp}) rotate(${partner.phase}rad)`;
  setTimeout(() => { p.el.classList.remove('collapsed'); partner.el.classList.remove('collapsed'); }, 800);
  document.getElementById('status').textContent = `Collapsed pair ${p.pair+1} | amp ${partner.amp.toFixed(2)}`;
  for (let i=0; i<mlp.w1.length; i++) mlp.w1[i] += 0.01 * residual * (Math.random()-0.5);
}

addEventListener('pointermove', e => {
  pointerHist = [e.clientX, e.clientY, ...pointerHist].slice(0, 8);
  particles.forEach(pt => {
    pt.vx += (e.clientX - pt.x) * 0.0005;
    pt.vy += (e.clientY - pt.y) * 0.0005;
  });
});

function loop() {
  ctx.fillStyle = 'rgba(10,10,18,0.2)';
  ctx.fillRect(0,0,W,H);
  particles.forEach(pt => {
    pt.x += pt.vx; pt.y += pt.vy;
    pt.vx *= 0.98; pt.vy *= 0.98;
    if (pt.x<0||pt.x>W) pt.vx *= -1;
    if (pt.y<0||pt.y>H) pt.vy *= -1;
    ctx.fillStyle = `hsla(${pt.life*180},80%,60%,0.6)`;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, Math.PI*2); ctx.fill();
  });
  portals.forEach(p => {
    particles.forEach(pt => {
      const dx = p.x+60 - pt.x, dy = p.y+40 - pt.y;
      const d = Math.hypot(dx,dy)+1;
      pt.vx += dx/d * p.amp * 0.01;
      pt.vy += dy/d * p.amp * 0.01;
    });
  });
  requestAnimationFrame(loop);
}
loop();

document.getElementById('seal').onclick = async () => {
  const data = { mlp, portals: portals.map(p => ({x:p.x,y:p.y,amp:p.amp,phase:p.phase})) };
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f512-entangled',1);
      r.onupgradeneeded = () => r.result.createObjectStore('seal');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seal','readwrite');
    tx.objectStore('seal').put(data, 'genome');
    document.getElementById('status').textContent = 'Sealed to IndexedDB';
  } catch(e) { document.getElementById('status').textContent = 'Seal failed (in-mem only)'; }
};

document.getElementById('restore').onclick = async () => {
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f512-entangled',1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('seal','readonly');
    const req = tx.objectStore('seal').get('genome');
    req.onsuccess = () => {
      if (req.result) {
        mlp = req.result.mlp;
        req.result.portals.forEach((s,i) => {
          if (portals[i]) { Object.assign(portals[i], s); portals[i].el.style.left=s.x+'px'; portals[i].el.style.top=s.y+'px'; }
        });
        document.getElementById('status').textContent = 'Restored genome';
      }
    };
  } catch(e) { document.getElementById('status').textContent = 'No seal found'; }
};
