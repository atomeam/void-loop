const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
let W = canvas.width = innerWidth, H = canvas.height = innerHeight;
addEventListener('resize', () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; });

const COLS = 16, ROWS = 12;
const DIM = 8;
const grid = Array.from({length: ROWS}, () => Array.from({length: COLS}, () => Array(DIM).fill(0)));
let energy = Array.from({length: ROWS}, () => Array(COLS).fill(0));

const lexicon = ['void','mind','path','echo','field','attention','seed','flow','memory','lattice','signal','probe','resonance','trace','focus'];
let seeds = [];

function hashEmbed(str) {
  const v = Array(DIM).fill(0);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    v[i % DIM] += (c % 97) / 50;
    v[(i * 3) % DIM] += Math.sin(c) * 0.4;
  }
  const n = Math.hypot(...v) || 1;
  return v.map(x => x / n);
}

function injectAt(x, y, word) {
  const cx = Math.floor((x / W) * COLS);
  const cy = Math.floor((y / H) * ROWS);
  const emb = hashEmbed(word.toLowerCase());
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const ny = cy + dy, nx = cx + dx;
    if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
      const w = 1 - Math.hypot(dx, dy) / 2;
      for (let d = 0; d < DIM; d++) grid[ny][nx][d] = grid[ny][nx][d] * 0.6 + emb[d] * w;
      energy[ny][nx] = Math.min(1, energy[ny][nx] + 0.7 * w);
    }
  }
  if (!seeds.includes(word)) seeds.push(word);
  statusEl.textContent = `Injected "${word}" at grid (${cx},${cy})`;
}

// Pointer trajectory writing
let lastX = W/2, lastY = H/2, writing = false;
addEventListener('pointermove', e => {
  const x = e.clientX, y = e.clientY;
  if (writing || e.buttons) {
    const steps = Math.hypot(x - lastX, y - lastY);
    for (let s = 0; s < steps; s += 8) {
      const t = s / steps;
      const px = lastX + (x - lastX) * t, py = lastY + (y - lastY) * t;
      const cx = Math.floor((px / W) * COLS);
      const cy = Math.floor((py / H) * ROWS);
      if (cy >= 0 && cy < ROWS && cx >= 0 && cx < COLS) {
        const dir = [ (x-lastX)/W*4, (y-lastY)/H*4, Math.sin(Date.now()*0.001), 0.2 ];
        for (let d = 0; d < DIM; d++) grid[cy][cx][d] = grid[cy][cx][d] * 0.85 + (dir[d % 4] || 0) * 0.3;
        energy[cy][cx] = Math.min(1, energy[cy][cx] + 0.15);
      }
    }
  }
  lastX = x; lastY = y;
});
addEventListener('pointerdown', () => writing = true);
addEventListener('pointerup', () => writing = false);

// Orientation bias
let orient = { beta: 0, gamma: 0 };
addEventListener('deviceorientation', e => { if (e.beta != null) { orient.beta = e.beta; orient.gamma = e.gamma; } });

// Tiny multi-head attention
function attentionQuery(qx, qy) {
  const heads = 2;
  const scores = Array.from({length: ROWS}, () => Array(COLS).fill(0));
  let total = 0;
  for (let h = 0; h < heads; h++) {
    const q = [
      (qx / W - 0.5) * 2 + orient.gamma / 60,
      (qy / H - 0.5) * 2 + orient.beta / 60,
      Math.sin(Date.now() * 0.002 + h),
      Math.cos(Date.now() * 0.0015 + h * 2),
      0.3, 0.1, h * 0.4, 0.2
    ];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      let dot = 0;
      for (let d = 0; d < DIM; d++) dot += q[d] * grid[y][x][d];
      const s = Math.exp(dot * 1.8);
      scores[y][x] += s;
      total += s;
    }
  }
  if (total < 1e-6) return { peaks: [], phrase: '...' };
  // Find top peaks
  const peaks = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    scores[y][x] /= total;
    if (scores[y][x] > 0.02) peaks.push({ x, y, s: scores[y][x], px: (x + 0.5) / COLS * W, py: (y + 0.5) / ROWS * H });
  }
  peaks.sort((a, b) => b.s - a.s);
  // Generate echo from top attention
  const top = peaks.slice(0, 3);
  let phrase = '';
  if (seeds.length && Math.random() < 0.6) {
    const w = seeds[Math.floor(Math.random() * seeds.length)];
    phrase = top.length ? `${w} ${['traces','echoes','focuses','resonates'][Math.floor(Math.random()*4)]}` : w;
  } else {
    const bits = ['path','memory','field','signal','void','mind'];
    phrase = top.length ? bits[Math.floor(top[0].s * bits.length) % bits.length] + ' ' + bits[Math.floor(Math.random()*bits.length)] : 'listening';
  }
  return { peaks: top, phrase, scores };
}

