/**
 * layer skill: "bring the clock to the front", "send the note to the back", "send it to the back".
 * Stage things draw in the order they sit in `things` (last = on top), so layering is a reorder of that object.
 * Next #3 (grouped objects / layers), the z-order half. "put the clock on top" stays a position move (top of the screen).
 * Empty surface stays empty: nothing is added, and an ask on an empty stage only says so.
 */
const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();

const FRONT_END = String.raw`(?:to\s+the\s+(?:front|very\s+front|top\s+layer|foreground)|to\s+front|forward|frontward|in\s+front(?:\s+of\s+everything(?:\s+else)?)?|on\s+top\s+of\s+(?:everything|the\s+rest|the\s+others)(?:\s+else)?|above\s+(?:everything|the\s+rest|the\s+others)(?:\s+else)?)`;
const BACK_END = String.raw`(?:to\s+the\s+(?:back|very\s+back|bottom\s+layer|background)|to\s+back|backward|backwards|behind\s+(?:everything|the\s+rest|the\s+others)(?:\s+else)?|under(?:neath)?\s+(?:everything|the\s+rest|the\s+others)(?:\s+else)?|below\s+(?:everything|the\s+rest|the\s+others)(?:\s+else)?)`;
const FRONT_RE = new RegExp(String.raw`^(?:please\s+)?(?:bring|move|put|pull|place|send)\s+(.*?)\s*` + FRONT_END + '$');
const BACK_RE = new RegExp(String.raw`^(?:please\s+)?(?:send|move|put|push|place)\s+(.*?)\s*` + BACK_END + '$');

// Everyday names for each stage kind (the same words batch asks use), singular and plural.
export const KIND_WORDS = [
  ['notepad', /^notepads?$/],
  ['image', /^(?:images?|pictures?|photos?)$/],
  ['link', /^links?$/],
  ['kept', /^(?:cards?|maps?|weather|translations?|pages?)$/],
  ['sticky', /^(?:stick(?:y|ies)|sticky notes?|notes?)$/],
  ['list', /^(?:lists?|checklists?|to-?do lists?)$/],
  ['calc', /^(?:calcs?|calculators?)$/],
  ['timer', /^(?:timers?|countdowns?)$/],
  ['counter', /^counters?$/],
  ['shape', /^(?:shapes?|rect(?:angles?)?|squares?|circles?|lines?)$/],
  ['clock', /^clocks?$/],
];
const SELF = /^(?:|it|this|that|this one|that one|the selected one|selected|the selected thing|what i picked)$/;

/** Parse an ask into { where: 'front'|'back', target: 'selected' | { word, all } } or null. */
export function layerOf(text) {
  const t = CLEAN(text);
  let m = FRONT_RE.exec(t), where = 'front';
  if (!m) { m = BACK_RE.exec(t); where = 'back'; }
  if (!m) return null;
  let words = m[1].trim();
  if (where === 'front' && /^(?:it|this|that)?$/.test(words) && /\bsend\b/.test(t) && /\bforward\b/.test(t)) return null; // "send it forward" is a message, not a layer
  if (SELF.test(words)) return { where, target: 'selected' };
  const all = /^(?:all|every|each|both)\b/.test(words) || /^the\s+\w+s$/.test(words) && !/^the\s+(?:glass|grass|class)$/.test(words);
  words = words.replace(/^(?:all\s+(?:of\s+)?(?:the|my)\s+|all\s+|every\s+|each\s+|both\s+|the\s+|my\s+|that\s+|this\s+|those\s+|these\s+)/, '').trim();
  const kind = KIND_WORDS.find(([, re]) => re.test(words));
  if (kind) return { where, target: { kind: kind[0], word: words, all: all || /s$/.test(words) && !/^(?:weather|glass)$/.test(words) } };
  if (/^[a-z][a-z0-9 -]{1,30}$/.test(words) && words.split(' ').length <= 3) return { where, target: { kind: null, word: words, all } };
  return null;
}

