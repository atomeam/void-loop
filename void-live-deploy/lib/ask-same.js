// lib/ask-same.js: when two of Verse's asks are one ask, and an ask's text without the model's citation tags. No imports, so the self card
// (lib/self-blocks.js), the voice record (lib/voice.js), the deploy's asks link (tools/asks-link.mjs) and the wants card (skills/wants.js)
// all fold asks by the same rule without loading each other. Tests: tools/self-card-true.test.mjs, tools/self-blocks.test.mjs.
// one ask said twice in other words is one ask (owner, 2026-10-18, "fix this" on a self card listing 'report-to-growth', the Zorbleflux
// throttle and 'dependency-health' twice each): two asks are the same when they quote the same name, or share most of their words
const STOP = new Set('a an the to of in on for and or so that this it its my me i as by with from into is be can when which what'.split(' '));
const quoted = (t) => { const m = /['‘"“]([^'’"”]{3,40})['’"”]/.exec(t); return m ? m[1].toLowerCase().replace(/[\s_-]+/g, '-') : ''; };
const words = (t) => new Set(String(t).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
export function sameAsk(a, b) {
  const qa = quoted(a), qb = quoted(b);
  if (qa && qb && qa !== qb) return false;
  const wa = words(a), wb = words(b); if (Math.min(wa.size, wb.size) < 3) return false; // too few words to call two asks one
  let n = 0; for (const w of wa) if (wb.has(w)) n++;
  // the same quoted name with a few more words in common is the same ask; two asks about one skill that want different things are not
  return n / Math.min(wa.size, wb.size) >= (qa && qb ? 0.4 : 0.7);
}
// the model's fact tags in its prose (owner's self card, 2026-11-06: "[my will]", "[S1]", "[S2, S4]", "[What I am being built, S2]"): the source
// line under each block already names the sources, so the words read without them. stripCites takes out every bracketed group of up to 80
// characters (model prose only: the readout, its paragraphs); uncite only the ones that are citations (an S tag, a fact label of the prompt, a
// date or a file), so an ask that really has brackets keeps them. Both fold the space left before a full stop. Pure.
const CITE_LABEL = /^(?:S\d{1,2}|my (?:will|want next)(?:, \d{4}-\d\d-\d\d)?|what (?:i want next|i am being built|my builders [a-z ]+|i said about myself[^\]]*)|how i am being built|(?:the )?(?:newest|new|current) (?:fact|input)|(?:fact: )?(?:this |just |recently |newly )?shipped|just shipped|new ship|shipment|recent_ship|(?:#\d+ )?wishlist(?: #\d+)?|growth|(?:the )?forge(?:, frontier #\d+)?|builders|no tag|(?:owner|claude|cursor)[, ]+[^\]]*|[\w./-]+\.(?:json|js|mjs|md)|[^\]]*\d{4}-\d\d-\d\d[^\]]*)$/i;
const isCite = (inner) => inner.split(/\s*[,;]\s*/).every((p) => CITE_LABEL.test(p.trim()));
const tidy = (s) => s.replace(/\s+([.,;:!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
export const stripCites = (t) => tidy(String(t == null ? '' : t).replace(/\s*\[[^\]\[\n]{1,80}\]/g, ''));
export const uncite = (t) => tidy(String(t == null ? '' : t).replace(/\s*\[([^\]\[\n]{1,80})\]/g, (m, inner) => (isCite(inner) ? '' : m)));

// One ask said twice is one ask (owner's self card, 2026-11-06: "Fix the images exam ..." three times in other words, "Add a page for
// onlineconverter.com to LANE_PAGES in lib/tower.js" twice word for word, "17 checked and 6 tested" beside "16 checked and 5 tested"):
// the same words once tags, case and punctuation are gone; the same words with only the numbers changed (at least four other words, so
// "ask 1" and "ask 2" stay two); or the same verb on the same named target (the X exam, the X skill, a site, a commit). Two asks that name
// different sites are never one. The card's lists fold with this and its own sameAsk (sameOrDup).
const SITE = /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|app|dev|co|ai|me|tv|gg|xyz|info|site|ru)\b/gi;
const sitesOfAsk = (t) => [...new Set((String(t).match(SITE) || []).map((s) => s.toLowerCase()))].sort().join(' ');
/** an ask's words for comparing: tags out, lower case, letters and digits only. Pure. */
export const askKey = (t) => uncite(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const targetsOf = (t) => {
  const s = uncite(t).toLowerCase(), out = new Set();
  for (const m of s.matchAll(/\bthe ['‘"“]?([a-z0-9][a-z0-9-]*)['’"”]? (exam|skill)s?\b/g)) out.add(m[2] + ':' + m[1].replace(/s$/, ''));
  for (const m of s.match(SITE) || []) out.add('site:' + m);
  for (const m of s.match(/\b[0-9a-f]{7,40}\b/g) || []) if (/\d/.test(m) && /[a-f]/.test(m)) out.add('commit:' + m);
  return [...out].sort().join(' ');
};
export function dupAsk(a, b) {
  const ka = askKey(a), kb = askKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (sitesOfAsk(a) !== sitesOfAsk(b)) return false;
  const ma = ka.replace(/\d+/g, '#');
  if (ma === kb.replace(/\d+/g, '#') && ma.split(' ').filter((w) => w.length > 2 && !/#/.test(w)).length >= 4) return true;
  const ta = targetsOf(a);
  return !!ta && ta === targetsOf(b) && ka.split(' ')[0] === kb.split(' ')[0];
}
/** one ask for the card's lists: the card's sameAsk or dupAsk. Pure. */
export const sameOrDup = (a, b) => sameAsk(uncite(a), uncite(b)) || dupAsk(a, b);
