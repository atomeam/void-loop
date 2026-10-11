// arena-say — the answer to "how good are you at <game>" and its curve, from the record the self-play arena wrote
// (lib/arena.js, tools/arena.mjs). No game imports: a game's own card can use it without an import cycle.
// The answer to "how good are you at connect four / othello": the record the games wrote (tools/arena.mjs -> arena.json,
// arena-othello.json), never a claim. A ladder of depths says "looking N moves ahead"; a ladder of players names them.
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const TITLES = { connect4: 'Connect Four', othello: 'Othello' };
export function arenaSay(a, game = (a && a.game) || 'connect4') {
  const title = TITLES[game] || 'that game';
  if (!a || !Array.isArray(a.ladder) || !a.ladder.length) return 'I have not played myself at ' + title + ' yet, so I have no rating to give.';
  const top = a.ladder[a.ladder.length - 1], low = a.ladder[0], byDepth = Number.isFinite(top.depth);
  const head = byDepth ? 'looking ' + top.depth + ' moves ahead I play at ' + top.rating + ', ' + (top.rating - low.rating) + ' above looking ' + low.depth + ' ahead'
    : top.name + ' plays at ' + top.rating + ', ' + (top.rating - low.rating) + ' above ' + low.name + (top.how ? ' (' + top.how + ')' : '');
  return 'At ' + title + ', rated from ' + plural(a.games, 'game') + ' against myself (' + (a.anchor || low.name + ' = ' + low.rating) + '): ' + head + '. ' + a.ladder.map((s) => s.name + ' ' + s.rating).join(' · ') + '.'
    + (a.tuned ? ' A tuned evaluation scored ' + Math.round(a.tuned.score * 100) + '% against my own and ' + (a.tuned.kept ? 'was kept.' : 'was not kept.') : '')
    + (a.played ? ' Played ' + a.played + '.' : '');
}
// every value that reaches the markup is escaped or forced to a number, so a record that is not ours cannot add markup
const escXml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** the curve: rating against look-ahead depth, an inline SVG (no library), labelled for a screen reader */
export function arenaCurve(a, w = 300, h = 140) {
  const L = ((a && a.ladder) || []).filter((s) => Number.isFinite(+s.rating)).map((s) => ({ name: String(s.name), rating: Math.round(+s.rating), depth: Number.isFinite(+s.depth) && s.depth != null ? Math.round(+s.depth) : null }));
  const byDepth = L.every((s) => s.depth != null), tick = (s) => (byDepth ? 'depth ' + s.depth : escXml(s.name));
  if (!L.length) return '';
  const lo = Math.min(...L.map((s) => s.rating)) - 50, hi = Math.max(...L.map((s) => s.rating)) + 50, pad = 28;
  const x = (i) => pad + (L.length === 1 ? 0 : (i * (w - 2 * pad)) / (L.length - 1)), y = (r) => h - pad - ((r - lo) * (h - 2 * pad)) / (hi - lo);
  const pts = L.map((s, i) => x(i).toFixed(1) + ',' + y(s.rating).toFixed(1));
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" role="img" aria-label="Rating by ' + (byDepth ? 'look-ahead depth' : 'player') + ': ' + escXml(L.map((s) => s.name + ' ' + s.rating).join(', ')) + '">'
    + '<polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" stroke-width="2"/>'
    + L.map((s, i) => '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(s.rating).toFixed(1) + '" r="4" fill="currentColor"/><text x="' + x(i).toFixed(1) + '" y="' + (y(s.rating) - 8).toFixed(1) + '" font-size="11" text-anchor="middle" fill="currentColor">' + s.rating + '</text><text x="' + x(i).toFixed(1) + '" y="' + (h - 8) + '" font-size="11" text-anchor="middle" fill="currentColor">' + tick(s) + '</text>').join('')
    + '</svg>';
}

/** the card a rating ask opens: the record from this site (/arena.json, /arena-othello.json), the answer and the curve */
export function showArena(api, url, game) {
  const el = api.showPage((p) => { p.innerHTML = '<h2>How good I am at ' + (TITLES[game] || 'this game') + '</h2><p data-arena-say class="sub">Reading my games…</p><div data-arena-curve></div>'; });
  fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((a) => {
    el.querySelector('[data-arena-say]').textContent = arenaSay(a, game);
    el.querySelector('[data-arena-curve]').innerHTML = arenaCurve(a); // void-review: ok: arenaCurve escapes the names and forces every number
    api.say('');
  });
}
