// Stage pack H (owner, 2026-10-18): the pure logic behind three skills, so it can be tested without a browser.
//  - negative-summons: "summon everything except urgency" -> existing stage things that fit the opposite mood
//  - echo-disagrees:   "what would the echo say <question>" -> the framing, the label and the check of the second view
//  - near-choir:       "what almost answered that" -> the other skills that nearly took the last ask
// No network and no model call in here; the skills do the asking through the page's own paths.

const STOP = new Set('a an the and or of to in on for with is are was be it its i me my you your do does what how why can this that these those about as at by from up out so if not no near almost just show summon everything anything all but except besides without minus please make add set get open new says say tell give find want need like'.split(' '));
const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9À-ɏ' -]+/g, ' ').split(/[\s-]+/).map((w) => w.replace(/^'+|'+$/g, '')).filter(Boolean);
const content = (s) => words(s).filter((w) => w.length > 2 && !STOP.has(w));

// ---- negative summons -------------------------------------------------------------------------------------------
/** the mood table: a word the person wants NOT to see -> the opposite mood and the stage things that carry it (skill name, the example ask to run).
 *  Every pair is checked against the real skills by tools/stage-pack-h.test.mjs, so a renamed skill breaks the test, not a person. */
export const MOODS = [
  { words: ['urgency', 'urgent', 'rush', 'rushed', 'hurry', 'haste', 'deadline', 'deadlines', 'panic', 'stress', 'stressed'], opposite: 'calm', prefer: [['breath', 'breathe with me'], ['sticky', 'a sticky'], ['moon', 'explain moon phases'], ['notepad', 'open a notepad'], ['skycard', 'where is the moon tonight']] },
  { words: ['noise', 'noisy', 'loud', 'chaos', 'chaotic', 'clutter'], opposite: 'quiet', prefer: [['breath', 'breathe with me'], ['notepad', 'open a notepad'], ['moon', 'explain moon phases'], ['skycard', 'where is the moon tonight'], ['sticky', 'a sticky']] },
  { words: ['sadness', 'sad', 'gloom', 'gloomy', 'grief', 'dark', 'darkness'], opposite: 'gentle', prefer: [['breath', 'breathe with me'], ['skycard', 'where is jupiter'], ['sticky', 'a sticky'], ['moon', 'explain moon phases']] },
  { words: ['boredom', 'boring', 'bored', 'dull'], opposite: 'curious', prefer: [['gears', 'mystery gears'], ['coral', 'does planting coral work'], ['moon', 'explain moon phases'], ['skycard', 'where is jupiter']] },
];
/** skills with no network and no side effect beyond a card or a note: the pool an unknown word falls back to */
export const GENTLE_POOL = [['breath', 'breathe with me'], ['sticky', 'a sticky'], ['notepad', 'open a notepad'], ['moon', 'explain moon phases'], ['skycard', 'where is the moon tonight'], ['gears', 'mystery gears'], ['coral', 'does planting coral work'], ['counter', 'make a counter']];
export const MAX_SUMMON = 4;

