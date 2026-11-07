// Which topics Verse may make a film about (tools/shorts-loop.mjs asks it before it plans a film; tools/video-gate.mjs asks it again
// on the finished film's words; tools/film-cleanup.mjs asks it of every film already listed on /films/). A topic is refused when:
//   math      it is a small everyday sum: splitting a bill, a tip, a discount, a percent, a unit conversion, interest, tax, a price per
//             unit. Those films were the only kind made until 2026-11-06 and nobody wanted to watch or share them, so the whole kind is
//             refused, the first time as much as the tenth.
//   harm      it is about a death, a killing, a disaster, a war, abuse or self-harm: a parody of that hurts people, and a fact film
//             about it from a trend list is not Verse's to make.
//   adult     it is sexual or adult content.
//   repeat    it is the same topic as a film of the last REPEAT_DAYS days (the same words, or most of them).
// Pure: every function here reads only its arguments.

export const REPEAT_DAYS = 30;
export const MATH = /(\bsplit(?:ting)?\b[^.?!]{0,40}\b(?:bill|check|cost|rent|ways?)\b|\b(?:dinner|restaurant|grocery|electric|phone)\s+bill\b|\btip(?:s|ping)?\b[^.?!]{0,30}(?:\$|\d|percent|%)|(?:\$|\d|percent|%)[^.?!]{0,30}\btip\b|\bhow much (?:do|should) (?:you|i) tip\b|\d+(?:\.\d+)?\s*%|\bpercent(?:age)?\b|\bdiscount\b|\b\d+\s*off\b|\bsales? tax\b|\b(?:simple|compound) interest\b|\binterest rate\b|\bunit price\b|\bprice per\b|\bper (?:ounce|pound|gram|kilo|liter|litre|gallon|unit)\b|\bconvert(?:ing|er|s)?\b|\bconversion\b|\b(?:cups?|ounces?|oz|grams?|kg|pounds?|lbs?|inches|feet|meters?|miles?|km|mph|kph|celsius|fahrenheit|liters?|gallons?)\s+(?:to|into|in)\s+(?:cups?|ounces?|oz|grams?|kg|pounds?|lbs?|inches|feet|meters?|miles?|km|mph|kph|celsius|fahrenheit|liters?|gallons?)\b|\bhourly (?:wage|rate)\b|\bper hour\b|\bsalary\b|\bpaycheck\b|\bcalculat(?:e|or|ing)\b|\bwho owes\b|\b\$\s?\d+(?:\.\d\d)?\b)/i;
export const HARM = /\b(dies|died|dead|death|deaths|killed|killing|kills|murder\w*|homicide|shoot(?:ing|er|s)|shot dead|stabb\w*|massacre|genocide|war|invasion|airstrike|bomb\w*|terror\w*|hostage\w*|attack(?:s|ed)?|crash(?:es|ed)?|wreck|derail\w*|earthquake|tsunami|hurricane|tornado|wildfire|flood(?:s|ing)?|disaster|victims?|funeral|obituar\w*|suicide|self-harm|overdose|abuse\w*|assault\w*|rape\w*|trafficking|kidnap\w*|missing (?:child|girl|boy|woman|man)|cancer|diagnos\w*|hospitali[sz]ed|arrest\w*|charged with|sentenced|convicted|trial|lawsuit|indicted|scandal)\b/i;
export const ADULT = /\b(porn\w*|sex(?:ual|y)?|nude\w*|naked|onlyfans|xxx|nsfw|erotic\w*|fetish\w*|escort\w*|strip(?:per|club))\b/i;

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set('a an the of and or to in on for with is are was why what how who you your everyone this that it its about after before at by from into vs'.split(' '));
/** the words that name a topic, without the small ones. Pure. */
export const words = (s) => [...new Set(norm(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w)))];
/** the share of a's words that b also has (0..1). Pure. */
export function overlap(a, b) { const A = words(a), B = new Set(words(b)); return A.length ? A.filter((w) => B.has(w)).length / A.length : 0; }

/** whether a topic may become a film. topic: { topic, summary?: [sentences], description? } or a string; recent: [{ topic, day }]
 *  from the loop log; day: 'YYYYMMDD' today. Returns { ok, reasons: [..], kinds: ['math'|'harm'|'adult'|'repeat'] }. Pure. */
export function topicCheck(topic, recent = [], day = null) {
  const t = typeof topic === 'string' ? { topic } : topic || {};
  const name = String(t.topic || '').trim(), text = [name, t.description, t.news, ...(t.summary || []).slice(0, 2)].filter(Boolean).join('. ');
  const reasons = [], kinds = [];
  if (!name) { reasons.push('no topic'); kinds.push('empty'); }
  if (MATH.test(name + ' ' + (t.description || ''))) { reasons.push('a small everyday sum (bills, tips, percents, conversions): nobody shares these'); kinds.push('math'); }
  if (HARM.test(text)) { reasons.push('about harm to people (' + text.match(HARM)[0] + '): not something to parody or make a trend film of'); kinds.push('harm'); }
  if (ADULT.test(text)) { reasons.push('adult content'); kinds.push('adult'); }
  const cutoff = day ? dayMinus(day, REPEAT_DAYS) : null;
  const twin = (recent || []).find((r) => r && r.topic && (!cutoff || String(r.day || '') >= cutoff) && (norm(r.topic) === norm(name) || (overlap(name, r.topic) >= 0.6 && overlap(r.topic, name) >= 0.6)));
  if (twin) { reasons.push('a repeat of the film about "' + twin.topic + '" (' + twin.day + ')'); kinds.push('repeat'); }
  return { ok: !reasons.length, reasons, kinds };
}
/** 'YYYYMMDD' minus n days. Pure. */
export function dayMinus(day, n) {
  const d = new Date(String(day).replace(/^(\d{4})(\d\d)(\d\d)$/, '$1-$2-$3') + 'T00:00:00Z');
  return new Date(+d - n * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
}
/** the words of a film already made (title, description, hook) checked for the refused kinds only, never as a repeat. Pure. */
export function filmWordsCheck(w) {
  const text = [w && w.title, w && w.hook, w && w.description].filter(Boolean).join('. ').replace(/https?:\/\/\S+/g, ' ').replace(/#\w+/g, ' ');
  const kinds = [];
  if (MATH.test(text)) kinds.push('math');
  if (ADULT.test(text)) kinds.push('adult');
  return { ok: !kinds.length, kinds };
}
