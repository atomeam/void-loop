// Verse Breaker, Update 3: rebuilt from scratch so it is fun in the first second. Glowing bricks shatter with particles and a
// little screen shake, a combo climbs a musical scale, five power-ups fall from bricks, each level is a tougher wall (more hits,
// steel, a wall that creeps down) and the daily wall gives everyone the same layout and a target score to beat.
// All art and sound are drawn and synthesised in code here: no outside assets. window.__game is read by tools/game-fun.mjs.
import { finish } from '/lib/ladder.js';
export const update = 3;
export const whatsNew = 'Update 3: rebuilt from scratch: bricks shatter with sparks and shake, combos climb the music, five power-ups, a tougher wall every level, and a daily wall with a target to beat.';
const W = 360, H = 640, PY = H - 64, PH = 12, R = 6, COLS = 9, BW = (W - 24 - (COLS - 1) * 4) / COLS, BH = 18, TOP = 96;
const $ = (id) => document.getElementById(id), cv = $('c'), g = cv.getContext('2d');
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PAL = [['#ff5d8f', '#9b1d4a'], ['#ffa94d', '#9a4a0c'], ['#ffe066', '#9c7d0a'], ['#69f0ae', '#137a4d'], ['#4dd8ff', '#0b5f86'], ['#a78bfa', '#4b2d9a']];
const POW = { wide: ['#ffe066', 'W'], multi: ['#a78bfa', '3'], slow: ['#4dd8ff', 'S'], fire: ['#ff7a45', 'F'], life: ['#ff5d8f', '♥'] };
const day = (() => { const d = new Date(); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); })();
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };
const BEST = 'a2m.breaker.best.v1', DBEST = 'a2m.breaker.daily.v1';
// ---- sound: tiny synth, a pentatonic scale for combos ----
let ac = null, muted = !!store.get('a2m.breaker.mute', false), sounds = 0;
const SCALE = [0, 2, 4, 7, 9];
const note = (i) => 261.63 * Math.pow(2, (SCALE[i % 5] + 12 * Math.floor(i / 5)) / 12);
function tone(f, d = 0.08, type = 'square', vol = 0.05, slide = 0, at = 0) {
  if (muted || !ac) return; sounds++;
  try { const t = ac.currentTime + at, o = ac.createOscillator(), v = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
    v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(v).connect(ac.destination); o.start(t); o.stop(t + d + 0.02); } catch (_) {}
}
function crunch(vol = 0.06) {
  if (muted || !ac) return; sounds++;
  try { const n = ac.sampleRate * 0.06 | 0, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), v = ac.createGain(); f.type = 'bandpass'; f.frequency.value = 1800; v.gain.value = vol; s.buffer = b; s.connect(f).connect(v).connect(ac.destination); s.start(); } catch (_) {}
}
const wake = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { ac = null; } } if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); };
// ---- state ----
let S, best = +store.get(BEST, 0) || 0, daily = false, paused = false, shake = 0, hitstop = 0, flash = 0, frames = 0;
const parts = [], pops = [], stars = Array.from({ length: 90 }, (_, i) => ({ x: (i * 97) % W, y: (i * 233) % H, z: 0.3 + ((i * 37) % 10) / 12 }));
const target = () => 2500 + (day % 89) * 40;
function layout(level, rand) {
  const rows = Math.min(10, 5 + level), shape = (level - 1) % 6, out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
    const mid = Math.abs(c - 4), keep = shape === 0 ? true : shape === 1 ? mid <= r : shape === 2 ? (r + c) % 2 === 0 || r < 2 : shape === 3 ? mid + Math.abs(r - rows / 2) < 5.5 : shape === 4 ? r % 3 !== 2 : rand() > 0.22;
    if (!keep) continue;
    let hp = 1; if (level >= 2 && r < 2) hp = 2; if (level >= 4 && r === 0) hp = 3; if (level >= 6 && rand() < 0.15) hp = 3;
    const steel = level >= 5 && r === rows - 1 && c % 4 === 0;
    out.push({ x: 12 + c * (BW + 4), y: TOP + r * (BH + 4), hp: steel ? 99 : hp, max: hp, steel, col: r % PAL.length, hit: 0 });
  }
  return out;
}
function newBall(stuck = true) { return { x: S ? S.px : W / 2, y: PY - R - 1, vx: 0, vy: 0, stuck, trail: [] }; }
function start() {
  const seed = daily ? day : (Math.random() * 1e9) >>> 0;
  S = { seed, rand: rng(seed), level: 1, score: 0, lives: 3, px: W / 2, pw: 76, wideT: 0, slowT: 0, fireT: 0, combo: 0, comboT: 0, hits: 0, balls: [], bricks: [], caps: [], over: false, overAt: 0, drop: 0, dropT: 0, banner: 'LEVEL 1', bannerT: 1.6, ramp: 0, won: null };
  S.bricks = layout(1, S.rand); S.balls = [newBall()]; parts.length = pops.length = 0; hud();
}
const speed = () => Math.min(760, (300 + 26 * (S.level - 1)) * (1 + Math.min(0.5, S.ramp)) * (S.slowT > 0 ? 0.65 : 1));
function launch() { for (const b of S.balls) if (b.stuck) { b.stuck = false; const a = (S.rand() - 0.5) * 0.6; b.vx = Math.sin(a) * speed(); b.vy = -Math.cos(a) * speed(); tone(520, 0.06, 'triangle', 0.05, 1.6); } }
function hud() {
  $('score').textContent = 'Score ' + S.score.toLocaleString(); $('best').textContent = (daily ? 'Daily best ' : 'Best ') + (daily ? +(store.get(DBEST, {})[day] || 0) : best).toLocaleString();
  $('lives').textContent = '♥'.repeat(Math.max(0, S.lives)) || '–'; $('level').textContent = 'Level ' + S.level + (daily ? ' · target ' + target().toLocaleString() : '');
}
function burst(x, y, col, n = 14, sp = 160) { for (let i = 0; i < n && parts.length < 420; i++) { const a = Math.random() * 6.283, v = sp * (0.3 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.5 + Math.random() * 0.4, t: 0, col, s: 2 + Math.random() * 3 }); } }
function pop(x, y, text, col = '#fff') { if (pops.length < 30) pops.push({ x, y, text, col, t: 0 }); }
function addShake(n) { shake = Math.min(14, shake + n * (calm ? 0.3 : 1)); }
function breakBrick(br, b) {
  if (br.steel) { tone(180, 0.05, 'square', 0.04); br.hit = 1; return; }
  br.hp--; br.hit = 1;
  if (br.hp > 0) { tone(note(S.combo) / 2, 0.06, 'square', 0.04); burst(br.x + BW / 2, br.y + BH / 2, PAL[br.col][0], 4, 90); return; }
  S.combo++; S.comboT = 2.4; const mult = Math.min(8, 1 + Math.floor(S.combo / 4)), pts = 10 * br.max * mult;
  S.score += pts; S.bricks.splice(S.bricks.indexOf(br), 1);
  burst(br.x + BW / 2, br.y + BH / 2, PAL[br.col][0], 16 + Math.min(20, S.combo)); addShake(2 + Math.min(6, S.combo * 0.4));
  tone(note(Math.min(24, S.combo)), 0.12, 'triangle', 0.06); crunch(0.035);
  pop(br.x + BW / 2, br.y, '+' + pts + (mult > 1 ? ' ×' + mult : ''), mult > 1 ? '#ffe066' : '#fff');
  if (S.combo > 0 && S.combo % 8 === 0) { hitstop = 0.05; flash = 0.25; pop(W / 2, H / 2, 'COMBO ' + S.combo + '!', '#7af5ff'); tone(note(S.combo + 5), 0.2, 'sawtooth', 0.04, 1.5); }
  if (S.rand() < 0.13 + Math.min(0.07, S.level * 0.01)) { const keys = ['wide', 'multi', 'slow', 'fire', 'wide', 'multi', 'fire', S.lives < 5 && S.rand() < 0.4 ? 'life' : 'slow']; S.caps.push({ x: br.x + BW / 2, y: br.y + BH / 2, k: keys[(S.rand() * keys.length) | 0] }); }
  hud();
}
function power(k) {
  tone(660, 0.07, 'square', 0.05); tone(880, 0.07, 'square', 0.05, 0, 0.07); tone(1320, 0.12, 'square', 0.05, 0, 0.14);
  if (k === 'wide') S.wideT = 12; if (k === 'slow') S.slowT = 9; if (k === 'fire') S.fireT = 7; if (k === 'life') { S.lives++; hud(); }
  if (k === 'multi') { const add = []; for (const b of S.balls.slice(0, 4)) if (!b.stuck) for (const a of [-0.45, 0.45]) { const c = Math.cos(a), s = Math.sin(a); add.push({ x: b.x, y: b.y, vx: b.vx * c - b.vy * s, vy: b.vx * s + b.vy * c, stuck: false, trail: [] }); } S.balls.push(...add); }
  pop(S.px, PY - 30, { wide: 'WIDE PADDLE', multi: 'MULTI-BALL', slow: 'SLOW BALL', fire: 'FIREBALL', life: 'EXTRA LIFE' }[k], POW[k][0]);
}
function loseLife() {
  S.lives--; S.combo = 0; addShake(10); flash = 0.35; tone(220, 0.35, 'sawtooth', 0.06, 0.4); hud();
  if (S.lives <= 0) return gameOver();
  S.balls = [newBall()]; S.wideT = S.fireT = S.slowT = 0; S.caps.length = 0;
}
function gameOver() {
  S.over = true; S.overAt = performance.now(); S.lives = 0;
  if (daily) { const d = store.get(DBEST, {}); if (S.score > (d[day] || 0)) { d[day] = S.score; store.set(DBEST, d); } S.won = S.score >= target(); try { finish('void-breaker', S.won ? 'you' : 'void'); } catch (_) {} }
  S.newBest = !daily && S.score > best; if (S.newBest) { best = S.score; store.set(BEST, best); }
  tone(392, 0.15, 'triangle', 0.06); tone(330, 0.15, 'triangle', 0.06, 0, 0.15); tone(262, 0.4, 'triangle', 0.06, 0, 0.3); hud();
}
function nextLevel() {
  const bonus = 250 * S.level + 100 * S.lives; S.score += bonus; S.level++; S.ramp = 0; S.drop = 0;
  S.bricks = layout(S.level, S.rand); S.balls = [newBall()]; S.caps.length = 0; S.banner = 'LEVEL ' + S.level; S.bannerT = 1.8; flash = 0.4;
  pop(W / 2, H / 2 + 64, 'WALL CLEARED +' + bonus, '#69f0ae'); [0, 4, 7, 12].forEach((s, i) => tone(392 * Math.pow(2, s / 12), 0.18, 'square', 0.05, 0, i * 0.09)); hud();
}
// ---- input ----
const keys = {}; let pointerX = null;
addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'Space', 'KeyA', 'KeyD', 'ArrowUp'].includes(e.code)) e.preventDefault();
  keys[e.code] = true; wake();
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') { if (S.over) { if (performance.now() - S.overAt > 600) start(); } else { paused = false; launch(); } }
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause(); if (e.code === 'KeyM') toggleMute();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
const fieldX = (e) => { const r = view(); return (e.clientX - r.ox) / r.s; };
cv.addEventListener('pointerdown', (e) => { wake(); pointerX = fieldX(e); try { cv.setPointerCapture(e.pointerId); } catch (_) {} if (S.over) { if (performance.now() - S.overAt > 600) start(); return; } paused = false; launch(); });
cv.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons || e.pressure > 0) pointerX = fieldX(e); });
const togglePause = () => { paused = !paused && !S.over; $('pause').textContent = paused ? 'Resume' : 'Pause'; };
const toggleMute = () => { muted = !muted; store.set('a2m.breaker.mute', muted); $('mute').textContent = muted ? 'Sound off' : 'Sound on'; $('mute').setAttribute('aria-pressed', String(muted)); wake(); tone(700, 0.05); };
$('pause').onclick = (e) => { e.currentTarget.blur(); togglePause(); };
$('mute').onclick = (e) => { e.currentTarget.blur(); toggleMute(); };
$('daily').onclick = (e) => { e.currentTarget.blur(); daily = !daily; $('daily').setAttribute('aria-pressed', String(daily)); $('daily').textContent = daily ? 'Daily wall ✓' : 'Daily wall'; paused = false; start(); };
document.addEventListener('visibilitychange', () => { if (document.hidden && !S.over) { paused = true; $('pause').textContent = 'Resume'; } });
$('mute').textContent = muted ? 'Sound off' : 'Sound on';
// ---- simulation ----
function step(dt) {
  S.wideT = Math.max(0, S.wideT - dt); S.slowT = Math.max(0, S.slowT - dt); S.fireT = Math.max(0, S.fireT - dt); S.bannerT = Math.max(0, S.bannerT - dt);
  if (S.comboT > 0 && (S.comboT -= dt) <= 0) S.combo = 0;
  const pw = S.wideT > 0 ? 118 : 76; S.pw += (pw - S.pw) * Math.min(1, dt * 10);
  const kd = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  if (kd) { S.px += kd * 620 * dt; pointerX = null; } else if (pointerX != null) S.px += (pointerX - S.px) * Math.min(1, dt * 28);
  S.px = Math.max(S.pw / 2 + 4, Math.min(W - S.pw / 2 - 4, S.px));
  const live = S.balls.some((b) => !b.stuck);
  if (live && S.level >= 3 && (S.dropT += dt) > Math.max(9, 24 - S.level)) { S.dropT = 0; for (const br of S.bricks) br.y += 11; tone(110, 0.2, 'sine', 0.08, 0.7); addShake(3); }
  if (S.bricks.some((br) => !br.steel && br.y + BH > PY - 22)) { S.bricks.forEach((br) => { br.y -= 66; }); loseLife(); pop(W / 2, H / 2, 'THE WALL REACHED YOU', '#ff5d8f'); return; }
  const v = speed();
  for (const b of S.balls) {
    if (b.stuck) { b.x = S.px; b.y = PY - R - 1; continue; }
    const m = Math.hypot(b.vx, b.vy) || 1; b.vx *= v / m; b.vy *= v / m;
    const n = Math.ceil((v * dt) / 4);
    for (let i = 0; i < n; i++) { b.x += (b.vx * dt) / n; b.y += (b.vy * dt) / n; collide(b); if (b.dead) break; }
    b.trail.push(b.x, b.y); if (b.trail.length > 16) b.trail.splice(0, 2);
  }
  S.balls = S.balls.filter((b) => !b.dead);
  if (!S.balls.length) return loseLife();
  for (const c of S.caps) { c.y += 150 * dt; if (c.y > PY - 8 && c.y < PY + PH + 8 && Math.abs(c.x - S.px) < S.pw / 2 + 10) { c.got = true; power(c.k); } }
  S.caps = S.caps.filter((c) => !c.got && c.y < H + 20);
  if (!S.bricks.some((br) => !br.steel)) nextLevel();
}
function collide(b) {
  if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); tone(900, 0.02, 'square', 0.015); }
  if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); tone(900, 0.02, 'square', 0.015); }
  if (b.y < 56 + R) { b.y = 56 + R; b.vy = Math.abs(b.vy); tone(900, 0.02, 'square', 0.015); }
  if (b.y > H + 20) { b.dead = true; return; }
  if (b.vy > 0 && b.y + R >= PY && b.y - R <= PY + PH && Math.abs(b.x - S.px) <= S.pw / 2 + R) {
    const off = Math.max(-1, Math.min(1, (b.x - S.px) / (S.pw / 2))), a = off * 1.05, v = Math.hypot(b.vx, b.vy);
    b.vx = Math.sin(a) * v; b.vy = -Math.abs(Math.cos(a) * v); b.y = PY - R; S.hits++; S.ramp += 0.018; S.squash = 1;
    tone(196 + 60 * Math.abs(off), 0.07, 'triangle', 0.07); burst(b.x, PY, '#7af5ff', 5, 80);
  }
  for (const br of S.bricks) {
    if (b.x + R < br.x || b.x - R > br.x + BW || b.y + R < br.y || b.y - R > br.y + BH) continue;
    const fire = S.fireT > 0 && !br.steel;
    if (!fire) { const ox = Math.min(b.x + R - br.x, br.x + BW - (b.x - R)), oy = Math.min(b.y + R - br.y, br.y + BH - (b.y - R)); if (ox < oy) { b.vx = b.x < br.x + BW / 2 ? -Math.abs(b.vx) : Math.abs(b.vx); b.x += b.vx > 0 ? ox : -ox; } else { b.vy = b.y < br.y + BH / 2 ? -Math.abs(b.vy) : Math.abs(b.vy); b.y += b.vy > 0 ? oy : -oy; } }
    else br.hp = 1;
    breakBrick(br, b); if (!fire) return;
  }
}
// ---- drawing ----
let geo = { s: 1, ox: 0, oy: 0 }, dpr = 1, brickLayer = null, brickKey = '';
const view = () => geo;
function fit() { dpr = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * dpr | 0; cv.height = innerHeight * dpr | 0; const s = Math.min(innerWidth / W, innerHeight / H); geo = { s, ox: (innerWidth - W * s) / 2, oy: (innerHeight - H * s) / 2 }; brickKey = ''; }
addEventListener('resize', fit); fit();
let bgC = null, bgKey = '';
function backdrop() { const k = S.level + ':' + cv.width + 'x' + cv.height; if (k === bgKey) return bgC; bgKey = k; bgC = bgC || document.createElement('canvas'); bgC.width = Math.max(1, innerWidth / 2 | 0); bgC.height = Math.max(1, innerHeight / 2 | 0);
  const x = bgC.getContext('2d'), hue = (250 + S.level * 23) % 360, gr = x.createLinearGradient(0, 0, 0, bgC.height); gr.addColorStop(0, 'hsl(' + hue + ',55%,10%)'); gr.addColorStop(1, '#05030c'); x.fillStyle = gr; x.fillRect(0, 0, bgC.width, bgC.height); return bgC; }