/** Which ids an ask moves, given the stage in draw order. */
export function pickIds(order, target, selected, where) {
  const list = order.filter(Boolean);
  if (!list.length) return [];
  if (target === 'selected') {
    if (selected && list.some((t) => t.id === selected)) return [selected];
    return [list[list.length - 1].id]; // "it" = the newest / topmost thing
  }
  if (/^(?:group|grouped (?:things|ones|stuff|items)|bunch|cluster)$/.test(target.word)) { // "bring the group to the front": every member of the group (skills/group.js)
    const sel = list.find((t) => t.id === selected && t.group);
    const g = sel ? sel.group : list.filter((t) => t.group).map((t) => t.group).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).pop(); // newest group (text ids)
    return g ? list.filter((t) => t.group === g).map((t) => t.id) : [];
  }
  const w = target.word.replace(/s$/, '');
  const hits = list.filter((t) => (target.kind ? t.kind === target.kind : (t.kind === target.word || t.kind === w || String(t.name || t.title || '').toLowerCase() === target.word)));
  if (!hits.length) return [];
  if (target.all) return hits.map((t) => t.id);
  if (selected && hits.some((t) => t.id === selected)) return [selected];
  return [(where === 'front' ? hits[0] : hits[hits.length - 1]).id]; // the one the move would actually change
}

/** New draw order: moved ids go to the end (front) or start (back), keeping their own order. Pure. */
export function reorder(things, ids, where) {
  const keys = Object.keys(things || {});
  const move = keys.filter((k) => ids.includes(k)), rest = keys.filter((k) => !ids.includes(k));
  const order = where === 'front' ? [...rest, ...move] : [...move, ...rest];
  const changed = order.some((k, i) => k !== keys[i]);
  const out = {};
  for (const k of order) out[k] = things[k];
  return { things: out, changed, moved: move };
}

async function run(text, api) {
  const hit = layerOf(text);
  if (!hit) return 'none';
  const st = api.stage || {};
  const live = st.things ? st.things() : {};
  const order = Object.values(live);
  if (!order.length) { if (api.say) api.say('the void is empty · summon something first'); return 'layer'; }
  const ids = pickIds(order, hit.target, st.selected ? st.selected() : null, hit.where);
  if (!ids.length) { if (api.say) api.say(/^(?:group|grouped|bunch|cluster)/.test(hit.target.word) ? 'nothing is grouped yet · try "group the clock and the note"' : 'no ' + hit.target.word + ' on the stage'); return 'layer'; }
  const next = reorder(live, ids, hit.where);
  if (!next.changed) { if (api.say) api.say(hit.where === 'front' ? 'already in front' : 'already at the back'); return 'layer'; }
  for (const k of Object.keys(live)) delete live[k]; // same object the page holds: reinsert in the new draw order
  Object.assign(live, next.things);
  if (st.select && ids.length === 1) st.select(ids[0]);
  if (st.save) st.save();
  if (st.render) st.render();
  if (api.say) api.say(hit.where === 'front' ? (ids.length > 1 ? 'brought ' + ids.length + ' to the front' : 'brought to the front') : (ids.length > 1 ? 'sent ' + ids.length + ' to the back' : 'sent to the back'));
  return 'layer';
}

export default {
  name: 'layer',
  examples: ['bring the clock to the front', 'send the note to the back', 'bring it to the front', 'send it to the back',
    'move the timer behind everything', 'put the sticky in front of everything', 'bring all the notes to the front', 'send this to the back',
    'bring the group to the front', 'send the group to the back'],
  nearMisses: ['put the clock on top', 'move the clock to the top left', 'send it away', 'what is the front of a ship',
    'bring me a coffee', 'send an email to sam', 'send it forward'],
  layerOf,
  pickIds,
  reorder,
  match(lower, text) { return !!layerOf(text); },
  run,
  suite() {
    const s = { a: { id: 'a', kind: 'clock' }, b: { id: 'b', kind: 'sticky' }, c: { id: 'c', kind: 'sticky' } };
    const front = reorder(s, pickIds(Object.values(s), layerOf('bring the clock to the front').target, null, 'front'), 'front');
    const back = reorder(s, pickIds(Object.values(s), layerOf('send the notes to the back').target, null, 'back'), 'back');
    const it = pickIds(Object.values(s), 'selected', null, 'back');
    const same = reorder(s, ['c'], 'front');
    const ok = Object.keys(front.things).join('') === 'bca' && front.changed
      && Object.keys(back.things).join('') === 'bca' && back.moved.length === 2
      && it[0] === 'c' && same.changed === false
      && !layerOf('put the clock on top') && !layerOf('send it away') && layerOf('send it to the back').target === 'selected'
      && pickIds([], 'selected', null, 'front').length === 0;
    return { ok, got: ok ? 'front, back, it, no-op' : 'miss' };
  }
};
