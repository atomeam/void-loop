// Verse Breaker, full-viewport edition. Verse's own rules: a readable base speed, combos and power bricks.
const c = document.getElementById('c'), g = c.getContext('2d'), W = 320, H = 180;
g.imageSmoothingEnabled = false;
const scoreEl = document.getElementById('score'), bestEl = document.getElementById('best'), comboEl = document.getElementById('combo'), levelEl = document.getElementById('level'), msg = document.getElementById('msg');
const fit = () => { const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H))); c.style.width = W * s + 'px'; c.style.height = H * s + 'px'; c.style.left = (innerWidth - W * s) / 2 + 'px'; c.style.top = (innerHeight - H * s) / 2 + 'px'; };
addEventListener('resize', fit); fit();
let audio = null, muted = false;
const beep = (f, d = 0.05) => { if (muted) return; try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); const o = audio.createOscillator(), v = audio.createGain(); o.type = 'square'; o.frequency.value = f; v.gain.value = 0.035; o.connect(v).connect(audio.destination); o.start(); o.stop(audio.currentTime + d); } catch (_) {} };
document.getElementById('mute').onclick = (e) => { muted = !muted; e.target.textContent = muted ? 'Sound off' : 'Sound on'; beep(700); };

const KEY = 'a2m.breaker.best.v1';
const S = { px: 146, pw: 28, balls: [], bricks: [], score: 0, best: 0, combo: 0, level: 1, paused: false, wide: 0 };
try { S.best = Number(localStorage.getItem(KEY) || 0) || 0; } catch (_) {}
const hud = () => { scoreEl.textContent = 'Score ' + S.score; bestEl.textContent = 'Best ' + S.best; comboEl.textContent = 'Combo ×' + Math.max(1, S.combo); levelEl.textContent = 'Level ' + S.level; };
function level() {
  S.bricks = []; const rows = 4 + Math.min(2, Math.floor(S.level / 2));
  for (let r = 0; r < rows; r++) for (let col = 0; col < 12; col++) {
    if (S.rng && S.rng() < 0.08) continue;
    S.bricks.push({ x: 16 + col * 24, y: 24 + r * 12, w: 22, h: 9, kind: (r + col) % 11 === 0 ? 1 : (r + col) % 13 === 0 ? 2 : 0 });
  }
  S.balls = [{ x: W / 2, y: 150, vx: 1.6, vy: -1.9 }]; S.combo = 0; S.wide = 0; S.pw = 28;
}
function reset() { S.rng = Math.random; S.score = 0; S.level = 1; S.paused = false; document.getElementById('pause').textContent = 'Pause'; level(); hud(); }
function serve() { S.balls = [{ x: S.px + S.pw / 2, y: 158, vx: 1.6, vy: -1.9 }]; }
function tick() {
  if (S.paused) return;
  for (let i = S.balls.length - 1; i >= 0; i--) {
    const b = S.balls[i]; b.x += b.vx; b.y += b.vy;
    if (b.x < 3 || b.x > W - 3) b.vx *= -1;
    if (b.y < 3) b.vy *= -1;
    if (b.y > 166 && b.y < 174 && b.x > S.px && b.x < S.px + S.pw) { b.vy = -Math.abs(b.vy); const hit = (b.x - S.px) / S.pw - 0.5; b.vx = hit * 2.4; beep(520); }
    if (b.y > 180) S.balls.splice(i, 1);
  }
  if (!S.balls.length) { S.score = Math.max(0, S.score - 5); hud(); msg.textContent = 'Ball lost — 5 points off. The next serve is on its way.'; serve(); }
  for (const b of S.balls) for (let i = S.bricks.length - 1; i >= 0; i--) {
    const k = S.bricks[i]; if (b.x + 3 < k.x || b.x - 3 > k.x + k.w || b.y + 3 < k.y || b.y - 3 > k.y + k.h) continue;
    S.bricks.splice(i, 1); S.combo++; b.vy *= -1; beep(380 + S.combo * 20);
    S.score += 4 * Math.max(1, S.combo);
    if (k.kind === 1) { S.wide = 600; S.pw = 44; msg.textContent = 'Gold brick: a wider paddle for a while.'; }
    if (k.kind === 2) { S.balls.push({ x: b.x, y: b.y, vx: -b.vx, vy: -b.vy }); msg.textContent = 'Violet brick: an extra ball joined the run.'; }
  }
  if (S.score > S.best) { S.best = S.score; try { localStorage.setItem(KEY, String(S.best)); } catch (_) {} }
  if (!S.bricks.length) { S.level++; msg.textContent = 'Board cleared — level ' + S.level + '.'; level(); }
  hud();
}
function draw() {
  g.fillStyle = '#0a0f22'; g.fillRect(0, 0, W, H);
  for (const k of S.bricks) { g.fillStyle = k.kind === 1 ? '#ffd27a' : k.kind === 2 ? '#a58bff' : '#7aa7ff'; g.fillRect(k.x, k.y, k.w, k.h); }
  g.fillStyle = '#f4d58d'; g.fillRect(S.px, 168, S.pw, 5);
  for (const b of S.balls) { g.fillStyle = '#e8e6f5'; g.fillRect(b.x - 2, b.y - 2, 4, 4); }
  if (S.paused) { g.fillStyle = '#e8e6f5'; g.font = '16px monospace'; g.fillText('PAUSED', 136, 90); }
}
function loop() { tick(); draw(); requestAnimationFrame(loop); }
const move = (dx) => { if (S.wide > 0 && S.wide-- === 0) S.pw = 28; S.px = Math.max(2, Math.min(W - S.pw - 2, S.px + dx)); };
addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') move(-12); if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') move(12); });
c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); S.px = Math.max(2, Math.min(W - S.pw - 2, (e.clientX - r.left) / r.width * W - S.pw / 2)); });
document.getElementById('pause').onclick = (e) => { S.paused = !S.paused; e.target.textContent = S.paused ? 'Resume' : 'Pause'; };
document.getElementById('new').onclick = () => { reset(); msg.textContent = 'A fresh run. Chain bricks for combos; gold widens, violet adds a ball.'; };
reset(); loop();
