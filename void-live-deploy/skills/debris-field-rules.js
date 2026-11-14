/** Debris Field: one ship, free movement, everything on the field comes for you. Verse is a ghost score. */
export const id = 'debris-field', W = 1280, H = 720, fly = true, stick = 'fly';
const rng = (s) => { s.n = (Math.imul(s.n, 1664525) + 1013904223) >>> 0; return s.n / 4294967296; };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const hypot = (x, y) => Math.hypot(x, y) || 1;
function blank(seed) {
  const s = {
    n: (seed >>> 0) || 1, tick: 0, clock: 0, phase: 'title', over: null, why: '', anim: 0, ghost: 0,
    you: { x: W / 2, y: H / 2, vx: 0, vy: 0, lives: 3, cool: 0, inv: 0, dash: 0, spread: 0, shield: 0, alive: 1, aim: 0 },
    shots: [], foes: [], bits: [], pops: [], drops: [], stars: [],
    score: { you: 0 }, mult: 1, chain: 0, shake: 0, stop: 0, mo: 0, wave: 1, banner: 0, boss: 0, flash: 0, sfx: 0, cue: '',
  };
  for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 36; i++) s.stars.push({ x: rng(s) * W, y: rng(s) * H, z: 0.2 + layer * 0.5, a: 0.18 + layer * 0.2, layer });
  return s;
}
function edge(s) {
  const k = rng(s) * 4 | 0, u = rng(s);
  if (k === 0) return { x: u * W, y: -40 };
  if (k === 1) return { x: W + 40, y: u * H };
  if (k === 2) return { x: u * W, y: H + 40 };
  return { x: -40, y: u * H };
}
function burst(s, x, y, color, n, big) {
  for (let i = 0; i < n && s.bits.length < 180; i++) {
    const a = rng(s) * 6.28, sp = (big ? 2.4 : 0.7) + rng(s) * (big ? 7 : 3.2);
    s.bits.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (big ? 32 : 14) + (rng(s) * 18 | 0), size: big ? 4 + (rng(s) * 6 | 0) : 2, color });
  }
  s.shake = Math.min(big ? 26 : 14, s.shake + (big ? 16 : 7));
  s.stop = big ? 10 : 4; s.flash = big ? 12 : 5; s.cue = big ? 'boom' : 'shot'; s.sfx = 1;
}
function spawn(s, kind, at) {
  if (!at && kind !== 'boss' && s.foes.length > 16) return;
  const boss = kind === 'boss';
  const p = boss ? { x: W / 2, y: 250 } : (at || edge(s));
  const r = boss ? 88 : kind === 'shard' || kind === 'bolt' ? 9 : kind === 'dart' ? 12 : 18 + (rng(s) * 8 | 0);
  const f = { ...p, r, kind, hp: boss ? 28 : kind === 'chase' || kind === 'split' ? 2 : 1, max: boss ? 28 : 2, spin: rng(s) * 6, vr: (rng(s) - 0.5) * 0.08, on: 1, vx: 0, vy: 0, pat: 0 };
  if (kind === 'dart') {
    const a = Math.atan2(s.you.y - f.y, s.you.x - f.x), sp = 4.6 + s.wave * 0.28;
    f.vx = Math.cos(a) * sp; f.vy = Math.sin(a) * sp;
  }
  if (kind === 'bolt' && at) { f.vx = at.vx; f.vy = at.vy; }
  s.foes.push(f);
  if (boss) { s.boss = 1; s.bossAt = s.tick; }
}
function nearest(s) {
  let best = null, bd = 1e9;
  for (const f of s.foes) if (f.on) { const d = hypot(f.x - s.you.x, f.y - s.you.y); if (d < bd) { bd = d; best = f; } }
  return best;
}
function shoot(s, ax, ay) {
  const p = s.you; if (!p.alive || p.cool > 0) return;
  const ang = Math.atan2(ay - p.y, ax - p.x); p.aim = ang;
  const fans = p.spread > 0 ? [-0.28, 0, 0.28] : [0];
  for (const o of fans) s.shots.push({ x: p.x + Math.cos(ang) * 26, y: p.y + Math.sin(ang) * 26, vx: Math.cos(ang + o) * 14, vy: Math.sin(ang + o) * 14, on: 1 });
  p.cool = p.spread > 0 ? 11 : 8; s.cue = 'shot'; s.sfx = 1;
}
function bossAct(s, f, step) {
  f.pat = (f.pat || 0) + 1;
  if (f.pat > 168) f.pat = 0;
  if (f.pat === 36) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.283 + f.spin;
      spawn(s, 'bolt', { x: f.x + Math.cos(a) * (f.r + 8), y: f.y + Math.sin(a) * (f.r + 8), vx: Math.cos(a) * 3.3, vy: Math.sin(a) * 3.3 });
    }
  }
  if (f.pat === 118) {
    const a = Math.atan2(s.you.y - f.y, s.you.x - f.x);
    f.cvx = Math.cos(a) * 7.4; f.cvy = Math.sin(a) * 7.4;
  }
  if (f.pat >= 104 && f.pat < 126) s.shake = Math.max(s.shake, 2.5 + (f.pat - 104) * 0.4);
  if (f.pat >= 126 && f.pat <= 156) {
    f.x += (f.cvx || 0) * step; f.y += (f.cvy || 0) * step;
    f.trail = (f.trail || []).concat({ x: f.x, y: f.y }).slice(-10);
    s.bits.push({ x: f.x - (f.cvx || 0) * 1.4, y: f.y - (f.cvy || 0) * 1.4, vx: -(f.cvx || 0) * 0.04, vy: -(f.cvy || 0) * 0.04, life: 18, size: 16, color: '#ffd7a4' });
  }
  else if (f.pat >= 104) { f.x += (s.you.x - f.x) * 0.004; f.y += (s.you.y - f.y) * 0.004; }
  else { f.trail = [];
    const d = hypot(s.you.x - f.x, s.you.y - f.y);
    f.x += (s.you.x - f.x) / d * 0.9 * step; f.y += (s.you.y - f.y) / d * 0.9 * step;
  }
  f.x = clamp(f.x, 100, W - 100); f.y = clamp(f.y, 110, H - 90);
  f.spin += f.pat >= 104 && f.pat < 126 ? 0.09 : 0.012;
}
function moveFoe(s, f, step) {
  if (f.kind === 'dart' || f.kind === 'bolt') { f.x += f.vx * step; f.y += f.vy * step; return; }
  if (f.kind === 'boss') return bossAct(s, f, step);
  const sp = f.kind === 'shard' ? 2.4 + s.wave * 0.08 : f.kind === 'split' ? 1.25 + s.wave * 0.05 : 1.55 + s.wave * 0.1;
  const d = hypot(s.you.x - f.x, s.you.y - f.y);
  f.vx = (s.you.x - f.x) / d * sp; f.vy = (s.you.y - f.y) / d * sp;
  f.x += f.vx * step; f.y += f.vy * step; f.spin += f.vr;
}
function threat(s, p) {
  let f = null, best = 1e9;
  for (const e of s.foes) if (e.on) {
    const d = hypot(e.x - p.x, e.y - p.y), w = e.kind === 'boss' ? d * 0.7 : e.kind === 'dart' || e.kind === 'bolt' ? d * 0.5 : d;
    if (w < best) { best = w; f = e; }
  }
  return { f, best };
}
function away(p, f) {
  if (f.kind === 'dart') {
    const px = -f.vy, py = f.vx, side = Math.sign((p.x - f.x) * px + (p.y - f.y) * py) || 1;
    return { ax: px * side, ay: py * side };
  }
  return { ax: p.x - f.x, ay: p.y - f.y };
}
function pilot(s, input) {
  const p = s.you; let ax = 0, ay = 0, scale = 1;
  const t = threat(s, p);
  if (input.bot === 'reckless') { ax = Math.sin(s.tick / 55); ay = Math.cos(s.tick / 80); scale = 0.16; }
  else if (input.bot === 'show') {
    if (!s.nicked && p.lives < 3) s.nicked = s.tick;
    const drop = s.nicked && !s.shown && (s.drops.find((d) => d.on && d.kind === 'shield') || s.drops.find((d) => d.on));
    if (!s.nicked) { ax = Math.sin(s.tick / 48); ay = Math.cos(s.tick / 70); scale = t.best < 55 ? 0.45 : 0.2; if (t.f && t.best < 55) { ax = away(p, t.f).ax; ay = away(p, t.f).ay; } }
    else if (s.tick < s.nicked + 100 && t.f) { ax = away(p, t.f).ax; ay = away(p, t.f).ay; }
    else if (drop && !(t.f && t.f.kind === 'dart' && t.best < 80)) { ax = drop.x - p.x; ay = drop.y - p.y; }
    else if (s.shown && s.tick > s.shownAt + 1200) { ax = Math.sin(s.tick / 30); ay = 0.1; scale = 0.08; }
    else if (t.f && t.best < 240) { ax = away(p, t.f).ax; ay = away(p, t.f).ay; }
    else { ax = Math.cos(s.tick / 24); ay = Math.sin(s.tick / 37); scale = 0.8; }
    if ((p.spread || p.shield) && !s.shown) { s.shown = 1; s.shownAt = s.tick; }
  } else if (input.bot === 'film') {
    const late = s.tick > 4200;
    if (late) { ax = Math.sin(s.tick / 26); ay = 0.2; scale = 0.08; }
    else if (t.f && t.best < 230) { ax = away(p, t.f).ax; ay = away(p, t.f).ay; }
    else { ax = Math.cos(s.tick / 22); ay = Math.sin(s.tick / 34); scale = 0.8; }
  } else if (input.bot === 'verse') {
    scale = 0.55;
    if (t.f && t.best < 100) { ax = p.x - t.f.x; ay = p.y - t.f.y; } else { ax = Math.cos(s.tick / 34); ay = Math.sin(s.tick / 51); }
  } else if (input.bot) {
    if (t.f && t.best < 260) { ax = away(p, t.f).ax; ay = away(p, t.f).ay; } else { ax = Math.cos(s.tick / 22); ay = Math.sin(s.tick / 33); scale = 0.85; }
  } else if (input.sx || input.sy) { ax = input.sx; ay = input.sy; }
  else { if (input.left) ax -= 1; if (input.right) ax += 1; if (input.up) ay -= 1; if (input.down) ay += 1; }
  const d = hypot(ax, ay);
  if (d) { p.vx += ax / d * 1.05 * scale; p.vy += ay / d * 1.05 * scale; }
  p.vx = clamp(p.vx * 0.88, -6.4, 6.4); p.vy = clamp(p.vy * 0.88, -6.4, 6.4);
  p.x = clamp(p.x + p.vx, 30, W - 30); p.y = clamp(p.y + p.vy, 30, H - 30);
}
function shock(s, power) {
  const p = s.you;
  for (const f of s.foes) if (f.on) {
    const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy) || 1;
    const reach = f.r + (f.kind === 'boss' ? 80 : 120);
    if (d < reach) { const push = (f.kind === 'boss' ? 28 : 14) * power; f.x += dx / d * push; f.y += dy / d * push; }
  }
  if (power > 1) for (let i = 0; i < 18; i++) {
    const a = i / 18 * 6.283;
    s.bits.push({ x: p.x, y: p.y, vx: Math.cos(a) * 8, vy: Math.sin(a) * 8, life: 18, size: 4, color: '#e7fffd' });
  }
}
function hurt(s) {
  const p = s.you;
  shock(s, 2);
  if (p.shield) { p.shield = 0; p.inv = 90; burst(s, p.x, p.y, '#d8fff8', 20, false); return; }
  p.lives--; p.inv = 90; s.chain = 0; s.mult = 1;
  burst(s, p.x, p.y, '#ff8d7a', 22, true);
  if (p.lives <= 0) { p.alive = 0; s.mo = 56; burst(s, p.x, p.y, '#7ef6ff', 56, true); s.cue = 'boom'; }
}
export function create(seed = 1) {
  const s = blank(seed);
  s.ghost = rival(seed);
  return s;
}
function rival(seed) {
  const s = blank(seed); let n = 0;
  while (s.phase !== 'over' && n < 4200) { tick(s, { bot: 'verse' }); n++; }
  return s.score.you;
}
export function tick(s, input = {}) {
  if (s.phase === 'over') return s;
  s.clock++; s.sfx = 0; s.cue = '';
  if (s.phase === 'title') { if (input.fire || input.flap || input.auto || input.bot || input.step || input.dash || input.left || input.right || input.up || input.down || input.sx || input.sy) s.phase = 'play'; return s; }
  s.tick++;
  if (input.bot === 'film' && s.tick % 70 === 20) input.dash = true;
  s.sx = input.sx || 0; s.sy = input.sy || 0;
  const wave = 1 + (s.tick / 620 | 0);
  if (wave !== s.wave) { s.wave = wave; s.banner = 50; s.boss = 0; }
  s.banner = Math.max(0, s.banner - 1);
  if (s.stop > 0) { s.stop--; s.shake *= 0.88; for (const b of s.bits) { b.x += b.vx * 0.2; b.y += b.vy * 0.2; b.life--; } return s; }
  const slow = s.mo > 0; if (slow) s.mo--;
  s.shake = Math.max(0, s.shake * 0.86); s.flash = Math.max(0, s.flash - 1);
  if (s.you.alive && !slow) pilot(s, input);
  if (s.you.alive && !slow && input.dash && s.you.dash <= 0) {
    const sp = Math.hypot(s.you.vx, s.you.vy);
    const ux = sp > 0.45 ? s.you.vx / sp : Math.cos(s.you.aim || -1.2);
    const uy = sp > 0.45 ? s.you.vy / sp : Math.sin(s.you.aim || -1.2);
    s.you.vx = ux * 17; s.you.vy = uy * 17; s.you.dash = 48;
    for (let i = 0; i < 10; i++) s.bits.push({ x: s.you.x, y: s.you.y, vx: -ux * (3 + i * 0.8), vy: -uy * (3 + i * 0.8), life: 16, size: 4, color: '#ffffff' });
    s.cue = 'shot'; s.sfx = 1;
  }
  s.you.dash = Math.max(0, s.you.dash - 1);
  if (s.you.alive && s.tick % 2 === 0) s.bits.push({ x: s.you.x - Math.cos(s.you.aim) * 20, y: s.you.y - Math.sin(s.you.aim) * 20, vx: -s.you.vx * 0.2, vy: -s.you.vy * 0.2, life: 12, size: 3, color: '#7ef6ff' });
  const foe = nearest(s);
  if (s.you.alive && !slow) {
    const mouse = !!(input.mouse && Number.isFinite(input.ax));
    const ax = mouse ? input.ax : foe ? foe.x : s.you.x + Math.cos(s.you.aim) * 120;
    const ay = mouse ? input.ay : foe ? foe.y : s.you.y + Math.sin(s.you.aim) * 120;
    if (mouse) s.you.aim = Math.atan2(ay - s.you.y, ax - s.you.x);
    if (!mouse || input.hold) shoot(s, ax, ay);
  }
  s.you.cool = Math.max(0, s.you.cool - 1); s.you.inv = Math.max(0, s.you.inv - 1); s.you.spread = Math.max(0, s.you.spread - 1);
  const quiet = (s.tick % 320) < 16;
  s.why = s.boss === 1 ? 'a heavy crystal has your track' : quiet ? 'a breath, then the next pattern' : 'they are closing from the edges';
  if (!quiet && s.you.alive && s.tick % Math.max(7, 20 - s.wave) === 0) {
    const roll = rng(s);
    const kind = s.wave >= 3 && roll < 0.34 ? 'dart' : s.wave >= 2 && roll < 0.6 ? 'split' : 'chase';
    spawn(s, kind);
  }
  if (s.you.alive && s.wave >= 3 && s.tick % 110 === 0) spawn(s, 'dart');
  if (s.you.alive && s.wave % 4 === 0 && !s.boss) spawn(s, 'boss');
  const step = slow ? 0.28 : 1;
  for (const f of s.foes) if (f.on) { moveFoe(s, f, step); if (f.kind !== 'boss' && (f.x < -140 || f.x > W + 140 || f.y < -140 || f.y > H + 140)) f.on = 0; }
  for (const b of s.shots) if (b.on) {
    b.x += b.vx * step; b.y += b.vy * step;
    if (b.x < -20 || b.y < -20 || b.x > W + 20 || b.y > H + 20) b.on = 0;
    for (const f of s.foes) if (f.on && b.on && hypot(b.x - f.x, b.y - f.y) < f.r) {
      b.on = 0; f.hp--;
      if (f.hp <= 0) {
        f.on = 0; s.chain++; s.mult = 1 + Math.min(9, s.chain * 0.5);
        const pts = Math.round((f.kind === 'boss' ? 400 : 10) * s.mult); s.score.you += pts;
        s.pops.push({ x: f.x, y: f.y - (f.kind === 'boss' ? 30 : 0), t: '+' + pts, life: f.kind === 'boss' ? 50 : 30 });
        if (f.kind === 'boss') { s.boss = 2; s.bits.splice(0, Math.max(0, s.bits.length - 30)); }
        burst(s, f.x, f.y, f.kind === 'boss' ? '#ffb15a' : '#7ef6ff', f.kind === 'boss' ? 80 : 12, f.kind === 'boss');
        if (f.kind === 'boss') burst(s, f.x, f.y, '#fff6d2', 40, true);
        if (f.kind === 'split') { spawn(s, 'shard', { x: f.x - 14, y: f.y }); spawn(s, 'shard', { x: f.x + 14, y: f.y }); }
        if (f.kind !== 'shard' && rng(s) < 0.22) s.drops.push({ x: f.x, y: f.y, vx: (rng(s) - 0.5) * 0.8, vy: (rng(s) - 0.5) * 0.8, kind: rng(s) < 0.5 ? 'spread' : 'shield', on: 1 });
      } else burst(s, b.x, b.y, '#fff6d2', 5, false);
    }
  }
  if (s.you.alive && s.you.inv) shock(s, 0.35);
  if (s.you.alive && !s.you.inv) {
    for (const f of s.foes) if (f.on && hypot(f.x - s.you.x, f.y - s.you.y) < f.r + (f.kind === 'boss' ? 8 : 18)) {
      if (f.kind !== 'boss') f.on = 0;
      hurt(s); break;
    }
    for (const d of s.drops) if (d.on && hypot(d.x - s.you.x, d.y - s.you.y) < 30) {
      d.on = 0; if (d.kind === 'spread') s.you.spread = 480; else s.you.shield = 1; s.cue = 'shot'; s.sfx = 1;
    }
  }
  for (const d of s.drops) { d.x += d.vx; d.y += d.vy; }
  for (const bit of s.bits) { bit.x += bit.vx * (slow ? 0.4 : 1); bit.y += bit.vy * (slow ? 0.4 : 1); bit.life--; }
  for (const p of s.pops) { p.y -= 1; p.life--; }
  s.shots = s.shots.filter((b) => b.on); s.foes = s.foes.filter((f) => f.on);
  s.bits = s.bits.filter((b) => b.life > 0); s.pops = s.pops.filter((p) => p.life > 0); s.drops = s.drops.filter((d) => d.on);
  if (!s.you.alive && s.mo === 0) {
    s.phase = 'over'; s.anim = 0;
    s.over = s.score.you > s.ghost ? 'you' : s.score.you === s.ghost ? 'draw' : 'void';
    s.why = 'the run ends when the ship does';
  }
  return s;
}
export function play(seed, bot, cap = 14000) {
  const s = create(seed); while (s.phase !== 'over' && s.tick < cap) tick(s, { bot });
  return { over: s.over, tick: s.tick, score: s.score.you, ghost: s.ghost, lives: s.you.lives, powered: s.shown ? 1 : 0 };
}
export function selfPlay(seed, cap = 14000) {
  const r = play(seed, 'careful', cap);
  return { over: r.over, tick: r.tick, score: { you: r.score, void: r.ghost } };
}
function hull(g, x, y, aim, tick, shield) {
  g.save(); g.translate(x, y); g.rotate(aim);
  g.fillStyle = '#7ef6ff'; g.globalAlpha = 0.8; g.beginPath(); g.moveTo(-20, 0); g.lineTo(-34, 8); g.lineTo(-34, -8); g.fill();
  g.globalAlpha = 1; g.fillStyle = '#141028'; g.strokeStyle = '#4fe3e3'; g.lineWidth = 3; g.shadowColor = '#4fe3e3'; g.shadowBlur = 16;
  g.beginPath(); g.moveTo(20, 0); g.lineTo(8, 13); g.lineTo(-16, 15); g.lineTo(-22, 6); g.lineTo(-22, -6); g.lineTo(-16, -15); g.lineTo(8, -13); g.closePath(); g.fill(); g.stroke();
  g.shadowBlur = 0; g.fillStyle = '#e7fffd'; g.beginPath(); g.ellipse(4, 0, 7, 5, 0, 0, 7); g.fill();
  g.fillStyle = '#4fe3e3'; g.fillRect(-10, -20, 16, 5); g.fillRect(-10, 15, 16, 5);
  if (shield) { g.strokeStyle = '#d8fff8'; g.globalAlpha = 0.9; g.beginPath(); g.arc(0, 0, 34, 0, 7); g.stroke(); }
  g.restore();
  void tick;
}
function foeDraw(g, f) {
  g.save(); g.translate(f.x, f.y); g.rotate(f.spin);
  if (f.kind === 'boss') {
    const wind = f.pat >= 104 && f.pat < 126;
    if (wind) { const k = (f.pat - 104) / 22; g.translate(Math.sin(f.pat * 1.8) * (3 + k * 7), Math.cos(f.pat * 2.2) * (3 + k * 7)); g.shadowBlur = 48 + k * 50; g.shadowColor = '#fff6d2'; }
    g.fillStyle = '#ffb15a'; g.shadowColor = wind ? '#fff6d2' : '#ffb15a'; if (!wind) g.shadowBlur = 36;
    g.beginPath(); g.moveTo(0, -f.r); g.lineTo(f.r * 0.55, -f.r * 0.35); g.lineTo(f.r * 0.85, f.r * 0.15); g.lineTo(f.r * 0.3, f.r); g.lineTo(-f.r * 0.35, f.r * 0.82); g.lineTo(-f.r * 0.8, f.r * 0.05); g.lineTo(-f.r * 0.45, -f.r * 0.45); g.closePath(); g.fill();
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,248,220,.95)'; g.beginPath(); g.moveTo(0, -f.r * 0.45); g.lineTo(f.r * 0.16, 0); g.lineTo(0, f.r * 0.38); g.lineTo(-f.r * 0.16, 0); g.fill();
    const crack = 1 - f.hp / f.max; g.strokeStyle = '#3a1a08'; g.lineWidth = 4;
    if (crack > 0.12) { g.beginPath(); g.moveTo(-8, -30); g.lineTo(22, 16); g.stroke(); }
    if (crack > 0.4) { g.beginPath(); g.moveTo(16, -36); g.lineTo(-24, 20); g.stroke(); }
    if (crack > 0.68) { g.beginPath(); g.moveTo(0, -50); g.lineTo(6, 44); g.stroke(); }
    if (f.pat >= 104 && f.pat < 126) { g.strokeStyle = '#fff6d2'; g.globalAlpha = 0.9; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, f.r + 14, 0, 7); g.stroke(); }
    g.restore();
    return;
  }
  const col = f.kind === 'bolt' ? '#ffd2a8' : f.kind === 'dart' ? '#ff7a8a' : f.kind === 'split' ? '#d2b0ff' : f.kind === 'shard' ? '#f2eeff' : '#f0c36a';
  g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 14;
  if (f.kind === 'dart' || f.kind === 'bolt') { g.beginPath(); g.moveTo(f.r + 8, 0); g.lineTo(-f.r, 7); g.lineTo(-f.r, -7); g.fill(); }
  else {
    g.beginPath(); g.moveTo(0, -f.r); g.lineTo(f.r * 0.62, -f.r * 0.1); g.lineTo(f.r * 0.35, f.r); g.lineTo(-f.r * 0.35, f.r); g.lineTo(-f.r * 0.62, -f.r * 0.1); g.closePath(); g.fill();
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,250,230,.9)'; g.beginPath(); g.moveTo(0, -f.r * 0.62); g.lineTo(f.r * 0.14, 0); g.lineTo(0, f.r * 0.4); g.lineTo(-f.r * 0.14, 0); g.fill();
  }
  g.restore();
}
export function draw(g, s) {
  s.anim = (s.anim || 0) + 1;
  if (g.canvas) {
    const bossOn = s.foes.find((f) => f.on && f.kind === 'boss');
    const tag = (s.mo > 0 ? 'mo' : s.phase) + s.you.lives + (s.you.shield ? 's' : '') + (bossOn ? 'B' : '') + (bossOn && bossOn.pat >= 104 && bossOn.pat < 126 ? 'W' : '') + (bossOn && bossOn.pat >= 126 ? 'C' : '') + (s.you.dash > 36 ? 'D' : '');
    if (g.canvas.dataset.tag !== tag) g.canvas.dataset.tag = tag;
  }
  if (s.cue && typeof window !== 'undefined') hear(s.cue);
  g.save();
  g.translate((Math.sin(s.clock * 1.8) * s.shake) | 0, (Math.cos(s.clock) * s.shake) | 0);
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#120a2c'); bg.addColorStop(1, '#05040e');
  g.fillStyle = bg; g.fillRect(-40, -40, W + 80, H + 80);
  for (const st of s.stars) {
    const speed = 0.03 + st.layer * 0.045;
    const dx = (st.x - s.clock * speed) % W; const dy = (st.y - s.clock * speed * 0.22) % H;
    g.globalAlpha = st.a; g.fillStyle = st.layer === 2 ? '#fff' : '#b7a6e6';
    g.fillRect(dx < 0 ? dx + W : dx, dy < 0 ? dy + H : dy, st.layer + 1, st.layer + 1);
  }
  g.globalAlpha = 1;
  if (s.flash) { g.fillStyle = 'rgba(255,210,190,' + (s.flash / 26) + ')'; g.fillRect(0, 0, W, H); }
  for (const f of s.foes) if (f.kind === 'boss' && f.trail) for (let i = 0; i < f.trail.length; i++) {
    const p = f.trail[i]; g.globalAlpha = 0.18 + (i + 1) / f.trail.length * 0.55; g.fillStyle = '#ffb15a';
    g.beginPath(); g.arc(p.x, p.y, f.r * 0.7, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  for (const f of s.foes) foeDraw(g, f);
  const boss = s.foes.find((f) => f.on && f.kind === 'boss');
  if (boss) {
    const bw = boss.r * 2;
    g.fillStyle = 'rgba(8,6,18,.75)'; g.fillRect(boss.x - bw / 2 - 3, boss.y - boss.r - 22, bw + 6, 12);
    g.fillStyle = '#ffb15a'; g.fillRect(boss.x - bw / 2, boss.y - boss.r - 19, bw * boss.hp / boss.max, 6);
    g.fillStyle = 'rgba(8,6,18,.72)'; g.fillRect(W / 2 - 150, 70, 300, 22);
    g.fillStyle = '#ffb15a'; g.fillRect(W / 2 - 146, 74, 292 * boss.hp / boss.max, 14);
  }
  for (const d of s.drops) {
    g.save(); g.translate(d.x, d.y); g.fillStyle = d.kind === 'spread' ? '#7ef6ff' : '#d8fff8'; g.shadowColor = g.fillStyle; g.shadowBlur = 16;
    g.beginPath(); g.arc(0, 0, 12, 0, 7); g.fill(); g.restore();
  }
  for (const bit of s.bits) { g.globalAlpha = Math.max(0, bit.life / 28); g.fillStyle = bit.color; g.fillRect(bit.x, bit.y, bit.size, bit.size); }
  g.globalAlpha = 1;
  for (const p of s.pops) { g.globalAlpha = Math.max(0, p.life / 30); g.fillStyle = '#fff'; g.font = '700 22px ui-sans-serif, system-ui, sans-serif'; g.fillText(p.t, p.x - 14, p.y); }
  g.globalAlpha = 1;
  for (const b of s.shots) {
    g.strokeStyle = '#e9fffd'; g.lineWidth = 3; g.shadowColor = '#7ef6ff'; g.shadowBlur = 12;
    g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - b.vx * 0.6, b.y - b.vy * 0.6); g.stroke();
    g.shadowBlur = 0; g.fillStyle = '#fff'; g.beginPath(); g.arc(b.x, b.y, 2.5, 0, 7); g.fill();
  }
  if (s.you.alive && s.phase !== 'title' && !(s.you.inv && s.clock % 4 < 2)) hull(g, s.you.x, s.you.y, s.you.aim, s.clock, s.you.shield);
  stickRing(g, s);
  hud(g, s);
  if (s.banner > 8 && s.phase === 'play') {
    g.globalAlpha = Math.min(1, s.banner / 22); g.textAlign = 'center'; g.fillStyle = '#f4f1ea'; g.font = '700 40px ui-sans-serif, system-ui, sans-serif';
    g.fillText(s.boss ? 'HEAVY CRYSTAL' : 'WAVE ' + s.wave, W / 2, 120); g.textAlign = 'left'; g.globalAlpha = 1;
  }
  if (s.phase === 'title') plate(g, 'DEBRIS FIELD', 'Arrows move. Hold the button to fire. Shift or space dashes.', 1);
  if (s.phase === 'over') endCard(g, s, Math.min(1, s.anim / 16));
  g.restore();
}
function stickRing(g, s) {
  g.strokeStyle = 'rgba(79,227,227,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(150, H - 150, 54, 0, 7); g.stroke();
  g.fillStyle = 'rgba(79,227,227,.45)'; g.beginPath(); g.arc(150 + (s.sx || 0) * 36, H - 150 + (s.sy || 0) * 36, 16, 0, 7); g.fill();
}
function hud(g, s) {
  g.fillStyle = 'rgba(8,6,18,.5)'; g.fillRect(24, 18, 360, 44); g.fillRect(W - 460, 18, 250, 44);
  g.fillStyle = '#f4f1ea'; g.font = '600 22px ui-sans-serif, system-ui, sans-serif';
  g.fillText('YOU  ' + s.score.you + '   ×' + s.mult.toFixed(1), 36, 48);
  g.textAlign = 'right'; g.fillText('VERSE  ' + s.ghost, W - 220, 48); g.textAlign = 'left';
  for (let i = 0; i < 3; i++) {
    if (i < s.you.lives) { g.globalAlpha = 1; g.fillStyle = '#4fe3e3'; g.fillRect(36 + i * 28, H - 40, 18, 7); }
    else { g.globalAlpha = 0.7; g.strokeStyle = '#4fe3e3'; g.lineWidth = 2; g.strokeRect(36.5 + i * 28, H - 39.5, 17, 6); }
  }
  g.globalAlpha = 1;
  g.fillStyle = s.you.dash > 0 ? 'rgba(79,227,227,.45)' : '#7ef6ff';
  g.fillRect(W - 230, H - 40, 70 * (s.you.dash > 0 ? Math.max(0.08, 1 - s.you.dash / 48) : 1), 7);
  g.fillStyle = '#d8fff8'; g.font = '14px ui-sans-serif, system-ui, sans-serif'; g.fillText(s.you.dash > 0 ? 'DASH' : 'DASH READY', W - 230, H - 48);
}
function deviceBest() {
  try { const b = JSON.parse(localStorage.getItem('a2m.void.arcade.best.v1') || '{}'); return b['debris-field'] || 0; } catch (_) { return 0; }
}
function endCard(g, s, fade) {
  const best = Math.max(deviceBest(), s.score.you || 0);
  g.globalAlpha = 0.72 * fade; g.fillStyle = '#07060f'; g.fillRect(0, H / 2 - 168, W, 336);
  g.globalAlpha = fade; g.textAlign = 'center'; g.fillStyle = '#f4f1ea'; g.font = '700 60px ui-sans-serif, system-ui, sans-serif';
  g.fillText(s.over === 'you' ? 'YOU BEAT VERSE' : 'RUN OVER', W / 2, H / 2 - 88);
  g.font = '600 28px ui-sans-serif, system-ui, sans-serif'; g.fillStyle = '#7ef6ff'; g.fillText('You  ' + s.score.you, W / 2, H / 2 - 28);
  g.fillStyle = '#d2b0ff'; g.fillText('Verse  ' + s.ghost, W / 2, H / 2 + 14);
  g.fillStyle = '#f4f1ea'; g.fillText('Best  ' + best, W / 2, H / 2 + 56);
  g.fillStyle = '#4fe3e3'; g.font = '22px ui-sans-serif, system-ui, sans-serif'; g.fillText('space or tap to play again', W / 2, H / 2 + 108);
  g.textAlign = 'left'; g.globalAlpha = 1;
}
function plate(g, title, sub, fade) {
  g.globalAlpha = 0.55 * fade; g.fillStyle = '#07060f'; g.fillRect(0, H / 2 - 100, W, 200);
  g.globalAlpha = fade; g.textAlign = 'center'; g.fillStyle = '#f4f1ea'; g.font = '700 64px ui-sans-serif, system-ui, sans-serif';
  g.fillText(title, W / 2, H / 2 - 8); g.font = '22px ui-sans-serif, system-ui, sans-serif'; g.fillStyle = '#4fe3e3';
  g.fillText(sub, W / 2, H / 2 + 40); g.textAlign = 'left'; g.globalAlpha = 1;
}
function hear(kind) {
  try {
    if (localStorage.getItem('a2m.void.arcade.sound.v1') !== '1') return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    hear.ac = hear.ac || new AC();
    const o = hear.ac.createOscillator(), gn = hear.ac.createGain();
    o.type = kind === 'boom' ? 'sawtooth' : 'square'; o.frequency.value = kind === 'boom' ? 80 : 640;
    gn.gain.value = kind === 'boom' ? 0.07 : 0.03; o.connect(gn); gn.connect(hear.ac.destination);
    o.start(); o.stop(hear.ac.currentTime + (kind === 'boom' ? 0.2 : 0.03));
  } catch (_) { /* silent */ }
}
export const how = 'One ship. Arrows or WASD move it. On a desktop the pointer aims and holding the button fires. A touch stick moves and the guns stay hot. Shift or space dashes, then it has to cool. Chasers, darts and splitters come in from every edge. A heavy crystal is the wave boss. Three lives, and a hit leaves you clear for a moment. A shield takes the hit that would have cost one. The multiplier climbs with kills and drops when you are hit. Verse is the ghost score for this field, not another ship.';
