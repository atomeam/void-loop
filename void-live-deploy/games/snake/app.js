// Verse Snake, full-viewport edition. Verse's own rules: the edges wrap and golden fruit is worth three.
const c = document.getElementById('c'), g = c.getContext('2d'), W = 320, H = 180, T = 10, GW = 32, GH = 18;
g.imageSmoothingEnabled = false;
const scoreEl = document.getElementById('score'), bestEl = document.getElementById('best'), lenEl = document.getElementById('len'), msg = document.getElementById('msg');
const fit = () => { const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H))); c.style.width = W * s + 'px'; c.style.height = H * s + 'px'; c.style.left = (innerWidth - W * s) / 2 + 'px'; c.style.top = (innerHeight - H * s) / 2 + 'px'; };
addEventListener('resize', fit); fit();
let audio = null, muted = false;
const beep = (f, d = 0.05) => { if (muted) return; try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); const o = audio.createOscillator(), v = audio.createGain(); o.type = 'square'; o.frequency.value = f; v.gain.value = 0.04; o.connect(v).connect(audio.destination); o.start(); o.stop(audio.currentTime + d); } catch (_) {} };
document.getElementById('mute').onclick = (e) => { muted = !muted; e.target.textContent = muted ? 'Sound off' : 'Sound on'; beep(720); };

const KEY = 'a2m.snake.best.v1';
const S = { body: [], dir: [1, 0], next: [1, 0], food: null, golden: false, score: 0, best: 0, paused: false, tick: 0 };
try { S.best = Number(localStorage.getItem(KEY) || 0) || 0; } catch (_) {}
const hud = () => { scoreEl.textContent = 'Score ' + S.score; bestEl.textContent = 'Best ' + S.best; lenEl.textContent = 'Length ' + S.body.length; };
const place = () => { let p; do { p = [Math.floor(Math.random() * GW), Math.floor(Math.random() * GH)]; } while (S.body.some((b) => b[0] === p[0] && b[1] === p[1])); S.food = p; S.golden = S.score > 0 && S.score % 15 < 5; };
const reset = () => { S.body = [[6, 9], [5, 9], [4, 9]]; S.dir = [1, 0]; S.next = [1, 0]; S.score = 0; S.paused = false; document.getElementById('pause').textContent = 'Pause'; place(); hud(); };
const turn = (dx, dy) => { if (S.dir[0] * -1 === dx && S.dir[1] * -1 === dy) return; S.next = [dx, dy]; };
function step() {
  S.dir = S.next; const h = S.body[0], n = [(h[0] + S.dir[0] + GW) % GW, (h[1] + S.dir[1] + GH) % GH];
  if (S.body.some((b, i) => i < S.body.length - 1 && b[0] === n[0] && b[1] === n[1])) { beep(150, 0.2); msg.textContent = 'Run over — score ' + S.score + '. Press New run to try again.'; return; }
  S.body.unshift(n);
  if (n[0] === S.food[0] && n[1] === S.food[1]) { const add = S.golden ? 3 : 1; S.score += add; beep(S.golden ? 900 : 560); if (S.score > S.best) { S.best = S.score; try { localStorage.setItem(KEY, String(S.best)); } catch (_) {} msg.textContent = 'New best: ' + S.best + '. Keep going.'; } place(); hud(); }
  else S.body.pop();
}
function draw() {
  g.fillStyle = '#0a0f22'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#121a35'; for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) if ((x + y) % 2 === 0) g.fillRect(x * T, y * T, T, T);
  g.fillStyle = S.golden ? '#ffd27a' : '#a58bff'; g.fillRect(S.food[0] * T + 2, S.food[1] * T + 2, T - 4, T - 4);
  S.body.forEach((b, i) => { g.fillStyle = i === 0 ? '#f4d58d' : i % 2 ? '#7aa7ff' : '#5f8fe0'; g.fillRect(b[0] * T + 1, b[1] * T + 1, T - 2, T - 2); });
  if (S.paused) { g.fillStyle = '#e8e6f5'; g.font = '16px monospace'; g.fillText('PAUSED', 138, 90); }
}
let last = 0;
function loop(now) { if (!S.paused && now - last > Math.max(70, 140 - S.score * 2)) { last = now; step(); } draw(); requestAnimationFrame(loop); }
addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (k === 'arrowup' || k === 'w') turn(0, -1); if (k === 'arrowdown' || k === 's') turn(0, 1); if (k === 'arrowleft' || k === 'a') turn(-1, 0); if (k === 'arrowright' || k === 'd') turn(1, 0); });
let start = null;
c.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; });
c.addEventListener('pointerup', (e) => { if (!start) return; const dx = e.clientX - start.x, dy = e.clientY - start.y; start = null; if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0); else turn(0, dy > 0 ? 1 : -1); });
document.getElementById('pause').onclick = (e) => { S.paused = !S.paused; e.target.textContent = S.paused ? 'Resume' : 'Pause'; };
document.getElementById('again').onclick = () => { reset(); msg.textContent = 'Arrows or WASD to turn, or swipe. Edges wrap. Golden fruit is worth three.'; };
reset(); requestAnimationFrame(loop);
