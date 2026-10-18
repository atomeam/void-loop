// Pure logic of the small delights (owner, 2026-10-18, tools pack 8): confetti on a finished goal, a soft tick on keep, seasonal
// stage dust, an undo toast, the first-run tour, the card flip, stamps, sticky tape and rubber-band select. All opt-in; the
// DOM and sound parts live in skills/stage-fx.js and skills/card-play.js. Tests: tools/tools-pack-8.test.mjs.

const tidy = (s) => String(s || '').trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').toLowerCase();
const P = '(?:please\\s+)?';
const OFF = '(?:turn\\s+off|stop|disable|no\\s+more|switch\\s+off)';
const ON = '(?:turn\\s+on|start|enable|switch\\s+on|use|add)';

/** what an effects ask wants: { op, on?, season? } or null. Short anchored phrases, so "confetti recipe" is left alone. Pure. */
export function fxIntent(text) {
  const t = tidy(text);
  let m;
  if (new RegExp('^' + P + '(?:' + OFF + '\\s+(?:the\\s+)?(?:goal\\s+)?confetti|confetti\\s+off)$').test(t)) return { op: 'confetti', on: false };
  if (new RegExp('^' + P + '(?:(?:' + ON + '\\s+)?(?:the\\s+)?(?:goal\\s+)?confetti(?:\\s+(?:on|when\\s+i\\s+(?:finish|complete|reach)\\s+(?:a\\s+|my\\s+)?goals?))?|confetti\\s+when\\s+(?:i\\s+)?(?:finish|complete|reach)\\s+(?:a\\s+|my\\s+)?goals?)$').test(t)) return { op: 'confetti', on: true };
  if (new RegExp('^' + P + '(?:throw|shoot|pop|fire)\\s+(?:some\\s+)?confetti(?:\\s+now)?$|^confetti\\s+now$').test(t)) return { op: 'confetti-now' };
  if (new RegExp('^' + P + '(?:' + OFF + '\\s+(?:the\\s+)?(?:soft\\s+)?tick(?:\\s+sound)?(?:\\s+on\\s+keep)?|(?:soft\\s+)?tick(?:\\s+sound)?\\s+(?:on\\s+keep\\s+)?off)$').test(t)) return { op: 'tick', on: false };
  if (new RegExp('^' + P + '(?:(?:' + ON + '\\s+)?(?:a\\s+|the\\s+)?(?:soft\\s+)?tick(?:\\s+sound)?\\s+(?:on|when\\s+i)\\s+keep(?:\\s+(?:a\\s+card|something|this))?|(?:' + ON + '\\s+)(?:a\\s+|the\\s+)?(?:soft\\s+)?tick(?:\\s+sound)?(?:\\s+on)?|tick\\s+on\\s+keep)$').test(t)) return { op: 'tick', on: true };
  if (new RegExp('^' + P + '(?:' + OFF + '\\s+(?:the\\s+)?(?:stage\\s+|seasonal\\s+)?(?:dust|falling\\s+(?:leaves|snow|petals))|(?:stage\\s+|seasonal\\s+)?dust\\s+off|clear\\s+the\\s+dust)$').test(t)) return { op: 'dust', on: false };
  if ((m = new RegExp('^' + P + '(?:(?:' + ON + '\\s+)?(?:the\\s+)?(?:seasonal\\s+(?:stage\\s+)?dust|stage\\s+dust|dust\\s+on\\s+the\\s+stage|falling\\s+(leaves|snow|petals)|(winter|spring|summer|autumn|fall)\\s+(?:stage\\s+)?dust)(?:\\s+on)?)$').exec(t))) {
    const word = m[1] || m[2] || '';
    const season = { leaves: 'autumn', snow: 'winter', petals: 'spring', fall: 'autumn' }[word] || word || 'auto';
    return { op: 'dust', on: true, season };
  }
  if (new RegExp('^' + P + '(?:' + OFF + '\\s+(?:the\\s+)?undo\\s+toasts?|undo\\s+toasts?\\s+off)$').test(t)) return { op: 'toast', on: false };
  if (new RegExp('^' + P + '(?:(?:' + ON + '\\s+|show\\s+(?:me\\s+)?)?(?:an\\s+|the\\s+)?undo\\s+toasts?(?:\\s+on)?|show\\s+(?:me\\s+)?(?:an\\s+)?undo\\s+(?:button|toast)\\s+(?:when|after)\\s+(?:i\\s+)?(?:remove|delete|clear)(?:\\s+\\w+)?)$').test(t)) return { op: 'toast', on: true };
  if (new RegExp('^' + P + '(?:(?:give\\s+me|take|start|show\\s+me|begin|run)\\s+(?:a\\s+|the\\s+|my\\s+)?(?:first[\\s-]?run\\s+|quick\\s+|60[\\s-]?second\\s+)?(?:tour|walk[\\s-]?through\\s+of\\s+(?:the\\s+)?(?:stage|void|v01d|verse))|(?:first[\\s-]?run|quick)\\s+tour|(?:tour|show\\s+me\\s+around)(?:\\s+(?:the\\s+)?(?:stage|void))?)$').test(t)) return { op: 'tour' };
  return null;
}

