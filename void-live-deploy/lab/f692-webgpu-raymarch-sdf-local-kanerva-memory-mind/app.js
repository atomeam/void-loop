const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

// --- Kanerva Sparse Distributed Memory (pure JS) ---
const DIM = 64;
const HARD = 256;
const hard = Array.from({length: HARD}, () => Float32Array.from({length: DIM}, () => Math.random()*2-1));
const contents = Array.from({length: HARD}, () => Float32Array.from({length: 12}, () => 0));
let writes = 0;

function addressFrom(px, py, vx, vy, ori) {
  const a = new Float32Array(DIM);
  for (let i = 0; i < DIM; i++) {
    const f = Math.sin(i * 0.7 + px * 0.01) * Math.cos(i * 0.3 + py * 0.01) + vx * 0.05 + (ori ? ori.beta * 0.01 : 0);
    a[i] = Math.tanh(f);
  }
  return a;
}

function cosine(a, b) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < DIM; i++) { d += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return d / (Math.sqrt(na*nb) + 1e-8);
}

function sdmRead(addr) {
  const out = new Float32Array(12);
  let total = 0;
  for (let h = 0; h < HARD; h++) {
    const sim = Math.max(0, cosine(addr, hard[h]));
    if (sim > 0.35) {
      const w = sim * sim;
      for (let c = 0; c < 12; c++) out[c] += contents[h][c] * w;
      total += w;
    }
  }
  if (total > 0) for (let c = 0; c < 12; c++) out[c] /= total;
  return out;
}

function sdmWrite(addr, content) {
  for (let h = 0; h < HARD; h++) {
    const s = cosine(addr, hard[h]);
    if (s > 0.4) {
      const alpha = 0.15 * s;
      for (let c = 0; c < 12; c++) contents[h][c] = contents[h][c] * (1-alpha) + content[c] * alpha;
    }
  }
  writes++;
}

let px = W/2, py = H/2, vx = 0, vy = 0, lastX = px, lastY = py;
let ori = null;
let showPortals = true;
const portals = [];

addEventListener('pointermove', e => {
  vx = e.clientX - lastX; vy = e.clientY - lastY;
  lastX = px = e.clientX; lastY = py = e.clientY;
});
addEventListener('pointerdown', e => {
  const addr = addressFrom(px, py, vx, vy, ori);
  const content = sdmRead(addr);
  sdmWrite(addr, content);
});

document.getElementById('ori').onclick = () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission().then(p => { if (p === 'granted') addEventListener('deviceorientation', o => ori = o); });
  } else addEventListener('deviceorientation', o => ori = o);
};
document.getElementById('reset').onclick = () => {
  for (let h = 0; h < HARD; h++) contents[h].fill(0);
  writes = 0;
};
document.getElementById('portals').onclick = () => showPortals = !showPortals;
document.getElementById('seal').onclick = async () => {
  const data = { hard: Array.from(hard, a => Array.from(a)), contents: Array.from(contents, a => Array.from(a)), writes };
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f692', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('mem');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mem', 'readwrite');
    tx.objectStore('mem').put(data, 'kanerva');
    await new Promise(r => tx.oncomplete = r);
    if (typeof BroadcastChannel !== 'undefined') new BroadcastChannel('verse-genome').postMessage({type:'f692', data});
    document.getElementById('status').textContent = 'Sealed to IndexedDB + broadcast';
  } catch(e) { document.getElementById('status').textContent = 'Seal failed (private?)'; }
};

(async () => {
  try {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('verse-f692', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('mem', 'readonly');
    const req = tx.objectStore('mem').get('kanerva');
    req.onsuccess = () => {
      if (req.result) {
        const d = req.result;
        for (let h = 0; h < HARD; h++) {
          hard[h].set(d.hard[h]);
          contents[h].set(d.contents[h]);
        }
        writes = d.writes || 0;
        document.getElementById('status').textContent = 'Loaded sealed Kanerva memory';
      }
    };
  } catch (e) { console.debug("lab f692-webgpu-raymarch-sdf-local-kanerva-memory-mind:", e); }
})();

function sdfScene(x, y, mem) {
  const r1 = 40 + mem[0]*30, r2 = 50 + mem[1]*40, r3 = 30 + mem[2]*25;
  const ox = mem[3]*80, oy = mem[4]*60;
  const d1 = Math.hypot(x - W/2 - ox, y - H/2 - oy) - r1;
  const d2 = Math.hypot(x - W/2 + 100 + mem[5]*40, y - H/2 - 80 + mem[6]*30) - r2;
  const d3 = Math.hypot(x - W/2 - 120 + mem[7]*50, y - H/2 + 60 + mem[8]*40) - r3;
  return Math.min(d1, d2, d3);
}

function colorFromMem(mem) {
  return `hsl(${180 + mem[9]*60}, 70%, ${50 + mem[10]*20}%)`;
}

function frame() {
  const addr = addressFrom(px, py, vx*0.5, vy*0.5, ori);
  const mem = sdmRead(addr);
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  const step = 6;
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const d = sdfScene(x, y, mem);
      if (d < 0) {
        const shade = Math.max(0, Math.min(1, -d / 40));
        ctx.fillStyle = colorFromMem(mem);
        ctx.globalAlpha = 0.4 + shade * 0.5;
        ctx.fillRect(x, y, step, step);
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#4af';
  ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI*2); ctx.stroke();
  if (showPortals) {
    if (portals.length < 4 && Math.random() < 0.02) {
      const p = document.createElement('div');
      p.className = 'portal';
      p.style.left = (Math.random()*W*0.6 + 100) + 'px';
      p.style.top = (Math.random()*H*0.5 + 80) + 'px';
      p.textContent = `mem #${writes}`;
      document.body.appendChild(p);
      portals.push(p);
      let dragging = false, ox, oy;
      p.onpointerdown = e => { dragging = true; ox = e.clientX - p.offsetLeft; oy = e.clientY - p.offsetTop; p.setPointerCapture(e.pointerId); };
      p.onpointermove = e => { if (dragging) { p.style.left = (e.clientX - ox) + 'px'; p.style.top = (e.clientY - oy) + 'px'; } };
      p.onpointerup = () => { dragging = false; };
    }
    portals.forEach((p, i) => {
      if (i === 0) p.textContent = `active mem\nwrites:${writes}\nr:${(40+mem[0]*30).toFixed(0)}`;
    });
  } else portals.forEach(p => p.style.display = 'none');
  if (showPortals) portals.forEach(p => p.style.display = '');
  document.getElementById('status').textContent = `Kanerva · writes ${writes} · addr strength ${mem.reduce((a,b)=>a+Math.abs(b),0).toFixed(2)}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
