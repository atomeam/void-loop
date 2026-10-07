/**
 * define skill — what a word means, from Wiktionary (Wikimedia REST, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "define serendipity", "what does ephemeral mean", "meaning of saudade", "definition of hubris".
 */
const ABBR_HELD = new Set(['lol', 'asap', 'brb', 'btw', 'fyi', 'imo', 'imho', 'tbh', 'idk', 'omg', 'rsvp', 'eta', 'faq', 'diy', 'aka', 'tba', 'tbd', 'fomo', 'smh', 'irl', 'dm', 'afaik', 'tldr', 'ootd', 'nvm', 'ttyl', 'rofl', 'jk', 'ikr', 'ftw', 'goat', 'ama', 'eod', 'ooo', 'wfh', 'pto', 'roi', 'kpi', 'cc', 'bcc', 'ps', 'nb', 'ie', 'eg', 'etc']);
export function wordOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:please\s+)?define\s+(?:the\s+word\s+)?["“]?(.+?)["”]?$/i)
    || t.match(/^(?:what(?:['’]?s|\s+is)\s+the\s+)?(?:meaning|definition)\s+of\s+(?:the\s+word\s+)?["“]?(.+?)["”]?$/i)
    || t.match(/^what\s+does\s+(?:the\s+word\s+)?["“]?(.+?)["”]?\s+mean$/i)
    || t.match(/^what\s+is\s+the\s+meaning\s+of\s+["“]?(.+?)["”]?$/i);
  if (!m) return null;
  const w = m[1].trim();
  if (/^(?:[a-z]{2,6})$/i.test(w) && ABBR_HELD.has(w.toLowerCase())) return null; // texting and office abbreviations are answered by the calculator's table
  // a word or a short phrase, not a sentence or a number ("what does it mean", "define 42" stay elsewhere)
  if (!w || w.split(' ').length > 3 || /\d/.test(w) || /^(it|this|that|life|love|you|me|my\s+\w+)$/i.test(w)) return null;
  return w;
}

const strip = (html) => String(html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

async function run(text, api) {
  const { showPage, esc } = api;
  const word = wordOf(text);
  if (!word) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(word) + '</h2><div class="sub">…</div>'; });
  const url = 'https://en.wiktionary.org/api/rest_v1/page/definition/' + encodeURIComponent(word.replace(/ /g, '_')) + '?redirect=true';
  const page = 'https://en.wiktionary.org/wiki/' + encodeURIComponent(word.replace(/ /g, '_'));
  let j = null;
  let reached = false; // the dictionary answered at all (a 404 is an answer: no such word); a network failure is not
  try { const r = await fetch(url); reached = r.ok || r.status === 404; if (r.ok) j = await r.json(); } catch (_) {}
  if (!api._pageStill(el)) return 'define';
  let senses = (j && (j.en || j[Object.keys(j)[0]])) || [];
  senses = senses.map((s) => ({ pos: s.partOfSpeech, defs: (s.definitions || []).map((d) => strip(d.definition)).filter(Boolean).slice(0, 3) })).filter((s) => s.defs.length).slice(0, 3);
  if (!senses.length && !reached) {
    el.innerHTML = '<h2>' + esc(word) + '</h2><p>The dictionary didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
  if (!senses.length) {
    el.innerHTML = '<h2>' + esc(word) + '</h2><p>I couldn\'t find “' + esc(word) + '” in the dictionary. Check the spelling, or ask “what is ' + esc(word) + '” for a page about it.</p>';
    return 'none';
  }
  el.innerHTML = '<h2>' + esc(word) + '</h2>'
    + senses.map((s) => '<div class="sub" style="margin-top:8px">' + esc(s.pos || '') + '</div><ol style="margin:4px 0 0 18px;padding:0">' + s.defs.map((d) => '<li style="margin:2px 0">' + esc(d) + '</li>').join('') + '</ol>').join('')
    + '<div class="src">Source: <a href="' + esc(page) + '" target="_blank" rel="noopener">Wiktionary</a></div>';
  return 'define';
}

export default {
  name: 'define',
  examples: ['define serendipity', 'what does ephemeral mean', 'meaning of saudade', 'definition of hubris'],
  nearMisses: ['what is a black hole', 'what does it mean', 'define 42', 'meaning of life', 'what time is it in Tokyo'],
  match(lower, text) { return !!wordOf(text); },
  run
};
