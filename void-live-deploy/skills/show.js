/**
 * show skill — a TV show from TVMaze (no key)
 * "tv show severance", "what network is the office on", "when did breaking bad end".
 */
const HISTORY = /\b(?:wars?|ww\s?[12i]+|world\s+war|revolution|battle|siege|depression|recession|prohibition|apartheid|slavery|segregation|pandemic|epidemic|plague|lockdown|empire|dynasty|reign|era|age|colonial\w*|occupation|crusades?|genocide|holocaust|famine|strike|crisis|rule|regime|monarchy|soviet\s+union|ussr|daylight\s+saving|school|summer|winter|the\s+\d{4}s)\b/i;
export function showOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:tv\s+show|the\s+tv\s+show|show\s+me\s+the\s+tv\s+show)\s+(.{2,60})$/i);
  if (m) return m[1].replace(/^(?:called|named)\s+/i, '');
  m = t.match(/^what\s+network\s+is\s+(.{2,60}?)\s+on$/i);
  if (m) return m[1];
  m = t.match(/^when\s+did\s+(.{2,60}?)\s+end$/i);
  // history is not television: "when did world war 2 end", "when did the cold war end", "when did prohibition end"
  if (m && !/the\s+world|it\s+all/.test(m[1]) && !HISTORY.test(m[1])) return m[1];
  return null;
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = showOf(text);
  if (!q) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>TV</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://api.tvmaze.com/singlesearch/shows?q=' + encodeURIComponent(q)).then((r) => r.ok ? r.json() : null);
    if (!api._pageStill(el)) return 'show';
    if (!j || !j.name) throw 0;
    const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const summary = strip(j.summary).slice(0, 420);
    el.innerHTML = '<h2>' + esc(j.name) + '</h2>'
      + '<p style="color:#8a8a8a">' + esc([j.network && j.network.name, j.status, j.premiered, j.ended && ('ended ' + j.ended)].filter(Boolean).join(' · ')) + '</p>'
      + (summary ? '<p>' + esc(summary) + '</p>' : '')
      + '<div class="src">Source: <a href="' + esc(j.url || 'https://www.tvmaze.com') + '" target="_blank" rel="noopener">TVMaze</a></div>';
    return 'show';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>TV</h2><p>No show turned up for that. Try the name the way it is billed.</p>';
    return 'show';
  }
}
export default {
  name: 'show',
  examples: ['tv show severance', 'what network is the office on', 'when did breaking bad end', 'show me the tv show andor'],
  nearMisses: ['what is a tv', 'show the map', 'show me a map of paris', 'office hours'],
  match(lower, text) { return !!showOf(text); },
  run
};