/** ids of the things that count as a finished goal now: a list with every item ticked, a habit ring with every habit marked
 *  today. `things` is the stage's record, `today` is YYYY-MM-DD. Pure. */
export function completeIds(things, today) {
  const ids = [];
  for (const t of Object.values(things || {})) {
    if (!t) continue;
    if (t.kind === 'list' && Array.isArray(t.items) && t.items.length && t.items.every((i) => i && i.done)) ids.push(t.id);
    else if (t.kind === 'habits' && Array.isArray(t.habits) && t.habits.length && t.habits.every((h) => h && Array.isArray(h.days) && h.days.includes(today))) ids.push(t.id);
  }
  return ids;
}

/** what changed between two looks at the stage: { added, removed, done } (ids). `prev` and `cur` are { id: kind }; `doneNow` and
 *  `donePrev` are arrays of complete ids. Pure. */
export function stageDiff(prev, cur, donePrev, doneNow) {
  const p = prev || {}, c = cur || {};
  return {
    added: Object.keys(c).filter((id) => !(id in p)),
    removed: Object.keys(p).filter((id) => !(id in c)),
    done: (doneNow || []).filter((id) => !(donePrev || []).includes(id) && id in p), // an id that was there before and is now complete
  };
}

/** the season for a calendar month (0 to 11), by northern-hemisphere calendar. Pure. */
export const seasonOf = (month) => (month === 11 || month <= 1 ? 'winter' : month <= 4 ? 'spring' : month <= 7 ? 'summer' : 'autumn');

export const DUST = {
  winter: { colors: ['#ffffff', '#dbe9ff', '#c6dcff'], size: [1.5, 3.5], fall: [14, 34], sway: 12, shape: 'dot' },
  spring: { colors: ['#ffc2d9', '#ffd9e6', '#f7a8c8'], size: [3, 5], fall: [10, 24], sway: 22, shape: 'petal' },
  summer: { colors: ['#fff3a0', '#ffe66d', '#fffbd0'], size: [1.5, 3], fall: [-6, 6], sway: 18, shape: 'glow' },
  autumn: { colors: ['#e8893a', '#c9602a', '#d9a441'], size: [4, 7], fall: [16, 36], sway: 26, shape: 'petal' },
};

/** n dust specks placed by a seeded generator (deterministic, so the same dust can be tested). Pure. */
export function dustSpecks(season, n, w, h, rand) {
  const d = DUST[season] || DUST.winter, r = typeof rand === 'function' ? rand : Math.random;
  return Array.from({ length: n }, () => ({
    x: r() * w, y: r() * h, r: d.size[0] + r() * (d.size[1] - d.size[0]), vy: d.fall[0] + r() * (d.fall[1] - d.fall[0]), ph: r() * Math.PI * 2,
    c: d.colors[Math.floor(r() * d.colors.length)],
  }));
}

/** a small seeded random generator (mulberry32). Pure. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const CONFETTI_COLORS = ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#b794f6', '#ff9ec8'];
/** n confetti pieces burst from (cx, cy); speeds in px per second. Pure. */
export function confettiPieces(n, cx, cy, rand) {
  const r = typeof rand === 'function' ? rand : Math.random;
  return Array.from({ length: n }, () => {
    const a = -Math.PI / 2 + (r() - 0.5) * Math.PI * 0.9, sp = 260 + r() * 380;
    return { x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: r() * 6.28, vr: (r() - 0.5) * 12, w: 5 + r() * 6, h: 3 + r() * 4, c: CONFETTI_COLORS[Math.floor(r() * CONFETTI_COLORS.length)] };
  });
}
/** one step of a piece: gravity and drag. Pure (returns a new piece). */
export function confettiStep(p, dt) {
  const vx = p.vx * (1 - 1.4 * dt), vy = p.vy * (1 - 0.6 * dt) + 900 * dt;
  return { ...p, x: p.x + vx * dt, y: p.y + vy * dt, vx, vy, rot: p.rot + p.vr * dt };
}

