// Merge Verse, full-viewport edition. Verse's own merge puzzle: no timer, combos within a move, star power tiles.
const c = document.getElementById('c'), g = c.getContext('2d'), W = 320, H = 180, N = 4, T = 36, GAP = 4, OX = (W - N * T) / 2, OY = (H - N * T) / 2 - 4;
g.imageSmoothingEnabled = false;
const scoreEl = document.getElementById('score'), bestEl = document.getElementById('best'), topEl = document.getElementById('top'), comboEl = document.getElementById('combo'), msg = document.getElementById('msg');
const fit = () => { const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H))); c.style.width = W * s + 'px'; c.style.height = H * s + 'px'; c.style.left = (innerWidth - W * s) / 2 + 'px'; c.style.top = (innerHeight - H * s) / 2 + 'px'; };
addEventListener('resize', fit); fit();
let audio = null, muted = false;
const beep = (f, d = 0.07) => { if (muted) return; try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); const o = audio.createOscillator(), v = audio.createGain(); o.type = 'square'; o.frequency.value = f; v.gain.value = 0.04; o.connect(v).connect(audio.destination); o.start(); o.stop(audio.currentTime + d); } catch (_) {} };
document.getElementById('mute').onclick = (e) => { muted = !muted; e.target.textContent = muted ? 'Sound off' : 'Sound on'; beep(700); };

const KEY = 'a2m.merge.best.v1';
const S = { grid: [], score: 0, best: 0, combo: 1, spawns: 0, prev: null };
try { S.best = Number(localStorage.getItem(KEY) || 0) || 0; } catch (_) {}
const empty = () => Array.from({ length: N }, () => Array(N).fill(0));
const free = () => { const out = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!S.grid[y][x]) out.push([x, y]); return out; };
const spawn = () => { const f = free(); if (!f.length) return; const [x, y] = f[Math.floor(Math.random() * f.length)]; S.spawns++; S.grid[y][x] = S.spawns % 9 === 0 ? -2 : (Math.random() < 0.9 ? 2 : 4); };
const hud = () => { scoreEl.textContent = 'Score ' + S.score; bestEl.textContent = 'Best ' + S.best; topEl.textContent = 'Top tile ' + Math.max(2, ...S.grid.flat().map(Math.abs)); comboEl.textContent = 'Combo ×' + S.combo; };
const reset = () => { S.grid = empty(); S.score = 0; S.combo = 1; S.spawns = 0; S.prev = null; spawn(); spawn(); hud(); draw(); };
function slide(dx, dy) {
  S.prev = { grid: S.grid.map((r) => r.slice()), score: S.score };
  let merges = 0, moved = false;
  const order = (dx > 0 || dy > 0) ? [3, 2, 1, 0] : [0, 1, 2, 3];
  for (const i of order) for (const j of order) {
    const x = dx ? j : i, y = dy ? j : i, v = S.grid[y][x]; if (!v) continue;
    let nx = x, ny = y;
    while (true) { const ax = nx + dx, ay = ny + dy; if (ax < 0 || ax >= N || ay < 0 || ay >= N || S.grid[ay][ax]) break; nx = ax; ny = ay; }
    const ax = nx + dx, ay = ny + dy, target = (ax >= 0 && ax < N && ay >= 0 && ay < N) ? S.grid[ay][ax] : null;
    if (target && Math.abs(target) !== Math.abs(v)) continue;
    if ((nx !== x || ny !== y) || target) moved = true;
    S.grid[y][x] = 0;
    if (target !== null && target !== undefined) { const base = Math.abs(v) * 2; S.grid[ay][ax] = (v < 0 || target < 0) ? -base : base; merges++; }
    else S.grid[ny][nx] = v;
  }
  if (!moved) { S.prev = null; return; }
  S.combo = Math.min(8, merges);
  const gain = merges * 2 * S.combo;
  S.score += gain;
  if (S.score > S.best) { S.best = S.score; try { localStorage.setItem(KEY, String(S.best)); } catch (_) {} }
  beep(440 + merges * 90);
  if (merges > 1) msg.textContent = 'Combo ×' + S.combo + ' — ' + gain + ' points in one slide.';
  spawn(); hud(); draw();
}
function draw() {
  g.fillStyle = '#0a0f22'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = S.grid[y][x], px = OX + x * T, py = OY + y * T;
    g.fillStyle = '#1a2140'; g.fillRect(px, py, T - GAP, T - GAP);
    if (!v) continue;
    g.fillStyle = v < 0 ? '#ffd27a' : Math.abs(v) >= 64 ? '#a58bff' : '#7aa7ff'; g.fillRect(px + 2, py + 2, T - GAP - 4, T - GAP - 4);
    g.fillStyle = '#0a0f22'; g.font = 'bold ' + (Math.abs(v) >= 100 ? 12 : 15) + 'px monospace';
    const label = v < 0 ? '★' : String(v); g.fillText(label, px + (T - GAP) / 2 - (label.length * 4), py + T / 2 - 2);
  }
}
addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (k === 'arrowup' || k === 'w') slide(0, -1); if (k === 'arrowdown' || k === 's') slide(0, 1); if (k === 'arrowleft' || k === 'a') slide(-1, 0); if (k === 'arrowright' || k === 'd') slide(1, 0); });
let start = null; c.addEventListener('pointerdown', (e) => { start = [e.clientX, e.clientY]; });
c.addEventListener('pointerup', (e) => { if (!start) return; const dx = e.clientX - start[0], dy = e.clientY - start[1]; start = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 16) return; if (Math.abs(dx) > Math.abs(dy)) slide(dx > 0 ? 1 : -1, 0); else slide(0, dy > 0 ? 1 : -1); });
document.getElementById('new').onclick = () => { reset(); msg.textContent = 'A fresh board. No timer, no rush — build a combo.'; };
document.getElementById('undo').onclick = () => { if (!S.prev) { msg.textContent = 'Nothing to undo yet.'; return; } S.grid = S.prev.grid; S.score = S.prev.score; S.prev = null; hud(); draw(); msg.textContent = 'That slide was taken back.'; };
reset();
