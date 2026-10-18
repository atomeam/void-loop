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
    + (a.champion && Number.isFinite(+a.champion.vsCard) && a.champion.vsCard > 0.55
      ? ' Self-play has found an evaluation that scores ' + Math.round(a.champion.vsCard * 100) + '% against my card\'s own, kept since ' + a.champion.since + ' (' + a.champion.days + ' day' + (a.champion.days === 1 ? '' : 's') + ' of tuning).'
      : a.champion ? ' Self-play tuning has run for ' + a.champion.days + ' day' + (a.champion.days === 1 ? '' : 's') + ' and has not yet found an evaluation that clearly beats my own.'
      : a.tuned ? ' A tuned evaluation scored ' + Math.round(a.tuned.score * 100) + '% against my own and ' + (a.tuned.kept ? 'was kept.' : 'was not kept.') : '')
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

// Day over day (the owner, 2026-10-11: "show day-over-day deltas on self-play ... so overnight progress is visible at a
// glance"): the daily run keeps one line a day in arena.json's history; the card says the change since the last day that
// differed. The seed is fixed, so most days change nothing, and the card says that rather than inventing a delta.
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/, MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (d) => { const m = DAY.exec(String(d)); return m ? MONTHS[+m[2] - 1] + ' ' + +m[3] : ''; };
const goodDay = (e) => e && DAY.test(String(e.date)) && Number.isFinite(e.rating);
/** history plus one day ({ date: 'YYYY-MM-DD', rating, vsCard }): the same date replaces its line; the last `max` kept. Pure. */
export function pushHistory(history, entry, max = 60) {
  const h = (Array.isArray(history) ? history : []).filter(goodDay);
  if (!goodDay(entry)) return h;
  return [...h.filter((e) => e.date !== entry.date), { date: entry.date, rating: Math.round(entry.rating), vsCard: Number.isFinite(entry.vsCard) ? entry.vsCard : null }]
    .sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-max);
}
/** "+62 since Oct 10": the latest rating against the most recent earlier day that differed; '' with no history. Pure. */
export function arenaDelta(history) {
  const h = (Array.isArray(history) ? history : []).filter(goodDay);
  if (!h.length) return '';
  const last = h[h.length - 1];
  if (h.length === 1) return 'first day on record (' + dayLabel(last.date) + ')';
  const prev = [...h.slice(0, -1)].reverse().find((e) => e.rating !== last.rating);
  if (!prev) return 'no change since ' + dayLabel(h[0].date);
  const d = last.rating - prev.rating;
  return (d > 0 ? '+' : '\u2212') + Math.abs(d) + ' since ' + dayLabel(prev.date);
}
/** a small line of the days, an inline SVG labelled for a screen reader; '' until there are two days. Pure. */
export function arenaTrend(history, w = 300, h = 60) {
  const H = (Array.isArray(history) ? history : []).filter(goodDay).map((e) => ({ label: dayLabel(e.date), rating: Math.round(e.rating) }));
  if (H.length < 2) return '';
  const lo = Math.min(...H.map((e) => e.rating)) - 10, hi = Math.max(...H.map((e) => e.rating)) + 10, pad = 8;
  const x = (i) => pad + (i * (w - 2 * pad)) / (H.length - 1), y = (r) => h - pad - ((r - lo) * (h - 2 * pad)) / (hi - lo);
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" role="img" aria-label="Rating by day: ' + escXml(H.map((e) => e.label + ' ' + e.rating).join(', ')) + '">'
    + '<polyline points="' + H.map((e, i) => x(i).toFixed(1) + ',' + y(e.rating).toFixed(1)).join(' ') + '" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.7"/>'
    + H.map((e, i) => '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(e.rating).toFixed(1) + '" r="2.5" fill="currentColor"/>').join('') + '</svg>';
}

/** the card a rating ask opens: the record from this site (/arena.json, /arena-othello.json), the answer and the curve */
export function showArena(api, url, game) {
  const el = api.showPage((p) => { p.innerHTML = '<h2>How good I am at ' + escXml(TITLES[game] || 'this game') + '</h2><p data-arena-say class="sub">Reading my games…</p><div data-arena-curve></div><p data-arena-delta class="sub"></p><div data-arena-trend></div>'; }); // void-review: ok: the title is a fixed name from TITLES, escaped
  fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((a) => {
    el.querySelector('[data-arena-say]').textContent = arenaSay(a, game);
    el.querySelector('[data-arena-curve]').innerHTML = arenaCurve(a); // void-review: ok: arenaCurve escapes the names and forces every number
    const delta = arenaDelta(a && a.history); // day over day, from the daily run's history
    el.querySelector('[data-arena-delta]').textContent = delta ? 'Day over day: ' + delta + '.' : '';
    el.querySelector('[data-arena-trend]').innerHTML = arenaTrend(a && a.history); // void-review: ok: arenaTrend writes only day labels it built and numbers
    arenaNoteForm(el, api, game, a); // asked by Verse, 2026-10-16: write down why a self-play run failed or worked
    api.say('');
  });
}

/** under the card: one box and a button; the note goes to the notepad as "self-play connect four, Oct 16: rated 1609 (+62 since Oct 10). Why: <your words>" */
function arenaNoteForm(el, api, game, a) {
  if (!el || !api.stage || el.querySelector('[data-arena-note]')) return;
  const form = document.createElement('form'); form.setAttribute('data-arena-note', ''); form.style.cssText = 'display:flex;gap:6px;margin-top:10px';
  const box = document.createElement('input'); box.type = 'text'; box.placeholder = 'why did it fail or win? your note'; box.maxLength = 300; box.setAttribute('aria-label', 'note on this self-play run'); box.style.cssText = 'flex:1;font:inherit;padding:4px 8px';
  const go = document.createElement('button'); go.type = 'submit'; go.textContent = 'to notepad';
  form.append(box, go);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    import('../skills/notepad.js').then((n) => import('./bridges.js').then((b) => { n.append(api.stage, b.arenaNoteLine(game, a, arenaDelta(a && a.history)) + box.value.trim()); box.value = ''; api.say('in the notepad'); })).catch(() => {});
  });
  el.appendChild(form);
}