// Echo cards
const cards = [];
for (let i = 0; i < 4; i++) {
  const el = document.createElement('div');
  el.className = 'echo';
  el.innerHTML = '<strong>echo</strong><span>—</span>';
  el.style.left = (100 + i * 160) + 'px';
  el.style.top = (80 + i * 40) + 'px';
  document.body.appendChild(el);
  cards.push({ el, x: 200 + i*100, y: 200, tx: 200, ty: 200, phrase: '…', alpha: 0.4 });
}

document.getElementById('inject').onclick = () => {
  const w = document.getElementById('seed').value.trim();
  if (w) injectAt(lastX, lastY, w);
  document.getElementById('seed').value = '';
};
document.getElementById('seed').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('inject').click(); });

async function openDB() {
  return new Promise(res => {
    const r = indexedDB.open('void-f186', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('field');
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
  });
}
async function seal() {
  const db = await openDB();
  if (!db) { statusEl.textContent = 'Seal skipped (IndexedDB blocked)'; return; }
  const tx = db.transaction('field', 'readwrite');
  tx.objectStore('field').put({ grid, energy, seeds, t: Date.now() }, 'state');
  statusEl.textContent = 'Field sealed to IndexedDB';
}
async function load() {
  const db = await openDB();
  if (!db) return;
  const tx = db.transaction('field', 'readonly');
  const req = tx.objectStore('field').get('state');
  req.onsuccess = () => {
    if (req.result) {
      // shallow restore
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (req.result.grid?.[y]?.[x]) grid[y][x] = req.result.grid[y][x].slice();
        if (req.result.energy?.[y]) energy[y][x] = req.result.energy[y][x] || 0;
      }
      seeds = req.result.seeds || [];
      statusEl.textContent = 'Restored sealed field';
    }
  };
}
load();
document.getElementById('seal').onclick = seal;
document.getElementById('clear').onclick = () => {
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { grid[y][x].fill(0); energy[y][x] = 0; }
  seeds = [];
  statusEl.textContent = 'Memory cleared';
};

let tick = 0;
function step() {
  tick++;
  // Decay energy slowly
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) energy[y][x] *= 0.992;

  const att = attentionQuery(lastX, lastY);

  // Update cards toward peaks
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const p = att.peaks[i % Math.max(1, att.peaks.length)] || { px: W/2, py: H/2, s: 0.1 };
    c.tx = p.px + (Math.random()-0.5)*40;
    c.ty = p.py + (Math.random()-0.5)*30;
    c.x += (c.tx - c.x) * 0.08;
    c.y += (c.ty - c.y) * 0.08;
    c.alpha = 0.3 + p.s * 4;
    if (tick % 40 === i * 10) c.phrase = att.phrase;
    c.el.style.left = (c.x - 70) + 'px';
    c.el.style.top = (c.y - 30) + 'px';
    c.el.style.opacity = Math.min(1, c.alpha);
    c.el.style.transform = `scale(${0.85 + p.s * 2})`;
    c.el.querySelector('span').textContent = c.phrase;
  }

  // Draw
  ctx.fillStyle = 'rgba(11,11,15,0.35)';
  ctx.fillRect(0, 0, W, H);
  const cw = W / COLS, ch = H / ROWS;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const e = energy[y][x];
    if (e > 0.02) {
      ctx.fillStyle = `rgba(107,140,255,${e * 0.6})`;
      ctx.fillRect(x * cw, y * ch, cw - 1, ch - 1);
    }
  }
  // Attention rays
  ctx.strokeStyle = 'rgba(192,132,252,0.45)';
  ctx.lineWidth = 1.5;
  for (const p of att.peaks.slice(0, 3)) {
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.px, p.py);
    ctx.stroke();
  }
  ctx.fillStyle = '#fff8';
  ctx.beginPath();
  ctx.arc(lastX, lastY, 5, 0, Math.PI*2);
  ctx.fill();

  requestAnimationFrame(step);
}
step();
