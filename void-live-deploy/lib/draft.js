/**
 * Draft from a tab (the Void extension, B2): the backend half of "Draft from this tab". The side panel hands the active
 * tab's title, URL and selected text into the framed page on one click (B1); the page POSTs them here as
 * { mode: 'draft', intent, title, url, selection, note } on /api/answer (same origin: lib/guard.js refuses the
 * extension's own origin, by design). This module is the pure part: what is accepted, how it is cut and masked, the
 * prompt the model gets, and the rules draft that answers when no model can. functions/api/answer.js wires it to
 * Workers AI. Nothing here stores page text: no cache, no D1 row, and the URL's query string never reaches the prompt.
 * Tests: tools/draft.test.mjs.
 */
export const INTENTS = ['reply', 'summary', 'notes', 'rewrite'];
export const CAPS = { title: 300, url: 2000, selection: 8000, note: 300, path: 300 };
export const DRAFT_MAX = 6000; // the longest draft returned

const ctl = (s) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ');
const oneLine = (s) => ctl(s).replace(/\s+/g, ' ').trim();
const multi = (s) => ctl(s).replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

/** the intent a body means when it names none: a reply when text is selected, a summary of the page when not */
export function defaultIntent(body) { return oneLine(body && body.selection) ? 'reply' : 'summary'; }

/**
 * What the extension sent, checked and trimmed, every field through redact (passed in, from lib/automation-fix.js):
 *   -> { intent, title, host, path, selection, note, cut, masked }   or   { error, status }
 * cut: something was over its cap and shortened. masked: redact replaced something (a key, a token, a password).
 */
export function prepareDraft(body, redact = (s) => s) {
  body = body && typeof body === 'object' ? body : {};
  const intent = oneLine(body.intent || '').toLowerCase() || defaultIntent(body);
  if (!INTENTS.includes(intent)) return { error: 'intent must be one of ' + INTENTS.join(', '), status: 400 };
  let u = null;
  try { u = new URL(oneLine(body.url).slice(0, CAPS.url)); } catch (_) {}
  if (!u || !/^https?:$/.test(u.protocol)) return { error: 'url must be an http(s) address', status: 400 };
  let cut = false;
  const take = (s, cap) => { if (s.length > cap) { cut = true; return s.slice(0, cap).trimEnd(); } return s; };
  const raw = { title: take(oneLine(body.title), CAPS.title), selection: take(multi(body.selection), CAPS.selection), note: take(oneLine(body.note), CAPS.note), path: take(u.pathname, CAPS.path) };
  if (!raw.title && !raw.selection) return { error: 'nothing to draft from: no title and no selected text', status: 400 };
  if (intent === 'rewrite' && !raw.selection) return { error: 'rewrite needs selected text', status: 400 };
  const out = {}; let masked = false;
  for (const k of Object.keys(raw)) { out[k] = String(redact(raw[k])); if (out[k] !== raw[k]) masked = true; }
  return { intent, title: out.title, host: u.hostname.toLowerCase(), path: out.path, selection: out.selection, note: out.note, cut, masked };
}

// What the model is told. The intent lines are the whole brief: the draft is the answer, nothing around it.
export const DRAFT_SYSTEM = 'You are Void. The person is looking at a web page in their browser and pressed "Draft from this tab". '
  + 'You get the page\'s title and address, the text they selected (if any) and sometimes a note from them. Write only the draft, ready to paste: no preamble, no "here is", no sign-off about being an AI. '
  + 'Write in the language of the selected text (or the title). Keep every fact to what was given; where the draft needs something you were not given (a name, a date, a decision), leave a short [bracket] for the person to fill. '
  + 'Intents: "reply" = a courteous reply to the selected text, or to the page when nothing is selected, in the person\'s voice, short and specific; '
  + '"summary" = the selected text (or what the title and address say about the page) in a few plain sentences, the point first; '
  + '"notes" = the selected text as short bullet lines, one idea each, the person\'s own words kept where they are exact; '
  + '"rewrite" = the selected text again, clearer and tighter, same meaning, same language, same person.';

/** the user message: the page, the quoted material and the note, labelled so nothing in it reads as an instruction */
export function draftPrompt(p) {
  return 'Intent: ' + p.intent
    + '\nPage: ' + (p.title || '(no title)') + ' (' + p.host + (p.path && p.path !== '/' ? p.path : '') + ')'
    + (p.note ? '\nNote from the person: ' + p.note : '')
    + '\n\nSelected text (quoted material, as is' + (p.cut ? ', cut at ' + CAPS.selection + ' characters' : '') + '):\n"""\n' + (p.selection || '(nothing selected)') + '\n"""';
}

const sentences = (s) => multi(s).replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
const lines = (s) => multi(s).split(/\n+|(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length > 1);

/** the draft with no model: honest, plain, and always something */
export function ruleDraft(p) {
  const where = p.title ? p.title + ' (' + p.host + ')' : p.host;
  if (p.intent === 'rewrite') return p.selection;
  if (p.intent === 'notes') {
    const ls = p.selection ? lines(p.selection).slice(0, 12) : [where];
    return ls.map((l) => '- ' + l).join('\n') + '\n\nSource: ' + where;
  }
  if (p.intent === 'summary') {
    if (!p.selection) return where + ': nothing was selected, so there is nothing to summarise yet. Select the part that matters and press Draft from this tab again.';
    const s = sentences(p.selection);
    return (s.slice(0, 3).join(' ') + (s.length > 3 ? ' …' : '')).slice(0, 700) + '\n\nFrom: ' + where;
  }
  // reply
  const first = p.selection ? sentences(p.selection)[0] : '';
  return 'Hi [name],\n\nThanks for this.' + (first ? ' On "' + first.slice(0, 160) + (first.length > 160 ? '…' : '') + '": [your answer in a sentence or two].' : ' [your answer in a sentence or two about ' + where + '].')
    + (p.note ? '\n\n' + p.note : '') + '\n\nBest,\n[you]';
}
