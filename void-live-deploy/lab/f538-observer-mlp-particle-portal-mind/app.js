const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const status = document.getElementById('status');
const portalsEl = document.getElementById('portals');
let W = innerWidth, H = innerHeight;
function resize() { W = cv.width = innerWidth; H = cv.height = innerHeight; }
addEventListener('resize', resize); resize();

// Portals
const N_PORTALS = 6;
const portals = [];
for (let i = 0; i < N_PORTALS; i++) {
  const el = document.createElement('div');
  el.className = 'verse-portal';
  el.innerHTML = `<h3>Portal ${i+1}</h3><p>vis 0.00</p>`;
  el.style.left = (80 + (i%3)*220) + 'px';
  el.style.top = (80 + Math.floor(i/3)*180) + 'px';
  portalsEl.appendChild(el);
  portals.push({ el, x:0, y:0, vis:0, area:0, attract:0.5, emit:1, hue:200 });
}

// Observers
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    const p = portals.find(pp => pp.el === e.target);
    if (p) p.vis = e.intersectionRatio;
  });
}, { threshold: [0,0.25,0.5,0.75,1] });
const ro = new ResizeObserver(entries => {
  entries.forEach(e => {
    const p = portals.find(pp => pp.el === e.target);
    if (p) p.area = (e.contentRect.width * e.contentRect.height) / (140*90);
  });
});
portals.forEach(p => { io.observe(p.el); ro.observe(p.el); });

// MLP
let weights = { ih: Array(4*6).fill(0).map(()=>Math.random()*0.4-0.2), ho: Array(6*3).fill(0).map(()=>Math.random()*0.4-0.2) };
function forward(input) {
  const h = new Array(6).fill(0);
  for (let i=0;i<6;i++) for (let j=0;j<4;j++) h[i] += input[j] * weights.ih[j*6+i];
  for (let i=0;i<6;i++) h[i] = Math.tanh(h[i]);
  const o = new Array(3).fill(0);
  for (let i=0;i<3;i++) for (let j=0;j<6;j++) o[i] += h[j] * weights.ho[j*3+i];
  return o.map(v => 1/(1+Math.exp(-v))); // sigmoid
}
function updateWeights(input, reward) {
  const o = forward(input);
  const lr = 0.08 * reward;
  for (let i=0;i<weights.ho.length;i++) weights.ho[i] += lr * (Math.random()-0.5)*0.1;
  for (let i=0;i<weights.ih.length;i++) weights.ih[i] += lr * (Math.random()-0.5)*0.05;
}

// Pointer
let px=0, py=0, pvx=0, pvy=0, lastX=0, lastY=0;
addEventListener('pointermove', e => {
  pvx = (e.clientX - lastX)*0.1; pvy = (e.clientY - lastY)*0.1;
  lastX = e.clientX; lastY = e.clientY;
  px = e.clientX; py = e.clientY;
});

// Particles
const particles = Array.from({length:300}, () => ({x:Math.random()*W, y:Math.random()*H, vx:0, vy:0, life:1}));

// Drag
let drag = null, offX=0, offY=0;
portalsEl.addEventListener('pointerdown', e => {
  const el = e.target.closest('.verse-portal');
  if (!el) return;
  drag = portals.find(p => p.el === el);
  offX = e.clientX - el.offsetLeft; offY = e.clientY - el.offsetTop;
  el.setPointerCapture(e.pointerId);
});
addEventListener('pointermove', e => {
  if (!drag) return;
  drag.el.style.left = (e.clientX - offX) + 'px';
  drag.el.style.top = (e.clientY - offY) + 'px';
});
addEventListener('pointerup', () => drag = null);

// Reward
portalsEl.addEventListener('click', e => {
  const el = e.target.closest('.verse-portal');
  if (!el) return;
  const avgVis = portals.reduce((s,p)=>s+p.vis,0)/N_PORTALS;
  const avgArea = portals.reduce((s,p)=>s+p.area,0)/N_PORTALS;
  updateWeights([avgVis, avgArea, pvx, pvy], 1.0);
  status.textContent = 'rewarded';
});

// Seal / Restore
const DB = 'f538-observer-mlp';
async function seal() {
  const data = { weights, fitness: portals.reduce((s,p)=>s+p.vis,0), t: Date.now() };
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data.weights)));
  const id = Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16);
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore('genomes');
  req.onsuccess = () => {
    const tx = req.result.transaction('genomes','readwrite');
    tx.objectStore('genomes').put({id, data}, 'best');
    status.textContent = 'sealed ' + id;
    try { new BroadcastChannel('f538-genome').postMessage({id, data}); } catch(e){}
  };
}
document.getElementById('seal').onclick = seal;
document.getElementById('restore').onclick = () => {
  const req = indexedDB.open(DB, 1);
  req.onsuccess = () => {
    const tx = req.result.transaction('genomes');
    const g = tx.objectStore('genomes').get('best');
    g.onsuccess = () => { if (g.result) { weights = g.result.data.weights; status.textContent = 'restored'; } };
  };
};
try {
  new BroadcastChannel('f538-genome').onmessage = e => {
    if (e.data.data && e.data.data.fitness > portals.reduce((s,p)=>s+p.vis,0)) {
      weights = e.data.data.weights;
      status.textContent = 'adopted ' + e.data.id;
    }
  };
} catch(e){}

// Loop
function loop() {
  // Update portal metrics & MLP
  const avgVis = portals.reduce((s,p)=>s+p.vis,0)/N_PORTALS || 0.1;
  const avgArea = portals.reduce((s,p)=>s+p.area,0)/N_PORTALS || 1;
  const out = forward([avgVis, avgArea, pvx*0.5, pvy*0.5]);
  portals.forEach((p,i) => {
    const localOut = forward([p.vis, p.area, pvx, pvy]);
    p.attract = localOut[0];
    p.emit = localOut[1];
    p.hue = 180 + localOut[2]*120;
    const rect = p.el.getBoundingClientRect();
    p.x = rect.left + rect.width/2; p.y = rect.top + rect.height/2;
    const scale = 0.8 + p.vis*0.6 + p.attract*0.3;
    p.el.style.transform = `scale(${scale.toFixed(2)})`;
    p.el.style.borderColor = `hsl(${p.hue},70%,60%)`;
    p.el.style.background = `hsla(${p.hue},40%,30%,${0.4+p.vis*0.4})`;
    p.el.querySelector('p').textContent = `vis ${p.vis.toFixed(2)} att ${p.attract.toFixed(2)}`;
  });

  // Particles
  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  particles.forEach(pt => {
    let fx=0, fy=0;
    portals.forEach(p => {
      const dx = p.x - pt.x, dy = p.y - pt.y;
      const d2 = dx*dx + dy*dy + 100;
      const f = p.attract * 40 / d2;
      fx += dx * f; fy += dy * f;
      if (Math.random() < p.emit * 0.02 && d2 < 20000) { pt.x = p.x; pt.y = p.y; }
    });
    pt.vx = (pt.vx + fx)*0.92; pt.vy = (pt.vy + fy)*0.92;
    pt.x += pt.vx; pt.y += pt.vy;
    if (pt.x<0||pt.x>W||pt.y<0||pt.y>H) { pt.x = Math.random()*W; pt.y = Math.random()*H; }
    ctx.fillStyle = `hsla(${portals[0]?.hue||200},80%,70%,0.7)`;
    ctx.fillRect(pt.x, pt.y, 2, 2);
  });

  status.textContent = `vis ${avgVis.toFixed(2)} | particles active`;
  requestAnimationFrame(loop);
}
loop();
