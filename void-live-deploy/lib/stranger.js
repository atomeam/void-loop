// The stranger test (owner, 2026-11-20: "nobodys building the correct system or anything good"; "we have to design it to be good, we may
// have to build and invent things that dont exist yet"; "overall everything just needs updated and improved"). Everything Verse ships or
// publishes (pages, tools, games, answer cards, videos, podcasts, posts) is judged the way a stranger would judge it, on six checks:
//   works    it works live on a desktop and a phone: the main action completes, no errors, the result is right (tools/quality-measure.mjs)
//   looks    it looks professional: no raw logs, ids or code on screen, a sound layout, real pictures that match, a natural voice
//   claims   every promise or link it makes goes to something that works
//   names    it is called what people already call it
//   rival    it is not worse than the best at the same job (the Tower's gap; the compare itself stays owner-only)
//   purpose  it has a reason to exist and pays off what it promises: no fill-in-the-blank template, no one dry encyclopedia line
// The judge is a model (Workers AI or Groq, never a free tier that may train on what it reads) plus measures; a check the model could
// not answer is 'unknown': verdict() below leaves it out of a sign-off (tools/stranger.test.mjs checks it). Pure; no model is named here.
// Wired by tools/stranger-test.mjs: a pull-request check, a pre-publish gate for videos, podcasts and posts, and the live loop.

export const CHECKS = Object.freeze([
  { id: 'works', name: 'Works live' }, { id: 'looks', name: 'Looks professional' }, { id: 'claims', name: 'No false claims' },
  { id: 'names', name: 'Standard name' }, { id: 'rival', name: 'As good as the best' }, { id: 'purpose', name: 'Real purpose' },
]);
export const KINDS = Object.freeze(['page', 'tool', 'game', 'card', 'video', 'podcast', 'post']);
// the Tower's gap (0-100) above which an item is behind the best at its job; the quality board's own pinnacle bar sits at 90
export const RIVAL_GAP = 25;
// a template: this share of the shorter item's lines (each topic taken out) is word for word the same in another item on another topic
export const TEMPLATE_SHARE = 0.5;
// an item that failed the same check this many times after improve jobs, with no gain, needs a new approach (an invent job)
export const INVENT_AFTER = 2;

/** a short stable hash of an item's content (FNV-1a, 64 bits as hex), so an unchanged item is never checked twice. Pure. */
export function fingerprint(content) {
  let h = 0xcbf29ce484222325n; const s = typeof content === 'string' ? content : JSON.stringify(content);
  for (let i = 0; i < s.length; i++) { h ^= BigInt(s.charCodeAt(i)); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; }
  return h.toString(16).padStart(16, '0');
}

/** true when the ledger signed this item off at this exact content. Pure. */
export const signedOff = (ledger, id, hash) => !!(ledger && ledger.items && ledger.items[id] && ledger.items[id].pass && ledger.items[id].hash === hash);

