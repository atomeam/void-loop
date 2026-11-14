/** Gap Glide Update 1: one glider, tightening gates, a storm gate. Verse is a ghost score. */
export const id = 'gap-glide', W = 1280, H = 720, tap = true, stick = 'tap', update = 1;
export const whatsNew = 'Update 1: one glider, three lives, gates that tighten, and a storm gate. Verse is the ghost score.';
const GX = 300, GRAV = 0.42, LIFT = -8.4, GAP0 = 250, GW = 92;
const rng = (s) => { s.n = (Math.imul(s.n, 1664525) + 1013904223) >>> 0; return s.n / 4294967296; };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function blank(seed) {
  const s = {
    n: (seed >>> 0) || 1, tick: 0, clock: 0, phase: 'title', over: null, why: '', anim: 0, ghost: 0,
    y: H * 0.46, vy: 0, lives: 3, inv: 0, alive: 1, gates: 0, mult: 1, chain: 0,
    speed: 3.2, pipes: [], bits: [], pops: [], stars: [], score: { you: 0 }, shake: 0, flash: 0, mo: 0, sfx: 0, cue: '',
  };
  for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 28; i++) s.stars.push({ x: rng(s) * W, y: rng(s) * H, layer, a: 0.2 + layer * 0.2 });
  for (let i = 0; i < 4; i++) s.pipes.push(gate(s, 780 + i * 460));
  return s;
}
function gate(s, x) {
  const gap = Math.max(176, GAP0 - s.gates * 4);
  const lo = 80 + gap / 2, hi = H - 80 - gap / 2;
  const storm = s.gates > 0 && s.gates % 6 === 0;
  return { x, c: lo + rng(s) * (hi - lo), gap, storm, scored: false, spin: rng(s) * 6 };
}
function nextGate(s) { return s.pipes.find((p) => p.x + GW > GX - 28) || s.pipes[0]; }
function flapWant(s, late) {
  const p = nextGate(s); if (!p) return false;
  const sway = p.storm ? Math.sin((s.tick + p.spin * 20) * 0.03) * 42 : 0;
  return s.vy > 0.15 && s.y > p.c + sway + late;
}
function burst(s, x, y, color, n, big) {
  for (let i = 0; i < n && s.bits.length < 140; i++) {
    const a = rng(s) * 6.28, sp = (big ? 2 : 0.6) + rng(s) * (big ? 6 : 3);
    s.bits.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: (big ? 28 : 12) + (rng(s) * 10 | 0), size: big ? 5 : 3, color });
  }
  s.shake = Math.min(22, s.shake + (big ? 14 : 5)); s.flash = big ? 10 : 4; s.cue = big ? 'boom' : 'flap'; s.sfx = 1;
}
function hurt(s) {
  s.lives--; s.inv = 80; s.chain = 0; s.mult = 1; burst(s, GX, s.y, '#ff8d7a', 24, true);
  if (s.lives <= 0) { s.alive = 0; s.mo = 50; burst(s, GX, s.y, '#7ef6ff', 48, true); }
}
function stepPlay(s, flap) {
  if (s.phase === 'title') { if (flap) s.phase = 'play'; return; }
  s.tick++;
  if (s.mo > 0) { s.mo--; if (!s.alive && s.mo === 0) { s.phase = 'over'; s.anim = 0; s.over = s.score.you > s.ghost ? 'you' : s.score.you === s.ghost ? 'draw' : 'void'; } return; }
  s.shake = Math.max(0, s.shake * 0.86); s.flash = Math.max(0, s.flash - 1); s.inv = Math.max(0, s.inv - 1);
  if (s.alive) {
    if (flap && s.vy > -6) { s.vy = LIFT; burst(s, GX - 18, s.y, '#7ef6ff', 6, false); }
    s.vy = Math.min(10, s.vy + GRAV); s.y += s.vy;
    if (s.y < 24 || s.y > H - 24) hurt(s);
    s.y = clamp(s.y, 20, H - 20);
  }
  for (const p of s.pipes) {
    p.x -= s.speed;
    const sway = p.storm ? Math.sin((s.tick + p.spin * 20) * 0.03) * 42 : 0;
    const cy = p.c + sway, top = cy - p.gap / 2, bot = cy + p.gap / 2;
    const overlap = GX + 22 > p.x && GX - 22 < p.x + GW;
    if (s.alive && !s.inv && overlap && (s.y - 16 < top || s.y + 16 > bot)) hurt(s);
    if (!p.scored && p.x + GW < GX - 22) {
      p.scored = true; s.gates++; s.chain++; s.mult = 1 + Math.min(6, s.chain * 0.25);
      const pts = Math.round((p.storm ? 40 : 10) * s.mult); s.score.you += pts;
      s.pops.push({ x: p.x, y: cy, t: '+' + pts, life: 26 });
      s.speed = Math.min(5.2, 3.2 + s.gates * 0.05);
    }
  }
  if (s.pipes[0] && s.pipes[0].x < -GW) { s.pipes.shift(); const last = s.pipes[s.pipes.length - 1]; s.pipes.push(gate(s, (last ? last.x : W) + 420)); }
  for (const b of s.bits) { b.x += b.vx; b.y += b.vy; b.life--; }
  for (const p of s.pops) { p.y -= 1; p.life--; }
  s.bits = s.bits.filter((b) => b.life > 0); s.pops = s.pops.filter((p) => p.life > 0);
  s.why = s.pipes.some((p) => p.storm && p.x < W && p.x > 0) ? 'a storm gate is moving' : 'the gaps are tightening';
}
function botFlap(s, kind) {
  if (kind === 'show') return s.tick < 4200 ? flapWant(s, 22) : false;
  if (kind === 'reckless') return s.tick % 18 === 0;
  if (kind === 'verse') return flapWant(s, -36);
  return flapWant(s, 22);
}
export function create(seed = 1) {
  const s = blank(seed); s.ghost = rival(seed); return s;
}
function rival(seed) {
  const s = blank(seed); let n = 0;
  while (s.phase !== 'over' && n < 5000) { stepPlay(s, s.phase === 'title' ? true : botFlap(s, 'verse')); n++; }
  return s.score.you;
}
export function tick(s, input = {}) {
  if (s.phase === 'over') return s;
  s.clock++; s.sfx = 0; s.cue = '';
  const kind = input.bot || (input.auto ? 'careful' : '');
  const flap = kind ? (s.phase === 'title' ? true : botFlap(s, kind)) : !!(input.flap || input.fire);
  stepPlay(s, flap);
  return s;
}
export function selfPlay(seed, cap = 9000) {
  const s = create(seed);
  while (s.phase !== 'over' && s.tick < cap) tick(s, { auto: true });
  return { over: s.over, tick: s.tick, score: { you: s.score.you, void: s.ghost } };
}
export function play(seed, bot, cap = 9000) {
  const s = create(seed);
  while (s.phase !== 'over' && s.tick < cap) tick(s, { bot });
  return { over: s.over, tick: s.tick, score: s.score.you, ghost: s.ghost, lives: s.lives, gates: s.gates };
}
function craft(g, y, vy, inv, clock) {
  if (inv && clock % 4 < 2) return;
  g.save(); g.translate(GX, y); g.rotate(clamp(vy * 0.08, -0.6, 0.9));
  g.fillStyle = '#7ef6ff'; g.globalAlpha = 0.8; g.beginPath(); g.moveTo(-16, 4); g.lineTo(-30, 10); g.lineTo(-30, -2); g.fill();
  g.globalAlpha = 1; g.fillStyle = '#141028'; g.strokeStyle = '#4fe3e3'; g.lineWidth = 3; g.shadowColor = '#4fe3e3'; g.shadowBlur = 14;
  g.beginPath(); g.moveTo(22, 0); g.lineTo(-8, 12); g.lineTo(-14, 0); g.lineTo(-8, -12); g.closePath(); g.fill(); g.stroke();
  g.restore();
}
export function draw(g, s) {
  s.anim = (s.anim || 0) + 1;
  if (g.canvas) { const tag = (s.mo > 0 ? 'mo' : s.phase) + s.lives + (s.pipes.some((p) => p.storm && p.x < W && p.x + GW > 0) ? 'S' : ''); if (g.canvas.dataset.tag !== tag) g.canvas.dataset.tag = tag; }
  if (s.cue && typeof window !== 'undefined') hear(s.cue);
  g.save();
  g.translate((Math.sin(s.clock) * s.shake) | 0, 0);
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1a1038'); bg.addColorStop(1, '#07060f');
  g.fillStyle = bg; g.fillRect(-8, -8, W + 16, H + 16);
  for (const st of s.stars) {
    const speed = 0.04 + st.layer * 0.05; const x = (st.x - s.clock * speed) % W; const y = (st.y + s.clock * speed * 0.15) % H;
    g.globalAlpha = st.a; g.fillStyle = st.layer === 2 ? '#fff' : '#b7a6e6';
    g.fillRect(x < 0 ? x + W : x, y < 0 ? y + H : y, st.layer + 1, st.layer + 1);
  }
  g.globalAlpha = 1;
  if (s.flash) { g.fillStyle = 'rgba(255,180,160,' + (s.flash / 24) + ')'; g.fillRect(0, 0, W, H); }
  for (const p of s.pipes) {
    const sway = p.storm ? Math.sin((s.clock + p.spin * 20) * 0.03) * 42 : 0;
    const top = p.c + sway - p.gap / 2, bot = p.c + sway + p.gap / 2;
    g.fillStyle = p.storm ? '#5a2a78' : '#2a2158'; g.fillRect(p.x, 0, GW, top); g.fillRect(p.x, bot, GW, H - bot);
    g.fillStyle = p.storm ? '#ffb15a' : '#4fe3e3'; g.fillRect(p.x - 4, top - 8, GW + 8, 8); g.fillRect(p.x - 4, bot, GW + 8, 8);
    if (p.storm) { g.fillStyle = '#ffb15a'; g.font = '700 16px ui-sans-serif, system-ui, sans-serif'; g.fillText('STORM', p.x - 4, top - 16); }
  }
  for (const b of s.bits) { g.globalAlpha = Math.max(0, b.life / 24); g.fillStyle = b.color; g.fillRect(b.x, b.y, b.size, b.size); }
  g.globalAlpha = 1;
  for (const p of s.pops) { g.globalAlpha = Math.max(0, p.life / 26); g.fillStyle = '#fff'; g.font = '700 22px ui-sans-serif, system-ui, sans-serif'; g.fillText(p.t, p.x, p.y); }
  g.globalAlpha = 1;
  if (s.alive) craft(g, s.y, s.vy, s.inv, s.clock);
  hud(g, s);
  if (s.phase === 'title') titleCard(g);
  if (s.phase === 'over') endCard(g, s, Math.min(1, s.anim / 16));
  g.restore();
}
function hud(g, s) {
  g.fillStyle = 'rgba(8,6,18,.55)'; g.fillRect(24, 18, 280, 44); g.fillRect(W - 520, 18, 210, 44);
  g.fillStyle = '#f4f1ea'; g.font = '600 22px ui-sans-serif, system-ui, sans-serif';
  g.fillText('YOU  ' + s.score.you + '   ×' + s.mult.toFixed(1), 36, 48);
  g.textAlign = 'right'; g.fillText('VERSE  ' + s.ghost, W - 320, 48); g.textAlign = 'left';
  for (let i = 0; i < 3; i++) {
    if (i < s.lives) { g.fillStyle = '#4fe3e3'; g.fillRect(36 + i * 28, H - 36, 18, 7); }
    else { g.strokeStyle = '#4fe3e3'; g.strokeRect(36.5 + i * 28, H - 35.5, 17, 6); }
  }
}
function deviceBest() {
  try { const b = JSON.parse(localStorage.getItem('a2m.void.arcade.best.v1') || '{}'); return b['gap-glide'] || 0; } catch (_) { return 0; }
}
function titleCard(g) {
  g.globalAlpha = 0.78; g.fillStyle = '#07060f'; g.fillRect(0, H / 2 - 200, W, 400);
  g.globalAlpha = 1; g.textAlign = 'center'; g.fillStyle = '#f4f1ea'; g.font = '700 64px ui-sans-serif, system-ui, sans-serif';
  g.fillText('GAP GLIDE', W / 2, H / 2 - 100);
  g.fillStyle = '#4fe3e3'; g.font = '700 28px ui-sans-serif, system-ui, sans-serif'; g.fillText('Update 1', W / 2, H / 2 - 48);
  g.fillStyle = '#f4f1ea'; g.font = '22px ui-sans-serif, system-ui, sans-serif';
  g.fillText("What's new", W / 2, H / 2 - 4);
  g.fillText('One glider. Three lives. The gates tighten.', W / 2, H / 2 + 32);
  g.fillText('A storm gate moves. Verse is the ghost score.', W / 2, H / 2 + 64);
  g.fillStyle = '#7ef6ff'; g.fillText('Tap or press space to lift.', W / 2, H / 2 + 116);
  g.textAlign = 'left';
}
function endCard(g, s, fade) {
  const best = Math.max(deviceBest(), s.score.you || 0);
  g.globalAlpha = 0.74 * fade; g.fillStyle = '#07060f'; g.fillRect(0, H / 2 - 168, W, 336);
  g.globalAlpha = fade; g.textAlign = 'center'; g.fillStyle = '#f4f1ea'; g.font = '700 60px ui-sans-serif, system-ui, sans-serif';
  g.fillText(s.over === 'you' ? 'YOU BEAT VERSE' : 'RUN OVER', W / 2, H / 2 - 88);
  g.font = '600 28px ui-sans-serif, system-ui, sans-serif'; g.fillStyle = '#7ef6ff'; g.fillText('You  ' + s.score.you, W / 2, H / 2 - 28);
  g.fillStyle = '#d2b0ff'; g.fillText('Verse  ' + s.ghost, W / 2, H / 2 + 14);
  g.fillStyle = '#f4f1ea'; g.fillText('Best  ' + best, W / 2, H / 2 + 56);
  g.fillStyle = '#4fe3e3'; g.font = '22px ui-sans-serif, system-ui, sans-serif'; g.fillText('space or tap to play again', W / 2, H / 2 + 108);
  g.textAlign = 'left'; g.globalAlpha = 1;
}
function hear(kind) {
  try {
    if (localStorage.getItem('a2m.void.arcade.sound.v1') !== '1') return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    hear.ac = hear.ac || new AC();
    const o = hear.ac.createOscillator(), gn = hear.ac.createGain();
    o.type = kind === 'boom' ? 'sawtooth' : 'square'; o.frequency.value = kind === 'boom' ? 90 : 520;
    gn.gain.value = kind === 'boom' ? 0.07 : 0.03; o.connect(gn); gn.connect(hear.ac.destination);
    o.start(); o.stop(hear.ac.currentTime + (kind === 'boom' ? 0.16 : 0.04));
  } catch (_) { /* silent */ }
}
export const how = "Update 1: one glider, three lives, gates that tighten, and a storm gate. Tap or press space to lift. A scrape costs a life and leaves you clear for a moment. Verse is the ghost score for this course, not another glider.";
