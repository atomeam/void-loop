// Null Sweep, full-viewport edition. Verse's own rules: the first reveal is always safe and there is no timer.
const c = document.getElementById('c'), g = c.getContext('2d'), W = 320, H = 180, GW = 12, GH = 8, T = 20, OX = (W - GW * T) / 2, OY = 12;
g.imageSmoothingEnabled = false;
const clearedEl = document.getElementById('cleared'), streakEl = document.getElementById('streak'), minesEl = document.getElementById('mines'), msg = document.getElementById('msg');
const fit = () => { const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H))); c.style.width = W * s + 'px'; c.style.height = H * s + 'px'; c.style.left = (innerWidth - W * s) / 2 + 'px'; c.style.top = (innerHeight - H * s) / 2 + 'px'; };
addEventListener('resize', fit); fit();
let audio = null, muted = false;
const beep = (f, d = 0.05) => { if (muted) return; try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); const o = audio.createOscillator(), v = audio.createGain(); o.type = 'square'; o.frequency.value = f; v.gain.value = 0.035; o.connect(v).connect(audio.destination); o.start(); o.stop(audio.currentTime + d); } catch (_) {} };
document.getElementById('mute').onclick = (e) => { muted = !muted; e.target.textContent = muted ? 'Sound off' : 'Sound on'; beep(700); };

const KEY = 'a2m.sweep.streak.v1', MINES = 12;
const S = { grid: [], first: true, flags: 0, cleared: 0, streak: 0, flagMode: false, over: false };
try { S.streak = Number(localStorage.getItem(KEY) || 0) || 0; } catch (_) {}
const hud = () => { clearedEl.textContent = 'Cleared ' + S.cleared; streakEl.textContent = 'Streak ' + S.streak; minesEl.textContent = 'Mines ' + (MINES - S.flags); };
const neighbours = (x, y) => { const out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const a = x + dx, b = y + dy; if ((dx || dy) && a >= 0 && a < GW && b >= 0 && b < GH) out.push([a, b]); } return out; };
function reset() { S.grid = Array.from({ length: GH }, () => Array.from({ length: GW }, () => ({ mine: false, open: false, flag: false, n: 0 }))); S.first = true; S.flags = 0; S.over = false; hud(); draw(); }
function plant(x, y) { let left = MINES; const safe = new Set([x + ',' + y, ...neighbours(x, y).map((p) => p[0] + ',' + p[1])]); const cells = []; for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) if (!safe.has(i + ',' + j)) cells.push([i, j]); for (let i = cells.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [cells[i], cells[k]] = [cells[k], cells[i]]; } for (const [i, j] of cells.slice(0, left)) S.grid[j][i].mine = true;
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) S.grid[j][i].n = neighbours(i, j).filter(([a, b]) => S.grid[b][a].mine).length; }
function open(x, y) {
  const cell = S.grid[y][x]; if (!cell || cell.open || cell.flag || S.over) return;
  if (S.first) { plant(x, y); S.first = false; }
  if (cell.mine) { S.over = true; S.streak = 0; try { localStorage.setItem(KEY, '0'); } catch (_) {} beep(150, 0.2); msg.textContent = 'A null. Streak lost — New board to try again.'; draw(); hud(); return; }
  cell.open = true; beep(470);
  if (cell.n === 0) for (const [a, b] of neighbours(x, y)) open(a, b);
  const left = S.grid.flat().filter((v) => !v.open && !v.mine).length;
  if (left === 0) { S.over = true; S.cleared++; S.streak++; try { localStorage.setItem(KEY, String(S.streak)); } catch (_) {} beep(880, 0.18); msg.textContent = 'Board cleared in one pass — streak ' + S.streak + '.'; }
  draw(); hud();
}
function flag(x, y) { const cell = S.grid[y] && S.grid[y][x]; if (!cell || cell.open || S.over) return; cell.flag = !cell.flag; S.flags += cell.flag ? 1 : -1; beep(620); draw(); hud(); }
function draw() {
  g.fillStyle = '#0a0f22'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const v = S.grid[y][x], px = OX + x * T, py = OY + y * T;
    g.fillStyle = v.open ? '#101830' : '#253058'; g.fillRect(px + 1, py + 1, T - 2, T - 2);
    if (v.flag && !v.open) { g.fillStyle = '#ffd27a'; g.fillText('F', px + 7, py + 14); }
    else if (v.open && v.mine) { g.fillStyle = '#ff6b7e'; g.fillRect(px + 5, py + 5, 10, 10); }
    else if (v.open && v.n) { g.fillStyle = ['#7aa7ff', '#a58bff', '#f4d58d'][Math.min(2, v.n - 1)]; g.font = 'bold 12px monospace'; g.fillText(String(v.n), px + 7, py + 14); }
  }
}
const at = (e) => { const r = c.getBoundingClientRect(); return [Math.floor(((e.clientX - r.left) / r.width * W - OX) / T), Math.floor(((e.clientY - r.top) / r.height * H - OY) / T)]; };
c.addEventListener('pointerdown', (e) => { const [x, y] = at(e); if (e.button === 2 || S.flagMode) flag(x, y); else open(x, y); });
c.addEventListener('contextmenu', (e) => e.preventDefault());
document.getElementById('flag').onclick = (e) => { S.flagMode = !S.flagMode; e.target.textContent = S.flagMode ? 'Flag: on' : 'Flag: off'; msg.textContent = S.flagMode ? 'Flag mode: tap to mark a mine.' : 'Reveal mode: tap to open a cell.'; };
document.getElementById('new').onclick = () => { reset(); msg.textContent = 'A fresh board. The first tap is always safe.'; };
reset();
