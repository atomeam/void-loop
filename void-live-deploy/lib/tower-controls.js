// The gate's controls (owner's standards, 2026-10-28, after Amazon and YouTube read as checked off on a store and a video page that have
// nothing on them): a floor is beaten only by scripted end-to-end journeys a person would take, each with positive controls (what must be
// there) and negative controls (no stub, placeholder, error page or "coming soon" showing). A check that was blocked, skipped or did not load
// is INCOMPLETE, never a pass. A comparison where the rival scored nothing counts only when the gate really read the rival's page.
// Shared by lib/tower.js (the pure gate), tools/tower-gate.mjs and tools/tower-journeys.mjs (the runners). Pure.

/** text that means a page is not doing its job yet: a stub, a placeholder, a "coming soon", a mock. */
export const STUB_RE = /\b(?:coming soon|lorem ipsum|placeholder (?:text|content|data)|not (?:yet )?implemented|under construction|work in progress|TODO:|mock(?:ed)? (?:data|results?|products?)|dummy (?:data|text|content)|fake (?:data|results?))\b/i;
/** text that means the page failed: an error page or a crashed app. */
export const ERROR_RE = /(?:\b404\b[^\n]{0,30}not found|\bpage not found\b|something went wrong|internal server error|\b50[234]\b[^\n]{0,20}(?:bad gateway|unavailable|timeout)|application error|uncaught (?:type|reference)error|cannot read propert(?:y|ies) of)/i;
/** text that means the rival turned the reader away: a bot wall, a captcha, a sign-in wall. What is behind it was never seen. */
export const WALL_RE = /(?:enter the characters you see|type the characters you see|are you a (?:human|robot)|verify (?:that )?you are (?:a )?human|confirm you(?:'|’)re not a robot|unusual traffic|\bcaptcha\b|access denied|request (?:was )?blocked|checking (?:if the site connection is secure|your browser)|just a moment\.\.\.|sorry, we just need to make sure you(?:'|’)re not a robot|sign in to (?:continue|confirm you)|robot check)/i;

/** the negative controls a page's visible text fails, as plain words (empty when it passes all of them). Pure. */
export function negativesOf(text) {
  const t = String(text || ''), out = [];
  const m1 = t.match(STUB_RE); if (m1) out.push('stub or placeholder text: "' + m1[0] + '"');
  const m2 = t.match(ERROR_RE); if (m2) out.push('error text: "' + m2[0] + '"');
  if (t.replace(/\s+/g, ' ').trim().length < 40) out.push('the page shows almost nothing (' + t.trim().length + ' characters)');
  return out;
}
/** true when the text is a bot wall or sign-in wall rather than the page (what is behind it was never read). Pure. */
export const wallOf = (text) => WALL_RE.test(String(text || ''));

export const JOURNEY_PREFIX = 'journey: ';
export const isJourney = (aspect) => String(aspect).startsWith(JOURNEY_PREFIX);
/** a journey row passes only when the runner recorded every step it took and every negative control it checked, and said pass. Pure. */
export function journeyPasses(r) {
  return !!(r && r.verdict === 'pass' && Array.isArray(r.steps) && r.steps.length > 0 && Array.isArray(r.negatives) && r.negatives.length > 0 && r.evidence && !r.incomplete);
}
/** a row that was blocked, skipped or not loaded: never a pass, never a loss. Pure. */
export const incompleteRow = (r) => !!(r && (r.verdict === 'incomplete' || r.incomplete));
/** a comparison won only because the rival could not be read (the standards: blocked is INCOMPLETE, never a pass): the rival's reliability
 *  "0 of 3 ... turned the gate away", or a full-answer count where the rival showed none of 8 or more things (Amazon, 2026-10-28: "23 of 23 vs
 *  Amazon 0 of 23", Amazon's page was a bot wall to the gate, not a store with nothing on it). A row the gate marks siteRead (it read the
 *  rival's own page, no wall) is a real comparison. Rows judged on Verse alone or against the bar are not comparisons and are not touched. Pure. */
export function zeroRivalUnread(r) {
  if (!r || r.siteRead || r.part) return false;
  const e = String(r.evidence || '');
  if (/judged (?:on Verse alone|against the standard)/.test(e)) return false;
  if (/\b0 of 3 from an ordinary phone browser \(it turned the gate away/.test(e)) return true;
  const m = e.match(/\bvs [^\n]*?\b0 of (\d+) things a full answer shows/);
  return !!(m && Number(m[1]) >= 8);
}