export const TOUR = [
  { title: 'A blank stage', text: 'Type what you want in the box at the bottom and it appears here. Try "sticky note buy milk".' },
  { title: 'Move things', text: 'Drag a card to move it. Flick it hard off the edge and it is gone.' },
  { title: 'Take it back', text: 'Say "undo", or press Esc twice, and the last thing comes back.' },
  { title: 'Keep what you like', text: 'When something opens as a page, say "keep this" and it stays on the stage as a card.' },
  { title: 'Ask what I can do', text: 'Say "menu" for a list of things to try, or "what’s new" to see what Verse made lately.' },
];

/** the rectangle between two points. Pure. */
export function rectBetween(a, b) {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}
/** do two rectangles {x,y,w,h} overlap. Pure. */
export const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** the ids whose boxes touch the rubber band; a band under 6px either way selects nothing (a click is not a drag). Pure. */
export function pickedBy(band, boxes) {
  if (!band || band.w < 6 || band.h < 6) return [];
  return (boxes || []).filter((b) => overlaps(band, b)).map((b) => b.id);
}

/** what a card-play ask wants: { op, ... } or null. Pure. */
export function playIntent(text) {
  const t = tidy(text);
  let m;
  if (new RegExp('^' + P + 'flip\\s+(?:it|this|that|the|my|selected)(?:\\s+(?:card|note|thing|one))?(?:\\s+over)?$|^' + P + 'flip\\s+(?:the\\s+)?card$').test(t)) return { op: 'flip' };
  if ((m = new RegExp('^' + P + 'stamp\\s+(?:(?:it|this|that|the\\s+card|the\\s+note|this\\s+card)\\s+)?(?:as\\s+|with\\s+)?["“\']?(approved|rejected|paid|draft|done|urgent|confidential|void|received|checked|final|top\\s+secret)["”\']?$').exec(t))) return { op: 'stamp', word: m[1].replace(/\s+/g, ' ') };
  if ((m = /^(?:please\s+)?stamp\s+(?:it|this|that|the\s+card|this\s+card)\s+(?:as|with)\s+["“']?([a-z0-9][a-z0-9 !-]{0,15})["”']?$/.exec(t))) return { op: 'stamp', word: m[1].trim() };
  if (new RegExp('^' + P + '(?:remove|clear|take\\s+off|peel\\s+off|unstamp)\\s+(?:the\\s+|this\\s+|that\\s+)?stamps?(?:\\s+(?:off|from)\\s+(?:it|this|the\\s+card))?$|^unstamp(?:\\s+it)?$').test(t)) return { op: 'unstamp' };
  if (new RegExp('^' + P + '(?:' + OFF + '\\s+(?:the\\s+)?(?:sticky\\s+|note\\s+)?tape|(?:sticky\\s+|note\\s+)?tape\\s+off|peel\\s+(?:the\\s+)?tape\\s+off(?:\\s+my\\s+(?:notes|stickies))?|remove\\s+(?:the\\s+)?tape\\s+from\\s+(?:my\\s+)?(?:notes|stickies|stickys))$').test(t)) return { op: 'tape', on: false };
  if (new RegExp('^' + P + '(?:(?:' + ON + '\\s+|put\\s+)(?:some\\s+)?(?:sticky\\s+|note\\s+|washi\\s+)?tape(?:\\s+on\\s+(?:my\\s+|the\\s+)?(?:notes|stickies|stickys|sticky\\s+notes))?|tape\\s+(?:up\\s+)?(?:my\\s+|the\\s+)?(?:notes|stickies|stickys|sticky\\s+notes|sticky)|(?:sticky\\s+|note\\s+)?tape\\s+on|(?:sticky|note)\\s+tape)$').test(t)) return { op: 'tape', on: true };
  if (new RegExp('^' + P + '(?:' + OFF + '\\s+(?:the\\s+)?rubber[\\s-]?band(?:\\s+select(?:ion)?)?|rubber[\\s-]?band(?:\\s+select(?:ion)?)?\\s+off)$').test(t)) return { op: 'rubber', on: false };
  if (new RegExp('^' + P + '(?:(?:' + ON + '\\s+)?(?:the\\s+)?rubber[\\s-]?band(?:\\s+(?:multi[\\s-]?)?select(?:ion)?)?(?:\\s+on)?|drag\\s+to\\s+select(?:\\s+many)?|(?:select|pick)\\s+many\\s+(?:by\\s+)?dragging)$').test(t)) return { op: 'rubber', on: true };
  return null;
}

/** the colour and mood of a stamp word. Pure. */
export function stampStyle(word) {
  const w = String(word || '').toLowerCase();
  const good = /^(approved|paid|done|received|checked|final)$/.test(w), bad = /^(rejected|void|urgent)$/.test(w);
  return { text: w.toUpperCase().slice(0, 16), color: good ? '#1f9d55' : bad ? '#d1332e' : '#2b6cb0' };
}
