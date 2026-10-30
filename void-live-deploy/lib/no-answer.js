// A "no answer" is not an answer (owner, 2026-10-26, "happy time harry": the model said "I do not have information regarding ... not contained within
// the provided sources", and the card was still labelled "Answer - from a source", credited itself with "Adds to Verse: a fact it did not have to be
// taught", listed a source with no link and drew a clock because the title held the word "time"). These pure helpers decide, for the answer route
// (functions/api/answer.js), the page (void.html) and the card frame (lib/card-frame.js): is this body a refusal, is a source a real link, do the
// sources even match the ask, and where in a long "List of ..." page does a redirect's section start. No DOM, no network.
const NO_ANSWER = /\b(?:i (?:do not|don'?t|cannot|can'?t|could not|couldn'?t) (?:have|find|locate|see|know)\b[^.]{0,60}\b(?:information|record|records|data|anything|details|mention|match)|(?:i have |there is |there'?s |i found |i see )?no (?:information|record|records|mention|details|results?)\b[^.]{0,40}\b(?:about|on|regarding|for|of)\b|(?:is|are|was|were) not (?:contained|mentioned|covered|found|included) (?:within|in) (?:the |any )?(?:provided |given )?(?:sources?|text|context)|(?:sources?|context) (?:do|does) not (?:contain|cover|mention|include)|not (?:contained|covered|mentioned) (?:within|in) the (?:provided |given )?sources?)/i;
/** true when a body is Verse saying it found nothing: the refusal phrase sits in the first 220 characters, or "not contained within the provided sources" anywhere in a short body. Pure. */
export function isNoAnswer(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return false; // nothing yet is not a refusal: a card still loading says so itself
  if (NO_ANSWER.test(t.slice(0, 220))) return true;
  return t.length < 900 && /not (?:contained|covered|mentioned) (?:within|in) the (?:provided |given )?sources?|sources? (?:do|does) not (?:contain|cover|mention)/i.test(t);
}
/** the sources worth listing: those with an https link. A source with no URL is not a source (it cannot be checked). Pure. */
export const linked = (sources) => (Array.isArray(sources) ? sources : []).filter((s) => s && /^https:\/\/[^\s"'<>]+$/i.test(String(s.url || s.u || '')));
const STOPQ = new Set('a an the of and or to in on for is are was were what who whom whose where when why how which about tell me please define meaning'.split(' '));
const words = (s) => (String(s || '').toLowerCase().replace(/['\u2019]s\b/g, '').match(/[a-z0-9]+/g) || []).map((w) => (w.length > 3 && /[^s]s$/.test(w) ? w.slice(0, -1) : w)); // widows = widow
/** the distinctive words of an ask ("what is happy time harry" -> happy time harry). Pure. */
export const askWords = (ask) => words(ask).filter((w) => !STOPQ.has(w));
/** is the ask a bare name or short phrase ("happy time harry", "who is moe szyslak"), the kind a source either names or does not? A how-to or a comparison is not. Pure. */
export const isNameAsk = (ask) => { const w = askWords(ask); return w.length >= 1 && w.length <= 5 && !/\b(?:how|why|should|can|could|do|does|did|best|vs|versus|difference|compare|recipe|ideas?|write|make|build|draw|create|convert|calculate|plan|fix|help|my|me|you|your|i)\b/i.test(String(ask || '')); };
/** do the sources hold what was asked? true when one source's title or text has every distinctive word of the ask. false = the sources are only fuzzy neighbours (a guess). Pure. */
export function sourcesMatch(ask, sources) {
  const need = askWords(ask); if (!need.length) return true;
  return (sources || []).some((s) => { const have = new Set(words((s.title || '') + ' ' + (s.text || ''))); return need.every((w) => have.has(w)); });
}
/** the closest guess among fuzzy sources: its title, or ''. Pure. */
export const guessOf = (sources) => String(((sources || []).find((s) => s && s.title) || {}).title || '').slice(0, 120);
/** a redirect that lands inside a list page: { page, section } from MediaWiki's action=query&redirects reply, or null. Pure. */
export function listRedirect(reply) {
  const r = reply && reply.query && Array.isArray(reply.query.redirects) ? reply.query.redirects[reply.query.redirects.length - 1] : null;
  if (!r || !r.to) return null;
  return /^List of /i.test(r.to) || r.tofragment ? { page: String(r.to), section: String(r.tofragment || r.from || '') } : null;
}
/** a section hit among full-text search results (srprop=sectiontitle|snippet): the first whose section title or snippet holds every word of the ask. Pure. */
export function sectionHit(hits, ask) {
  const need = askWords(ask); if (!need.length) return null;
  for (const h of hits || []) {
    const hay = new Set(words(String(h.sectiontitle || '') + ' ' + String(h.snippet || '').replace(/<[^>]+>/g, ' ')));
    if (h.sectiontitle && need.every((w) => hay.has(w))) return { page: String(h.title), section: String(h.sectiontitle) };
  }
  return null;
}
/** the passage of a page's text (MediaWiki extracts with exsectionformat=wiki: headings are "== Name ==") that starts at a section's heading, or at the
 *  ask's first occurrence when no heading carries the name; it ends at the next heading, `max` characters at most, cut at a sentence end. Pure. */
export function sectionText(plain, section, ask, max = 1200) {
  const t = String(plain || '').replace(/\r/g, '');
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let body = '';
  const head = section ? new RegExp('^[ \\t]*(=+)[ \\t]*' + esc(String(section).replace(/_/g, ' ')) + '[ \\t]*\\1[ \\t]*$', 'im').exec(t) : null;
  if (head) body = t.slice(head.index + head[0].length);
  else { const at = ask ? t.toLowerCase().indexOf(askWords(ask).join(' ')) : -1; if (at < 0) return ''; body = t.slice(at); }
  const next = body.search(/\n[ \t]*=+[^=\n][^\n]*=+[ \t]*(?:\n|$)/);
  body = (next >= 0 ? body.slice(0, next) : body).replace(/\s+/g, ' ').trim();
  if (body.length <= max) return body;
  const cut = body.slice(0, max), end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > 200 ? cut.slice(0, end + 1) : cut.slice(0, cut.lastIndexOf(' '));
}
/** the honest card for a no-answer: { title, line, did } - "Did you mean X?" when a guess exists. Pure. */
export function notFound(ask, guess) {
  const g = String(guess || '').trim();
  return { title: String(ask || '').slice(0, 600), line: 'I could not find “' + String(ask || '').replace(/[?!.]+$/, '').slice(0, 120) + '”.', did: g ? 'Did you mean ' + g + '?' : '', clue: 'A clue helps: where you saw it, who is in it, what it is.' };
}
/** "say only what the fetched text says" (owner, 2026-10-26): keep the sentences of an answer whose numbers, quoted titles and capitalised names are all in the fetched
 *  text; drop the rest. When nothing is left the fetched text's own first sentences are the answer. Used when the only source is a section of a list page. Pure. */
export function grounded(answer, sourceText, max = 3) {
  const src = String(sourceText || '').toLowerCase().replace(/\s+/g, ' ');
  const parts = String(answer || '').replace(/\s+/g, ' ').match(/[^.!?]+(?:[.!?]+(?:\s*\[\d+\])*|$)/g) || [];
  const ok = (sent) => {
    const body = sent.replace(/\[\d+\]/g, ' ');
    const toks = [...(body.match(/["“][^"”]{2,60}["”]|\b\d[\d,.]*\b/g) || []).map((x) => x.replace(/["“”]/g, '')), ...(body.replace(/^\s*\S+/, ' ').match(/\b[A-Z][a-z]+(?:'s)?\b/g) || []).map((x) => x.replace(/'s$/, ''))];
    return toks.every((t) => src.includes(t.toLowerCase().replace(/[.,]+$/, '')));
  };
  const keep = parts.map((s) => s.trim()).filter((s) => s && ok(s));
  if (keep.length) return keep.join(' ');
  return (String(sourceText || '').replace(/\s+/g, ' ').match(/[^.!?]+[.!?]/g) || []).slice(0, max).join(' ').trim() + ' [1]';
}
