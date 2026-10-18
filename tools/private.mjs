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

// The owner's own words stay off the site (the owner, 2026-10-18): only Verse's words are shown. A quote credited to the owner
// ("(owner, 2026-10-13: "…")", "the owner: "…"", "Adam, 2026-10-02: "…"") is left out with its bracket when it has one; the rest of
// the sentence stays. Verse's own asks and words are not touched. The repo keeps the quotes (append-only records, build notes);
// only what is served is filtered (tools/public-ledger.mjs, tools/self-context.mjs, tools/public-quotes.mjs). Pure.
const WHO = String.raw`(?:the\s+owner|owner|Adam|Atom)`;
const QUOTED = String.raw`["“][^"”]{0,900}["”]`; // a quote may wrap onto the next comment line
const QUOTES = String.raw`${QUOTED}(?:\s*(?:[;,]|and|then)\s*${QUOTED})*`;
const ATTRIB_IN_PARENS = new RegExp(String.raw`\s*\([^()]*\b${WHO}\b[^()]*?:\s*${QUOTES}[^()]*\)`, 'g');
const ATTRIB_BARE = new RegExp(String.raw`(\b${WHO}\b[^"“”\n:]{0,60}?):\s*${QUOTES}`, 'g');
const WORDS = new RegExp(String.raw`(\b(?:in\s+)?(?:the\s+)?(?:owner|Adam|Atom)'s\s+(?:own\s+)?words)[,:]?\s*${QUOTES}`, 'g'); // "in the owner's words "…""
export const quotesOwner = (s) => new RegExp(String.raw`\b${WHO}\b[^"“”\n:]{0,60}?:\s*${QUOTED}`).test(String(s || '')) || new RegExp(WORDS.source).test(String(s || '')); // both patterns are built from this file's own constants, never from the text tested (void-review: ok)
export function quoteFree(text) {
  const t = String(text == null ? '' : text);
  if (!quotesOwner(t)) return t;
  return t.replace(ATTRIB_IN_PARENS, '').replace(ATTRIB_BARE, '$1').replace(WORDS, '$1').replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1');
}
/** every string in a JSON value through quoteFree (keys untouched). Pure. */
export const deepQuoteFree = (v) => (typeof v === 'string' ? quoteFree(v) : Array.isArray(v) ? v.map(deepQuoteFree) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepQuoteFree(x)])) : v);
