// Shared controls for a Studio arcade game (skills/*-rules.js): keyboard, touch, pause, sound, a new round,
// a daily seed, a best score on this device, and a link that carries the seed and the score.
// The card on the stage and the arcade page both call drive(). Nothing is sent anywhere.

export function asked(text, names) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const alt = names.map((n) => n.trim().toLowerCase().replace(/\s+/g, '\\s+')).join('|');
  return new RegExp('^(?:(?:let\'?s|lets|can we|i want to|wanna)\\s+)?(?:(?:play|start|open|new)\\s+)?(?:a\\s+)?(?:game\\s+of\\s+)?(?:' + alt + ')(?:\\s+game)?(?:\\s+(?:with|against|vs)\\s+(?:me|(?:verse|void)|you))?$').test(t);
}

export function daySeed(d = new Date()) {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

/** /arcade/?play=<id>&seed=<n>&score=<s> so a friend plays the same round. Pure. */
export function roundLink(id, seed, score, daily = false) {
  const q = new URLSearchParams();
  q.set('play', id);
  q.set('seed', String(seed >>> 0));
  if (score != null && Number.isFinite(+score)) q.set('score', String(Math.max(0, Math.floor(+score))));
  if (daily) q.set('daily', '1');
  return '/arcade/?' + q.toString();
}

const BEST = 'a2m.void.arcade.best.v1';
const SOUND = 'a2m.void.arcade.sound.v1';
const readBest = () => { try { return JSON.parse(localStorage.getItem(BEST) || '{}') || {}; } catch (_) { return {}; } };
const writeBest = (id, n) => { try { const b = readBest(); if (!(n > (b[id] || 0))) return b[id] || 0; b[id] = n; localStorage.setItem(BEST, JSON.stringify(b)); return n; } catch (_) { return n; } };
const soundOn = () => { try { return localStorage.getItem(SOUND) === '1'; } catch (_) { return false; } };

function beep(bag) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    bag.ac = bag.ac || new AC();
    const o = bag.ac.createOscillator(), g = bag.ac.createGain();
    o.frequency.value = 520; g.gain.value = 0.03; o.connect(g); g.connect(bag.ac.destination);
    o.start(); o.stop(bag.ac.currentTime + 0.04);
  } catch (_) { /* a browser with no audio keeps the game silent */ }
}

function btn(label, fn) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'g-btn'; b.textContent = label;
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  return b;
}

/**
 * card: { el, cv, ctx, status, why, again, start, local } from arcadeCard, or the same shape on the page.
 * game: { id, create, tick, draw, how }.
 */
