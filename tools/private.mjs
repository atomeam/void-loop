// What Verse studies stays off the site (the owner, 2026-10-13: Verse does not need to say what sites it is studying or
// borrowing from). The growth ledger, the frontier and the build notes name the products Verse measures itself against;
// everything the site serves is passed through here at build and deploy time (tools/public-ledger.mjs, tools/self-context.mjs); this file is never served, so the list itself stays off the site, and any sentence or bracket that names one, or the
// study itself, is left out. The ledger stays append-only in the repo; only what is shown is filtered. Pure.
export const PRIVATE = [
  /\bcandy[ .-]?ai\b/i,
  /\bibis ?paint\b/i,
  /\belevenessee\b/i,
  /\bdomains\/targets\b/i,
  /\bone notch past\b/i,
  /\bnotch past\b/i,
  /\btargets?\b[^.;]{0,80}\b(?:site|sights|feature|beaten|beats|study|studying|one at a time)\b/i,
  /\btarget(?:s)?:/i,
  /\btarget \d+\b/i,
];
export const isPrivate = (s) => PRIVATE.some((re) => re.test(String(s || '')));

/** text with every bracketed aside and sentence that names a studied product left out; '' when nothing else is left */
export function privateFree(text) {
  let t = String(text || '');
  if (!isPrivate(t)) return t;
  t = t.replace(/\s*\([^()]*\)/g, (m) => (isPrivate(m) ? '' : m)); // "(target: ibisPaint X, feature layers)"
  if (isPrivate(t.split(/(?<=[.;!?])\s+/)[0])) return ''; // the line is about the study itself: none of it is shown
  const parts = t.split(/(?<=[.;!?])\s+/);
  const kept = parts.map((p) => (isPrivate(p) ? p.split(/,\s+|\s+(?:and|plus)\s+/).every(isPrivate) ? '' : p.split(/(?<=,)\s+/).filter((c) => !isPrivate(c)).join(' ').replace(/,\s*$/, '.') : p)).filter((p) => p.trim());
  const out = kept.join(' ').replace(/\s+/g, ' ').trim();
  return isPrivate(out) ? '' : out;
}
