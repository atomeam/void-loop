// A note aimed at someone, and the stock chatbot refusal (owner, 2026-10-30). A note written to the owner was pasted into Verse: "Good, Beam has
// it. I'm checking #1795 and will hand you the loop line for Beam once it's live. ⏎ The Modal part was for you, not Beam: you make the account and
// add the two repo secrets, whenever you want real AI songs. Until then the music". The model answered "I cannot perform the actions you described.
// I do not have the capability to create accounts ... My functions are limited to processing the text and images provided to me within this
// interface." Verse never answers like that. A note is read as a note: what it says, what step it asks for and whose step it is, and the Verse page
// that does the related thing when one exists. A line about Verse's own limits is cut; an answer that is only such lines is asked for again, and a
// note with nothing left is read back from its own words (noteReading). Pure, no I/O.

// a line about what the model itself cannot do, or about being an AI in a box: never Verse's voice
const LIMITS = new RegExp([
  "\\bi\\s+(?:cannot|can't|can\\s+not|could\\s+not|couldn't|am\\s+(?:unable|not\\s+able)\\s+to|'m\\s+(?:unable|not\\s+able)\\s+to)\\s+(?:directly\\s+|actually\\s+|personally\\s+)?(?:perform|create|access|manage|carry\\s+out|execute|complete|interact|browse|open|sign|log\\s+in|click|run|connect|make\\s+(?:an?\\s+)?account|set\\s+up|add\\s+(?:the\\s+)?(?:repo|repository|secret)|take\\s+(?:that|this|the|any)\\s+(?:action|step)|do\\s+(?:that|this|so)\\b)",
  "\\bi\\s+(?:do\\s+not|don't)\\s+have\\s+(?:the\\s+)?(?:ability|capability|capabilities|capacity|means|tools?|permissions?)\\b",
  "\\bi\\s+lack\\s+the\\s+(?:ability|capability|capacity|means|access)\\b",
  "\\bi\\s+(?:do\\s+not|don't)\\s+have\\s+(?:direct\\s+)?access\\s+to\\s+(?:external|the\\s+internet|real-time|your|any\\s+external|accounts?|platforms?)",
  "\\bmy\\s+(?:functions?|capabilities|abilities|role|purpose)\\s+(?:is|are)\\s+(?:limited|restricted|only|solely|confined)",
  "\\bwithin\\s+this\\s+(?:interface|chat|conversation|text\\s+box)\\b",
  "\\b(?:text|images?)\\s+(?:and\\s+images?\\s+)?provided\\s+to\\s+me\\b",
  "\\bas\\s+an\\s+ai(?:\\s+(?:language\\s+model|model|assistant|system))?\\s*,",
  "\\bi\\s+am\\s+(?:only\\s+|just\\s+)?(?:an?\\s+)?(?:ai(?:\\s+assistant|\\s+model)?|large\\s+language\\s+model|language\\s+model|text-based\\s+(?:ai|model|assistant))\\b",
  "\\b(?:i\\s+am|i'm)\\s+(?:sorry|afraid),?\\s+(?:but\\s+)?i\\s+(?:cannot|can't|am\\s+unable)",
].join('|'), 'i');
const sentences = (t) => String(t || '').match(/[^.!?\n]+[.!?]*\s*|\n+/g) || [];
/** true when the answer holds a line about the model's own limits ("I cannot perform", "my functions are limited", "as an AI,"). Pure. */
export const talksLimits = (answer) => sentences(answer).some((s) => LIMITS.test(s));
/** the answer without its lines about the model's own limits. Pure. */
export function dropLimits(answer) {
  return sentences(answer).filter((s) => !LIMITS.test(s)).join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** said again to the model when its first answer was about its own limits */
export const NO_LIMITS_RULE = 'Your answer must not mention what you can or cannot do, your functions, your interface or being an AI. If the message asks someone to take a step, say what the step is and whose step it is. Never say you did it.';

// a note to someone: a step put to "you", or a line on whose part it is
// the reader is the one who acts ("you make the account", "the Modal part was for you", "your turn")
const YOU_ACT = /\b(?:you(?:'ll|\s+will|\s+can|\s+should|\s+need\s+to|\s+have\s+to|\s+must)?\s+(?:make|add|do|set|create|open|run|get|go|check|sign|pick|paste|put|send|merge|review|approve|click|tap|press|connect|install|enable|turn|move|copy|reload|restart)\b|(?:was|is|are)\s+for\s+you\b|\byour\s+(?:step|turn|part|call|job|move)\b)/i;
// any line written to a reader: an act of theirs, or a line about when or what they get ("once you", "hand you")
const YOU_STEP = new RegExp(YOU_ACT.source + '|\\bnot\\s+for\\s+you\\b|\\b(?:whenever|once|when|after|before)\\s+you\\b|\\bhand\\s+you\\b|\\bif\\s+you\\s+want\\b', 'i');
const ASKING = /^\s*(?:how|what|why|when|where|which|who|whom|whose|can|could|should|would|will|is|are|do|does|did|was|were|tell\s+me|explain|define|write|make\s+me|give\s+me)\b/i;
/** true when the ask is a note or instructions written to someone (two sentences or more, a step put to "you"), not a question to Verse. Pure. */
export function isNote(ask) {
  const t = String(ask || '').replace(/\s*⏎\s*/g, '\n').trim();
  if (t.length < 60 || ASKING.test(t)) return false;
  const lines = t.split(/(?<=[.!?])\s+|\n+/).filter((x) => x.trim());
  if (lines.length < 2) return false;
  return YOU_STEP.test(t) && !/^[^.!\n]{0,200}\?\s*$/.test(t);
}

// the Verse pages a note can point to: a word in the note -> the page that does that thing (each path is in sitemap.xml: tools/note-ask.test.mjs)
export const PAGES = [
  [/\b(?:songs?|music|melod(?:y|ies)|metronome|tuner|setlists?|piano)\b/i, '/music/', 'Music tools'],
  [/\b(?:rap|raps|rapping|rhymes?|bars)\b/i, '/rap/', 'Verse raps'],
  [/\b(?:photos?|pictures?|images?)\b/i, '/photos/', 'Photo tools'],
  [/\b(?:colou?rs?|palettes?)\b/i, '/color/', 'Colour tools'],
  [/\bpdfs?\b/i, '/pdf/', 'PDF tools'],
  [/\b(?:convert|converter|conversion)\b/i, '/converter/', 'Converter'],
  [/\b(?:translate|translation)\b/i, '/translate/', 'Translate'],
  [/\bweather\b/i, '/weather/', 'Weather'],
  [/\bflights?\b/i, '/flights/', 'Flights'],
  [/\b(?:recipes?|cook(?:ing)?)\b/i, '/recipes/', 'Recipes'],
  [/\b(?:code\s+review|pull\s+requests?)\b/i, '/code-review/', 'Code review'],
  [/\bcalendar\b/i, '/calendar/', 'Calendar'],
  [/\b(?:films?|movies?)\b/i, '/films/', 'Films'],
  [/\b(?:fanfic|fan\s+fiction)\b/i, '/fanfic/', 'Fanfic'],
];
/** the one Verse page that does the thing the note is about: { path, name } or null. Pure. */
export function relatedPage(ask) {
  const t = String(ask || '');
  let best = null;
  for (const [re, path, name] of PAGES) { const m = re.exec(t); if (m && (!best || m.index < best.at)) best = { path, name, at: m.index }; }
  return best ? { path: best.path, name: best.name } : null;
}

/** what the model is told for a note: read it as a note, in its own words, and point to the related page when there is one */
export function noteRule(page) {
  return 'The ask is a note written to someone, not a question to you. In two to four sentences, using its own words, say what it says, what step it asks for and whose step that is. The "you" in the note is the person it was written to, not you. If it stops mid-sentence, say it is cut off there and do not guess the rest. Never say you did a step, and never mention what you can or cannot do.'
    + (page ? ` End with one line that names the Verse page for it: https://a-to-mind.com${page.path} (${page.name}).` : '');
}

/** a note read back from its own words, for when the model gives nothing usable: what it says, the step and whose it is, and the page. Pure. */
export function noteReading(ask, page = relatedPage(ask)) {
  const t = String(ask || '').replace(/\s*⏎\s*/g, '\n').trim();
  const parts = t.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
  const steps = parts.filter((x) => YOU_ACT.test(x)), said = parts.filter((x) => !YOU_ACT.test(x));
  const not = (steps.join(' ').match(/\bnot\s+([A-Z][\w-]*)\b/) || [])[1];
  const cut = !/[.!?)"'”]\s*$/.test(t);
  const out = [];
  if (said.length) out.push('The note says: “' + said.slice(0, 2).join(' ') + '”');
  if (steps.length) out.push('The step it asks for is the reader’s' + (not ? ', not ' + not + '’s' : '') + ': “' + steps[0] + '”');
  if (cut) out.push('It stops mid-sentence at “' + t.split(/\s+/).slice(-4).join(' ') + '”, so the rest is not here.');
  if (page) out.push('The Verse page for it: https://a-to-mind.com' + page.path + ' (' + page.name + ').');
  return out.join('\n');
}