const glows = {};
function glow(rgb) { if (glows[rgb]) return glows[rgb]; const c = document.createElement('canvas'); c.width = c.height = 80; const x = c.getContext('2d'), gr = x.createRadialGradient(40, 40, 4, 40, 40, 40); gr.addColorStop(0, 'rgba(' + rgb + ',.9)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)'); x.fillStyle = gr; x.fillRect(0, 0, 80, 80); return (glows[rgb] = c); }
function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function bricksTo(ctx) {
  for (const br of S.bricks) {
    const [a, d] = br.steel ? ['#c9d1e0', '#5a6478'] : PAL[br.col], gr = ctx.createLinearGradient(0, br.y, 0, br.y + BH);
    gr.addColorStop(0, a); gr.addColorStop(1, d); ctx.fillStyle = gr; ctx.shadowColor = a; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(br.x, br.y, BW, BH, 4) : ctx.rect(br.x, br.y, BW, BH); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff55'; ctx.fillRect(br.x + 3, br.y + 2, BW - 6, 2);
    if (br.hp > 1 && !br.steel) { ctx.fillStyle = '#0008'; for (let i = 0; i < br.hp; i++) ctx.fillRect(br.x + BW / 2 - (br.hp * 5) / 2 + i * 5, br.y + BH - 6, 3, 3); }
    if (br.steel) { ctx.strokeStyle = '#ffffff88'; ctx.strokeRect(br.x + 2.5, br.y + 2.5, BW - 5, BH - 5); }
  }
}
function draw(dt) {
  const s = geo.s; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.drawImage(backdrop(), 0, 0, innerWidth, innerHeight);
  const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
  g.setTransform(dpr * s, 0, 0, dpr * s, dpr * (geo.ox + sx * s), dpr * (geo.oy + sy * s));
  g.fillStyle = '#ffffff07'; g.fillRect(0, 0, W, H); g.strokeStyle = '#ffffff18'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, W - 1, H - 1);
  for (const st of stars) { st.y += st.z * 14 * dt * (1 + S.ramp); if (st.y > H) st.y -= H; g.fillStyle = 'rgba(255,255,255,' + (0.15 + st.z * 0.45) + ')'; g.fillRect(st.x, st.y, st.z * 1.8, st.z * 1.8); }
  const key = S.bricks.map((b) => b.x + ',' + b.y + ',' + b.hp).join(';') + s;
  if (key !== brickKey) { brickKey = key; brickLayer = brickLayer || document.createElement('canvas'); brickLayer.width = W * s * dpr; brickLayer.height = H * s * dpr; const bc = brickLayer.getContext('2d'); bc.setTransform(s * dpr, 0, 0, s * dpr, 0, 0); bc.clearRect(0, 0, W, H); bricksTo(bc); }
  g.drawImage(brickLayer, 0, 0, W, H);
  for (const br of S.bricks) if (br.hit > 0) { g.fillStyle = 'rgba(255,255,255,' + br.hit * 0.8 + ')'; g.fillRect(br.x, br.y, BW, BH); br.hit = Math.max(0, br.hit - dt * 6); }
  for (const c of S.caps) { const [col, ch] = POW[c.k]; g.fillStyle = col + '44'; rr(c.x - 18, c.y - 12, 36, 24, 12); g.fill(); g.fillStyle = col; rr(c.x - 14, c.y - 8, 28, 16, 8); g.fill(); g.fillStyle = '#1a0b2e'; g.font = '800 11px system-ui'; g.textAlign = 'center'; g.fillText(ch, c.x, c.y + 4); }
  S.squash = Math.max(0, (S.squash || 0) - dt * 6); const pw = S.pw * (1 + 0.12 * S.squash), ph = PH * (1 - 0.3 * S.squash);
  const pc = S.fireT > 0 ? '#ff7a45' : '#7af5ff', pg = g.createLinearGradient(0, PY, 0, PY + PH); pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.4, pc); pg.addColorStop(1, '#1b4f6b');
  g.fillStyle = pc + '33'; rr(S.px - pw / 2 - 6, PY + (PH - ph) - 6, pw + 12, ph + 12, 12); g.fill(); g.fillStyle = pg; rr(S.px - pw / 2, PY + (PH - ph), pw, ph, 6); g.fill();
  for (const b of S.balls) {
    const bc = S.fireT > 0 ? '255,122,69' : '200,245,255';
    for (let i = 0; i < b.trail.length; i += 2) { const k = i / b.trail.length; g.fillStyle = 'rgba(' + bc + ',' + k * 0.35 + ')'; g.beginPath(); g.arc(b.trail[i], b.trail[i + 1], R * (0.4 + k * 0.6), 0, 6.283); g.fill(); }
    g.drawImage(glow(bc), b.x - 20, b.y - 20, 40, 40); g.fillStyle = '#fff'; g.beginPath(); g.arc(b.x, b.y, R, 0, 6.283); g.fill();
  }
  for (const p of parts) { p.t += dt; p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt; g.globalAlpha = Math.max(0, 1 - p.t / p.life); g.fillStyle = p.col; g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
  g.globalAlpha = 1; for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t > parts[i].life) parts.splice(i, 1);
  g.textAlign = 'center';
  for (const p of pops) { p.t += dt; g.globalAlpha = Math.max(0, 1 - p.t / 1.1); g.fillStyle = p.col; g.font = '800 ' + (p.text.length > 8 ? 18 : 14) + 'px system-ui'; g.fillText(p.text, p.x, p.y - p.t * 40); }
  g.globalAlpha = 1; for (let i = pops.length - 1; i >= 0; i--) if (pops[i].t > 1.1) pops.splice(i, 1);
  if (S.combo >= 2) { g.fillStyle = '#ffe066'; g.font = '800 15px system-ui'; g.fillText('COMBO ' + S.combo + '  ×' + Math.min(8, 1 + Math.floor(S.combo / 4)), W / 2, 80); g.fillStyle = '#ffe06655'; g.fillRect(W / 2 - 50, 86, 100 * (S.comboT / 2.4), 3); }
  const timers = [['WIDE', S.wideT, 12, '#ffe066'], ['SLOW', S.slowT, 9, '#4dd8ff'], ['FIRE', S.fireT, 7, '#ff7a45']].filter((t) => t[1] > 0);
  timers.forEach(([n, t, m, col], i) => { g.fillStyle = col; g.font = '700 10px system-ui'; g.fillText(n, 40 + i * 70, H - 22); g.fillRect(20 + i * 70, H - 16, 40 * t / m, 3); });
  if (S.bannerT > 0) { g.globalAlpha = Math.min(1, S.bannerT); g.fillStyle = '#fff'; g.font = '900 34px system-ui'; g.fillText(S.banner, W / 2, H / 2 + 10); g.globalAlpha = 1; }
  if (!S.over && S.balls.some((b) => b.stuck) && S.bannerT < 1.2) { g.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 220); g.fillStyle = '#7af5ff'; g.font = '700 15px system-ui'; g.fillText(matchMedia('(pointer: coarse)').matches ? 'Tap to launch · drag to move' : 'Space or click to launch · ← → or mouse to move', W / 2, PY - 40); g.globalAlpha = 1; }
  if (paused && !S.over) { g.fillStyle = '#05030ccc'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = '900 30px system-ui'; g.fillText('PAUSED', W / 2, H / 2); g.font = '600 13px system-ui'; g.fillText('Tap or press Space to keep going', W / 2, H / 2 + 26); }
  if (S.over) {
    g.fillStyle = '#05030cdd'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = '900 32px system-ui'; g.fillText('GAME OVER', W / 2, H / 2 - 90);
    g.font = '800 46px system-ui'; g.fillStyle = '#ffe066'; g.fillText(S.score.toLocaleString(), W / 2, H / 2 - 30); g.font = '600 14px system-ui'; g.fillStyle = '#cfc4ff';
    g.fillText('Level ' + S.level + (daily ? '' : ' · best ' + best.toLocaleString()), W / 2, H / 2);
    if (S.newBest) { g.fillStyle = '#69f0ae'; g.font = '800 18px system-ui'; g.fillText('NEW BEST!', W / 2, H / 2 + 30); }
    if (daily) { g.fillStyle = S.won ? '#69f0ae' : '#ff7aa8'; g.font = '800 16px system-ui'; g.fillText(S.won ? 'You beat today’s target (' + target().toLocaleString() + '). Round to you.' : 'Today’s target is ' + target().toLocaleString() + '. Round to Verse.', W / 2, H / 2 + 30); }
    if (performance.now() - S.overAt > 600) { g.fillStyle = '#7af5ff'; g.font = '700 15px system-ui'; g.fillText('Tap or press Space to play again', W / 2, H / 2 + 70); }
    g.fillStyle = '#cfc4ff99'; g.font = '500 11px system-ui'; g.fillText('Verse Breaker · Update ' + update, W / 2, H - 30);
  }
  if (flash > 0) { g.fillStyle = 'rgba(255,255,255,' + flash * 0.5 + ')'; g.fillRect(0, 0, W, H); flash = Math.max(0, flash - dt * 2); }
  shake = Math.max(0, shake - dt * 40);
}
let last = performance.now(), acc = 0;
function loop(t) {
  requestAnimationFrame(loop); frames++;
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  if (hitstop > 0) hitstop -= dt; else if (!paused && !S.over) { acc += dt; while (acc >= 1 / 120) { step(1 / 120); acc -= 1 / 120; if (S.over) break; } }
  draw(dt);
}
start();
const note0 = $('new-note'); note0.textContent = whatsNew; setTimeout(() => { note0.style.opacity = '0'; }, 6000);
requestAnimationFrame(loop);
window.__game = () => ({ id: 'void-breaker', update, score: S.score, lives: S.lives, level: S.level, speed: Math.round(speed()), over: S.over, waiting: S.balls.some((b) => b.stuck), paddle: Math.round(S.px), bricks: S.bricks.length, sounds, audio: !!ac, frames, paused });
if (new URLSearchParams(location.search).has('probe')) window.__gameCheat = { clear() { S.bricks = S.bricks.filter((b) => b.steel); }, ball() { const b = S.balls[0]; return b && { x: b.x, y: b.y, vy: b.vy }; }, bot() { const b = S.balls.filter((x) => !x.stuck).sort((p, q) => q.y - p.y)[0]; return { x: b ? b.x : W / 2, launch: S.balls.some((x) => x.stuck) }; } };