/** the items to check now: never a signed-off unchanged one; the lowest-scoring first, then the never-scored, then the longest unchecked. Pure. */
export function pickNext(items, ledger, n = 10) {
  const led = (ledger && ledger.items) || {};
  const todo = (items || []).filter((it) => it && it.id && !signedOff(ledger, it.id, it.hash));
  const key = (it) => { const r = led[it.id]; return r && Number.isFinite(r.score) ? [0, r.score, Date.parse(r.at) || 0] : [1, 0, it.score != null ? it.score : 101]; };
  todo.sort((a, b) => { const x = key(a), y = key(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
  return todo.slice(0, n);
}

/** the lines of a media item a viewer reads or hears: captions, beats, title. Pure. */
export function linesOf(item) {
  const out = [];
  for (const c of (item && (item.captions || item.beats)) || []) { const t = typeof c === 'string' ? c : c && c.text; if (t && !/^cta$/i.test(c.kind || '')) out.push(String(t)); }
  if (!out.length && item && item.text) out.push(...String(item.text).split(/\n+/));
  return out.map((s) => s.trim()).filter(Boolean);
}
const norm = (line, topic) => {
  let s = String(line).toLowerCase();
  for (const t of [topic, ...(String(topic || '').match(/^[^(]+/) || [])].filter(Boolean)) s = s.split(String(t).toLowerCase().trim()).join('{t}');
  return s.replace(/[^\w{}]+/g, ' ').trim();
};

/** purpose, measured: (a) the item is a fill-in-the-blank template when most of its own lines, with its topic taken out, are word for word
 *  another item's lines on a different topic; (b) it is one dry encyclopedia line when it states at most one fact and that fact is all it
 *  has. Returns { ok, why[], template: [other ids], facts }. Pure. */
export function purposeShape(item, others = []) {
  const topic = item.topic || item.name || '', mine = linesOf(item).map((l) => norm(l, topic)).filter((l) => l.length > 3);
  const why = [], twins = [];
  for (const o of others || []) {
    if (!o || o.id === item.id || (o.topic || o.name) === topic) continue;
    const theirs = new Set(linesOf(o).map((l) => norm(l, o.topic || o.name)));
    const same = mine.filter((l) => theirs.has(l)).length;
    if (mine.length && theirs.size && same / Math.min(mine.length, theirs.size) >= TEMPLATE_SHARE) twins.push(o.id);
  }
  if (twins.length) why.push('a fill-in-the-blank template: ' + Math.round(100 * TEMPLATE_SHARE) + '% or more of its lines are word for word the same as ' + twins.length + ' other item' + (twins.length > 1 ? 's' : '') + ' with only the topic swapped');
  const facts = ((item.beats || item.timing && item.timing.beats || []).filter((b) => b && b.kind === 'fact').length) || (item.facts != null ? +item.facts : null);
  if (facts != null && facts <= 1 && /wikipedia|encyclop/i.test(String(item.source || (item.footage && item.footage.source) || item.description || ''))) why.push('one dry encyclopedia line is all it says (' + facts + ' fact)');
  return { ok: !why.length, why, template: twins, facts };
}

/** the links and site addresses a piece of text promises. Pure. */
export function claimsOf(text) {
  const s = String(text || ''), out = new Set();
  for (const m of s.matchAll(/https?:\/\/[^\s"'<>)]+/g)) out.add(m[0].replace(/[.,;:!?]+$/, ''));
  for (const m of s.matchAll(/(?<![\w/.])a-to-mind\.com(\/[^\s"'<>)]*)?/g)) out.add('https://' + m[0].replace(/[.,;:!?]+$/, ''));
  return [...out];
}

/** what a stranger sees that is not for them: an error, a stack trace, a template hole, a file path or a long raw id. Measures leaks, not words. Pure. */
export function rawLeaks(text) {
  const s = String(text || ''), hits = [];
  if (/\bat [\w.$<>]+ \([^)]*:\d+:\d+\)|Traceback \(most recent|\bTypeError:|\bReferenceError:|SyntaxError:/.test(s)) hits.push('a stack trace or error');
  if (/\bundefined\b|\bNaN\b|\[object \w+\]|\{\{\s*\w+\s*\}\}|\$\{\w+\}/.test(s)) hits.push('a template hole (undefined, NaN or {{ }})');
  if (/(?:^|\s)(?:\.{0,2}\/)?(?:tools|functions|void-live-deploy|lib|src)\/[\w./-]+\.(?:mjs|js|py|json|ts)\b/.test(s)) hits.push('a source file path');
  if (/\b[0-9a-f]{24,}\b/i.test(s)) hits.push('a long raw id or hash');
  return hits;
}

/** the rival check from the Tower's gaps (tower.frontier.json, read by towerGaps in lib/quality.js). Never names the rival. Pure. */
export function rivalCheck(path, gaps = {}) {
  const g = gaps && path != null ? gaps[path] : undefined;
  if (g == null) return { ok: null, detail: 'no rival measured for this job yet' };
  return { ok: g < RIVAL_GAP, detail: g < RIVAL_GAP ? 'within ' + Math.round(g) + ' points of the best at this job' : Math.round(g) + ' points behind the best at this job (the compare is in the Tower)' };
}

/** the model's verdict text read into { looks, claims, names, purpose } each { ok, why }; null when unreadable. Pure. */
export function readJudge(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/); if (!m) return null;
  let j; try { j = JSON.parse(m[0]); } catch (_) { return null; }
  const out = {};
  for (const k of ['looks', 'claims', 'names', 'purpose']) {
    const v = j[k]; if (v == null) continue;
    const ok = typeof v === 'object' ? v.ok : v; out[k] = { ok: ok === true || ok === 'yes' || ok === 'pass', why: String((typeof v === 'object' && (v.why || v.reason)) || '').slice(0, 240) };
  }
  if (j.standard_name) out.standardName = String(j.standard_name).slice(0, 80);
  return Object.keys(out).length ? out : null;
}

/** the judge's question for one item: plain, the six checks, a JSON answer. Pure. */
export function judgePrompt(item) {
  const kind = item.kind || 'page';
  return 'You are a stranger who just met this ' + kind + ' on a website or in a social feed. Judge it honestly, against the best ' + kind + 's made by anyone. '
    + 'Answer only JSON: {"looks":{"ok":bool,"why":""},"claims":{"ok":bool,"why":""},"names":{"ok":bool,"why":""},"purpose":{"ok":bool,"why":""},"standard_name":""}. '
    + 'looks: professional, real matching pictures, no raw data or code, a natural human-sounding voice if it speaks. '
    + 'claims: every promise it makes (what you can do, where to go) is believable and specific. '
    + 'names: the title is the plain name people already search for this kind of thing; standard_name is that name. '
    + 'purpose: it gives you something real (an answer, a laugh, a skill, a tool that does the job) and pays off its own hook; hype wrapped around one dry encyclopedia sentence, or a fill-in-the-blank template, fails. '
    + '\nTitle: ' + String(item.title || item.hook || item.id).slice(0, 200) + '\nWhat it shows or says:\n' + linesOf(item).concat(item.visible ? [String(item.visible)] : []).join('\n').slice(0, 3000);
}

/** the six checks into one verdict: pass only when every check is ok; a check nobody could answer is 'unknown' and blocks a sign-off. Pure. */
export function verdict(checks) {
  const list = CHECKS.map((c) => ({ id: c.id, name: c.name, ok: checks[c.id] ? checks[c.id].ok : null, why: checks[c.id] ? checks[c.id].why || checks[c.id].detail || '' : 'not checked' }));
  const failed = list.filter((c) => c.ok === false), unknown = list.filter((c) => c.ok == null);
  const score = Math.round(100 * list.filter((c) => c.ok === true).length / list.length);
  return { pass: !failed.length && !unknown.length, fail: failed.length > 0, score, failed: failed.map((c) => c.id), unknown: unknown.map((c) => c.id), checks: list };
}

/** record one verdict on the ledger; keeps the failure count per check so a stuck item becomes an invent job. Pure (returns a new ledger). */
export function record(ledger, item, v, at = new Date().toISOString()) {
  const items = { ...((ledger && ledger.items) || {}) }, prev = items[item.id] || {};
  const stuck = { ...(prev.stuck || {}) };
  for (const c of CHECKS) stuck[c.id] = v.failed.includes(c.id) ? (stuck[c.id] || 0) + 1 : 0;
  items[item.id] = { kind: item.kind, hash: item.hash, pass: v.pass, score: v.score, failed: v.failed, unknown: v.unknown, at, stuck, ...(v.pass ? { signedAt: at } : prev.signedAt ? { lastSignedAt: prev.signedAt, lastSignedHash: prev.pass ? prev.hash : prev.lastSignedHash } : {}) };
  return { ...(ledger || {}), items };
}

/** a regression: the item was signed off before and now fails at new content. Pure. */
export const regressed = (prev, item, v) => !!(prev && (prev.pass || prev.lastSignedAt) && prev.hash !== item.hash && v.fail);

/** the job a failure files into the will engine (domains/inputs/stranger-test/records.jsonl): an improve job, or an invent job when the
 *  same check has failed INVENT_AFTER times after improve jobs, or when nothing free reaches the bar (the rival is far ahead). Pure. */
// a rendered film or episode cannot be patched: when its purpose or its look fails, the way it is made has to change, so it is an invent job at once
export const NO_PATCH = Object.freeze({ video: ['purpose', 'looks'], podcast: ['purpose', 'looks'] });
// where each invent job starts: what nothing free does yet, and the new approach to prototype (owner, 2026-11-20: "we may have to build and invent things that dont exist yet")
export const INVENT_START = Object.freeze({
  'video:purpose': 'a film pipeline of Verse\'s own: a subject people asked about (the miss list, the cards people open), three or more sourced facts that answer its hook, a script written to pay that hook off, and a template-overlap score under 20% against every earlier film',
  'video:looks': 'pictures that match the subject (licensed photos from the subject\'s own page and Wikimedia Commons, checked by the vision model, generated art only when none fits) and a voice picked by ear: each candidate voice read back by the hearing model and judged for natural pace before a film uses it',
  'podcast:looks': 'two natural voices instead of one synthetic reader: each line voiced by the best of the speech models, scored by the hearing model for how human it sounds, with the music ducked under it',
  'podcast:purpose': 'an episode built around one question listeners asked, answered with sources, instead of a log of the week',
  'card:looks': 'card art that is the subject: a licensed photo found by the subject\'s own page, checked by the vision model for a match, painted only when no photo fits, never a generic scene',
  'card:claims': 'sources chosen by meaning: each source must mention the subject, ranked by how directly it answers, and a card that cannot find one says so',
});
export function jobFor(item, v, prev = {}) {
  if (!v.fail) return null;
  const stuck = v.failed.filter((k) => (NO_PATCH[item.kind] || []).includes(k) || ((prev.stuck || {})[k] || 0) + 1 >= INVENT_AFTER);
  const invent = stuck.length > 0;
  const what = v.checks.filter((c) => c.ok === false).map((c) => c.name.toLowerCase() + ': ' + c.why).join('; ');
  if (!invent) return { type: 'stranger-improve', item: item.id, kind: item.kind, failed: v.failed, want: { title: 'make ' + item.id + ' pass the stranger test', why: what, weight: 9 } };
  return { type: 'stranger-invent', item: item.id, kind: item.kind, failed: v.failed,
    want: { title: 'invent a new way to make ' + item.kind + 's like ' + item.id + ' good: ' + stuck.join(', '), why: 'improve jobs did not reach the bar (' + what + '); design Verse\'s own approach, combining models and tools in a new way or a new interface', weight: 11 },
    invent: { key: item.kind + ':' + stuck.join(','), spec: (stuck.map((k) => INVENT_START[item.kind + ':' + k]).filter(Boolean).join('; ') || 'what professional looks like for this ' + item.kind + ', and what no existing free tool does') + '; passing means the stranger test checks ' + stuck.join(', ') + ' pass', prototype: 'one working version on a helper/* branch', measure: { before: v.score, after: null, bar: 100 } } };
}
