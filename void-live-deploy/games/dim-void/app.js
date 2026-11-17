// Dim the Verse, full-viewport edition. Verse's own lights-out: tap a lamp to dim it and its four neighbours.
// Every puzzle is made by scrambling a solved board, so a solution always exists.
const c = document.getElementById('c'), g = c.getContext('2d'), W = 320, H = 180, N = 5, T = 24, OX = (W - N * T) / 2, OY = (H - N * T) / 2 - 6;
g.imageSmoothingEnabled = false;
const levelEl = document.getElementById('level'), movesEl = document.getElementById('moves'), bestEl = document.getElementById('best'), msg = document.getElementById('msg');
const fit = () => { const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H))); c.style.width = W * s + 'px'; c.style.height = H * s + 'px'; c.style.left = (innerWidth - W * s) / 2 + 'px'; c.style.top = (innerHeight - H * s) / 2 + 'px'; };
addEventListener('resize', fit); fit();
let audio = null, muted = false;
const beep = (f, d = 0.06) => { if (muted) return; try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); const o = audio.createOscillator(), v = audio.createGain(); o.type = 'square'; o.frequency.value = f; v.gain.value = 0.04; o.connect(v).connect(audio.destination); o.start(); o.stop(audio.currentTime + d); } catch (_) {} };
document.getElementById('mute').onclick = (e) => { muted = !muted; e.target.textContent = muted ? 'Sound off' : 'Sound on'; beep(700); };

const KEY = 'a2m.dim.best.v1';
const S = { grid: Array.from({ length: N }, () => Array(N).fill(false)), level: 1, moves: 0, best: null, hint: null };
try { const b = JSON.parse(localStorage.getItem(KEY) || 'null'); if (b && typeof b === 'object') S.best = b; } catch (_) {}
const hud = () => { levelEl.textContent = 'Level ' + S.level; movesEl.textContent = 'Moves ' + S.moves; bestEl.textContent = 'Best ' + (S.best && S.best[S.level] != null ? S.best[S.level] : '—'); };
const lit = () => S.grid.flat().filter(Boolean).length;
function scramble(n) { if (n === 0) return; const r = () => Math.floor(Math.random() * N); toggle(r(), r()); scramble(n - 1); }
function toggle(x, y) { for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = y + dy; if (a >= 0 && a < N && b >= 0 && b < N) S.grid[b][a] = !S.grid[b][a]; } }
function puzzle() { S.grid = Array.from({ length: N }, () => Array(N).fill(false)); scramble(Math.min(12, S.level + 1)); S.moves = 0; S.hint = null; hud(); draw(); }
function tap(x, y) { if (x < 0 || x >= N || y < 0 || y >= N) return; toggle(x, y); S.moves++; beep(520); if (!lit()) { beep(880, 0.2); S.best ||= {}; if (S.best[S.level] == null || S.moves < S.best[S.level]) { S.best[S.level] = S.moves; try { localStorage.setItem(KEY, JSON.stringify(S.best)); } catch (_) {} msg.textContent = 'Puzzle dimmed in ' + S.moves + ' moves — best for this level.'; } else msg.textContent = 'Puzzle dimmed in ' + S.moves + ' moves.'; S.level++; setTimeout(puzzle, 700); } hud(); draw(); }
function draw() {
  g.fillStyle = '#0a0f22'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#a58bff'; g.font = '12px monospace'; g.fillText('Dim the Verse', 8, 16);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const on = S.grid[y][x]; g.fillStyle = on ? '#f4d58d' : '#1a2140'; g.fillRect(OX + x * T + 2, OY + y * T + 2, T - 4, T - 4); if (on) { g.fillStyle = '#fff4c9'; g.fillRect(OX + x * T + 7, OY + y * T + 7, 6, 6); } }
  if (S.hint) { g.strokeStyle = '#7aa7ff'; g.lineWidth = 2; g.strokeRect(OX + S.hint[0] * T, OY + S.hint[1] * T, T, T); }
}
const cell = (e) => { const r = c.getBoundingClientRect(); return [Math.floor(((e.clientX - r.left) / r.width * W - OX) / T), Math.floor(((e.clientY - r.top) / r.height * H - OY) / T)]; };
c.addEventListener('pointerdown', (e) => { const [x, y] = cell(e); tap(x, y); });
document.getElementById('new').onclick = () => { puzzle(); msg.textContent = 'A fresh puzzle. Tap a lamp to dim it and its neighbours.'; };
document.getElementById('solve').onclick = () => { S.hint = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; beep(400); draw(); msg.textContent = 'Try the outlined lamp — or any lamp you prefer. Every puzzle has a solution.'; };
puzzle();
