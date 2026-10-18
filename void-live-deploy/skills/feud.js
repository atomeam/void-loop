/**
 * feud skill - a blood feud between two things on the stage (owner, 2026-10-18, the Opposite Era; made with tools/new-skill.mjs).
 * "start a blood feud between the clock and the note": the two named things become rivals. Each second each drains the
 * other's life bar, by a number seeded from the pair (the same feud plays the same way twice); a visible card shows both bars.
 * The loser dissolves, or, when it is kept or pinned (th.keep / th.pinned / th.locked), stays up marked defeated.
 * "bet the counter on the clock" stakes a third thing: it dissolves if its side loses and moves next to the winner if it wins.
 * "end the feud" stops it, nothing harmed. Playful only: no money, nothing sent, and the feud card is ephemeral (never saved).
 * Pure parts (feudOf, betOf, findThing, newFeud, step, settle) are tested in tools/stage-pack-f.test.mjs.
 */
import { rng } from '../lib/field-kit.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
export const LIFE = 100, TICK_MS = 1000, DMG_MIN = 9, DMG_SPAN = 13; // 9..21 a second: a feud lasts 5 to 12 seconds

/** { a, b } the two words named, { end: true }, or null. Pure. */
export function feudOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?(?:end|stop|call\s+off|settle|cancel)\s+(?:the\s+|this\s+|that\s+)?(?:blood\s+)?feud$/.test(t)) return { end: true };
  const m = /^(?:please\s+)?(?:(?:start|begin|declare)\s+)?(?:a\s+)?blood\s+feud\s+between\s+(?:the\s+|my\s+)?(.{1,40}?)\s+and\s+(?:the\s+|my\s+)?(.{1,40}?)$/.exec(t)
    || /^(?:please\s+)?(?:start|begin|declare)\s+(?:a\s+)?feud\s+between\s+(?:the\s+|my\s+)?(.{1,40}?)\s+and\s+(?:the\s+|my\s+)?(.{1,40}?)$/.exec(t);
  return m ? { a: m[1], b: m[2] } : null;
}
/** { stake, on } for "bet the counter on the clock", else null. Pure. */
export function betOf(text) {
  const m = /^(?:please\s+)?(?:bet|stake|wager)\s+(?:the\s+|my\s+)?(.{1,40}?)\s+on\s+(?:the\s+)?(.{1,40}?)$/.exec(CLEAN(text));
  return m ? { stake: m[1], on: m[2] } : null;
}

// [kind, the words that name it, what the card calls it]
const KIND_WORDS = [['clock', /^clocks?$/, 'the clock'], ['sticky', /^(?:stick(?:y|ies)|notes?|sticky notes?)$/, 'the note'], ['counter', /^counters?$/, 'the counter'], ['timer', /^(?:timers?|countdowns?)$/, 'the timer'],
  ['list', /^(?:lists?|checklists?)$/, 'the list'], ['notepad', /^notepads?$/, 'the notepad'], ['link', /^links?$/, 'the link'], ['image', /^(?:images?|pictures?|photos?)$/, 'the picture'], ['calc', /^(?:calcs?|calculators?)$/, 'the calculator'],
  ['shape', /^(?:shapes?|circles?|squares?|rects?|rectangles?|lines?)$/, 'the shape'], ['kept', /^(?:cards?|kept cards?)$/, 'the card'], ['convert', /^converters?$/, 'the converter'], ['figure', /^(?:figures?|persons?|people)$/, 'the figure']];
/** the stage kind a word names ('note' -> sticky), or null. Pure. */
export const kindOfWord = (w) => { const x = CLEAN(w); const k = KIND_WORDS.find(([, re]) => re.test(x)); return k ? k[0] : null; };
/** what a thing is called on the feud card: its own name, else its kind's word. Pure. */
export function labelOf(th) {
  if (!th) return 'nothing';
  const own = String(th.name || th.title || '').trim();
  if (own) return own.slice(0, 24);
  const k = KIND_WORDS.find(([kind]) => kind === th.kind);
  return k ? k[2] : 'the ' + String(th.kind || 'thing');
}
/** the thing a word means: one named so (name, title, or the words on it), else the newest of the kind the word names; never
 *  one in `taken`. Pure. */
