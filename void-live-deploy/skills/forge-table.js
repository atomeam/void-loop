/**
 * forge-table - "forge these", "forge the timer and the note": takes two things you have kept on the stage and proposes ONE hybrid card
 * through the merge path that already exists (skills/merge.js: fixed rules for the numbers, /api/merge for a name and a line, once per
 * pair; no new server route). The proposal shows both parents and the new card with one button, "Put it on the stage"; nothing is added
 * until you tap it. Asked by the owner, 2026-10-18 (stage pack D). "merge a pizza and a black hole" is the same machine for two IDEAS you
 * type; the Forge Table is for two THINGS you already have. "forge a sword" (one thing, no pair) is not taken.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { refOf, pick } from './label.js';
import { parentCard, mergedCard, bodyHtml, CSS as MERGE_CSS, fetchWords } from './merge.js';
import { loadStats } from '../lib/card-frame.js';
import { nameOf } from './archive-of-one.js';

const clean = (s) => String(s || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const THESE = /^(?:these|them|those|both|these two|those two|the two|the selected|it)$/;

/** "forge these" -> { refs: null }; "forge the timer and the note" -> { refs: [ref, ref] }; anything else (a lone noun, "forge a sword") -> null. Pure. */
export function forgeAsk(text) {
  const t = clean(text).replace(/^(?:please\s+)?(?:can you\s+)?/, ''); if (!t || t.length > 120) return null;
  const m = /^forge\s+(.+)$/.exec(t); if (!m) return null;
  const rest = m[1].replace(/\s+(?:together|into one|into a hybrid)$/, '');
  if (THESE.test(rest)) return { refs: null };
  const parts = rest.split(/\s+(?:and|with|plus|&|\+)\s+/);
  if (parts.length !== 2) return null;
  const refs = parts.map((p) => refOf(p, false));
  return refs.every((r) => r && !r.self && r.kind) ? { refs } : null;
}

const FORGEABLE = (t) => t && !['figure', 'weave', 'label'].includes(t.kind) && !!nameOf(t);
/** the two things to forge: the named ones (the newest of each kind), else the selected one and the newest other, else the newest two. Pure. */
export function pairOf(things, refs, selected = null) {
  const list = Object.values(things || {}).filter(FORGEABLE);
  if (refs) { const a = pick(list, refs[0], selected), b = pick(list, refs[1], selected); return a && b && a !== b ? [a, b] : null; }
  if (list.length < 2) return null;
  const s = list.find((t) => t.id === selected);
  return s ? [s, [...list].reverse().find((t) => t !== s)] : list.slice(-2);
}

/** the idea each parent brings to the merge: the thing's short name, at most five words. Pure. */
export function ideaOf(th) { return nameOf(th).replace(/[^\p{L}\p{N} '-]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 5).join(' ').toLowerCase(); }

/** the kept card the accept button puts on the stage: every value escaped. Pure but for esc. */
export function keptCardOf(esc, card, pa, pb, id, x, y) {
  return { id, kind: 'kept', x, y, w: 300, name: card.name, ask: 'forge ' + pa.name + ' and ' + pb.name,
    html: '<h2>' + esc(card.name) + '</h2><p>' + esc(card.line) + '</p><p>' + esc(card.typeLine) + '</p><p>Power ' + esc(card.power) + ' · Resistance ' + esc(card.resistance) + ' · Income ' + esc(card.income) + '</p><p>Forged from ' + esc(pa.name) + ' and ' + esc(pb.name) + '.</p>' };
}

async function run(text, api) {
  const ask = forgeAsk(text); if (!ask) return 'none';
  const { showPage, esc, say } = api, st = api.stage;
  const pair = pairOf(st.things(), ask.refs, st.selected());
  if (!pair) { say(ask.refs ? 'I could not find both of those on the stage' : 'put two things on the stage first, then "forge these"'); return 'forge-table'; }
  const ideas = { a: ideaOf(pair[0]), b: ideaOf(pair[1]) };
  if (!ideas.a || !ideas.b || ideas.a === ideas.b) { say('those two need different names to forge'); return 'forge-table'; }
  const stats = await Promise.race([loadStats().catch(() => null), new Promise((r) => setTimeout(() => r(null), 1500))]);
  const pa = parentCard(ideas.a, stats), pb = parentCard(ideas.b, stats);
  let card = mergedCard(pa, pb), h2, body, btn;
  const el = showPage((p) => {
    p.innerHTML = '<style>' + MERGE_CSS + '</style><div class="sub">Forge Table</div><h2></h2><div class="mg-body"></div><p><button type="button" class="ft-accept">Put it on the stage</button></p>';
    h2 = p.querySelector('h2'); body = p.querySelector('.mg-body'); btn = p.querySelector('.ft-accept'); h2.textContent = card.name; body.innerHTML = bodyHtml(esc, pa, pb, card, 'pending'); // void-review: ok: bodyHtml escapes every value
  });
  btn.addEventListener('click', () => {
    const things = st.things(), id = 'forged' + Date.now().toString(36), at = pair[0];
    things[id] = keptCardOf(esc, card, pa, pb, id, (Number(at.x) || 40) + 36, (Number(at.y) || 60) + 36);
    st.select(id); st.save(); st.render(); if (st.closePage) st.closePage(); say('forged: ' + card.name);
  });
  const got = await fetchWords({ a: ideas.a, b: ideas.b });
  if (!el.isConnected) return 'forge-table';
  if (got && got.kept) { body.innerHTML = '<p>' + esc(String(got.answer || '')) + '</p>'; h2.textContent = 'Not forged'; btn.remove(); return 'forge-table'; }
  const ok = got && got.name && !got.fallback && !got.error;
  card = mergedCard(pa, pb, ok ? got : {}); h2.textContent = card.name;
  body.innerHTML = bodyHtml(esc, pa, pb, card, ok ? (got.cached ? 'cached' : 'fresh') : 'offline', ok ? got.since || '' : ''); // void-review: ok: bodyHtml escapes every value
  return 'forge-table';
}

export default {
  name: 'forge-table',
  examples: ['forge these', 'forge the timer and the note', 'forge the timer with the note'],
  nearMisses: ['forge a sword', 'forge a signature', 'forge ahead', 'how do i forge steel', 'merge a pizza and a black hole', 'forge'],
  forgeAsk, pairOf, ideaOf, keptCardOf,
  match(lower, text) { return !!forgeAsk(text || lower); },
  run,
};
