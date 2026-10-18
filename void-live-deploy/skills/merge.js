/**
 * merge skill - two ideas make one V01D card (frontier #34 step 1; owner, 2026-10-16: "research merge games so V01D can experiment with
 * card merges"; research in docs/research/merge-games.md). "merge a pizza and a black hole", "combine fire with ice", "fuse a cat and the
 * moon", "what do you get if you merge ...": the result is a V01D card (lib/card-frame.js) showing both parents, the new card's name,
 * kinds, and Power / Resistance / Income worked out from the parents by FIXED rules (lib/merge-rules.js, written at its top). A name that is
 * a V01D skill brings that skill's real stats (cardOf); any other idea is a fresh card 1 / 1 / 0. The model is asked only for a name and one
 * line, once per pair, by /api/merge (functions/api/merge.js), and everyone who merges that pair gets the same answer; with the route down
 * the card is still made, named by the plain blend. No number on the card ever comes from the model.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { ideaKey, freshCard, cardFromStats, mergeKinds, mergeStats, fallbackName, fallbackLine, sanitiseName, sanitiseLine } from '../lib/merge-rules.js';
import { cardOf, lookup, loadStats } from '../lib/card-frame.js';

const LEAD = /^(?:(?:please|hey|v01d|void|can you|could you|would you|will you|let'?s|lets|i want to|i'?d like to|i would like to|try to|try and)\s+)+/;
const WHAT = /^(?:what|who|which)\s+(?:(?:do|would|will|might|could|can|should)\s+(?:you|we|i)\s+(?:get|make|have|see)|happens|if)\s+(?:if|when)?\s*(?:you|we|i)?\s*(?:were to\s+|did\s+|tried to\s+)?/;
const VERB = /^(?:merge|combine|fuse|smash together|mash together|blend)\s+(.+)$/;
const SPLIT = /\s+(?:and|with|plus|into|&|\+)\s+/;
// work with files, data and code is not a card game: "merge two pdf files", "combine columns in excel", "git merge conflict"
const TECH = /\b(?:pdfs?|csv|excel|spreadsheets?|sheets?|columns?|rows?|cells?|git|branch(?:es)?|pull requests?|prs?|commits?|conflicts?|python|javascript|java|code|sort|files?|folders?|documents?|docs?|videos?|audio|photos?|images?|pictures?|tables?|arrays?|lists?|json|accounts?|contacts?|calendars?|emails?|inbox|playlists?|tabs?|layers?|clips?|mail|directories|databases?|repos?|repositories|dicts?|objects?|log|logs|merged|lately|recently)\b/;
const VAGUE = /^(?:the |these |those |both |all |any |some )?(?:them|these|those|it|ones?|things?|two|both|stuff|cards?|together)$/;
const idea = (s) => String(s || '').replace(/\s+(?:together|please)$/, '').replace(/^(?:a|an|the|some|my)\s+/i, '').trim();

/** "merge a pizza and a black hole" -> { a: 'pizza', b: 'black hole' }, or null when it is not two ideas to merge. Pure. */
export function mergeAsk(text) {
  let t = String(text || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!t || t.length > 140 || TECH.test(t)) return null;
  t = t.replace(LEAD, '').replace(WHAT, '').replace(LEAD, '');
  const m = VERB.exec(t); if (!m) return null;
  const parts = m[1].split(SPLIT);
  if (parts.length < 2) return null;
  const a = idea(parts[0]), b = idea(parts.slice(1).join(' and '));
  for (const s of [a, b]) if (!/[a-z]/.test(s) || VAGUE.test(s) || s.split(' ').length > 6 || !ideaKey(s)) return null;
  return { a, b };
}

const nameOf = (s) => (s.charAt(0).toUpperCase() + s.slice(1));
/** a card for one side: a V01D skill of that name (its real stats), else a fresh idea. Pure. */
export function parentCard(name, stats) {
  const key = ideaKey(name);
  for (const f of (stats && stats.fam && stats.fam.families) || []) for (const s of f.skills || []) {
    if (ideaKey(s.name) !== key) continue;
    const c = cardOf({ ...lookup(stats, s.name) });
    if (c.power != null) return { ...cardFromStats(s.name, c), name: nameOf(s.name), key };
  }
  const f = freshCard(name); return { ...f, name: nameOf(f.name) };
}

/** the merged card from the two parents and the words (the model's, or the plain blend): everything the page shows. Pure. */
export function mergedCard(pa, pb, words = {}) {
  const st = mergeStats(pa, pb), kinds = mergeKinds(pa, pb);
  const name = sanitiseName(words.name) || fallbackName(pa, pb), line = sanitiseLine(words.line) || fallbackLine(pa, pb);
  return { name, line, kinds, ...st, typeLine: kinds.join(' · ') + ' — merged, depth ' + st.depth };
}

