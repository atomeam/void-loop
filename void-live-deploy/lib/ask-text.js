/**
 * ask-text — the one place an ask is tidied before a skill matches it (convergence step 1, docs/convergence.md).
 * Twenty-three skills each kept their own copy of these two lines; they now import them from here.
 *   clean(s):      trim, drop trailing ? ! ., collapse spaces       ("  Show   me X?! " -> "Show me X")
 *   cleanLower(s): the same, lower-cased                             ("  Show   me X?! " -> "show me x")
 */
export const clean = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
export const cleanLower = (s) => clean(s).toLowerCase();
// long pasted prose (a status report, an email): keyword skills (air, weather, time, country...) must not fire on a word buried in it
// and read the whole paste as a city. Two or more sentences and over 25 words, or over 220 characters, unless it opens with an
// instruction for a skill that takes long text ("summarize this transcript: ...", "review this ...", "translate ..."). Pure.
const LONG_LEAD = /^(?:please\s+)?(?:summari[sz]e|digest|tl;?dr|transcript|captions|review|fix|debug|translate|remember|note|sticky|list|draft|write|proposal|keep|my\s+\w+\s+(?:workflow|automation)|```)/i;
export function isLongProse(s) {
  const t = String(s || '').trim();
  if (LONG_LEAD.test(t)) return false;
  const words = t.split(/\s+/).length, sentences = (t.match(/[.!?](?:\s|$)/g) || []).length;
  return t.length > 220 || (words > 25 && sentences >= 2);
}
// skills that are made for long text and still run on it
export const LONG_OK = new Set(['telemetry-route', 'digest', 'translate', 'memory', 'proposal', 'notepad', 'sticky', 'list', 'automations', 'actions', 'link']);

// A tool on the stage opens only when the message asks for it (owner, 2026-10-30: "when clock is mentioned in any message it opens
// the clock only on verse"). The page's own parser matched the tool's word: "we worked around the clock", "my clock is broken",
// "I set a timer earlier but it never rang" and a pasted report that named the clock card each put a tool on the stage.
const STAGE_VERB = /^(?:make|add|create|put|place|drop|spawn|draw|set|start|stop|pause|reset|resume|restart|show|open|give|bring|get|remove|delete|clear|hide|close|dismiss|move|change|turn|paint|colou?r|tint|resize|grow|shrink|enlarge|pin|write|type|tick|check|uncheck|cross|count|new|wipe|undo|edit|rename|label)\b/;
// the polite words in front of a command ("ok now", "can you", "i want you to", "let's")
const LEAD = /^(?:(?:ok(?:ay)?|now|and|then|also|so|hey|verse|please|pls|yes|yeah|good|great|nice|cool|perfect|thanks)\b[\s,!.]*)*(?:(?:can|could|would|will)\s+(?:you|u)\s+|(?:i|we)\s+(?:want|need|would\s+like|'d\s+like)\s+(?:you\s+)?to\s+|let'?s\s+|go\s+ahead\s+and\s+|just\s+|please\s+)*/;
// a want for a thing: "i want a big red clock", "give me a timer", "can i have a list"
const WANT = /^(?:(?:i|we)\s+(?:want|need|would\s+like|'d\s+like|wanna)\b|(?:give|get)\s+me\b|(?:can|could|may)\s+(?:i|we)\s+(?:have|get)\b)/;
// a labelled ask for a stage tool: "note: buy milk", "my shopping list: milk, eggs"
const LABELLED = /^(?:(?:my|a|the|new)\s+)?(?:\w+\s+)?(?:note|sticky|list|todo|to-?do|checklist|notepad|timer|clock|counter|reminder)s?\s*:/;
// a sentence about something, not an ask: "my clock is broken", "the timer card now counts down", "it's too small"
const SPEAKER = /^(?:i|i'm|i've|i'd|i'll|we|we're|we've|my|our|the|that|this|these|those|it|it's|its|there|there's|you|you're|your|they|they're|their|he|she|his|her)\b/;
const tidy = (s) => String(s || '').trim().toLowerCase().replace(/[‘’]/g, "'");
/** the ask opens with a command for the stage, after any polite words. Pure. */
export const opensWithCommand = (s) => STAGE_VERB.test(tidy(s).replace(LEAD, ''));
/** pasted text, not a typed ask: more than one line, two or more sentences, or over 160 characters. Pure. */
export function isPasted(s) {
  const t = String(s || '').trim();
  return /[\n⏎]/.test(t) || t.length > 160 || (t.match(/[.!?](?:\s|$)/g) || []).length >= 2;
}
/** the ask is for the stage: a command, a want or a labelled ask, or a short ask that is not a sentence about something ("a big
 *  red clock", "clock blue"). A paste that does not open with one of those, and a sentence about a tool, ask for nothing. `terse`
 *  says that every word is one of the stage's own ("the timers are blue"); the page knows those words (onlyStageWords). Pure. */
export function asksTheStage(s, terse = false) {
  const t = tidy(s), bare = t.replace(LEAD, '');
  if (!t) return false;
  if (opensWithCommand(t) || WANT.test(bare) || LABELLED.test(t)) return true;
  if (isPasted(t)) return false;
  if (withoutIdioms(t) !== t.replace(/\s+/g, ' ')) return false; // "around the clock" names no tool: the idiom is the whole point
  return terse || !SPEAKER.test(bare);
}
/** the ask may make a new tool: a command, a want, or the stage's own words only ("a big red clock"). "around the clock" and
 *  "clock tower photos" make nothing. Pure. */
export const asksToMake = (s, terse = false) => opensWithCommand(s) || WANT.test(tidy(s).replace(LEAD, '')) || terse;
// idioms that name a tool and ask for none ("around the clock", "5 o'clock", "beat the clock", "over the counter")
const IDIOMS = [
  /\b(?:a)?round[\s-]the[\s-]clock\b/g,
  /\bo'\s?clock\b/g,
  /\b(?:i|we|you|they|he|she|to|and|just|already|not)\s+clock(?:s|ed)?\s+(?:in|out|off)\b/g,
  /\b(?:against|beat|beating|race|racing|run(?:ning)?\s+(?:out|down)|turn(?:ed|ing)?\s+back|watch(?:ed|ing)?)\s+the\s+clock\b/g,
  /\b(?:the\s+)?clock\s+is\s+ticking\b/g,
  /\b(?:body|biological|inner|internal|circadian|cpu|atomic|doomsday|shot|game)\s+clocks?\b/g,
  /\bclock\s+(?:speeds?|rate|cycles?|towers?|radio|skew|drift)\b/g,
  /\bset\s+(?:the\s+)?clocks?\s+(?:back|forward|ahead)\b/g,
  /\bover[\s-]the[\s-]counter\b/g,
];
/** the ask with those idioms taken out, for the words that pick a tool. Pure. */
export const withoutIdioms = (s) => IDIOMS.reduce((t, re) => t.replace(re, ' '), tidy(s)).replace(/\s+/g, ' ').trim();
