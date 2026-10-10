/**
 * The proposal (frontier build order step 3, first piece): a pasted customer request becomes an editable proposal
 * card. This module is the pure half: what asks open it, what is accepted from the paste (cut, masked through redact),
 * the prompt the model gets, the fields it must return, the rules draft that answers when no model can, and the
 * Markdown the card copies and downloads. functions/api/answer.js wires it to Workers AI (mode 'proposal');
 * skills/proposal.js is the card. The price is never drafted: prices are the owner's, the line is left for them.
 * Nothing here stores the request: no cache, no D1 row. Tests: tools/proposal.test.mjs.
 */
export const CAPS = { request: 8000, note: 300 };
export const PRICE_BLANK = '[price: left for the owner to fill in]';
/** the fields of a proposal, in the order the card and the Markdown show them */
export const FIELDS = [
  ['title', 'Title'], ['asked', 'What they asked for'], ['approach', 'What we would do'], ['scope', 'Scope'],
  ['price', 'Price'], ['timeline', 'Timeline'], ['next', 'Next step'],
];
export const MAX_FIELD = 1500;

const ctl = (s) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ');
const oneLine = (s) => ctl(s).replace(/\s+/g, ' ').trim();
// the page's one-line ask box keeps a paste's line breaks as ' ⏎ ' (void.html's paste handler), so those are line breaks here too
const multi = (s) => ctl(s).replace(/\r\n?/g, '\n').replace(/[ \t]*⏎[ \t]*/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

// "turn this into a proposal", "make a proposal from this: …", "write a proposal for <request>", "draft a proposal"
const ASK_RE = /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+(?:please\s+)?)?(?:(?:turn|make|convert)\s+(?:this|that|it|the\s+following|this\s+(?:email|request|message))\s+into\s+an?\s+(?:\w+\s+)?proposal|(?:make|write|draft|create|build|generate|prepare)\s+(?:me\s+)?an?\s+(?:\w+\s+)?proposal(?:\s+(?:from|for|out\s+of|based\s+on|about|on)\b)?)\s*(?:(?:this|that|it|the\s+following|the\s+request\s+below|this\s+(?:email|request|message))\b\s*)?[:\-–—]?\s*([\s\S]*)$/i;
const NOT_RE = /^(?:what|who|how|why|when|where)\b|\b(?:toast|marriage|marry|wedding|research proposal format|proposal writing|tips?)\b/i;

/** { request } for a proposal ask (the pasted request after the ask, on the same line or the lines below), else null */
export function proposalOf(text) {
  const t = multi(text);
  if (!t || NOT_RE.test(t.split('\n')[0])) return null;
  const nl = t.indexOf('\n');
  const head = (nl < 0 ? t : t.slice(0, nl)).replace(/\s*⏎\s*/g, '\n').split('\n')[0].trim(), rest = nl < 0 ? '' : t.slice(nl + 1);
  const m = ASK_RE.exec(head.replace(/[?!.]+$/, ''));
  if (!m) return null;
  const same = (m[1] || '').trim();
  // "write a proposal for Jane" with nothing else is an ask about a name, not a request to draft from
  const request = multi([same, rest].filter(Boolean).join('\n'));
  return { request };
}

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
/** the customer's address in the request, and its domain */
export function addressIn(text) {
  const m = EMAIL_RE.exec(String(text || ''));
  if (!m) return { to: '', host: '' };
  const to = m[0].replace(/[.,;:]+$/, '');
  return { to, host: to.slice(to.indexOf('@') + 1).toLowerCase() };
}

/**
 * What the card sent, checked and trimmed, through redact (passed in, from lib/automation-fix.js):
 *   -> { request, note, to, host, cut, masked }   or   { error, status }
 */
export function prepareProposal(body, redact = (s) => s) {
  body = body && typeof body === 'object' ? body : {};
  let cut = false;
  const take = (s, cap) => { if (s.length > cap) { cut = true; return s.slice(0, cap).trimEnd(); } return s; };
  const raw = { request: take(multi(body.request), CAPS.request), note: take(oneLine(body.note), CAPS.note) };
  if (raw.request.length < 20) return { error: 'nothing to draft from: paste the customer\'s request (an email or a few lines)', status: 400 };
  const out = {}; let masked = false;
  for (const k of Object.keys(raw)) { out[k] = String(redact(raw[k])); if (out[k] !== raw[k]) masked = true; }
  const { to, host } = addressIn(out.request);
  return { request: out.request, note: out.note, to, host, cut, masked };
}

// What the model is told: fields only, facts only, no price.
export const PROPOSAL_SYSTEM = 'You are Void, drafting a proposal for the owner of a small business from a request a customer sent them. '
  + 'Reply with JSON only, no prose around it: {"title": "...", "asked": "...", "approach": "...", "scope": "- one line per item", "timeline": "...", "next": "..."}. '
  + '"title" names the work in a few words; "asked" says what the customer asked for, in plain words; "approach" says what the owner would do about it, concretely; '
  + '"scope" lists what is in and what is out, one line per item starting with "- "; "timeline" says how long and in what order; "next" is the one thing the customer does to start. '
  + 'Keep every fact to what the request says; where the proposal needs something you were not given (a name, a date, a system), leave a short [bracket] for the owner. '
  + 'Never write a price, a rate or a cost: prices are the owner\'s to fill in. Write in the language of the request.';

