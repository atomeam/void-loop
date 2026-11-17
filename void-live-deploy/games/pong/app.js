// Verse Pong, full-viewport edition. Free of third-party assets; sound is synthesized here.
const c = document.getElementById('c'), g = c.getContext('2d'), W = 320, H = 180;
g.imageSmoothingEnabled = false;
const score = document.getElementById('score'), best = document.getElementById('best'), rallyEl = document.getElementById('rally'), msg = document.getElementById('msg');
const fit = () => { const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H))); c.style.width = W * s + 'px'; c.style.height = H * s + 'px'; c.style.left = (innerWidth - W * s) / 2 + 'px'; c.style.top = (innerHeight - H * s) / 2 + 'px'; };
addEventListener('resize', fit); fit();
let audio = null, muted = false;
const beep = (f, d = 0.05) => { if (muted) return; try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); const o = audio.createOscillator(), v = audio.createGain(); o.type = 'square'; o.frequency.value = f; v.gain.value = 0.04; o.connect(v).connect(audio.destination); o.start(); o.stop(audio.currentTime + d); } catch (_) {} };
document.getElementById('mute').onclick = (e) => { muted = !muted; e.target.textContent = muted ? 'Sound off' : 'Sound on'; beep(700); };

const KEY = 'a2m.pong.best.v1';
const S = { you: 0, verse: 0, rally: 0, best: 0, paused: false, py: 70, ey: 70, by: 86, bx: 158, vx: 2.2, vy: 1.1, target: 70 };
try { S.best = Number(localStorage.getItem(KEY) || 0) || 0; } catch (_) {}
const hud = () => { score.textContent = 'You ' + S.you + ' · Verse ' + S.verse; best.textContent = 'Best rally ' + S.best; rallyEl.textContent = 'Rally ' + S.rally; };
const serve = (dir) => { S.bx = 158; S.by = 86; S.vx = 2.2 * dir; S.vy = (Math.random() * 2 - 1) * 1.4; S.rally = 0; };
function point(who) { S[who]++; beep(who === 'you' ? 880 : 180, 0.16); serve(who === 'you' ? 1 : -1); if (S.you >= 7 || S.verse >= 7) { msg.textContent = (S.you > S.verse ? 'You win' : 'Verse wins') + ' — press New round to play again.'; S.you = 0; S.verse = 0; } hud(); }
function tick() {
  if (S.paused) return;
  S.py += Math.max(-4, Math.min(4, S.target - S.py));
  S.py = Math.max(6, Math.min(H - 22, S.py));
  const speed = 1 + Math.min(1.8, S.rally * 0.05);
  S.ey += Math.max(-2.6, Math.min(2.6, (S.by - S.ey - 6) * 0.09 * speed));
  S.ey = Math.max(6, Math.min(H - 22, S.ey));
  S.bx += S.vx * speed; S.by += S.vy * speed;
  if (S.by < 4 || S.by > H - 8) { S.vy *= -1; beep(330); }
  if (S.vx < 0 && S.bx < 16 && S.bx > 6 && S.by + 4 > S.py && S.by + 4 < S.py + 20) { S.vx *= -1; S.vy += (S.by - S.py - 8) * 0.06; S.rally++; beep(520); if (S.rally > S.best) { S.best = S.rally; try { localStorage.setItem(KEY, String(S.best)); } catch (_) {} } hud(); }
  if (S.vx > 0 && S.bx > 302 && S.bx < 314 && S.by + 4 > S.ey && S.by + 4 < S.ey + 20) { S.vx *= -1; S.vy += (S.by - S.ey - 8) * 0.06; beep(430); }
  if (S.bx < -4) point('verse'); if (S.bx > W + 4) point('you');
}
function draw() {
  g.fillStyle = '#07060f'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#3b4466'; for (let y = 4; y < H; y += 12) g.fillRect(158, y, 3, 6);
  g.fillStyle = '#a58bff'; g.fillRect(8, S.py, 6, 20);
  g.fillStyle = '#7aa7ff'; g.fillRect(W - 14, S.ey, 6, 20);
  g.fillStyle = '#f4d58d'; g.fillRect(S.bx, S.by, 7, 7);
  if (S.paused) { g.fillStyle = '#e8e6f5'; g.font = '16px monospace'; g.fillText('PAUSED', 132, 90); }
}
function loop() { tick(); draw(); requestAnimationFrame(loop); }
const move = (k) => { if (k === 'w' || k === 'ArrowUp') S.target -= 14; if (k === 's' || k === 'ArrowDown') S.target += 14; };
addEventListener('keydown', (e) => { if (['ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault(); move(e.key.toLowerCase()); if (e.key === 'p' || e.key === 'P') document.getElementById('pause').click(); });
c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); S.target = (e.clientY - r.top) / r.height * H - 10; });
document.getElementById('pause').onclick = (e) => { S.paused = !S.paused; e.target.textContent = S.paused ? 'Resume' : 'Pause'; };
document.getElementById('again').onclick = () => { S.you = 0; S.verse = 0; S.paused = false; document.getElementById('pause').textContent = 'Pause'; serve(Math.random() < 0.5 ? 1 : -1); hud(); msg.textContent = 'First to 7. The ball speeds up every rally.'; };
serve(-1); hud(); loop();
