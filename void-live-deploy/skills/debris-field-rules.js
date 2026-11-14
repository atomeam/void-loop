/** Debris Field: a one-minute duel. You slide the cyan chevron and fire. Verse holds the top and shoots more slowly. Crystals are squares. */
export const id = 'debris-field', W = 420, H = 240, MATCH = 2700;
const rng = (s) => { s.n = (Math.imul(s.n, 1664525) + 1013904223) >>> 0; return s.n / 4294967296; };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function create(seed = 1) {
  const s = {
    n: (seed >>> 0) || 1, tick: 0, phase: 'title', over: null, why: 'holding the top lane',
    you: { x: W / 2, vx: 0, lives: 3, cool: 0, inv: 0 }, void: { x: W / 2, vx: 0, lives: 3, cool: 0, inv: 0 },
    shots: [], chunks: [], bits: [], pops: [], stars: [], score: { you: 0, void: 0 }, combo: { you: 0, void: 0, t: 0 },
    shake: 0, wave: 1, banner: 0, sfx: 0, cue: '', flash: 0,
  };
  for (let i = 0; i < 48; i++) s.stars.push({ x: rng(s) * W, y: rng(s) * H, z: 0.3 + rng(s) * 1.4, a: 0.25 + rng(s) * 0.6 });
  return s;
}
function burst(s, x, y, color, n) {
  for (let i = 0; i < n && s.bits.length < 70; i++) {
    const a = rng(s) * 6.28, sp = 0.6 + rng(s) * 2.4;
    s.bits.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 18 + (rng(s) * 14 | 0), color });
  }
  s.shake = Math.min(8, s.shake + 3); s.cue = 'boom'; s.sfx = 1;
}
function spawn(s) {
  const r = 7 + (rng(s) * 6 | 0), edge = rng(s);
  const c = { x: edge < 0.5 ? -r : W + r, y: 48 + rng(s) * (H - 96), r, spin: rng(s) * 6, vr: (rng(s) - 0.5) * 0.08, hp: 1, on: 1 };
  const sp = (0.7 + s.wave * 0.18) * (0.75 + rng(s) * 0.7);
  c.vx = (c.x < 0 ? 1 : -1) * sp; c.vy = (rng(s) - 0.5) * sp;
  s.chunks.push(c);
}
function shoot(s, seat) {
  const p = s[seat]; if (p.cool > 0 || p.lives <= 0) return;
  s.shots.push({ x: p.x, y: seat === 'you' ? H - 34 : 30, vy: seat === 'you' ? -8.5 : 7.2, seat, on: 1 });
  p.cool = seat === 'you' ? 7 : 16; s.cue = 'shot'; s.sfx = 1;
}
function steer(s, seat, aim, speed) {
  const p = s[seat];
  p.vx = clamp(p.vx + clamp(aim - p.x, -speed, speed), -6.5, 6.5) * 0.82;
  p.x = clamp(p.x + (seat === 'you' && speed > 2 ? clamp(aim - p.x, -8, 8) * 0.35 : p.vx), 16, W - 16);
}
function danger(s, seat) {
  const y = seat === 'you' ? H - 28 : 22; let best = null, bd = 1e9;
  for (const c of s.chunks) if (c.on) { const d = Math.abs(c.x - s[seat].x) + Math.abs(c.y - y) * 0.65; if (d < bd) { bd = d; best = c; } }
  return best;
}
export function tick(s, input = {}) {
  if (s.phase === 'over') return s;
  s.clock = (s.clock || 0) + 1; s.sfx = 0; s.cue = '';
  if (s.phase === 'title') { s.why = ''; if (input.fire || input.flap || input.auto || input.step) s.phase = 'play'; return s; }
  s.tick++;
  const wave = 1 + (s.tick / 520 | 0); if (wave !== s.wave) { s.wave = wave; s.banner = 46; }
  s.banner = Math.max(0, s.banner - 1); s.shake = Math.max(0, s.shake * 0.84); s.flash = Math.max(0, s.flash - 1);
  if (s.combo.t > 0) s.combo.t--; else { s.combo.you = 0; s.combo.void = 0; }
  const mine = danger(s, 'you'), theirs = danger(s, 'void');
  if (s.you.lives > 0) {
    if (input.auto && mine) {
      const close = Math.abs(mine.x - s.you.x) < mine.r + 22 && mine.y > H - 78;
      steer(s, 'you', close ? s.you.x + (mine.x > s.you.x ? -56 : 56) : mine.x, 4);
      if (!close && Math.abs(mine.x - s.you.x) < 18) shoot(s, 'you');
    } else if (Number.isFinite(input.x)) s.you.x = clamp(s.you.x + (input.x - s.you.x) * 0.5, 16, W - 16);
    else { if (input.left) s.you.vx -= 1.35; if (input.right) s.you.vx += 1.35; s.you.vx *= 0.8; s.you.x = clamp(s.you.x + s.you.vx, 16, W - 16); }
    if (input.fire || input.auto) shoot(s, 'you');
  }
  if (s.void.lives > 0 && theirs) {
    const dive = Math.abs(theirs.y - 22) < 52;
    steer(s, 'void', dive ? s.void.x + (theirs.x > s.void.x ? -40 : 40) : theirs.x + 28, 1.2);
    if (!dive && Math.abs(theirs.x - s.void.x) < 26) shoot(s, 'void');
  }
  const quiet = (s.tick % 210) < 48;
  s.why = quiet ? 'holding fire while the lane clears' : 'a line of crystals is crossing';
  s.you.cool--; s.void.cool--; s.you.inv = Math.max(0, s.you.inv - 1); s.void.inv = Math.max(0, s.void.inv - 1);
  if (!quiet && s.tick % Math.max(8, 18 - s.wave * 2) === 0) spawn(s);
  for (const c of s.chunks) if (c.on) {
    c.x += c.vx; c.y += c.vy; c.spin += c.vr;
    if (c.y < 36 || c.y > H - 36) c.vy *= -0.9;
    if (s.tick % 50 === 0 && rng(s) < 0.35) c.vy = (rng(s) < 0.5 ? -1 : 1) * (1.1 + s.wave * 0.15);
    if (c.x < -36 || c.x > W + 36) c.on = 0;
  }
  for (const b of s.shots) if (b.on) {
    b.y += b.vy; if (b.y < 0 || b.y > H) b.on = 0;
    for (const c of s.chunks) if (c.on && b.on && Math.abs(b.x - c.x) < c.r + 2 && Math.abs(b.y - c.y) < c.r + 2) {
      c.on = 0; b.on = 0; const seat = b.seat; s.combo[seat] = Math.min(8, s.combo[seat] + 1); s.combo.t = 70;
      const pts = 10 * s.combo[seat]; s.score[seat] += pts; s.pops.push({ x: c.x, y: c.y, t: '+' + pts, life: 26 });
      burst(s, c.x, c.y, seat === 'you' ? '#4fe3e3' : '#b79bff', 10);
    }
  }
  const hit = (seat, y) => {
    const p = s[seat]; if (p.inv || p.lives <= 0) return;
    for (const c of s.chunks) if (c.on && Math.abs(c.x - p.x) < c.r + 8 && Math.abs(c.y - y) < c.r + 8) {
      c.on = 0; p.lives--; p.inv = 50; s.flash = 8; s.cue = 'hurt'; s.shake = 7; burst(s, c.x, c.y, '#e07070', 10); s.sfx = 1;
    }
  };
  hit('you', H - 28); hit('void', 22);
  for (const bit of s.bits) { bit.x += bit.vx; bit.y += bit.vy; bit.life--; }
  for (const p of s.pops) { p.y -= 0.7; p.life--; }
  s.shots = s.shots.filter((b) => b.on); s.chunks = s.chunks.filter((c) => c.on); s.bits = s.bits.filter((b) => b.life > 0); s.pops = s.pops.filter((p) => p.life > 0);
  if ((s.you.lives <= 0 && s.void.lives <= 0) || s.tick >= MATCH) {
    s.phase = 'over';
    s.over = s.score.you === s.score.void ? 'draw' : s.score.you > s.score.void ? 'you' : 'void';
    s.why = s.tick >= MATCH ? 'the minute is up' : 'both ships are wrecked and the score stands';
  }
  return s;
}
export function selfPlay(seed, cap = 4000) {
  const s = create(seed); while (s.phase !== 'over' && s.tick < cap) tick(s, { auto: true, fire: true });
  return { over: s.over, tick: s.tick, score: { you: s.score.you, void: s.score.void } };
}
function chevron(g, x, y, color, down, tick) {
  g.save(); g.translate(x, y); g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 16;
  g.beginPath(); g.moveTo(0, down ? 12 : -12); g.lineTo(14, down ? -8 : 8); g.lineTo(0, down ? -2 : 2); g.lineTo(-14, down ? -8 : 8); g.closePath(); g.fill();
  g.shadowBlur = 0; g.fillStyle = '#f4f1ea'; g.fillRect(-2, down ? -1 : -3, 4, 5);
  g.globalAlpha = 0.45 + (tick % 4) * 0.12; g.fillStyle = down ? '#d2c4ff' : '#bffff8';
  g.fillRect(-2, down ? -14 : 8, 4, 6 + (tick % 5)); g.restore();
}
export function draw(g, s) {
  if (s.cue && typeof window !== 'undefined') hear(s.cue);
  g.save();
  const k = s.shake;
  g.translate(Math.sin(s.tick * 1.7) * k, Math.cos(s.tick * 1.3) * k);
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#120a28'); bg.addColorStop(1, '#07060f');
  g.fillStyle = bg; g.fillRect(-8, -8, W + 16, H + 16);
  const clock = s.clock || s.tick;
  for (const st of s.stars) { g.globalAlpha = st.a; g.fillStyle = '#f2eeff'; g.fillRect((st.x + clock * st.z) % W, st.y, st.z > 1 ? 2 : 1, st.z > 1 ? 2 : 1); }
  g.globalAlpha = 1;
  if (s.flash) { g.fillStyle = 'rgba(255,80,80,.25)'; g.fillRect(0, 0, W, H); }
  for (const c of s.chunks) {
    g.save(); g.translate(c.x, c.y); g.rotate(c.spin); g.fillStyle = '#f0c36a'; g.shadowColor = '#ffd27a'; g.shadowBlur = 12;
    g.beginPath(); g.moveTo(0, -c.r); g.lineTo(c.r * 0.72, 0); g.lineTo(0, c.r); g.lineTo(-c.r * 0.72, 0); g.closePath(); g.fill();
    g.shadowBlur = 0; g.fillStyle = '#fff6d2'; g.fillRect(-1.5, -c.r * 0.45, 3, c.r * 0.7); g.restore();
  }
  g.shadowBlur = 0;
  for (const bit of s.bits) { g.globalAlpha = Math.max(0, bit.life / 22); g.fillStyle = bit.color; g.beginPath(); g.arc(bit.x, bit.y, bit.life > 12 ? 2.4 : 1.2, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  for (const p of s.pops) { g.globalAlpha = Math.max(0, p.life / 26); g.fillStyle = '#f2eeff'; g.font = '700 12px ui-sans-serif, system-ui, sans-serif'; g.fillText(p.t, p.x - 8, p.y); }
  g.globalAlpha = 1;
  for (const b of s.shots) {
    g.strokeStyle = b.seat === 'you' ? '#9ffff8' : '#d8c6ff'; g.lineWidth = 2; g.shadowColor = g.strokeStyle; g.shadowBlur = 8;
    g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x, b.y - b.vy * 1.1); g.stroke();
  }
  g.shadowBlur = 0;
  if (s.void.lives > 0 && !(s.void.inv && s.tick % 4 < 2)) chevron(g, s.void.x, 20, '#b79bff', true, s.tick);
  if (s.you.lives > 0 && !(s.you.inv && s.tick % 4 < 2)) chevron(g, s.you.x, H - 26, '#4fe3e3', false, s.tick);
  g.fillStyle = '#f2eeff'; g.font = '13px ui-sans-serif, system-ui, sans-serif';
  g.fillText('you ' + s.score.you + '   ×' + (s.combo.you || 1), 12, 18);
  g.fillText('Verse ' + s.score.void, W - 92, 18);
  g.fillText('wave ' + s.wave, W / 2 - 22, 18);
  pips(g, 12, H - 12, s.you.lives, '#4fe3e3'); pips(g, W - 48, H - 12, s.void.lives, '#b79bff');
  if (s.banner > 8 && s.phase === 'play') { g.globalAlpha = Math.min(1, s.banner / 20); g.fillStyle = '#f2eeff'; g.font = '700 22px ui-sans-serif, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('WAVE ' + s.wave, W / 2, H / 2); g.textAlign = 'left'; g.globalAlpha = 1; }
  if (s.phase === 'title') veil(g, 'DEBRIS FIELD', 'Drag or arrows to slide. Hold to fire.');
  if (s.phase === 'over') veil(g, s.over === 'you' ? 'YOU WIN' : s.over === 'void' ? 'VERSE WINS' : 'DRAW', 'you ' + s.score.you + '   ·   Verse ' + s.score.void);
  g.restore();
}
function pips(g, x, y, n, color) { g.fillStyle = color; for (let i = 0; i < n; i++) g.fillRect(x + i * 10, y, 6, 4); }
function veil(g, title, sub) {
  g.fillStyle = 'rgba(7,6,15,.55)'; g.fillRect(0, 62, W, 92);
  g.fillStyle = '#f2eeff'; g.font = '700 28px ui-sans-serif, system-ui, sans-serif'; g.textAlign = 'center';
  g.fillText(title, W / 2, 104); g.font = '14px ui-sans-serif, system-ui, sans-serif'; g.fillStyle = '#4fe3e3';
  g.fillText(sub, W / 2, 130); g.textAlign = 'left';
}
export const stick = 'x';
function hear(kind) {
  try {
    if (localStorage.getItem('a2m.void.arcade.sound.v1') !== '1') return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    hear.ac = hear.ac || new AC();
    const o = hear.ac.createOscillator(), gn = hear.ac.createGain();
    o.type = kind === 'hurt' ? 'sawtooth' : 'square';
    o.frequency.value = kind === 'boom' ? 160 : kind === 'hurt' ? 80 : 720;
    gn.gain.value = 0.035; o.connect(gn); gn.connect(hear.ac.destination);
    o.start(); o.stop(hear.ac.currentTime + (kind === 'shot' ? 0.03 : 0.1));
  } catch (_) { /* no audio keeps the round silent */ }
}
export const how = 'Slide the cyan ship with the arrows or a finger, and hold space or Act to fire. Square crystals cross the field and sometimes dive. Each wave is faster. Verse flies the violet ship along the top and shoots more slowly. Three hits wreck a ship and it stops scoring. When the minute ends, the higher score wins. A link hands a friend the same field.';
