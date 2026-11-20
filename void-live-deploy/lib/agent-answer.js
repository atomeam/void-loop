// Which bot takes an agent task, and whether its reply actually answered. Pure. The loose word overlap in lib/agent-core.js
// pickBot handed "three free things to do in Savannah" to keyword-finder because both lines contain "three". A bot is used
// only when its declared job matches; an open ask goes to the answer pipeline, and a reply that only echoes the ask is rejected.
const STOP = new Set('a an the to for of and or in on me my it is be with this that what how can you please make write give do does did just'.split(' '));
// words that show up in a job line without being the job ("top three key words in a text" is about key words, not the number three)
const FILLER = new Set('one two three four five six seven eight nine ten top first most last single every text line lines note notes your all per each thing things item items list lists show tell turn turns keep keeps from into using based about some'.split(' '));
const SHORT = new Set('km lb kg ft oz mi hr mb gb tb px'.split(' '));
const stem = (w) => {
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ers') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('er') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
};
/** content stems of a line. Short unit tokens (km, lb) count; filler and glue do not. Pure. */
export function askTerms(s) {
  const out = [];
  for (const w of String(s || '').toLowerCase().match(/[a-z0-9]+/g) || []) {
    if (/^\d+$/.test(w) || w.length < 2 || (!SHORT.has(w) && w.length < 3)) continue;
    const st = stem(w);
    if (STOP.has(w) || STOP.has(st) || FILLER.has(w) || FILLER.has(st)) continue;
    out.push(st);
  }
  return out;
}
// an open question wants new information, not a transform of the words it already used
const OPEN = /\b(things to do|ideas?|recommend|suggest|itinerary|what should|where can|where should|how do i|how can i|how should i|help me|pack for|weeknight|weekend|rainy[- ]day|apologi[sz]e|activities|places to|dinner)\b/i;
const NOT_OPEN = /\b(keywords?|key words|word count|count the words|percent|prime|binary|roman numeral|base64|status code|miles to|to km|to miles)\b/i;
/** true when the ask is an open question rather than a job a single bot was built to compute. Pure. */
export function openEnded(ask) {
  const t = String(ask || '').trim();
  if (NOT_OPEN.test(t)) return false;
  return OPEN.test(t) || /^(?:list|name|give me|what are|tell me)\b/i.test(t);
}
// A narrow bot is built to turn one kind of input into one kind of output. It may claim an ask only when the ask carries that input.
// A question or a request to write, with no numbers, quoted text or pasted text in it, is the general answerer's, however many words
// it shares with a bot's job line ("the difference between X and Y" is not "days between two dates").
const ASKING = /^(?:please\s+|can you\s+|could you\s+|would you\s+)?(?:what|why|how|who|when|where|which|whose|explain|describe|define|compare|contrast|tell me|should|is|are|was|were|can|could|does|do|did|will|would|write|draft|compose|give me|suggest|recommend|summari[sz]e|help me)\b/i;
/** the ask carries something to work on: a digit, a quoted or pasted text, a link, or a line after a colon. Pure. */
export const hasPayload = (ask) => { const t = String(ask || ''); return /\d/.test(t) || /["\u201c\u201d`]|\bhttps?:\/\/|\n/.test(t) || /:\s*\S+(?:\s+\S+){2,}/.test(t) || /'[^']{12,}'/.test(t); };
/** a question or a writing request with nothing to work on: the general answerer's job. Pure. */
export const isKnowledgeAsk = (ask) => { const t = String(ask || '').trim(); return !!t && !hasPayload(t) && (ASKING.test(t) || /\?\s*$/.test(t)); };
/** the bot needs input (its probe in the registry has one). A bot with none (a coin, a joke) can answer a bare ask. Pure. */
const needsInput = (b) => !!(b && b.probe && String(b.probe.in || '').trim());
/** can the bot take this ask at all? Its example input has digits and the ask has none: no. A knowledge ask with no payload and a bot that needs one: no. Pure. */
export function canTake(ask, b) {
  if (!needsInput(b)) return true;
  if (/\d/.test(b.probe.in) && !/\d/.test(ask)) return false;
  return !isKnowledgeAsk(ask);
}
const purposeOf = (b) => new Set(askTerms([b.name || b.id || '', b.description || '', b.job || '', ...(b.examples || [])].join(' ')));
// the name's own words, unstemmed ("percent-bot" declares percent; "word-counter" does not declare "count")
const rawId = (b) => new Set(String(b.name || b.id || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 5));
const slim = (b) => ({ name: String(b.name || b.id), description: String(b.description || b.job || 'the answer pipeline').slice(0, 160) });
const GENERAL = { name: 'verse', description: 'the answer pipeline' };

/** the words of the ask that say what to do: quoted or pasted text is the thing worked on, so its words never pick a bot (a bike lane in a quoted news story is not a lane). Pure. */
export function instructionTerms(ask) {
  const bare = String(ask || '').replace(/"[^"]*"|\u201c[^\u201d]*\u201d|`[^`]*`|(?<![A-Za-z])'[^']{12,}'(?![A-Za-z])/g, ' ');
  const t = askTerms(bare);
  return t.length ? t : askTerms(ask);
}
/** live bots whose declared purpose matches, best first, then Verse's answer pipeline. A shared filler word is not a match. Pure. */
export function botChoices(ask, bots) {
  const want = new Set(instructionTerms(ask));
  const open = openEnded(ask);
  const live = (bots || []).filter((b) => !b.status || b.status === 'live');
  const purposes = live.map(purposeOf);
  const owners = new Map();
  for (const b of live) for (const w of rawId(b)) owners.set(w, (owners.get(w) || 0) + 1);
  const ranked = [];
  live.forEach((b, i) => {
    if (!canTake(ask, b)) return;
    const hit = [...purposes[i]].filter((w) => want.has(w));
    const named = rawId(b);
    let score = 0;
    // two purpose words, or the bot's own name when that name is not shared and the ask is not an open question
    if (hit.length >= 2) score = hit.length;
    else if (hit.length === 1 && !open && named.has(hit[0]) && owners.get(hit[0]) === 1) score = 1;
    // among bots that match, the one whose own name says the job comes first (summarize -> summarizer, not a bot that shares the word "sentence")
    const nm = new Set(askTerms(String(b.name || b.id || '').replace(/[-_]+/g, ' ')));
    const named2 = hit.filter((w) => [...nm].some((x) => x === w || (x.length >= 4 && w.length >= 4 && x.slice(0, 4) === w.slice(0, 4)))).length;
    if (score) ranked.push({ b, score, named: named2, n: purposes[i].size });
  });
  ranked.sort((a, c) => c.named - a.named || c.score - a.score || a.n - c.n || slim(a.b).name.localeCompare(slim(c.b).name));
  const out = ranked.map((r) => slim(r.b));
  if (!out.some((b) => b.name === 'verse')) out.push(GENERAL);
  return out;
}
/** try order: each real match once, then the answer pipeline, then one stricter retry of it. Pure. */
export function attemptsFor(ask, bots) {
  const specs = botChoices(ask, bots).filter((b) => b.name !== 'verse');
  return [...specs.map((b) => ({ ...b, repair: false })), { ...GENERAL, repair: false }, { ...GENERAL, repair: true }];
}
/** the system line for one try. The answer pipeline answers the ask; a specialist does only its own job. Pure. */
export function answerBrief(bot) {
  const direct = 'You are Verse. Answer the task directly and concretely, from what you know. Lead with the answer in the first sentence, then only what a person needs to act on it. About 120 words or less, unless the person asks for depth (in detail, step by step, full, long, essay). No preamble, no filler, no repeating the question. Plain text. For a "difference between" question, say in one line what each one is or does and the main way they differ; do not pick a side. For an "A or B" choice, say what each one is, then recommend, with the one condition that changes the pick. For a health, medical, money or legal question, finish with what helps or who to ask (a doctor, a pharmacist, an adviser). For a how or why question about a method or mechanism (not a list of tips), name the one thing it does or compares each step and the one assumption it depends on, inside the answer, not as an opener. For a one-sentence summary, write one plain sentence of about 25 words that keeps every name, number and date. When the ask counts things (3 steps, three tips, a list), give exactly that many as a numbered list, 1. 2. 3., one per line. For a calculation, give the answer first, then one line showing how it checks. For writing tasks (an email, a note, a message), write the ready-to-send text: a greeting, the point, a next step or another option when you decline or say no, and a sign-off. When a request would mean getting into a place or a thing without its owner saying yes, do not help with that; suggest asking the owner, or a landlord or locksmith. When it asks for several things, name that many specific ones, each with a concrete detail a person could use. Do not reply with only words copied from the task. Never claim to have sent, paid, posted or deleted anything.';
  if (!bot || bot.name === 'verse' || bot.repair) return bot && bot.repair ? 'You are Verse. The last answer did not do the task. ' + direct.slice('You are Verse. '.length) : direct;
  return 'You are Verse, a helpful agent. You are acting as the bot "' + bot.name + '"' + (bot.description ? ' (' + bot.description + ')' : '') + '. Do only that bot\'s job, fully and concretely. Lead with the result. Plain text, about 120 words or less. Never claim to have sent, paid, posted or deleted anything.';
}
/** a short reply that says what the bot is for, or asks for other input, instead of doing the ask. A long answer is never one. Pure. */
export function staysInLane(text) {
  const t = String(text || '').trim();
  if (!t || t.split(/\s+/).length > 60) return false;
  return /\bI(?:'m| am) (?:a|an|the)\b[^.\n]{0,60}\bbot\b/i.test(t)
    || /\bI (?:am|was) (?:designed|built|made|specialized|specialised|programmed|created|trained)\b[^.\n]{0,70}\b(?:only|solely|specifically|just)\b/i.test(t)
    || /\bI (?:cannot|can't|can not|am unable to|am not able to|won't be able to) (?:provide|help|answer|assist|give|explain|offer|do)\b[^.\n]{0,80}\b(?:regarding|about|with|outside|beyond|other than)\b/i.test(t)
    || /\bplease (?:provide|give|send|enter|share) (?:me )?(?:two|a|an|the|your|some)\b[^.\n]{0,70}\b(?:if you (?:would|want|like|wish)|and I (?:will|can))\b/i.test(t)
    || /\b(?:outside|beyond) (?:of )?(?:my|the bot's) (?:scope|function|purpose|job)\b/i.test(t);
}
/** an open ask needs a real answer: long enough, and mostly new words, not the ask's own words joined back together. A specialist's short exact answer is its own result. Pure. */
export function addressesAsk(ask, result) {
  const text = String(result || '').trim();
  if (text.length < 2) return false;
  // semantic step-5: refusal boilerplate never addresses the ask, even if it passes word count
  if (/My sole function is|define the context|I am only able to|as an AI language model/i.test(text) || staysInLane(text)) return false;
  if (!openEnded(ask)) return true;
  const want = new Set(askTerms(ask));
  const novel = new Set(askTerms(text).filter((w) => !want.has(w)));
  return novel.size >= 3 && text.length >= 40 && text.split(/\s+/).filter(Boolean).length >= 6;
}
