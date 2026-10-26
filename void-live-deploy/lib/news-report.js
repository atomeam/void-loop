// "Verse reports" on /news/ (owner, 2026-10-26: "no reason we cant have everything they have, Verse can be the reporter"): short write-ups of what the
// feeds already say, never news Verse found itself. Three kinds: a summary of one story told by several sources ("cluster"), a daily brief across the
// sections ("brief"), and what changed since this morning on the topics a visitor follows ("changes"). Pure; the page (news/index.html) and /api/answer
// mode 'report' both use it. Tests: tools/news-report.test.mjs.
//
// THE RULES (the owner's): grounded and attributed. Step 1 is a deterministic draft built only from the feeds' own headlines and summaries, each
// sentence naming the sources that said it, and flagging figures the sources give differently. Step 2 asks the free text model to polish the draft;
// step 3 VALIDATES the polish: every capitalised name, number, date and number-word in it has to appear in the source text, it may not add a quote
// the feeds did not carry, may not speak as a person or a reporter, may not drift from the source's own words, and has to name a source. A polish that
// fails any check is thrown away and the draft is shown. Nothing here implies a human reporter: the label is always "Written by Verse from <sources>".
import { SOURCES, SECTIONS } from './news.js';

export const KINDS = Object.freeze(['cluster', 'brief', 'changes']);
export const LIMITS = Object.freeze({ items: 24, title: 300, summary: 220, topics: 5, topic: 30, text: 900 });
const nameOf = (id) => (SOURCES[id] || [id])[0];
const uniq = (a) => [...new Set(a)];
/** "A", "A and B", "A, B and C". Pure. */
export const joinNames = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const endDot = (s) => String(s).trim().replace(/[\s.!?:;,]+$/, '') + '.';
const num = (s) => String(s).replace(/,/g, '').replace(/[.]+$/, '');
const NUMBER = /\d[\d,]*(?:\.\d+)?/g;
/** the figures in a text, commas out ("1,200" is "1200"). Pure. */
export const numbersIn = (t) => (String(t).match(NUMBER) || []).map(num);
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

