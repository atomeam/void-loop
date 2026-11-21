// One "Explore more" link on an answer card: the single best official site, reference, or legal source.
// rel=noopener nofollow, new tab. No link when the topic is unsafe or about minors, or when nothing good is on hand.
// Adult-intent cards only reveal it after the 18+ tap (the owner is exempt). Pure. Tests: tools/safe-meanings.test.mjs
const BAD_HOST = /\b(?:xvideos|pornhub|xhamster|xnxx|redtube|youporn|xvid|onlyfans|rotten\.com|bestgore)\b/i;
const LEGAL = /\b(?:wikipedia\.org|wikimedia\.org|\.gov(?:[./]|$)|britannica\.com|nih\.gov|who\.int|commons\.wikimedia)\b/i;

export function exploreMore({ official, reference, unsafe = false, minors = false, adult = false } = {}) {
  if (unsafe || minors) return null;
  const pick = official || reference;
  if (!/^https:\/\/[^\s"'<>]+$/i.test(String(pick || ''))) return null;
  let host = ''; try { host = new URL(pick).hostname; } catch (_) { return null; }
  if (BAD_HOST.test(host) || BAD_HOST.test(pick)) return null;
  if (adult && !LEGAL.test(host)) return null;
  return { href: String(pick), label: 'Explore more', rel: 'noopener nofollow', target: '_blank' };
}

export function exploreHtml(esc, link, { gated = false } = {}) {
  if (!link || gated) return '';
  return '<p class="explore"><a href="' + esc(link.href) + '" target="_blank" rel="noopener nofollow">Explore more</a></p>';
}

/** true when a "fuzzy / not named exactly" warning would be wrong because the answer is the same thing (a synonym). Pure. */
export function namesTheAsk(ask, { name = '', title = '', answer = '', desc = '' } = {}) {
  const flat = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const words = (s) => String(s || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  const a = flat(ask); if (!a) return false;
  if ([name, title, desc].some((v) => { const f = flat(v); return f && (f.includes(a) || a.includes(f)); })) return true;
  const syn = { porn: ['pornographic', 'adult', 'erotic'], magazine: ['magazine', 'periodical', 'journal'] };
  const have = new Set(words([name, title, answer, desc].join(' ')));
  return words(ask).every((w) => have.has(w) || (syn[w] || []).some((s) => have.has(s)));
}

/** true when the ask is about minors in a sexual or body context — never attach an Explore more link. Pure. */
export function minorsTopic(ask) {
  const t = String(ask || '').toLowerCase();
  if (!/\b(?:child(?:ren)?|kids?|toddler|infant|minor|under-?age|teen(?:ager)?s?|boy|girl|pre-?teen)\b/.test(t)) return false;
  return /\b(?:nude|naked|sex|porn|boob|breast|penis|xxx|nsfw|explicit)\b/.test(t);
}
