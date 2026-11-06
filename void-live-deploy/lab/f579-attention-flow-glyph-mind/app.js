const canvas = document.getElementById('flow');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const alphabet = 'VERSEMINDATO'.split('');
const N = 32; // flow grid
const G = 12; // glyphs
let W, H, cell;

function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
  cell = Math.min(W, H) / N;
}
addEventListener('resize', resize);
resize();

// Flow: vx, vy grids
let vx = new Float32Array(N*N), vy = new Float32Array(N*N);
let vx2 = new Float32Array(N*N), vy2 = new Float32Array(N*N);

// Attention: simple 4-head, weights over history
const HIST = 16;
const hist = [];
let attn = Array.from({length: 4}, () => Array.from({length: HIST}, () => Math.random()*0.2-0.1));
let fitness = 0;

// Glyphs
const glyphs = [];
const root = document.body;
for (let i = 0; i < G; i++) {
  const el = document.createElement('div');
  el.className = 'glyph';
  el.textContent = alphabet[i % alphabet.length];
  el.style.left = (Math.random()*0.8+0.1)*W + 'px';
  el.style.top = (Math.random()*0.8+0.1)*H + 'px';
  el.onclick = () => reward(i);
  root.appendChild(el);
  glyphs.push({ el, x: parseFloat(el.style.left), y: parseFloat(el.style.top), vx: 0, vy: 0 });
}

let ox = 0, oy = 0, px = 0, py = 0, pvx = 0, pvy = 0;
addEventListener('deviceorientation', e => {
  ox = (e.gamma || 0) / 90;
  oy = (e.beta || 0) / 90;
  statusEl.textContent = `γ:${ox.toFixed(2)} β:${oy.toFixed(2)} fit:${fitness.toFixed(2)}`;
});
addEventListener('pointermove', e => {
  pvx = (e.clientX - px) * 0.05;
  pvy = (e.clientY - py) * 0.05;
  px = e.clientX; py = e.clientY;
});

function pushHist() {
  hist.push([pvx, pvy, ox, oy]);
  if (hist.length > HIST) hist.shift();
}

function attention() {
  if (hist.length < 4) return [0.1, 0.05, 0];
  let outs = [0,0,0,0];
  for (let h = 0; h < 4; h++) {
    let s = 0;
    for (let t = 0; t < hist.length; t++) {
      const [vx,vy,ox,oy] = hist[t];
      s += attn[h][t] * (vx + vy + ox*0.5 + oy*0.5);
    }
    outs[h] = Math.tanh(s);
  }
  return outs; // source strength, damping, curl bias, ...
}

function stepFlow(mods) {
  const [src, damp, curl] = mods;
  // inject near pointer
  const ix = Math.floor(px / cell), iy = Math.floor(py / cell);
  if (ix >= 0 && ix < N && iy >= 0 && iy < N) {
    const i = iy*N + ix;
    vx[i] += src * 0.8 + curl * 0.2;
    vy[i] += src * 0.4 - curl * 0.3;
  }
  // diffuse + advect (simple)
  for (let y = 1; y < N-1; y++) for (let x = 1; x < N-1; x++) {
    const i = y*N + x;
    vx2[i] = (vx[i] + 0.1*(vx[i-1]+vx[i+1]+vx[i-N]+vx[i+N])) * (1 - damp*0.05);
    vy2[i] = (vy[i] + 0.1*(vy[i-1]+vy[i+1]+vy[i-N]+vy[i+N])) * (1 - damp*0.05);
  }
  [vx, vx2] = [vx2, vx];
  [vy, vy2] = [vy2, vy];
}

function sample(x, y) {
  const ix = Math.max(0, Math.min(N-1, Math.floor(x / cell)));
  const iy = Math.max(0, Math.min(N-1, Math.floor(y / cell)));
  const i = iy*N + ix;
  return [vx[i], vy[i]];
}

function reward(idx) {
  fitness += 1;
  // simple evolutionary mutate toward higher curl near this glyph
  const g = glyphs[idx];
  const [fvx, fvy] = sample(g.x, g.y);
  const local = Math.abs(fvx - fvy);
  for (let h = 0; h < 4; h++) {
    for (let t = 0; t < HIST; t++) {
      attn[h][t] += (Math.random()-0.5)*0.02 * (local > 0.1 ? 1 : -0.5);
      attn[h][t] = Math.max(-1, Math.min(1, attn[h][t]));
    }
  }
  g.el.style.color = `hsl(${(fitness*30)%360},80%,70%)`;
}

function updateGlyphs() {
  for (const g of glyphs) {
    const [fvx, fvy] = sample(g.x, g.y);
    g.vx = g.vx*0.9 + fvx*2;
    g.vy = g.vy*0.9 + fvy*2;
    g.x += g.vx;
    g.y += g.vy;
    if (g.x < 20) g.x = 20; if (g.x > W-20) g.x = W-20;
    if (g.y < 20) g.y = 20; if (g.y > H-20) g.y = H-20;
    const ang = Math.atan2(g.vy, g.vx);
    const sc = 1 + Math.hypot(g.vx, g.vy)*0.15;
    g.el.style.transform = `translate(${g.x}px,${g.y}px) rotate(${ang}rad) scale(${sc})`;
    g.el.style.opacity = 0.6 + Math.min(0.4, Math.hypot(fvx,fvy)*2);
  }
}

function drawFlow() {
  ctx.fillStyle = 'rgba(10,10,18,0.15)';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle = 'rgba(100,180,255,0.25)';
  ctx.lineWidth = 1;
  for (let y = 0; y < N; y += 2) for (let x = 0; x < N; x += 2) {
    const i = y*N + x;
    const sx = x*cell + cell/2, sy = y*cell + cell/2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + vx[i]*cell*2, sy + vy[i]*cell*2);
    ctx.stroke();
  }
}

function loop() {
  pushHist();
  const mods = attention();
  stepFlow(mods);
  updateGlyphs();
  drawFlow();
  requestAnimationFrame(loop);
}
loop();

document.getElementById('seal').onclick = async () => {
  const genome = { attn, fitness, ts: Date.now() };
  try {
    const db = await new Promise((res,rej) => {
      const r = indexedDB.open('f579', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('genomes');
      r.onsuccess = () => res(r.result);
      r.onerror = rej;
    });
    const tx = db.transaction('genomes', 'readwrite');
    tx.objectStore('genomes').put(genome, 'latest');
    statusEl.textContent = 'sealed';
  } catch(e) { statusEl.textContent = 'seal fail'; }
};

document.getElementById('reset').onclick = () => {
  hist.length = 0;
  vx.fill(0); vy.fill(0);
  fitness = 0;
  attn = Array.from({length: 4}, () => Array.from({length: HIST}, () => Math.random()*0.2-0.1));
  statusEl.textContent = 'reset';
};

// Optional BroadcastChannel peer transfer
try {
  const ch = new BroadcastChannel('f579-genome');
  ch.onmessage = e => {
    if (e.data.fitness > fitness) {
      attn = e.data.attn;
      fitness = e.data.fitness;
      statusEl.textContent = 'genome received';
    }
  };
  setInterval(() => ch.postMessage({attn, fitness}), 8000);
} catch(e) {}