/** figures two sources give differently for the same story: "BBC News gives 12; The Guardian gives 14", or '' when none disagree. Pure. */
export function disagreement(items) {
  const by = new Map(); for (const i of items) { const k = i.src; by.set(k, new Set([...(by.get(k) || []), ...numbersIn(i.title + ' ' + (i.summary || '')).filter((n) => !/^(?:19|20)\d\d$/.test(n))])); }
  const srcs = [...by.entries()].filter(([, s]) => s.size); if (srcs.length < 2) return '';
  const [a, b] = srcs, onlyA = [...a[1]].filter((n) => !b[1].has(n)), onlyB = [...b[1]].filter((n) => !a[1].has(n));
  return onlyA.length && onlyB.length ? 'The sources differ on the figures: ' + nameOf(a[0]) + ' gives ' + onlyA.slice(0, 2).join(' and ') + ', ' + nameOf(b[0]) + ' gives ' + onlyB.slice(0, 2).join(' and ') + '.' : '';
}
/** the draft of one story from its sources' items [{ src, title, summary }]. Pure. */
export function draftCluster(items) {
  const names = uniq(items.map((i) => nameOf(i.src))), lead = items[0], withSum = items.find((i) => i.summary);
  return [('According to ' + joinNames(names) + ': ' + endDot(lead.title)), withSum ? nameOf(withSum.src) + ' adds: ' + endDot(withSum.summary) : '', disagreement(items)].filter(Boolean).join(' ');
}
const ORDER = ['top', 'world', 'uk', 'us', 'business', 'tech', 'science', 'sport', 'culture'];
/** the day's brief from stories [{ sec, srcs: [ids], title, summary }]: the biggest story of each section, then a second of the top, 5 to 8 sentences. Pure. */
export function draftBrief(stories) {
  const out = [], bySec = new Map();
  for (const s of stories) { const l = bySec.get(s.sec) || []; l.push(s); bySec.set(s.sec, l); }
  const line = (s) => 'According to ' + joinNames(uniq(s.srcs.map(nameOf))) + ' (' + (SECTIONS[s.sec] || s.sec).toLowerCase() + '): ' + endDot(s.title);
  for (const sec of ORDER) { const l = bySec.get(sec); if (l && l.length) out.push(line(l[0])); }
  const top = bySec.get('top') || []; for (const s of top.slice(1)) { if (out.length >= 8) break; out.push(line(s)); }
  return out.slice(0, 8).join(' ');
}
/** what changed on the topics followed: [{ topic, srcs, title }] -> sentences grouped by topic. Pure. */
export function draftChanges(found) {
  const by = new Map(); for (const f of found) { const l = by.get(f.topic) || []; l.push(f); by.set(f.topic, l); }
  return [...by.entries()].map(([topic, l]) => 'On ' + topic + ' since this morning: ' + l.slice(0, 3).map((f) => 'according to ' + joinNames(uniq(f.srcs.map(nameOf))) + ', ' + endDot(f.title).replace(/^./, (c) => c)).join(' ')).join(' ');
}
/** the stories (with their time) that mention a followed topic and are newer than `since` (ms): [{ topic, srcs, title, sec }]. Pure. */
export function changedOn(stories, topics, since) {
  const out = [];
  for (const topic of topics) for (const s of stories) {
    if (!(s.t >= since) || !(s.title + ' ' + (s.summary || '')).toLowerCase().includes(String(topic).toLowerCase())) continue;
    out.push({ topic, srcs: uniq([s.src, ...(s.also || []).map((a) => a.src)]), title: s.title });
  }
  return out;
}
/** 06:00 this morning in the visitor's own time (yesterday's when it is not 06:00 yet), in ms. Pure given `now`. */
export function morning(now = Date.now()) { const d = new Date(now); d.setHours(6, 0, 0, 0); if (d.getTime() > now) d.setDate(d.getDate() - 1); return d.getTime(); }

// ---- the model's part: what it is asked, what is checked ----
export const REPORT_SYSTEM = 'You rewrite a short news draft in plain, neutral words. Use ONLY the facts in the draft and source text you are given. '
  + 'Keep who said what: name the sources ("According to ..."). Add no name, number, date, place, cause or detail that is not in the source text. '
  + 'No opinion, no adjectives that judge, no quotation marks unless the source has them, no first person, never say or suggest a human reporter wrote it. '
  + 'If the sources differ on a fact, keep that difference. Keep it to the same number of sentences or fewer. Reply with the text only.';
