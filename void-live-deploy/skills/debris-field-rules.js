/** Debris Field: a long duel on a wide stage. You slide and hold to fire. Verse holds the top. */
export const id = 'debris-field', W = 1280, H = 720, MATCH = 5400, stick = 'x';
const rng = (s) => { s.n = (Math.imul(s.n, 1664525) + 1013904223) >>> 0; return s.n / 4294967296; };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const YOU_Y = H - 86, VOID_Y = 78;
export function create(seed = 1) {
  const s = {
    n: (seed >>> 0) || 1, tick: 0, clock: 0, phase: 'title', over: null, why: '', anim: 0,
    you: ship(W / 2), void: ship(W / 2),
    shots: [], chunks: [], bits: [], pops: [], drops: [], stars: [],
    score: { you: 0, void: 0 }, combo: { you: 0, void: 0, t: 0 },
    shake: 0, stop: 0, mo: 0, wave: 1, banner: 0, boss: 0, flash: 0, sfx: 0, cue: '',
  };
  for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 40; i++) s.stars.push({ x: rng(s) * W, y: rng(s) * H, z: 0.15 + layer * 0.55, a: 0.15 + layer * 0.22, layer });
  return s;
}
function ship(x) { return { x, vx: 0, lives: 4, cool: 0, inv: 0, spread: 0, shield: 0, alive: 1 }; }
function burst(s, x, y, color, n, big) {
  for (let i = 0; i < n && s.bits.length < 160; i++) {
    const a = rng(s) * 6.28, sp = (big ? 2.2 : 0.8) + rng(s) * (big ? 6 : 3);
    s.bits.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (big ? 28 : 16) + (rng(s) * 16 | 0), size: big ? 3 + (rng(s) * 5 | 0) : 2, color });
  }
  s.shake = Math.min(big ? 22 : 12, s.shake + (big ? 14 : 6));
  s.stop = big ? 8 : 4; s.flash = big ? 10 : 5; s.cue = big ? 'boom' : 'shot'; s.sfx = 1;
}
function spawn(s, boss) {
  const r = boss ? 48 : 16 + (rng(s) * 14 | 0);
  const c = { x: rng(s) < 0.5 ? -r : W + r, y: 160 + rng(s) * (H - 320), r, spin: rng(s) * 6, vr: (rng(s) - 0.5) * 0.06, hp: boss ? 12 : 1, max: boss ? 12 : 1, on: 1, boss: boss ? 1 : 0 };
  const sp = (boss ? 1.3 : 2.1 + s.wave * 0.28) * (0.8 + rng(s) * 0.5);
  c.vx = (c.x < 0 ? 1 : -1) * sp; c.vy = (rng(s) - 0.5) * sp * 0.4;
  s.chunks.push(c); if (boss) s.boss = 1;
}
function shoot(s, seat) {
  const p = s[seat]; if (p.cool > 0 || !p.alive) return;
  const y = seat === 'you' ? YOU_Y - 28 : VOID_Y + 28, vy = seat === 'you' ? -16 : 13;
  const fans = p.spread > 0 ? [-0.22, 0, 0.22] : [0];
  for (const a of fans) s.shots.push({ x: p.x, y, vx: a * 10, vy, seat, on: 1 });
  p.cool = seat === 'you' ? (p.spread > 0 ? 8 : 6) : 14; s.cue = 'shot'; s.sfx = 1;
}
function steer(s, seat, aim) {
  const p = s[seat], speed = seat === 'you' ? 28 : 9;
  p.x = clamp(p.x + clamp(aim - p.x, -speed, speed) * (seat === 'you' ? 0.28 : 0.12), 48, W - 48);
}
function nearest(s, seat) {
  const y = seat === 'you' ? YOU_Y : VOID_Y, p = s[seat]; let best = null, bd = 1e9;
  for (const c of s.chunks) if (c.on) { const d = Math.abs(c.x - p.x) + Math.abs(c.y - y) * 0.55; if (d < bd) { bd = d; best = c; } }
  return best;
}
function wreck(s, seat, x, y) {
  const p = s[seat]; if (!p.alive) return;
  p.alive = 0; p.lives = 0; s.mo = 42; burst(s, x, y, seat === 'you' ? '#7ef6ff' : '#c4b0ff', 48, true); s.cue = 'boom';
}
export function tick(s, input = {}) {
  if (s.phase === 'over') return s;
  s.clock++; s.sfx = 0; s.cue = '';
  if (s.phase === 'title') { if (input.fire || input.flap || input.auto || input.step) s.phase = 'play'; return s; }
  s.tick++;
  const wave = 1 + (s.tick / 480 | 0);
  if (wave !== s.wave) { s.wave = wave; s.banner = 54; s.boss = 0; }
  s.banner = Math.max(0, s.banner - 1);
  if (s.stop > 0) { s.stop--; s.shake *= 0.9; return s; }
  const slow = s.mo > 0; if (slow) s.mo--;
  s.shake = Math.max(0, s.shake * 0.86); s.flash = Math.max(0, s.flash - 1);
  if (s.combo.t > 0) s.combo.t--; else s.combo.you = s.combo.void = 0;
  const mine = nearest(s, 'you'), theirs = nearest(s, 'void');
  if (s.you.alive) {
    if (input.auto && mine) {
      const close = Math.abs(mine.y - YOU_Y) < 120 && Math.abs(mine.x - s.you.x) < mine.r + 50;
      steer(s, 'you', close ? s.you.x + (mine.x > s.you.x ? -160 : 160) : mine.x);
      if (!close && Math.abs(mine.x - s.you.x) < 36) shoot(s, 'you');
    } else if (Number.isFinite(input.x)) steer(s, 'you', input.x);
    else { if (input.left) s.you.vx -= 2.4; if (input.right) s.you.vx += 2.4; s.you.vx *= 0.84; s.you.x = clamp(s.you.x + s.you.vx, 48, W - 48); }
    if (input.fire || input.auto) shoot(s, 'you');
    if (s.tick % 2 === 0) s.bits.push({ x: s.you.x + (rng(s) - 0.5) * 10, y: YOU_Y + 18, vx: (rng(s) - 0.5), vy: 2.2, life: 14, size: 3, color: '#7ef6ff' });
  }
  if (s.void.alive && theirs) {
    const close = Math.abs(theirs.y - VOID_Y) < 110;
    steer(s, 'void', close ? s.void.x + (theirs.x > s.void.x ? -80 : 80) : theirs.x + 40);
    if (!close && Math.abs(theirs.x - s.void.x) < 40 && s.tick % 2 === 0) shoot(s, 'void');
    if (s.tick % 3 === 0) s.bits.push({ x: s.void.x, y: VOID_Y - 16, vx: 0, vy: -1.6, life: 12, size: 3, color: '#c4b0ff' });
  }
  s.you.cool = Math.max(0, s.you.cool - 1); s.void.cool = Math.max(0, s.void.cool - 1);
  s.you.inv = Math.max(0, s.you.inv - 1); s.void.inv = Math.max(0, s.void.inv - 1);
  s.you.spread = Math.max(0, s.you.spread - 1); s.void.spread = Math.max(0, s.void.spread - 1);
  const quiet = (s.tick % 240) < 36;
  s.why = s.boss ? 'a heavy crystal is in the lane' : quiet ? 'a breath before the next line' : 'the line is crossing';
  if (!quiet && s.tick % Math.max(7, 16 - s.wave) === 0) spawn(s, false);
  if (s.wave % 4 === 0 && !s.boss) spawn(s, true);
  const step = slow ? 0.35 : 1;
  for (const c of s.chunks) if (c.on) {
    c.x += c.vx * step; c.y += c.vy * step; c.spin += c.vr;
    if (c.y < 120 || c.y > H - 120) c.vy *= -0.85;
    if (s.tick % 70 === 0 && !c.boss && rng(s) < 0.3) c.vy = (rng(s) < 0.5 ? -1 : 1) * (1.4 + s.wave * 0.2);
    if (c.x < -80 || c.x > W + 80) c.on = 0;
  }
  for (const d of s.drops) { d.x += d.vx; d.y += 1.4; }
  for (const b of s.shots) if (b.on) {
    b.x += b.vx * step; b.y += b.vy * step; if (b.y < -20 || b.y > H + 20) b.on = 0;
    for (const c of s.chunks) if (c.on && b.on && Math.abs(b.x - c.x) < c.r && Math.abs(b.y - c.y) < c.r) {
      b.on = 0; c.hp--; const seat = b.seat;
      if (c.hp <= 0) {
        c.on = 0; s.combo[seat] = Math.min(12, s.combo[seat] + 1); s.combo.t = 80;
        const pts = (c.boss ? 40 : 10) * s.combo[seat]; s.score[seat] += pts;
        s.pops.push({ x: c.x, y: c.y, t: '+' + pts, life: 32 });
        burst(s, c.x, c.y, seat === 'you' ? '#7ef6ff' : '#c4b0ff', c.boss ? 36 : 14, !!c.boss);
        if (rng(s) < 0.16) s.drops.push({ x: c.x, y: c.y, vx: (rng(s) - 0.5) * 2, kind: rng(s) < 0.5 ? 'spread' : 'shield', on: 1 });
      } else burst(s, b.x, b.y, '#fff6d2', 6, false);
    }
  }
  const kiss = (seat, y) => {
    const p = s[seat]; if (!p.alive || p.inv) return;
    for (const c of s.chunks) if (c.on && Math.abs(c.x - p.x) < c.r + 18 && Math.abs(c.y - y) < c.r + 16) {
      if (p.shield) { p.shield = 0; c.on = 0; burst(s, p.x, y, '#d8fff8', 16, false); return; }
      c.on = 0; p.lives--; p.inv = 40; burst(s, c.x, c.y, '#ff8d7a', 18, true);
      if (p.lives <= 0) wreck(s, seat, p.x, y);
    }
    for (const d of s.drops) if (d.on && Math.abs(d.x - p.x) < 28 && Math.abs(d.y - y) < 28) {
      d.on = 0; if (d.kind === 'spread') p.spread = 420; else p.shield = 1; s.cue = 'shot'; s.sfx = 1;
    }
  };
  kiss('you', YOU_Y); kiss('void', VOID_Y);
  for (const bit of s.bits) { bit.x += bit.vx; bit.y += bit.vy; bit.life--; }
  for (const p of s.pops) { p.y -= 1.1; p.life--; }
  s.shots = s.shots.filter((b) => b.on); s.chunks = s.chunks.filter((c) => c.on);
  s.bits = s.bits.filter((b) => b.life > 0); s.pops = s.pops.filter((p) => p.life > 0); s.drops = s.drops.filter((d) => d.on && d.y < H + 20);
  if ((s.tick >= MATCH || (!s.you.alive && !s.void.alive)) && s.mo === 0) {
    s.phase = 'over';
    s.over = s.score.you === s.score.void ? 'draw' : s.score.you > s.score.void ? 'you' : 'void';
    s.why = s.tick >= MATCH ? 'the run is over' : 'both ships are gone';
  }
  return s;
}
export function selfPlay(seed, cap = 6000) {
  const s = create(seed); while (s.phase !== 'over' && s.tick < cap) tick(s, { auto: true, fire: true });
  return { over: s.over, tick: s.tick, score: { you: s.score.you, void: s.score.void } };
}
function hull(g, x, y, color, down, tick, shield) {
  g.save(); g.translate(x, y);
  const flame = 10 + (tick % 6) * 3;
  g.globalAlpha = 0.85; g.fillStyle = down ? '#b79bff' : '#7ef6ff';
  g.beginPath(); g.moveTo(0, down ? -flame - 8 : flame + 8); g.lineTo(7, down ? -6 : 6); g.lineTo(-7, down ? -6 : 6); g.fill();
  g.globalAlpha = 1; g.fillStyle = '#1a1030'; g.strokeStyle = color; g.lineWidth = 3; g.shadowColor = color; g.shadowBlur = 18;
  g.beginPath();
  g.moveTo(0, down ? 26 : -26); g.lineTo(28, down ? -8 : 8); g.lineTo(16, down ? -16 : 16); g.lineTo(0, down ? -6 : 6); g.lineTo(-16, down ? -16 : 16); g.lineTo(-28, down ? -8 : 8); g.closePath(); g.fill(); g.stroke();
  g.shadowBlur = 0; g.fillStyle = down ? '#efe8ff' : '#e7fffd'; g.beginPath(); g.ellipse(0, down ? 4 : -4, 7, 10, 0, 0, 7); g.fill();
  g.fillStyle = color; g.fillRect(-34, down ? -4 : -2, 14, 5); g.fillRect(20, down ? -4 : -2, 14, 5);
  if (shield) { g.strokeStyle = '#d8fff8'; g.globalAlpha = 0.8; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.stroke(); }
  g.restore();
}
function crystal(g, c) {
  g.save(); g.translate(c.x, c.y); g.rotate(c.spin);
  const col = c.boss ? '#ffb15a' : '#f0c36a';
  g.fillStyle = col; g.shadowColor = col; g.shadowBlur = c.boss ? 28 : 16;
  g.beginPath(); g.moveTo(0, -c.r); g.lineTo(c.r * 0.55, -c.r * 0.15); g.lineTo(c.r * 0.4, c.r * 0.85); g.lineTo(0, c.r * 0.45); g.lineTo(-c.r * 0.4, c.r * 0.85); g.lineTo(-c.r * 0.55, -c.r * 0.15); g.closePath(); g.fill();
  g.shadowBlur = 0; g.fillStyle = 'rgba(255,250,230,.85)'; g.beginPath(); g.moveTo(0, -c.r * 0.7); g.lineTo(c.r * 0.16, 0); g.lineTo(0, c.r * 0.35); g.lineTo(-c.r * 0.16, 0); g.fill();
  if (c.boss) { g.strokeStyle = '#fff6d2'; g.globalAlpha = 0.7; g.lineWidth = 2; g.stroke(); }
  g.restore();
}
export function draw(g, s) {
  s.anim = (s.anim || 0) + 1;
  if (s.cue && typeof window !== 'undefined') hear(s.cue);
  g.save();
  g.translate((Math.sin(s.clock * 1.7) * s.shake) | 0, (Math.cos(s.clock * 1.3) * s.shake) | 0);
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#140c30'); bg.addColorStop(0.55, '#09071a'); bg.addColorStop(1, '#05040e');
  g.fillStyle = bg; g.fillRect(-30, -30, W + 60, H + 60);
  for (const st of s.stars) {
    g.globalAlpha = st.a; g.fillStyle = st.layer === 2 ? '#ffffff' : '#b7a6e6';
    const x = (st.x + s.clock * st.z * (0.4 + st.layer)) % W;
    g.fillRect(x, st.y, st.layer + 1, st.layer + 1);
  }
  g.globalAlpha = 1;
  if (s.flash) { g.fillStyle = 'rgba(255,220,200,' + (s.flash / 28) + ')'; g.fillRect(0, 0, W, H); }
  for (const c of s.chunks) crystal(g, c);
  for (const d of s.drops) {
    g.save(); g.translate(d.x, d.y); g.fillStyle = d.kind === 'spread' ? '#7ef6ff' : '#d8fff8'; g.shadowColor = g.fillStyle; g.shadowBlur = 16;
    g.beginPath(); g.arc(0, 0, 11, 0, 7); g.fill(); g.restore();
  }
  for (const bit of s.bits) { g.globalAlpha = Math.max(0, bit.life / 30); g.fillStyle = bit.color; g.fillRect(bit.x, bit.y, bit.size, bit.size); }
  g.globalAlpha = 1;
  for (const p of s.pops) { g.globalAlpha = Math.max(0, p.life / 32); g.fillStyle = '#fff'; g.font = '700 22px ui-sans-serif, system-ui, sans-serif'; g.fillText(p.t, p.x - 16, p.y); }
  g.globalAlpha = 1;
  for (const b of s.shots) {
    g.strokeStyle = b.seat === 'you' ? '#d8fffb' : '#efe6ff'; g.lineWidth = 3; g.shadowColor = g.strokeStyle; g.shadowBlur = 12;
    g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx, b.y - b.vy * 0.7); g.stroke();
    g.shadowBlur = 0; g.fillStyle = '#fff'; g.beginPath(); g.arc(b.x, b.y, 3, 0, 7); g.fill();
  }
  if (s.void.alive && !(s.void.inv && s.clock % 4 < 2)) hull(g, s.void.x, VOID_Y, '#b79bff', true, s.clock, s.void.shield);
  if (s.you.alive && !(s.you.inv && s.clock % 4 < 2)) hull(g, s.you.x, YOU_Y, '#4fe3e3', false, s.clock, s.you.shield);
  hud(g, s);
  if (s.banner > 10 && s.phase === 'play') {
    g.globalAlpha = Math.min(1, s.banner / 24); g.fillStyle = '#f4f1ea'; g.font = '700 42px ui-sans-serif, system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(s.boss ? 'HEAVY CRYSTAL' : 'WAVE ' + s.wave, W / 2, H / 2); g.textAlign = 'left'; g.globalAlpha = 1;
  }
  if (s.phase === 'title') plate(g, 'DEBRIS FIELD', 'Drag or arrows to slide. Hold to fire.', 1);
  if (s.phase === 'over') plate(g, s.over === 'you' ? 'YOU WIN' : s.over === 'void' ? 'VERSE WINS' : 'DRAW', 'you ' + s.score.you + '    Verse ' + s.score.void + '    ·    space or tap to play again', Math.min(1, s.anim / 18));
  g.restore();
}
function hud(g, s) {
  g.fillStyle = 'rgba(8,6,18,.45)'; g.fillRect(24, 18, 280, 36); g.fillRect(W - 304, 18, 280, 36);
  g.fillStyle = '#f4f1ea'; g.font = '600 20px ui-sans-serif, system-ui, sans-serif';
  g.fillText('YOU  ' + s.score.you, 36, 42); g.textAlign = 'right'; g.fillText(s.score.void + '  VERSE', W - 36, 42); g.textAlign = 'left';
  pips(g, 36, H - 36, s.you.lives, '#4fe3e3'); pips(g, W - 120, H - 36, s.void.lives, '#b79bff');
  if (s.you.spread > 0) { g.fillStyle = '#7ef6ff'; g.font = '14px ui-sans-serif, system-ui, sans-serif'; g.fillText('SPREAD', 36, H - 48); }
}
function pips(g, x, y, n, color) { g.fillStyle = color; for (let i = 0; i < 4; i++) { g.globalAlpha = i < n ? 1 : 0.25; g.fillRect(x + i * 22, y, 14, 6); } g.globalAlpha = 1; }
function plate(g, title, sub, fade) {
  g.globalAlpha = 0.62 * fade; g.fillStyle = '#07060f'; g.fillRect(0, H / 2 - 90, W, 180);
  g.globalAlpha = fade; g.fillStyle = '#f4f1ea'; g.font = '700 64px ui-sans-serif, system-ui, sans-serif'; g.textAlign = 'center';
  g.fillText(title, W / 2, H / 2 - 6); g.font = '22px ui-sans-serif, system-ui, sans-serif'; g.fillStyle = '#4fe3e3';
  g.fillText(sub, W / 2, H / 2 + 36); g.textAlign = 'left'; g.globalAlpha = 1;
}
function hear(kind) {
  try {
    if (localStorage.getItem('a2m.void.arcade.sound.v1') !== '1') return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    hear.ac = hear.ac || new AC();
    const o = hear.ac.createOscillator(), gn = hear.ac.createGain();
    o.type = kind === 'boom' ? 'sawtooth' : 'square';
    o.frequency.value = kind === 'boom' ? 90 : 680;
    gn.gain.value = kind === 'boom' ? 0.06 : 0.03; o.connect(gn); gn.connect(hear.ac.destination);
    o.start(); o.stop(hear.ac.currentTime + (kind === 'boom' ? 0.18 : 0.03));
  } catch (_) { /* silent without audio */ }
}
export const how = 'Drag or the arrow keys slide your ship. Hold to fire. Crystals cross in waves, some dive, and every fourth wave brings a heavy crystal. A cyan orb spreads your shots. A pale orb is a shield. Three lives sit under the score, on the picture. The higher score at the end of the run wins.';