export function findThing(word, things, taken = []) {
  const w = CLEAN(word), all = Object.values(things || {}).filter((t) => t && t.id && !taken.includes(t.id) && t.kind !== 'feud');
  if (!w) return null;
  const named = all.filter((t) => [t.name, t.title, t.label, t.text].some((v) => v && CLEAN(v) === w)).pop()
    || all.filter((t) => [t.name, t.title, t.label].some((v) => v && CLEAN(v).includes(w))).pop();
  if (named) return named;
  const kind = kindOfWord(w);
  return kind ? all.filter((t) => t.kind === kind).pop() || null : null;
}

/** a seed for the pair: the same two ids, the same feud. Pure. */
export function seedOf(a, b) { let h = 7; for (const c of String(a) + '|' + String(b)) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0; return (h >>> 0) || 1; }
/** how much side `side` (0 = a, 1 = b) loses on tick `tick` of a feud seeded `seed`. Pure, deterministic. */
export const damageAt = (seed, tick, side) => DMG_MIN + rng((seed + tick * 7919 + side * 104729) >>> 0).int(DMG_SPAN);
/** a fresh feud between things a and b. Pure. */
export const newFeud = (a, b, now = 0) => ({ a: { id: a.id, life: LIFE }, b: { id: b.id, life: LIFE }, seed: seedOf(a.id, b.id), tick: 0, started: now, bet: null });
/** one second of feud: both drain; { over, winner: 'a' | 'b' }. A feud always has a loser: when both fall in the same second the one with
 *  more life before it wins, then the one that took less that second, then the one named first. Changes f. */
export function step(f) {
  f.tick += 1;
  const la = f.a.life, lb = f.b.life, da = damageAt(f.seed, f.tick, 0), db = damageAt(f.seed, f.tick, 1);
  f.a.life = Math.max(0, la - da);
  f.b.life = Math.max(0, lb - db);
  if (f.a.life > 0 && f.b.life > 0) return { over: false, winner: null };
  if (f.a.life > 0) return { over: true, winner: 'a' };
  if (f.b.life > 0) return { over: true, winner: 'b' };
  return { over: true, winner: la > lb ? 'a' : lb > la ? 'b' : db > da ? 'a' : da > db ? 'b' : 'a' };
}
const held = (t) => !!(t && (t.keep || t.pinned || t.locked));
/** what happens when a feud ends: the loser dissolves (or is only defeated when held), the bet dissolves or moves beside the winner;
 *  { gone: [ids], defeated: [ids], moved: [ids], line }. Changes things. */
export function settle(f, things, result) {
  const out = { gone: [], defeated: [], moved: [], line: '' };
  const A = things[f.a.id], B = things[f.b.id];
  const drop = (t) => { if (!t) return; if (held(t)) { t.defeated = true; out.defeated.push(t.id); } else { delete things[t.id]; out.gone.push(t.id); } };
  if (!result || !result.winner) { out.line = 'a draw: ' + labelOf(A) + ' and ' + labelOf(B) + ' both fall silent, both stay'; if (f.bet && things[f.bet.id]) out.line += ' · the bet is returned'; return out; }
  const win = result.winner === 'a' ? A : B, lose = result.winner === 'a' ? B : A;
  drop(lose);
  out.line = labelOf(win) + ' wins the feud; ' + labelOf(lose) + (held(lose) ? ' is defeated but kept' : ' dissolves');
  if (f.bet && things[f.bet.id]) {
    const stake = things[f.bet.id];
    if (win && f.bet.on === win.id) { stake.x = (+win.x || 0) + 36; stake.y = (+win.y || 0) + 72; out.moved.push(stake.id); out.line += ' · the bet pays: ' + labelOf(stake) + ' moves beside the winner'; }
    else { drop(stake); out.line += ' · the bet is lost: ' + labelOf(stake) + (held(stake) ? ' is defeated but kept' : ' dissolves'); }
  }
  return out;
}