const NEG_RE = /^(?:please\s+)?(?:summon|show me|show|bring me|bring|give me|give|get me)\s+(?:me\s+)?(?:everything|anything|all|all of it|it all)\s+(?:except|but|besides|without|minus|apart from)\s+(?:the\s+|any\s+|some\s+)?([a-z][a-z-]{2,24})$/i;
/** "summon everything except urgency" -> "urgency"; anything else -> ''. A phrase that is not about excluding ("summon the ancient ones") is never taken. */
export function negativeOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = NEG_RE.exec(t);
  return m ? m[1].toLowerCase() : '';
}
export function moodOf(word) { const w = String(word || '').toLowerCase(); return MOODS.find((m) => m.words.includes(w)) || null; }
const stem = (w) => String(w).toLowerCase().replace(/(?:ies|ing|ed|es|s|y|cy|ce|t)$/, '');
/** does this skill's name or any example carry the excluded word (or a word of its mood group, or its stem)? */
export function carries(skill, word) {
  const mood = moodOf(word), group = mood ? mood.words : [String(word).toLowerCase()];
  const st = group.map(stem).filter((s) => s.length >= 3);
  const hay = words((skill.name || '') + ' ' + (skill.examples || []).join(' '));
  return hay.some((h) => group.includes(h) || st.some((s) => h.startsWith(s)));
}
/** up to MAX_SUMMON { name, ask } to summon for the excluded word. `skills` is [{ name, examples }] (the loaded skills). Pure and deterministic. */
export function summonSet(word, skills) {
  const w = String(word || '').toLowerCase().trim();
  if (!w) return { word: w, opposite: '', picks: [] };
  const byName = new Map((skills || []).map((s) => [s.name, s]));
  const mood = moodOf(w), list = mood ? mood.prefer : GENTLE_POOL, picks = [];
  for (const [name, ask] of list) {
    const s = byName.get(name);
    if (!s || carries(s, w)) continue;
    const ex = s.examples || [];
    picks.push({ name, ask: ex.includes(ask) ? ask : ex[0] });
    if (picks.length >= MAX_SUMMON) break;
  }
  return { word: w, opposite: mood ? mood.opposite : 'something else', picks: picks.filter((p) => p.ask) };
}
export function summonTitle(word) { return 'without ' + String(word || '').toLowerCase().slice(0, 24); }

