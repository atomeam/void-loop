/**
 * define skill — what a word means, from Wiktionary (Wikimedia REST, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "define serendipity", "what does ephemeral mean", "meaning of saudade", "definition of hubris".
 */
const ABBR_HELD = new Set(['lol', 'asap', 'brb', 'btw', 'fyi', 'imo', 'imho', 'tbh', 'idk', 'omg', 'rsvp', 'eta', 'faq', 'diy', 'aka', 'tba', 'tbd', 'fomo', 'smh', 'irl', 'dm', 'afaik', 'tldr', 'ootd', 'nvm', 'ttyl', 'rofl', 'jk', 'ikr', 'ftw', 'goat', 'ama', 'eod', 'ooo', 'wfh', 'pto', 'roi', 'kpi', 'cc', 'bcc', 'ps', 'nb', 'ie', 'eg', 'etc']);
// typo-tolerant key words (issue #792: "menaing of saudade"): a word within a small edit distance of meaning/definition/define is read as it. Pure.
function lev(a, b) { const d = Array.from({ length: b.length + 1 }, (_, j) => j); for (let i = 1; i <= a.length; i++) { let p = d[0]; d[0] = i;
  for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } } return d[b.length]; }
const REAL = new Set(['mending', 'melting', 'meeting', 'meaning', 'morning', 'moaning', 'meant', 'defense', 'defiant', 'definite', 'refine', 'decline', 'design', 'detention', 'deflation', 'demolition']);
const KEYS = [['meaning', 2], ['definition', 2], ['define', 1]];
export function fixKeyTypos(t) {
  return t.replace(/^((?:please\s+|what(?:['’]?s|\s+is)\s+the\s+|(?:the\s+)?(?:dictionary|oxford)\s+)?)([a-z]{5,12})\b/i, (all, pre, w) => {
    const lw = w.toLowerCase(); if (KEYS.some(([k]) => k === lw) || REAL.has(lw)) return all;
    const hit = KEYS.find(([k, n]) => Math.abs(k.length - lw.length) <= n && lw[0] === k[0] && lev(lw, k) <= n);
    return hit ? pre + hit[0] : all; });
}
export function wordOf(text) {
  const t = fixKeyTypos(String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' '));
  const m = t.match(/^(?:please\s+)?define\s+(?:the\s+word\s+)?["“]?(.+?)["”]?$/i)
    || t.match(/^(?:what(?:['’]?s|\s+is)\s+the\s+)?(?:meaning|definition)\s+of\s+(?:the\s+word\s+)?["“]?(.+?)["”]?$/i)
    || t.match(/^what\s+does\s+(?:the\s+word\s+)?["“]?(.+?)["”]?\s+mean$/i)
    || t.match(/^what\s+is\s+the\s+meaning\s+of\s+["“]?(.+?)["”]?$/i)
    // "what does it mean to be pragmatic", "dictionary definition of empathy", "use serendipity in a sentence" (the card's example)
    || t.match(/^what\s+does\s+it\s+mean\s+to\s+be\s+(?:an?\s+)?["“]?([a-z][a-z'-]+)["”]?$/i)
    || t.match(/^(?:the\s+)?(?:dictionary|oxford|webster'?s?|merriam[- ]webster)\s+(?:definition|meaning)\s+(?:of|for)\s+(?:the\s+word\s+)?["“]?(.+?)["”]?$/i)
    || t.match(/^(?:use|put)\s+(?:the\s+word\s+)?["“]?([a-z][a-z'-]+)["”]?\s+in\s+a\s+sentence$/i);
  if (!m) return null;
  const w = m[1].trim();
  if (/^(?:[a-z]{2,6})$/i.test(w) && ABBR_HELD.has(w.toLowerCase())) return null; // texting and office abbreviations are answered by the calculator's table
  // a word or a short phrase, not a sentence or a number ("what does it mean", "define 42" stay elsewhere)
  if (!w || w.split(' ').length > 3 || /\d/.test(w) || /^(it|this|that|life|love|you|me|my\s+\w+)$/i.test(w)) return null;
  return w;
}

// where a word comes from (bench, 2026-10-30: "what language does the word kindergarten come from" fell to an article). Pure.
export function etymologyOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const W = '["“]?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\'’-]*(?: [A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\'’-]*){0,2}?)["”]?';
  const m = t.match(new RegExp('^(?:what|which)\\s+language\\s+(?:does|did|do)\\s+(?:the\\s+)?(?:word\\s+)?' + W + '\\s+come\\s+from$', 'i'))
    || t.match(new RegExp('^(?:what\\s+language\\s+is|where\\s+(?:does|did|do))\\s+(?:the\\s+)?word\\s+' + W + '(?:\\s+(?:come|came)\\s+from)?$', 'i'))
    || t.match(new RegExp('^(?:what(?:[\'’]?s|\\s+is)\\s+the\\s+)?(?:(?:etymology|word\\s+origin|word\\s+history)\\s+of\\s+(?:the\\s+word\\s+)?|origin\\s+of\\s+the\\s+word\\s+)' + W + '$', 'i'))
    || t.match(new RegExp('^(?:the\\s+)?(?:word\\s+)?' + W + '\\s+(?:etymology|word\\s+origin)$', 'i'));
  if (!m) return null;
  const w = m[1].trim();
  return w && !/^(?:it|this|that|life|love|you|me|the|a|an)$/i.test(w) ? w : null;
}
const WIKT = 'https://en.wiktionary.org/w/api.php?format=json&formatversion=2&origin=*&redirects=1&action=parse&page=';
/** the section index of the English Etymology (the first one, "Etymology 1" when there are several), or ''. Pure. */
export function etymologySection(sections) {
  const s = Array.isArray(sections) ? sections : []; const en = s.findIndex((x) => x && String(x.level) === '2' && x.line === 'English');
  if (en < 0) return '';
  for (let i = en + 1; i < s.length && String(s[i].level) !== '2'; i++) if (/^Etymology\b/.test(String(s[i].line || ''))) return String(s[i].index || '');
  return '';
}
/** a section's rendered HTML -> { from, text }: the first language Wiktionary names (its span.etyl) and the first paragraph, as plain text. Pure. */
export function etymologyFrom(html) {
  const h = String(html || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<sup[\s\S]*?<\/sup>/gi, '');
  // the first paragraph with words in it (an etymology tree or an empty <p> can come first)
  const p = [...h.replace(/<table[\s\S]*?<\/table>/gi, '').matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)].map((x) => x[1]).find((x) => strip(x).length > 8) || '';
  const ent = (x) => x.replace(/&#(\d{1,6});/g, (_, n) => (+n <= 0x10ffff ? String.fromCodePoint(+n) : '')).replace(/&#x([0-9a-f]{1,6});/gi, (_, n) => (parseInt(n, 16) <= 0x10ffff ? String.fromCodePoint(parseInt(n, 16)) : ''));
  let text = ent(strip(p));
  if (text.length > 600) { const cut = text.indexOf('. ', 400); if (cut > 0) text = text.slice(0, cut + 1); } // whole sentences, never a cut word
  const from = ent(strip((p.match(/<span class="etyl">([\s\S]*?)<\/span>/i) || [])[1] || ''));
  return { from: /^[\p{L} ().'-]{2,60}$/u.test(from) ? from : '', text };
}
async function runEtymology(word, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(word) + '</h2><div class="sub">…</div>'; });
  const page = 'https://en.wiktionary.org/wiki/' + encodeURIComponent(word.replace(/ /g, '_'));
  const get = (q) => (api.fetch || fetch)(WIKT + encodeURIComponent(word.replace(/ /g, '_')) + q).then((r) => { if (!r.ok) throw 0; return r.json(); });
  let e = null, reached = false;
  try {
    const s = await get('&prop=sections'); reached = true;
    const i = etymologySection(s && s.parse && s.parse.sections);
    if (i) { const t = await get('&prop=text&section=' + encodeURIComponent(i)); e = etymologyFrom(t && t.parse && t.parse.text); }
  } catch (_) {}
  if (!api._pageStill(el)) return 'define';
  if (!e || !e.text) {
    el.innerHTML = '<h2>' + esc(word) + '</h2><p>' + (reached ? 'Wiktionary has no word history for “' + esc(word) + '”. Ask “define ' + esc(word) + '” for what it means.' : 'The dictionary didn\'t answer just now. Ask again in a moment.') + '</p>';
    return reached ? 'define' : 'none';
  }
  el.innerHTML = '<h2>' + esc(word) + '</h2>' + (e.from ? '<p style="font-size:20px">From ' + esc(e.from) + '.</p>' : '') + '<p>' + esc(e.text) + '</p>'
    + '<div class="src">Source: <a href="' + esc(page) + '#Etymology" target="_blank" rel="noopener">Wiktionary</a></div>';
  return 'define';
}

const strip = (html) => String(html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

async function run(text, api) {
  const { showPage, esc } = api;
  const origin = etymologyOf(text);
  if (origin) return runEtymology(origin, api);
  const word = wordOf(text);
  if (!word) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(word) + '</h2><div class="sub">…</div>'; });
  const url = 'https://en.wiktionary.org/api/rest_v1/page/definition/' + encodeURIComponent(word.replace(/ /g, '_')) + '?redirect=true';
  const page = 'https://en.wiktionary.org/wiki/' + encodeURIComponent(word.replace(/ /g, '_'));
  let j = null;
  let reached = false; // the dictionary answered at all (a 404 is an answer: no such word); a network failure is not
  try { const r = await (api.fetch || fetch)(url); reached = r.ok || r.status === 404; if (r.ok) j = await r.json(); } catch (_) {}
  if (!api._pageStill(el)) return 'define';
  let senses = (j && (j.en || j[Object.keys(j)[0]])) || [];
  senses = senses.map((s) => ({ pos: s.partOfSpeech, defs: (s.definitions || []).map((d) => strip(d.definition)).filter(Boolean).slice(0, 3),
    // one example sentence per sense, when the dictionary has one ("use serendipity in a sentence" is answered by it)
    ex: (s.definitions || []).flatMap((d) => (d.examples || []).map(strip)).find((e) => e && e.length <= 220) || '' })).filter((s) => s.defs.length).slice(0, 3);
  if (!senses.length && !reached) {
    el.innerHTML = '<h2>' + esc(word) + '</h2><p>The dictionary didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
  if (!senses.length) {
    el.innerHTML = '<h2>' + esc(word) + '</h2><p>I couldn\'t find “' + esc(word) + '” in the dictionary. Check the spelling, or ask “what is ' + esc(word) + '” for a page about it.</p>';
    return 'none';
  }
  el.innerHTML = '<h2>' + esc(word) + '</h2>'
    + senses.map((s) => '<div class="sub" style="margin-top:8px">' + esc(s.pos || '') + '</div><ol style="margin:4px 0 0 18px;padding:0">' + s.defs.map((d) => '<li style="margin:2px 0">' + esc(d) + '</li>').join('') + '</ol>' + (s.ex ? '<div class="sub" style="margin:4px 0 0 18px;font-style:italic">“' + esc(s.ex) + '”</div>' : '')).join('')
    + '<div class="src">Source: <a href="' + esc(page) + '" target="_blank" rel="noopener">Wiktionary</a></div>';
  return 'define';
}

export default {
  name: 'define',
  examples: ['define serendipity', 'what does ephemeral mean', 'meaning of saudade', 'definition of hubris', 'menaing of saudade', 'defintion of hubris', 'what language does the word kindergarten come from', 'etymology of salary'],
  nearMisses: ['what is a black hole', 'what does it mean', 'define 42', 'meaning of life', 'what time is it in Tokyo', 'what language do they speak in brazil', 'where does coffee come from'],
  match(lower, text) { return !!(etymologyOf(text) || wordOf(text)); },
  run
};
