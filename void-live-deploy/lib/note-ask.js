// A note aimed at someone, and the stock chatbot refusal (owner, 2026-10-30). A note written to the owner was pasted into Verse: "Good, Beam has
// it. I'm checking #1795 and will hand you the loop line for Beam once it's live. ⏎ The Modal part was for you, not Beam: you make the account and
// add the two repo secrets, whenever you want real AI songs. Until then the music". The model answered "I cannot perform the actions you described.
// I do not have the capability to create accounts ... My functions are limited to processing the text and images provided to me within this
// interface." Verse never answers like that. A note is read as a note: what it says, what step it asks for and whose step it is, and the Verse page
// that does the related thing when one exists. A line about Verse's own limits is cut; an answer that is only such lines is asked for again, and a
// note with nothing left is read back from its own words (noteReading). Pure, no I/O.
// A pasted chat log is a note too (owner, 2026-10-30): a chat with "Today 3:27 AM", "Edited" and "You allowed this" lines, about the Modal
// step for AI songs, was answered as "a broken automation" with a guessed MODAL_TOKEN and a question back about what the name is. A chat log
// is read as one, and when it is about Verse's own setup (a secret, a token, an account) the answer uses the names Verse's code really
// reads (lib/verse-secrets.js, from tools/verse-secrets.mjs), or says that no Verse code reads one yet. It never guesses a name.
import SECRETS from './verse-secrets.js';

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
const YOU_ACT = /\b(?:you(?:'ll|'d|\s+will|\s+would|\s+can|\s+should|\s+need\s+to|\s+have\s+to|\s+must)?\s+(?:make|add|do|set|create|open|run|get|go|check|sign|pick|paste|put|send|merge|review|approve|click|tap|press|connect|install|enable|turn|move|copy|reload|restart)\b|(?:was|is|are)\s+for\s+you\b|\byour\s+(?:step|turn|part|call|job|move)\b)/i;
// any line written to a reader: an act of theirs, or a line about when or what they get ("once you", "hand you")
const YOU_STEP = new RegExp(YOU_ACT.source + '|\\bnot\\s+for\\s+you\\b|\\b(?:whenever|once|when|after|before)\\s+you\\b|\\bhand\\s+you\\b|\\bif\\s+you\\s+want\\b', 'i');
const ASKING = /^\s*(?:how|what|why|when|where|which|who|whom|whose|can|could|should|would|will|is|are|do|does|did|was|were|tell\s+me|explain|define|write|make\s+me|give\s+me)\b/i;
// the lines a chat app puts around messages when a chat is copied: a time stamp, "Edited", a permission card and its answer
const CHAT_MARKS = [
  /^(?:today|yesterday|(?:mon|tues|wednes|thurs|fri|satur|sun)day)(?:,?\s+\w+\s+\d{1,2})?\s+(?:at\s+)?\d{1,2}:\d\d(?:\s*[ap]\.?m\.?)?$/im,
  /^edited$/im,
  /^you\s+(?:allowed|denied|approved|declined)\s+(?:this|it)$/im,
  /^(?:let|allow)\s+(?:claude|verse|chatgpt|gemini|copilot|the\s+agent)\s+[^\n?]{2,60}\?$/im,
  /^\d{1,2}:\d\d\s*[ap]\.?m\.?$/im,
  /^(?:claude|verse|chatgpt|assistant|you|user|me)\s*:\s*\S/im,
];
/** true when the ask is a copied chat: two kinds of chat-app line at least (a time stamp, "Edited", "You allowed this", a "Name:" turn). Pure. */
export function isChatLog(ask) {
  const t = String(ask || '').replace(/\s*⏎\s*/g, '\n').trim();
  return t.length >= 120 && CHAT_MARKS.filter((re) => re.test(t)).length >= 2;
}
/** true when the ask is a note or instructions written to someone (two sentences or more, a step put to "you"), or a copied chat, not a question to Verse. Pure. */
export function isNote(ask) {
  const t = String(ask || '').replace(/\s*⏎\s*/g, '\n').trim();
  if (isChatLog(t)) return true;
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

// the services a note can name for Verse's own setup: the word in the note -> the part every secret name for it holds
const SERVICES = [
  [/\bmodal\b/i, 'Modal', /MODAL/], [/\bstripe\b/i, 'Stripe', /STRIPE/], [/\bgumroad\b/i, 'Gumroad', /GUMROAD/], [/\bcloudflare\b/i, 'Cloudflare', /CLOUDFLARE/],
  [/\bgroq\b/i, 'Groq', /GROQ/], [/\bgemini\b/i, 'Gemini', /GEMINI/], [/\banthropic\b/i, 'Anthropic', /ANTHROPIC/], [/\bopenrouter\b/i, 'OpenRouter', /OPENROUTER/],
  [/\bcerebras\b/i, 'Cerebras', /CEREBRAS/], [/\bpexels\b/i, 'Pexels', /PEXELS/], [/\bunsplash\b/i, 'Unsplash', /UNSPLASH/], [/\bpixabay\b/i, 'Pixabay', /PIXABAY/],
  [/\bflickr\b/i, 'Flickr', /FLICKR/], [/\byoutube\b/i, 'YouTube', /^(?:YT|YOUTUBE)_/], [/\bturnstile\b/i, 'Turnstile', /TURNSTILE/], [/\bpollinations\b/i, 'Pollinations', /POLLINATIONS/],
  [/\bhugging\s*face\b/i, 'Hugging Face', /(?:HF|HUGGING)/], [/\breplicate\b/i, 'Replicate', /REPLICATE/], [/\bopenai\b/i, 'OpenAI', /OPENAI/], [/\belevenlabs\b/i, 'ElevenLabs', /ELEVEN/],
];
const SETUP = /\b(?:secrets?|tokens?|api\s+keys?|keys?|env(?:ironment)?\s+var(?:iable)?s?|variables?|accounts?|credentials?|settings?)\b/i;
const listed = (a) => (a.length < 3 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
/** what Verse's own setup says about each service a sentence of the note names with a secret, a token or an account: the names its code reads, where they go,
 *  or that no Verse code reads one yet. One line per service, at most three; [] when the note is not about setup. Pure. */
export function setupFacts(ask, secrets = SECRETS) {
  const t = String(ask || '').replace(/\b(?:cloudflare|github)(?:'s)?\s+(?:settings|dashboard)\b/gi, ' '); // "in the site's Cloudflare settings" is where a secret goes, not a Cloudflare secret
  const parts = t.split(/(?<=[.!?])\s+|\n+/).filter((x) => SETUP.test(x)); // the service and the secret, token or account in one sentence
  const out = [];
  for (const [word, name, key] of SERVICES) {
    if (!parts.some((x) => word.test(x)) || out.length >= 3) continue;
    const cf = (secrets.cloudflare || []).filter((n) => key.test(n)), gh = (secrets.github || []).filter((n) => key.test(n));
    if (!cf.length && !gh.length) { out.push(`No Verse code reads a ${name} secret yet, so there is no ${name} name to save: the step that uses ${name} is not built yet, and its secret names come with it.`); continue; }
    out.push(`Verse's code reads these ${name} names: ` + [cf.length ? listed(cf) + ' in the site\'s Cloudflare settings' : '', gh.length ? listed(gh) + ' as GitHub repository secrets' : ''].filter(Boolean).join(', and ') + '.');
  }
  return out;
}

// a typed question about the name of a secret, a token or a key (live, 2026-10-30: "what is the Modal secret called?" went to Wikipedia, which
// suggested "model secret called" and showed a person card about a fashion model). It is answered from the names Verse's code reads, as a note is.
const NAME_ASK = /\b(?:called|named|name|names|which|what)\b/i;
/** the setup facts for a typed question about a service's secret, token or key name; [] for anything else (a paste, a note, a long ask). Pure. */
export function secretAsk(ask, secrets = SECRETS) {
  const t = String(ask || '').trim();
  if (!t || t.length > 160 || /[\n⏎]/.test(t) || !SETUP.test(t) || !NAME_ASK.test(t)) return [];
  if (!/\?\s*$/.test(t) && !ASKING.test(t)) return [];
  return setupFacts(t, secrets);
}

/** what the model is told for a note: read it as a note, in its own words, and point to the related page when there is one */
export function noteRule(page, facts = []) {
  return 'The ask is a note written to someone, or a copied chat, not a question to you and not a broken automation. In two to four sentences, using its own words, say what it says, what step it asks for and whose step that is. The "you" in the note is the person it was written to, not you. If it stops mid-sentence, say it is cut off there and do not guess the rest. Never say you did a step, and never mention what you can or cannot do.'
    + (facts.length ? ' Facts from Verse\'s own setup, to use as they are: ' + facts.join(' ') + ' Never give any other secret or variable name, never guess one, and never ask what one is called.' : '')
    + (page ? ` End with one line that names the Verse page for it: https://a-to-mind.com${page.path} (${page.name}).` : '');
}

/** a note read back from its own words, for when the model gives nothing usable: what it says, the step and whose it is, and the page. Pure. */
export function noteReading(ask, page = relatedPage(ask), facts = setupFacts(ask)) {
  const t = String(ask || '').replace(/\s*⏎\s*/g, '\n').trim();
  const parts = t.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
  const steps = parts.filter((x) => YOU_ACT.test(x)), said = parts.filter((x) => !YOU_ACT.test(x));
  const not = (steps.join(' ').match(/\bnot\s+([A-Z][\w-]*)\b/) || [])[1];
  const out = [];
  if (said.length) out.push('The note says: “' + said.slice(0, 2).join(' ') + '”');
  if (steps.length) out.push('The step it asks for is the reader’s' + (not ? ', not ' + not + '’s' : '') + ': “' + steps[0] + '”');
  const cut = cutLine(t);
  if (cut) out.push(cut);
  out.push(...facts);
  if (page) out.push('The Verse page for it: https://a-to-mind.com' + page.path + ' (' + page.name + ').');
  return out.join('\n');
}

/** the line for a note that stops mid-sentence, from its last four words; '' when it ends whole. Pure. */
export function cutLine(ask) {
  const t = String(ask || '').replace(/\s*⏎\s*/g, '\n').trim();
  return /[.!?)"'”]\s*$/.test(t) ? '' : 'It stops mid-sentence at “' + t.split(/\s+/).slice(-4).join(' ') + '”, so the rest is not here.';
}
const NAME = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]*[A-Z0-9]\b/g;
/** the model's reading of a note, made true to the note and to Verse's setup (live, 2026-10-30: a cut note was read with no word that it was
 *  cut, and a chat log got a guessed MODAL_TOKEN and a question back about the name). A sentence with a secret name Verse's code does not
 *  read, or that asks what a name is, goes; the cut line and each setup fact the answer left out are added. Pure. */
export function noteFinish(answer, ask, facts = setupFacts(ask), secrets = SECRETS) {
  const known = new Set([...(secrets.cloudflare || []), ...(secrets.github || [])]);
  const ok = (x) => !(x.match(NAME) || []).some((n) => !known.has(n)) && !/\bbroken\s+automation\b|\bautomation\s+(?:is|looks|seems)\s+broken\b/i.test(x)
    && (!/\?\s*$/.test(x) || !/\b(?:name|named|called|variable|secret|token|key)\b/i.test(x));
  const lines = String(answer || '').split(/\n+/).map((line) => line.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x && ok(x)).join(' ')).filter(Boolean);
  const page = lines.length && /^https:\/\/a-to-mind\.com\//.test(lines[lines.length - 1]) ? lines.pop() : null; // the page line stays last
  const cut = cutLine(ask);
  if (cut && !/\b(?:cut\s+off|cut\s+short|stops\s+mid|ends\s+mid|is\s+cut|unfinished|incomplete)\b/i.test(lines.join(' '))) lines.push(cut);
  for (const f of facts) {
    const names = f.match(NAME) || [], text = lines.join(' ');
    if (!(names.length ? names.every((n) => text.includes(n)) : /\bno\s+verse\s+code\s+reads\b/i.test(text))) lines.push(f);
  }
  if (page) lines.push(page);
  return lines.join('\n');
}
