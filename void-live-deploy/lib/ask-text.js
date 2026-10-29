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
