/**
 * family-gravity skill — soft attraction between stage objects that share a kind.
 * "turn on family gravity", "family gravity off", "gravity only notes",
 * "gravity only cards", "is family gravity on".
 * Empty surface stays empty: with zero things the loop never starts.
 * Reuses stage.things / void:dropped patterns (see collide). Pure client-side.
 */

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

/** Parse ask → { action: 'on'|'off'|'status'|'kind', kind?: string } or null. */
export function gravityOf(text) {
  const t = CLEAN(text);
  if (/^(?:is\s+)?(?:family\s+)?gravity\s+on$/.test(t) || /^gravity\s+status$/.test(t)) {
    return { action: 'status' };
  }
  if (/^(?:turn\s+)?(?:family\s+)?gravity\s+off$/.test(t) || /^(?:stop|disable)\s+(?:family\s+)?gravity$/.test(t)) {
    return { action: 'off' };
  }
  if (/^(?:turn\s+on\s+)?family\s+gravity$/.test(t) || /^(?:enable|start)\s+(?:family\s+)?gravity$/.test(t) || /^family\s+gravity\s+on$/.test(t)) {
    return { action: 'on' };
  }
  const kindM = t.match(/^(?:family\s+)?gravity\s+only\s+(notes?|cards?|figures?|timers?|everything)$/);
  if (kindM) {
    let k = kindM[1];
    if (k === 'notes') k = 'note';
    if (k === 'cards') k = 'card';
    if (k === 'figures') k = 'figure';
    if (k === 'timers') k = 'timer';
    if (k === 'everything') k = null;
    return { action: 'kind', kind: k };
  }
  return null;
}

const STRENGTH = 0.04;   // pull factor per frame
const MAX_STEP = 4;      // px clamp so mobile stays calm
const RANGE = 420;       // only attract within this distance
const TICK_MS = 32;      // ~30 fps, light on battery

let lastStage = null;
let on = false;
let kindFilter = null;   // null = all kinds attract within their own kind
let timer = null;

export function decorate(st) {
  if (st && st.things) lastStage = st;
}

function familyKey(t) {
  if (!t) return '';
  if (kindFilter) return (t.kind === kindFilter || t.type === kindFilter) ? kindFilter : '';
  return String(t.kind || t.type || 'thing');
}

function boxesOf(st) {
  const out = [];
  const things = st.things ? st.things() : {};
  for (const t of Object.values(things)) {
    if (!t || !t.id) continue;
    if (t.kind === 'figure') continue; // 3D figures walk their own path
    const el = st.stage && st.stage.querySelector(
      '[data-id="' + (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(t.id) : t.id) + '"]'
    );
    if (!el) continue;
    const key = familyKey(t);
    if (!key) continue;
    out.push({
      id: t.id,
      key,
      el,
      x: el.offsetLeft + (el.offsetWidth || 0) / 2,
      y: el.offsetTop + (el.offsetHeight || 0) / 2,
      w: el.offsetWidth || 1,
      h: el.offsetHeight || 1,
    });
  }
  return out;
}

function step(st) {
  if (!on || !st || !st.stage) return;
  const boxes = boxesOf(st);
  if (boxes.length < 2) return; // empty or single → no pull

  const byKey = new Map();
  for (const b of boxes) {
    if (!byKey.has(b.key)) byKey.set(b.key, []);
    byKey.get(b.key).push(b);
  }

  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      let fx = 0, fy = 0;
      for (let j = 0; j < group.length; j++) {
        if (i === j) continue;
        const a = group[i], b = group[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist > RANGE || dist < 8) continue;
        const pull = STRENGTH * (1 - dist / RANGE);
        fx += (dx / dist) * pull * 12;
        fy += (dy / dist) * pull * 12;
      }
      fx = Math.max(-MAX_STEP, Math.min(MAX_STEP, fx));
      fy = Math.max(-MAX_STEP, Math.min(MAX_STEP, fy));
      if (Math.abs(fx) < 0.05 && Math.abs(fy) < 0.05) continue;
      const el = group[i].el;
      const nx = Math.round(el.offsetLeft + fx);
      const ny = Math.round(el.offsetTop + fy);
      el.style.left = nx + 'px';
      el.style.top = ny + 'px';
      // keep data in sync if the stage exposes a move helper
      if (typeof st.moveThing === 'function') st.moveThing(group[i].id, nx, ny);
    }
  }
}

function startLoop(st) {
  stopLoop();
  if (!on) return;
  const tick = () => {
    step(st || lastStage);
    timer = setTimeout(tick, TICK_MS);
  };
  timer = setTimeout(tick, TICK_MS);
}

function stopLoop() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function countThings(st) {
  if (!st || !st.things) return 0;
  return Object.keys(st.things() || {}).length;
}

async function run(text, api) {
  const want = gravityOf(text);
  if (!want) return 'none';

  const st = api.stage || lastStage;
  const n = countThings(st);

  if (want.action === 'status') {
    api.say(
      on
        ? 'family gravity is on' + (kindFilter ? ' (only ' + kindFilter + 's)' : '') +
          (n === 0 ? ' · stage is empty so nothing moves' : '')
        : 'family gravity is off'
    );
    return 'family-gravity';
  }

  if (want.action === 'off') {
    on = false;
    stopLoop();
    api.say('family gravity off');
    return 'family-gravity';
  }

  if (want.action === 'kind') {
    kindFilter = want.kind;
    on = true;
    if (n === 0) {
      api.say('family gravity on' + (kindFilter ? ' for ' + kindFilter + 's' : '') + ' · stage is empty, nothing moves yet');
    } else {
      startLoop(st);
      api.say('family gravity on' + (kindFilter ? ' — only ' + kindFilter + 's attract' : ' — same kinds attract'));
    }
    return 'family-gravity';
  }

  // on
  on = true;
  kindFilter = null;
  if (n === 0) {
    api.say('family gravity on · stage is empty, nothing moves yet');
  } else {
    startLoop(st);
    api.say('family gravity on · same kinds gently attract');
  }
  return 'family-gravity';
}

export default {
  name: 'family-gravity',
  decorate,
  examples: [
    'turn on family gravity',
    'family gravity off',
    'gravity only notes',
    'gravity only cards',
    'is family gravity on',
  ],
  nearMisses: [
    'what is gravity',
    'gravity on earth',
    'family health',
    'magnetize a printed motor',
    'any collisions',
  ],
  match(lower, text) {
    return !!gravityOf(text || lower);
  },
  run,
  gravityOf,
  suite() {
    const a = gravityOf('turn on family gravity');
    const b = gravityOf('family gravity off');
    const c = gravityOf('gravity only notes');
    const d = gravityOf('is family gravity on');
    const e = gravityOf('hello world');
    return {
      ok:
        !!a && a.action === 'on' &&
        !!b && b.action === 'off' &&
        !!c && c.action === 'kind' && c.kind === 'note' &&
        !!d && d.action === 'status' &&
        e === null,
    };
  },
};