export const SRC = {
  pending: 'Naming it… the plain blend shows until V01D has a name.',
  fresh: "Named once by V01D's model; everyone who merges this pair gets this name.",
  cached: "Named by V01D's model and kept: everyone who merges this pair gets this name.",
  offline: 'Named offline, the plain blend of the two names: the model could not be reached, so this name is not kept.',
};
export const CSS = '.mg-parents{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:4px 0 8px}.mg-p{flex:1 1 130px;min-width:0;padding:6px 10px;border:1px solid var(--edge,#556);border-radius:8px;background:rgba(255,255,255,.04)}.mg-p b{display:block;overflow-wrap:anywhere}.mg-p span{font-size:11.5px;opacity:.8}.mg-plus{font-size:18px;opacity:.7}.mg-rule{font-size:12px;opacity:.8;margin:4px 0}';
const stat = (c) => 'P ' + c.power + ' · R ' + c.resistance + ' · I ' + c.income;

/** the card's inside for a state. Pure but for esc. */
export function bodyHtml(esc, pa, pb, card, state, since = '') {
  const side = (p) => '<div class="mg-p"><b>' + esc(p.name) + '</b><span>' + esc(p.kinds.join(' · ')) + ' · ' + esc(stat(p)) + '</span></div>';
  return '<div class="mg-parents" aria-label="the two cards merged">' + side(pa) + '<i class="mg-plus" aria-hidden="true">+</i>' + side(pb) + '</div>'
    + '<p class="mg-rule">Numbers are earned from the parents, never chosen by the model: Power is the stronger plus half the weaker, Resistance their average, Income their sum.</p>'
    + '<div class="src">' + esc(SRC[state] || '') + (state === 'cached' && since ? esc(' First merged ' + since + '.') : '') + '</div>';
}

export const ownOf = (c) => ({ tier: c.tier, chapter: 'games', typeLine: c.typeLine, cost: c.cost, power: c.power, resistance: c.resistance, income: c.income, adds: c.line, name: c.name });

async function ask(url, init) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null, timer = ctl ? setTimeout(() => ctl.abort(), 20000) : 0;
  try { const r = await fetch(url, { ...init, signal: ctl ? ctl.signal : undefined }); return r.ok || r.status === 429 ? await r.json() : null; } catch (_) { return null; } finally { clearTimeout(timer); }
}

/** the model's name and line for a pair through the existing /api/merge route (GET the kept answer, else POST once); null when the route is down. Shared by the Forge Table. */
export async function fetchWords(pair) {
  const q = 'a=' + encodeURIComponent(pair.a) + '&b=' + encodeURIComponent(pair.b);
  let got = await ask('/api/merge?' + q);
  if (got && got.kept) return got;
  if (!got || !got.cached) got = await ask('/api/merge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(pair) });
  return got;
}

async function run(text, api) {
  const pair = mergeAsk(text); if (!pair) return 'none';
  const { showPage, esc } = api;
  const stats = await Promise.race([loadStats().catch(() => null), new Promise((r) => setTimeout(() => r(null), 1500))]);
  const pa = parentCard(pair.a, stats), pb = parentCard(pair.b, stats);
  let card = mergedCard(pa, pb);
  let h2, body;
  const el = showPage((p) => {
    p.dataset.cardOwn = JSON.stringify(ownOf(card)); p.dataset.mergeA = pa.key; p.dataset.mergeB = pb.key;
    p.innerHTML = '<style>' + CSS + '</style><h2></h2><div class="mg-body"></div>';
    h2 = p.querySelector('h2'); body = p.querySelector('.mg-body'); h2.textContent = card.name; body.innerHTML = bodyHtml(esc, pa, pb, card, 'pending');
  });
  const paint = (words, state, since) => {
    if (!el.isConnected) return;
    card = mergedCard(pa, pb, words);
    el.dataset.cardOwn = JSON.stringify(ownOf(card)); h2.textContent = card.name; body.innerHTML = bodyHtml(esc, pa, pb, card, state, since);
  };
  let got = await fetchWords(pair);
  if (got && got.kept) { if (el.isConnected) { el.dataset.cardOwn = ''; body.innerHTML = '<p>' + esc(String(got.answer || '')) + '</p>'; h2.textContent = 'Not merged'; } return 'merge'; }
  if (got && got.name && !got.fallback && !got.error) paint(got, got.cached ? 'cached' : 'fresh', got.since || '');
  else paint({}, 'offline');
  return 'merge';
}

export default {
  name: 'merge',
  mergeAsk,
  examples: [
    'merge a pizza and a black hole',
    'what do you get if you merge a pizza and a black hole',
    'fuse a cat with the moon',
    'combine fire with ice',
  ],
  nearMisses: [
    'merge log',
    'what did you merge',
    'merge two pdf files',
    'merge sort in python',
    'combine two columns in excel',
    'git merge conflict',
  ],
  match(lower, text) { return !!mergeAsk(text || lower); },
  run,
};