export function drive(card, game, opt = {}) {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const linked = q.get('play') === game.id;
  let seed = linked && /^\d+$/.test(q.get('seed') || '') ? Number(q.get('seed')) : (opt.seed ?? ((Date.now() & 65535) || 1));
  let daily = linked && q.get('daily') === '1';
  if (daily) seed = daySeed();
  let s = game.create(seed >>> 0), paused = false, done = false, sound = soundOn();
  const held = { left: false, right: false, up: false, down: false };
  let edge = { flap: false, fire: false, dir: '' };
  const bag = {};
  const friend = linked && /^\d+$/.test(q.get('score') || '') ? Number(q.get('score')) : null;
  const stick = opt.stick === 'x'; // a game that slides on one axis: no directional pad, the pointer is the control
  if (opt.canvasHud) { if (card.status) card.status.remove(); if (card.why) card.why.remove(); card.status = card.why = null; }
  let heldFire = false;
  const tools = document.createElement('div');
  tools.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:6px';
  const pause = btn('Pause', () => { paused = !paused; pause.textContent = paused ? 'Resume' : 'Pause'; pause.setAttribute('aria-pressed', paused ? 'true' : 'false'); });
  const snd = btn(sound ? 'Sound off' : 'Sound on', () => {
    sound = !sound; snd.textContent = sound ? 'Sound off' : 'Sound on'; snd.setAttribute('aria-pressed', sound ? 'true' : 'false');
    try { localStorage.setItem(SOUND, sound ? '1' : '0'); } catch (_) {}
  });
  snd.setAttribute('aria-pressed', sound ? 'true' : 'false');
  const same = btn('Same round', () => restart(seed));
  const day = btn('Daily', () => { daily = true; restart(daySeed()); });
  const share = document.createElement('a');
  share.href = roundLink(game.id, seed, 0, daily); share.textContent = 'Share this round';
  share.style.cssText = 'font-size:13px;align-self:center';
  if (!stick) for (const dir of [['Left', 'left'], ['Right', 'right'], ['Up', 'up'], ['Down', 'down']]) {
    const b = btn(dir[0], () => {});
    b.addEventListener('pointerdown', () => { edge.dir = dir[1]; if (dir[1] === 'left' || dir[1] === 'right') edge.fire = true; edge.flap = true; });
    tools.append(b);
  }
  const act = btn('Act', () => { edge.flap = true; edge.fire = true; });
  tools.append(pause, snd, same, day);
  if (!stick) tools.append(act);
  tools.append(share);
  card.el.append(tools);
  const onKey = (e) => {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'a', 'arrowright', 'd', 'arrowup', 'w', 'arrowdown', 's', ' '].includes(k)) e.preventDefault();
    if (e.type === 'keydown' && !e.repeat) {
      if (k === 'arrowleft' || k === 'a') { held.left = true; edge.dir = 'left'; }
      else if (k === 'arrowright' || k === 'd') { held.right = true; edge.dir = 'right'; }
      else if (k === 'arrowup' || k === 'w') { held.up = true; edge.dir = 'up'; }
      else if (k === 'arrowdown' || k === 's') { held.down = true; edge.dir = 'down'; }
      else if (k === ' ') { if (stick) heldFire = true; else { edge.flap = true; edge.fire = true; } }
    } else if (e.type === 'keyup') {
      if (k === 'arrowleft' || k === 'a') held.left = false;
      else if (k === 'arrowright' || k === 'd') held.right = false;
      else if (k === 'arrowup' || k === 'w') held.up = false;
      else if (k === 'arrowdown' || k === 's') held.down = false;
      else if (k === ' ' && stick) heldFire = false;
    }
  };
  card.el.addEventListener('keydown', onKey);
  card.el.addEventListener('keyup', onKey);
  const point = (e) => {
    const p = card.local(e); edge.x = p.x; card.el.focus({ preventScroll: true });
    if (stick) heldFire = true; else { edge.flap = true; edge.fire = true; }
  };
  card.cv.addEventListener('pointerdown', point);
  card.cv.addEventListener('pointermove', (e) => { if (stick ? heldFire : e.buttons) edge.x = card.local(e).x; });
  if (stick) { const up = () => { heldFire = false; }; card.cv.addEventListener('pointerup', up); card.cv.addEventListener('pointercancel', up); card.cv.addEventListener('pointerleave', up); }
  function restart(next) {
    seed = next >>> 0; s = game.create(seed); done = false; paused = false; pause.textContent = 'Pause'; daily = seed === daySeed();
  }
  card.again.addEventListener('click', (e) => { e.stopPropagation(); restart((Date.now() & 65535) || 1); });
  card.start(() => {
    const dir = edge.dir || (held.left ? 'left' : held.right ? 'right' : held.up ? 'up' : held.down ? 'down' : '');
    const firing = edge.fire || edge.dir === 'up' || (stick && heldFire);
    if (!paused && s.over && stick && firing && (s.anim || 0) > 50) restart(seed);
    else if (!paused && !s.over) {
      game.tick(s, { flap: edge.flap || (stick && heldFire), fire: firing, step: !!edge.dir, left: held.left || edge.dir === 'left', right: held.right || edge.dir === 'right', dir, x: stick ? (heldFire ? edge.x : undefined) : edge.x });
      if (s.sfx && sound) beep(bag);
      edge = { flap: false, fire: false, dir: '', x: edge.x };
    }
    game.draw(card.ctx, s);
    const best = s.over ? writeBest(game.id, s.score.you) : (readBest()[game.id] || 0);
    if (card.status && !opt.canvasHud) {
      const end = s.over === 'you' ? 'You win' : s.over === 'void' ? 'Verse wins' : s.over === 'draw' ? 'A draw' : '';
      card.status.textContent = (end ? end + ' · ' : paused ? 'Paused · ' : '') + 'you ' + s.score.you + ' · Verse ' + s.score.void + (best ? ' · best ' + best : '') + (friend != null ? ' · a friend scored ' + friend + ' on this seed' : '') + (stick || s.over || paused ? '' : ' · step ' + s.tick);
    }
    if (card.why && !opt.canvasHud) card.why.textContent = s.why ? 'Verse: ' + s.why : '';
    share.href = roundLink(game.id, seed, s.score.you, daily);
    if (s.over && !done) { done = true; if (opt.onDone) opt.onDone(s.over); }
  });
}