// ---- the stage ---------------------------------------------------------------------------------------------------------------
let live = null; // { th, stageApi, timer } while a feud runs (one at a time)
const elOf = (st, id) => st.stage.querySelector('[data-id="' + (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(id)) : id) + '"]');
const dissolve = (el) => { if (!el) return; el.classList.add('feud-dissolve'); if (typeof el.animate === 'function') el.animate([{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(6px)', transform: 'scale(.6) rotate(8deg)' }], { duration: 650, easing: 'ease-in', fill: 'forwards' }); };
function paint(card, f, things) {
  for (const side of ['a', 'b']) { const bar = card.querySelector('.feud-fill[data-side="' + side + '"]'); if (bar) { bar.style.width = f[side].life + '%'; bar.parentNode.dataset.life = String(f[side].life); } }
  const name = (side) => card.querySelector('.feud-name[data-side="' + side + '"]');
  if (name('a')) name('a').textContent = labelOf(things[f.a.id]);
  if (name('b')) name('b').textContent = labelOf(things[f.b.id]);
  const bet = card.querySelector('.feud-bet'); if (bet) bet.textContent = f.bet && things[f.bet.id] ? 'bet: ' + labelOf(things[f.bet.id]) + ' on ' + labelOf(things[f.bet.on]) : '';
}
function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing feud-card'; el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:240px;padding:10px 12px;border-radius:12px;background:rgba(40,6,10,.82);border:1px solid rgba(255,80,90,.5);color:#f4d9d9;font-size:12px;letter-spacing:.04em;box-shadow:0 10px 30px rgba(0,0,0,.4)';
  const row = (side) => '<div class="feud-row" style="margin:6px 0"><span class="feud-name" data-side="' + side + '" style="display:block;margin-bottom:3px"></span><div class="feud-bar" data-side="' + side + '" style="height:8px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden"><div class="feud-fill" data-side="' + side + '" style="height:100%;width:100%;background:linear-gradient(90deg,#ff3b4e,#ffb347);transition:width .6s ease"></div></div></div>';
  el.innerHTML = '<div style="font-size:11px;text-transform:uppercase;opacity:.8">blood feud</div>' + row('a') + '<div style="text-align:center;opacity:.6">vs</div>' + row('b') + '<div class="feud-bet" style="margin-top:4px;opacity:.85"></div><button type="button" class="feud-end g-btn" style="margin-top:8px;font:inherit;font-size:11px;padding:3px 9px;border-radius:7px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:inherit;cursor:pointer">end the feud</button>'; // void-review: ok (static markup; row() takes only the fixed side letters a and b and the names are set with textContent)
  paint(el, th.feud, stageApi.things());
  const b = el.querySelector('.feud-end'); b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('click', (e) => { e.stopPropagation(); end(stageApi, 'the feud is called off'); });
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}
/** rivals keep a crimson outline while the feud runs (the page calls this after every render and drag) */
export function decorate(st) {
  if (!live) return;
  const f = live.th.feud;
  for (const id of [f.a.id, f.b.id]) { const el = elOf(st, id); if (el) { el.classList.add('feud-rival'); el.style.outline = '2px solid rgba(255,70,90,.85)'; el.style.outlineOffset = '3px'; } }
}
function clearMarks(st, f) { for (const id of [f.a.id, f.b.id]) { const el = elOf(st, id); if (el) { el.classList.remove('feud-rival'); el.style.outline = ''; el.style.outlineOffset = ''; } } }
function end(stageApi, line) {
  if (!live) return false;
  const { th, timer } = live; clearInterval(timer); live = null;
  clearMarks(stageApi, th.feud);
  delete stageApi.things()[th.id];
  if (stageApi.selected() === th.id) stageApi.select(null);
  stageApi.save(); stageApi.render();
  if (line) stageApi.say(line);
  return true;
}
function tick() {
  if (!live) return;
  const { th, stageApi } = live, things = stageApi.things(), f = th.feud;
  if (!things[th.id] || !things[f.a.id] || !things[f.b.id]) { end(stageApi, 'the feud is over: a rival left the stage'); return; }
  const r = step(f);
  const card = elOf(stageApi, th.id); if (card) paint(card, f, things);
  if (!r.over) return;
  clearInterval(live.timer);
  const loser = r.winner === 'a' ? f.b.id : r.winner === 'b' ? f.a.id : null;
  const copy = JSON.parse(JSON.stringify(things)), out = settle(f, copy, r); // what will go, worked out on a copy first: the dissolve plays before anything is removed
  for (const id of out.gone) dissolve(elOf(stageApi, id));
  if (loser && !out.gone.includes(loser)) { const el = elOf(stageApi, loser); if (el) el.style.filter = 'grayscale(1) brightness(.6)'; }
  setTimeout(() => { if (!live || live.th !== th) return; settle(f, things, r); end(stageApi, out.line); }, 700);
}
function start(a, b, api) {
  const st = api.stage, things = st.things();
  if (live) end(st, '');
  const stage = st.stage, w = stage.clientWidth || 800;
  const th = { id: 'feud_' + Math.random().toString(36).slice(2, 9), kind: 'feud', x: Math.max(8, Math.round(w / 2 - 120)), y: 12, feud: newFeud(a, b, Date.now()) };
  things[th.id] = th;
  live = { th, stageApi: st, timer: setInterval(tick, TICK_MS) };
  st.save(); st.render();
  api.say('blood feud: ' + labelOf(a) + ' against ' + labelOf(b) + ' · "bet the <thing> on the ' + labelOf(a) + '" · "end the feud" stops it');
}

async function run(text, api) {
  const st = api.stage, things = st.things();
  const q = feudOf(text);
  if (q && q.end) { if (!end(st, 'the feud is called off: both stay')) api.say('no feud is running'); return 'feud'; }
  if (q) {
    const a = findThing(q.a, things), b = findThing(q.b, things, a ? [a.id] : []);
    if (!a || !b) { api.say('no ' + (a ? q.b : q.a) + ' on the stage to feud with · put two things up first (a clock, a note, a counter)'); return 'feud'; }
    if (a.id === b.id) { api.say('a thing cannot feud with itself'); return 'feud'; }
    start(a, b, api);
    return 'feud';
  }
  const bet = betOf(text);
  if (bet && live) {
    const f = live.th.feud, on = findThing(bet.on, things), stake = findThing(bet.stake, things, [f.a.id, f.b.id]);
    if (!on || (on.id !== f.a.id && on.id !== f.b.id)) { api.say('bet on one of the rivals: ' + labelOf(things[f.a.id]) + ' or ' + labelOf(things[f.b.id])); return 'feud'; }
    if (!stake) { api.say('no ' + bet.stake + ' on the stage to bet'); return 'feud'; }
    f.bet = { id: stake.id, on: on.id };
    const card = elOf(st, live.th.id); if (card) paint(card, f, things);
    api.say(labelOf(stake) + ' is bet on ' + labelOf(on) + ': it dissolves if ' + labelOf(on) + ' loses, moves beside the winner if not');
    return 'feud';
  }
  return 'none';
}

export default {
  name: 'feud',
  examples: ['start a blood feud between the clock and the note', 'blood feud between the counter and the timer', 'end the feud', 'declare a feud between the list and the notepad'],
  nearMisses: ['blood test', 'family feud', 'what is a blood feud', 'bet on the horses', 'end the timer'],
  match(lower, text) { return !!feudOf(text) || (!!live && !!betOf(text)); },
  run,
  decorate,
  stageKinds: { feud: { mount, ephemeral: true } },
};
