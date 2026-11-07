const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const tokensEl = document.getElementById('tokens');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;
window.addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const N = 16;
const particles = Array.from({length: N}, () => ({
  x: Math.random() * W, y: Math.random() * H,
  vx: (Math.random()-0.5)*1.2, vy: (Math.random()-0.5)*1.2,
  energy: Math.random(), hue: Math.random()*360,
  boost: 0
}));

const NUM_TOKENS = 6;
const tokens = [];
for (let i = 0; i < NUM_TOKENS; i++) {
  const el = document.createElement('div');
  el.className = 'token';
  el.textContent = 'token ' + (i+1);
  el.dataset.idx = i;
  tokensEl.appendChild(el);
  tokens.push({ el, x: Math.random()*W, y: Math.random()*H, linked: i % N, scale: 1, opacity: 0.6 });
  el.addEventListener('click', () => {
    const t = tokens[i];
    particles[t.linked].boost = 1.5;
    statusEl.textContent = 'Boosted token ' + (i+1);
  });
}

let focusX = W/2, focusY = H/2;
let tiltX = 0, tiltY = 0;
document.addEventListener('pointermove', e => { focusX = e.clientX; focusY = e.clientY; });
window.addEventListener('deviceorientation', e => {
  if (e.gamma != null) tiltX = (e.gamma || 0) / 45;
  if (e.beta != null) tiltY = ((e.beta || 0) - 45) / 45;
});

let audioCtx, oscs = [];
function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (let i = 0; i < 3; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 200 + i*80;
    gain.gain.value = 0.02;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    oscs.push({ osc, gain });
  }
}
document.addEventListener('pointerdown', ensureAudio, { once: true });

function computeAttention() {
  const qx = (focusX / W - 0.5) + tiltX * 0.3;
  const qy = (focusY / H - 0.5) + tiltY * 0.3;
  const scores = particles.map(p => {
    const kx = p.x / W - 0.5;
    const ky = p.y / H - 0.5;
    const sim = qx*kx + qy*ky + p.energy*0.3 + p.boost*0.5;
    return Math.exp(sim * 4);
  });
  const sum = scores.reduce((a,b)=>a+b, 0.0001);
  return scores.map(s => s / sum);
}

function step() {
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -1;
    if (p.y < 0 || p.y > H) p.vy *= -1;
    const dx = focusX - p.x, dy = focusY - p.y;
    const d = Math.hypot(dx, dy) || 1;
    p.vx += (dx / d) * 0.02;
    p.vy += (dy / d) * 0.02;
    p.vx *= 0.98; p.vy *= 0.98;
    p.boost *= 0.95;
    p.energy = Math.max(0, Math.min(1, p.energy + (Math.random()-0.5)*0.01));
  }

  const attn = computeAttention();
  tokens.forEach((t, i) => {
    const p = particles[t.linked];
    const a = attn[t.linked] * N;
    const tx = p.x, ty = p.y;
    t.x += (tx - t.x) * 0.08;
    t.y += (ty - t.y) * 0.08;
    t.scale = 0.6 + a * 1.8;
    t.opacity = 0.3 + a * 0.7;
    t.el.style.transform = `translate(${t.x - 40}px, ${t.y - 30}px) scale(${t.scale})`;
    t.el.style.opacity = t.opacity;
    const hue = p.hue;
    t.el.style.background = `hsla(${hue}, 70%, ${30 + a*40}%, 0.75)`;
    t.el.style.borderColor = `hsl(${hue}, 80%, 60%)`;
    t.el.textContent = `attn ${(a*10).toFixed(1)}`;
  });

  if (oscs.length) {
    const top = attn.map((a,i)=>({a,i})).sort((x,y)=>y.a-x.a).slice(0,3);
    top.forEach((item, j) => {
      const p = particles[item.i];
      oscs[j].osc.frequency.setTargetAtTime(180 + p.hue * 1.5 + item.a * 400, audioCtx.currentTime, 0.1);
      oscs[j].gain.gain.setTargetAtTime(0.01 + item.a * 0.08, audioCtx.currentTime, 0.1);
    });
  }

  ctx.fillStyle = 'rgba(10,10,18,0.25)';
  ctx.fillRect(0,0,W,H);
  particles.forEach((p, i) => {
    const a = attn[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3 + a * 12, 0, Math.PI*2);
    ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${0.4 + a*0.6})`;
    ctx.fill();
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(focusX, focusY, 20, 0, Math.PI*2);
  ctx.stroke();

  requestAnimationFrame(step);
}
requestAnimationFrame(step);

const DB_NAME = 'verse-f589';
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('state');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
document.getElementById('seal').onclick = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put({
      particles: particles.map(p => ({...p})),
      tokens: tokens.map(t => ({x:t.x, y:t.y, linked:t.linked}))
    }, 'mind');
    await new Promise(r => tx.oncomplete = r);
    statusEl.textContent = 'Sealed to IndexedDB';
  } catch(e) { statusEl.textContent = 'Seal failed (memory only)'; }
};
document.getElementById('restore').onclick = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction('state');
    const req = tx.objectStore('state').get('mind');
    req.onsuccess = () => {
      const s = req.result;
      if (!s) return statusEl.textContent = 'Nothing sealed';
      s.particles.forEach((sp, i) => Object.assign(particles[i], sp));
      s.tokens.forEach((st, i) => { tokens[i].x = st.x; tokens[i].y = st.y; tokens[i].linked = st.linked; });
      statusEl.textContent = 'Restored sealed mind';
    };
  } catch(e) { statusEl.textContent = 'Restore failed'; }
};

statusEl.textContent = 'Local attention mind online (Canvas2D). Move / tilt / click tokens.';