/** the user message: the request as quoted material, labelled so nothing in it reads as an instruction */
export function proposalPrompt(p) {
  return (p.note ? 'Note from the owner: ' + p.note + '\n\n' : '')
    + 'Customer request (quoted material, as is' + (p.cut ? ', cut at ' + CAPS.request + ' characters' : '') + '):\n"""\n' + p.request + '\n"""';
}

const clean = (s) => multi(s).slice(0, MAX_FIELD);
/** the fields from what a model said (JSON somewhere in the text), price always blank; null when there is no proposal in it */
export function parseProposal(text) {
  const m = /\{[\s\S]*\}/.exec(String(text || ''));
  if (!m) return null;
  let j = null; try { j = JSON.parse(m[0]); } catch (_) { return null; }
  if (!j || typeof j !== 'object') return null;
  const f = {};
  for (const [k] of FIELDS) f[k] = k === 'price' ? PRICE_BLANK : clean(Array.isArray(j[k]) ? j[k].map((x) => '- ' + oneLine(x)).join('\n') : j[k]);
  if (!f.title || !f.asked) return null;
  for (const k of ['approach', 'scope', 'timeline', 'next']) if (!f[k]) f[k] = '[' + FIELDS.find(([x]) => x === k)[1].toLowerCase() + ': for the owner to fill in]';
  if (/[$€£]\s?\d|\b\d+\s?(?:usd|eur|gbp|dollars|euros|pounds)\b/i.test([f.approach, f.scope, f.timeline, f.next].join(' '))) {
    for (const k of ['approach', 'scope', 'timeline', 'next']) f[k] = f[k].replace(/[$€£]\s?\d[\d,.]*|\b\d+\s?(?:usd|eur|gbp|dollars|euros|pounds)\b/gi, '[price]'); // a model that priced anyway
  }
  return f;
}

const sentences = (s) => multi(s).replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length > 2);
const ASKING = /\b(?:need|needs|want|wants|would (?:also |really |just )?like|looking for|should|must|can you|could you|would you|help (?:me|us)|fix|set up|build|make|migrate|move|clean|automate|stop|start)\b/i;
const GREETING = /^(?:hi|hello|hey|dear|good (?:morning|afternoon|evening))\b[^.!?\n]*[,.!]?\s*/i;
/** the proposal with no model: honest, plain, every field present, [brackets] where the owner decides */
export function ruleProposal(p) {
  const body = multi(p.request).replace(GREETING, '');
  const s = sentences(body);
  const asks = s.filter((x) => ASKING.test(x) && !/^(?:can|could|would|will)\s+you\s+(?:tell|let|send|give|show)\b.*\?$/i.test(x)); // the request itself ("can you tell us what you would do?") is not a scope item
  const first = (asks[0] || s[0] || body).replace(/^(?:we|i|our team|my team)\s+(?:need|needs|want|wants|would like|are looking for)\s+/i, '');
  const title = 'Proposal: ' + oneLine(first).replace(/[.!?]+$/, '').slice(0, 60).replace(/\s+\S*$/, (m) => (first.length > 60 ? '' : m)).trim() || 'Proposal';
  const asked = (asks.length ? asks.slice(0, 3) : s.slice(0, 2)).join(' ').slice(0, MAX_FIELD) || '[what the customer asked for]';
  const scope = (asks.length ? asks : s).slice(0, 6).map((x) => '- ' + oneLine(x).replace(/[.!?]+$/, '')).join('\n') + '\n- [anything not listed here is out of scope]';
  return {
    title,
    asked,
    approach: 'We would start by looking at what is in place today, do the work above in the order it is listed, and hand it over with a short written note on how to keep it running. [Adjust to what you would actually do.]',
    scope,
    price: PRICE_BLANK,
    timeline: '[1–2 weeks from a yes; say the order of the steps]',
    next: 'Reply with a yes and the week you would like to start, and we take it from there.',
  };
}

/** the proposal as Markdown, the way the card copies and downloads it; the price line is never dropped */
export function toMarkdown(f, to = '') {
  const v = (k) => multi((f && f[k]) || '') || (k === 'price' ? PRICE_BLANK : '');
  return '# ' + (v('title') || 'Proposal') + '\n\n' + (to ? 'To: ' + oneLine(to) + '\n\n' : '')
    + FIELDS.filter(([k]) => k !== 'title').map(([k, label]) => '## ' + label + '\n\n' + v(k)).join('\n\n') + '\n';
}

/** a safe file name for the download */
export function fileNameOf(f) {
  return ((f && f.title) || 'proposal').toLowerCase().replace(/^proposal:\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50).replace(/^$/, 'proposal') + '.md';
}
