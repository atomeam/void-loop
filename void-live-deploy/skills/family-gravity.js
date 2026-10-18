/**
 * family-gravity skill - stage things whose skills share a family drift gently toward each other (asked by the owner, 2026-10-18).
 * "turn on family gravity", "family gravity off", "gravity only notes" (only that kind, pulled toward its own kind). The pull is the
 * law the field cards already use (lib/field-cards.js familyPull); here it moves the real stage things. A short animation loop runs
 * only while something is still moving, never with fewer than two things in a group, and stops when settled, saving the places once
 * (stageApi.save). Reduced motion: the settled places are computed at once and snapped to. Nothing is fetched but the family list
 * (skills/families.json); nothing runs until asked.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { familyPull } from '../lib/field-cards.js';
import { kindFor, KNOWN } from './type-filter.js';

const CLEAN = (t) => String(t || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const ON = /^(?:(?:turn|switch)\s+on|enable|start)\s+family\s+gravity$|^family\s+gravity(?:\s+on)?$/;
const OFF = /^(?:(?:turn|switch)\s+off|disable|stop)\s+family\s+gravity$|^(?:family\s+)?gravity\s+off$/;
const ONLY = /^(?:family\s+)?gravity\s+only\s+(?:for\s+)?(?:the\s+|my\s+)?([a-z][a-z -]{1,30})$/;

/** what the ask wants: { op: 'on' } | { op: 'off' } | { op: 'only', word } | null. A word that names no stage kind is not taken. Pure. */
export function gravityOf(text) {
  const t = CLEAN(text); let m;
  if (ON.test(t)) return { op: 'on' };
  if (OFF.test(t)) return { op: 'off' };
  if ((m = ONLY.exec(t)) && kindFor(m[1], KNOWN)) return { op: 'only', word: m[1] };
  return null;
}

/** kind -> family id from skills/families.json ({ families: [{ id, skills }] }); a kind with no family is its own. Pure. */
export function familyIndex(fam) {
  const out = {}, list = (fam && fam.families) || [];
  for (const f of list) for (const s of f.skills || []) { const n = s && s.name ? s.name : s; if (typeof n === 'string' && !(n in out)) out[n] = f.id; } // a skill is { name, tier, ... } in the file
  return out;
}

/** the cards gravity moves, in field widths 0..1: { id, x, y, family }. `only` (a kind) limits it to that kind, grouped by kind;
 *  otherwise things group by their skill's family, else their kind. Things alone in their group are left out. Pure. */
export function cardsOf(things, idx, w, h, only = '') {
  const all = Object.values(things || {}).filter((t) => t && t.id && Number.isFinite(+t.x) && Number.isFinite(+t.y) && t.kind && (!only || t.kind === only))
    .map((t) => ({ id: t.id, x: +t.x / Math.max(1, w), y: +t.y / Math.max(1, h), family: only ? t.kind : (idx && idx[t.kind]) || t.kind }));
  const n = {}; for (const c of all) n[c.family] = (n[c.family] || 0) + 1;
  return all.filter((c) => n[c.family] >= 2);
}

/** one step of the pull on every card (in place); returns the largest move, in field widths. Pure on its inputs. */
export function stepCards(cards, k = 4) {
  const pulls = cards.map((_, i) => familyPull(cards, i, k)); let top = 0;
  cards.forEach((c, i) => { c.x = Math.min(0.94, Math.max(0.02, c.x + pulls[i].dx)); c.y = Math.min(0.92, Math.max(0.02, c.y + pulls[i].dy)); top = Math.max(top, Math.hypot(pulls[i].dx, pulls[i].dy)); });
  return top;
}
export const SETTLED = 0.0002;
/** run steps until nothing moves (or `max` steps): the places the loop is heading for. Returns the steps taken. Pure on its inputs. */
export function settle(cards, k = 4, max = 600) { let n = 0; while (n < max && stepCards(cards, k) > SETTLED) n++; return n; }

let on = false, only = '', raf = 0, idx = null, listener = null;
const stageEl = () => document.getElementById('stage');
const reduced = () => { try { return !!(matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; } };
function size() { const s = stageEl(); return { w: (s && s.clientWidth) || innerWidth || 1, h: (s && s.clientHeight) || innerHeight || 1 }; }
function place(api, cards, sz) {
  const things = api.stage.things(), st = stageEl();
  for (const c of cards) {
    const th = things[c.id]; if (!th) continue;
    th.x = Math.round(c.x * sz.w); th.y = Math.round(c.y * sz.h);
    const el = st && st.querySelector(':scope > [data-id="' + CSS.escape(c.id) + '"]'); if (el) { el.style.left = th.x + 'px'; el.style.top = th.y + 'px'; }
  }
}
function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
function kick(api) {
  if (!on || raf) return;
  const sz = size(), cards = cardsOf(api.stage.things(), idx, sz.w, sz.h, only);
  if (cards.length < 2) return;
  if (reduced()) { if (settle(cards)) { place(api, cards, sz); api.stage.save(); } document.documentElement.dataset.familyGravity = 'settled'; return; }
  if (stepCards(cards.map((c) => ({ ...c }))) <= SETTLED) return; // already settled: our own save() must not start the loop again
  // the loop keeps its own exact places between frames: whole pixels on the stage would swallow the last small steps and never settle
  let last = 0;
  const loop = (now) => {
    raf = 0; if (!on) return;
    const k = last ? Math.min(12, Math.max(0.25, ((now - last) / 1000) * 60)) * 4 : 4; last = now; // time-based: a slow frame covers the ground a fast one would
    if (stepCards(cards, k) <= SETTLED) { document.documentElement.dataset.familyGravity = 'settled'; api.stage.save(); return; }
    place(api, cards, size()); document.documentElement.dataset.familyGravity = 'moving'; raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

async function run(text, api) {
  const want = gravityOf(text); if (!want) return 'none';
  const say = api.say;
  if (want.op === 'off') { on = false; only = ''; stop(); document.documentElement.dataset.familyGravity = 'off'; say('family gravity is off · things stay where they are'); return 'family-gravity'; }
  const kind = want.op === 'only' ? kindFor(want.word, Object.values(api.stage.things()).map((t) => t.kind)) : '';
  if (want.op === 'only' && !kind) { say('there is no ' + want.word + ' on the stage'); return 'family-gravity'; }
  if (!idx) { try { const r = await fetch('/skills/families.json'); idx = familyIndex(r.ok ? await r.json() : null); } catch (_) { idx = {}; } }
  const sz = size(), cards = cardsOf(api.stage.things(), idx, sz.w, sz.h, kind);
  if (cards.length < 2) { say(kind ? 'gravity needs two ' + kind + ' things on the stage' : 'gravity needs two things of one family on the stage'); return 'family-gravity'; }
  on = true; only = kind;
  if (!listener) { listener = () => kick(api); addEventListener('void:stage-change', listener); }
  say(kind ? 'gravity on for ' + kind + ' only' : 'family gravity is on · say "family gravity off" to stop it');
  kick(api); return 'family-gravity';
}

export default {
  name: 'family-gravity',
  gravityOf,
  examples: ['turn on family gravity', 'family gravity off', 'gravity only notes'],
  nearMisses: ['gravity of jupiter', 'family tree', 'turn on the lights', 'gravity only matters in space'],
  match(lower, text) { return !!gravityOf(text || lower); },
  run,
};