const FUNCTION_WORDS = new Set('according to the a an and or but in on at of for with by from as it its this that these those is are was were has have had be been not no also while after before over under into about said says say reports report reported both all some one two'.split(' '));
const NUMWORDS = /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|forty|fifty|hundred|thousand|million|billion|dozens?|hundreds|thousands|millions)\b/gi;
const CALENDAR = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|yesterday|tonight)\b/gi;
const words = (t) => String(t).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}’'-]*/gu) || [];
const stem = (w) => w.replace(/['’]s$/, '').slice(0, 5);
/** why a polished text is not fit to show, or '' when it is: every name, number and date must be in the source text. Pure. */
export function problem(polished, source, names = []) {
  const t = String(polished || '').trim(), src = String(source || '');
  if (t.length < 20) return 'too short'; if (t.length > LIMITS.text) return 'too long';
  const have = new Set(words(src)), srcNums = new Set(numbersIn(src));
  if (/["“”«»„]/.test(t) && !/["“”«»„]/.test(src)) return 'a quotation the sources do not carry';
  if (/\b(?:I|I'm|I’m)\b/.test(t) || /\b(?:we|we're|we’re|our|my)\b/i.test(t)) return 'speaks as a person';
  if (/\b(?:reporter|correspondent|journalist|our team|exclusive|breaking)\b/i.test(t) && !/\b(?:reporter|correspondent|journalist|exclusive|breaking)\b/i.test(src)) return 'implies a reporter';
  for (const n of numbersIn(t)) if (!srcNums.has(n)) return 'a number not in the sources: ' + n;
  for (const m of t.match(NUMWORDS) || []) if (!have.has(m.toLowerCase())) return 'a number word not in the sources: ' + m;
  for (const m of t.match(CALENDAR) || []) if (!have.has(m.toLowerCase())) return 'a date word not in the sources: ' + m;
  const sentences = t.split(/(?<=[.!?:])\s+/);
  for (const s of sentences) { const toks = s.match(/[\p{Lu}][\p{L}\p{N}’'-]*/gu) || []; let first = true;
    for (const tok of toks) { const lo = tok.toLowerCase().replace(/['’]s$/, ''), atStart = first && s.startsWith(tok); first = false; if (have.has(lo) || have.has(tok.toLowerCase())) continue; if (atStart && FUNCTION_WORDS.has(lo)) continue; return 'a name not in the sources: ' + tok; } }
  const srcStems = new Set([...have].map(stem)), content = words(t).filter((w) => w.length >= 5 && !FUNCTION_WORDS.has(w)), foreign = content.filter((w) => !srcStems.has(stem(w)));
  if (content.length && foreign.length / content.length > 0.3) return 'words that are not the sources\': ' + foreign.slice(0, 3).join(', ');
  if (names.length && !names.some((n) => t.includes(n))) return 'names no source';
  return '';
}
/** the text to show: the polish if it passes, else the draft; { text, polished, why }. Pure. */
export function settle(polished, draft, source, names) {
  if (!polished) return { text: draft, polished: false, why: 'no polish' };
  const why = problem(polished, source, names); return why ? { text: draft, polished: false, why } : { text: String(polished).trim(), polished: true, why: '' };
}
/** the label under every piece. Pure. */
export function label(names, at = Date.now(), polished = false) {
  const d = new Date(at), hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  return 'Written by Verse from ' + joinNames(names) + ' · ' + hm + (polished ? '' : ' · assembled straight from the headlines');
}

/** a request body checked and turned into what the route needs: { kind, draft, source, names, key } or { error }. Pure. */
export function prepare(body) {
  const kind = KINDS.includes(body && body.kind) ? body.kind : null, raw = Array.isArray(body && body.items) ? body.items.slice(0, LIMITS.items) : null;
  if (!kind || !raw || !raw.length) return { error: 'empty' };
  const items = raw.map((i) => ({ src: SOURCES[i && i.src] ? i.src : '', srcs: Array.isArray(i && i.srcs) ? i.srcs.filter((x) => SOURCES[x]).slice(0, 8) : [], sec: SECTIONS[i && i.sec] ? i.sec : 'top', topic: clean(i && i.topic, LIMITS.topic),
    title: clean(i && i.title, LIMITS.title), summary: clean(i && i.summary, LIMITS.summary) })).filter((i) => i.title && (kind === 'cluster' ? i.src : i.srcs.length));
  if (!items.length) return { error: 'empty' };
  const draft = kind === 'cluster' ? draftCluster(items) : kind === 'brief' ? draftBrief(items) : draftChanges(items.map((i) => ({ topic: i.topic || 'your topics', srcs: i.srcs, title: i.title })));
  const source = items.map((i) => i.title + '. ' + (i.summary || '')).join('\n') + '\n' + uniq(items.flatMap((i) => (kind === 'cluster' ? [i.src] : i.srcs)).map(nameOf)).join(' ') + (kind === 'changes' ? '\n' + items.map((i) => i.topic).join(' ') : '') + (kind === 'brief' ? '\n' + items.map((i) => (SECTIONS[i.sec] || '')).join(' ') : '');
  const names = uniq(items.flatMap((i) => (kind === 'cluster' ? [i.src] : i.srcs)).map(nameOf));
  return { kind, draft, source, names, items };
}