// ---- the echo that disagrees ------------------------------------------------------------------------------------
export const ECHO_LABEL = 'echo: a second view, not a correction';
export const ECHO_DELAY_MS = 4000;
const ECHO_RE = /^(?:please\s+)?(?:what\s+would\s+the\s+echo\s+say\s+(?:to\s+|about\s+|if\s+i\s+asked\s+)?(.{3,300})|echo\s+this|echo\s+that|keep\s+the\s+echo)$/i;
/** { kind: 'ask'|'this'|'keep', question } or null. Only these exact shapes: "echo chamber acoustics" is not one. */
export function echoOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = ECHO_RE.exec(t);
  if (!m) return null;
  if (m[1]) return { kind: 'ask', question: m[1].trim() };
  return /keep/i.test(t) ? { kind: 'keep', question: '' } : { kind: 'this', question: '' };
}
/** the ask sent through the existing answer path: the strongest honest counter-view, three sentences */
export function echoPrompt(question) {
  const q = String(question || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  return 'Give the strongest honest counter-view to the usual answer to this question, in 3 sentences, plain words, no insults and nothing invented: ' + q;
}
/** first n sentences, whitespace tidied, list marks and markdown dropped */
export function limitSentences(text, n = 3) {
  const t = String(text || '').replace(/[*_`#>]+/g, '').replace(/^\s*(?:[-•]|\d+[.)])\s+/gm, '').replace(/\s+/g, ' ').trim();
  const parts = t.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g) || [];
  return parts.slice(0, n).map((p) => p.trim()).join(' ');
}
/** the answer path's reply -> { ok, text, why }. Only a model-written reply is an echo: the path's "model busy" fallbacks (an excerpt, the web) are not a view. */
export function echoUsable(status, j) {
  if (status === 429) return { ok: false, text: '', why: 'The answer path asked us to slow down, so there is no echo this time. Nothing was spent.' };
  const note = String((j && j.note) || '');
  if (!j || !j.answer || /model busy|models? off|no model|nothing on the web|slow down/i.test(note)) return { ok: false, text: '', why: 'The answer path is not available just now (busy or switched off), so there is no echo. Nothing was spent.' };
  const text = limitSentences(j.answer, 3);
  return text ? { ok: true, text, why: '' } : { ok: false, text: '', why: 'The echo came back empty, so there is none to show.' };
}

// ---- the near choir ---------------------------------------------------------------------------------------------
const CHOIR_RE = /^(?:please\s+)?(?:show\s+(?:me\s+)?the\s+near\s+choir|the\s+near\s+choir|what\s+almost\s+answered\s+(?:that|it|this)|what\s+else\s+almost\s+answered\s+(?:that|it|this))$/i;
export function choirOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return CHOIR_RE.test(t);
}
/** the last ask that is not itself a choir/echo/negative request, from the recent asks (newest first) */
export function lastRealAsk(asks) {
  for (const a of asks || []) { if (typeof a === 'string' && a.trim() && !choirOf(a) && !echoOf(a) && !negativeOf(a)) return a.trim(); }
  return '';
}
/** how near a skill is to the ask by shared words: shared / sqrt(skill words), words of the ask only. Pure. */
export function overlapScore(ask, skill) {
  const a = new Set(content(ask));
  if (!a.size) return { score: 0, shared: [] };
  const bag = new Set(content((skill.name || '').replace(/-/g, ' ') + ' ' + (skill.examples || []).join(' ')));
  const shared = [...a].filter((w) => bag.has(w));
  return { score: shared.length ? shared.length / Math.sqrt(Math.max(1, bag.size)) : 0, shared };
}
/** the skills that nearly answered: those whose match() also accepts the ask, then the nearest by shared words. `accepts(skill)` is the skills' own match().
 *  The skill that really takes the ask (first in order that accepts) is the answerer, not a near one. Up to `max` of { name, ask, why }. */
export function nearChoir(ask, skills, accepts, max = 3) {
  const text = String(ask || '').trim();
  if (!text) return { taker: '', near: [] };
  const list = (skills || []).filter((s) => s && s.name && (s.examples || []).length);
  const acc = list.map((s) => { let ok = false; try { ok = !!accepts(s); } catch (_) {} return ok; });
  const takerAt = acc.indexOf(true);
  const taker = takerAt >= 0 ? list[takerAt].name : '';
  const rows = [];
  list.forEach((s, i) => {
    if (i === takerAt || META.test(s.name)) return;
    const o = overlapScore(text, s);
    if (acc[i]) rows.push({ s, rank: 1000 + o.score, why: 'its own matcher also takes this ask' });
    else if (o.score > 0) rows.push({ s, rank: o.score, why: 'shares ' + o.shared.slice(0, 3).join(', ') });
  });
  rows.sort((a, b) => b.rank - a.rank);
  const near = rows.slice(0, max).map((r) => ({ name: r.s.name, ask: nearestExample(text, r.s), why: r.why }));
  return { taker, near };
}
/** skills whose own examples run other asks (a diff of two asks, a re-run of a recent one) or are this pack's: a tap on them would not show the skill, so they are never in the choir */
const META = /^(?:near-choir|echo-disagrees|negative-summons|ask-diff|ask-clipboard)$/;
/** the skill's example that shares the most words with the ask (the first on a tie), so the tap runs the example the choir named it for. Pure. */
export function nearestExample(ask, skill) {
  const a = new Set(content(ask)), ex = (skill && skill.examples) || [];
  let best = ex[0], bestN = -1;
  for (const e of ex) { const n = content(e).filter((w) => a.has(w)).length; if (n > bestN) { best = e; bestN = n; } }
  return best;
}

// ---- browser side: the skills as the page loaded them (the browser caches the modules, so this costs no network after the first ask) ----
let loaded = null;
export function loadSkills(fetchFn = (u) => fetch(u), importFn = (u) => import(u)) {
  if (!loaded) {
    loaded = fetchFn('/skills/index.json').then((r) => r.json()).then((names) => Promise.all((Array.isArray(names) ? names : []).map((n) => importFn('/skills/' + n + '.js').then((m) => m && m.default).catch(() => null))))
      .then((mods) => mods.filter((m) => m && m.name && typeof m.match === 'function' && Array.isArray(m.examples)))
      .catch(() => { loaded = null; return []; });
  }
  return loaded;
}

/** a soft card that sits beside the stage's own page (it never replaces the open page); the caller escapes every value it puts in `html` */
export function softCard(id, html) {
  document.querySelectorAll('.sph-card[data-sph="' + id + '"]').forEach((n) => n.remove());
  const el = document.createElement('div');
  el.className = 'sph-card'; el.dataset.sph = id; el.setAttribute('role', 'region');
  el.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:40;max-width:min(360px,calc(100vw - 32px));padding:12px 14px;border-radius:14px;border:1px solid var(--edge,#3a3a44);background:rgba(20,20,28,.88);color:inherit;font-size:14px;line-height:1.4;backdrop-filter:blur(8px)';
  el.innerHTML = html; // void-review: ok (the caller escapes every value)
  document.body.appendChild(el);
  return el;
}
