// "Match graphics" (void-live-deploy/scores/gfx.js on a game's detail, tools/matchgfx.test.mjs): pictures Verse draws itself from the data /api/scores already holds, as inline SVG:
// a score card, a goal and card timeline, stats bars, a win-chance curve, the lineups on a pitch where the feed gives a formation, and a collage of a day's results. No crests,
// logos or photos: teams are text and the colour the feed gives them. Every picture is role=img with an alt text that says the facts, and every function returns { svg, alt }.
// Pure strings; nothing here touches a page. The source is named inside each picture: "Drawn by Verse from <source> data".
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// a name too long for its place is cut at a whole word (never with dots); the full text stays in the picture's alt text and caption
const cut = (v, n) => { const s = String(v || ''); if (s.length <= n) return s; const k = s.lastIndexOf(' ', n); return s.slice(0, k > n / 2 ? k : n).trim(); };
const colour = (c, fallback) => (/^[0-9a-f]{6}$/i.test(String(c || '')) ? '#' + c : fallback);
const FONT = 'system-ui, -apple-system, Segoe UI, sans-serif', W = 600;
const wrap = (h, alt, inner) => ({ alt, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + h + '" width="100%" role="img" aria-label="' + esc(alt) + '" font-family="' + FONT + '"><title>' + esc(alt) + '</title><rect width="' + W + '" height="' + h + '" rx="14" fill="#14121c"/>' + inner + '</svg>' });
const txt = (x, y, s, size, fill, anchor = 'start', weight = 400) => '<text x="' + x + '" y="' + y + '" font-size="' + size + '" fill="' + fill + '" text-anchor="' + anchor + '" font-weight="' + weight + '">' + esc(s) + '</text>';
const credit = (h, source) => txt(W - 14, h - 10, 'Drawn by Verse from ' + source + ' data', 11, '#a3a0b3', 'end');
/** the minute of an event text ("12'", "45'+2'", "90'+4'") as a number of minutes, or null. Pure. */
export const minuteOf = (m) => { const x = /^(\d{1,3})'?(?:\s*\+\s*(\d{1,2}))?/.exec(String(m || '').trim()); return x ? +x[1] + (x[2] ? +x[2] : 0) : null; };
/** which side an event belongs to: by the team id the scoreboard gives, or by the team's name the summary gives. Pure. */
export function sideOf(e, game) {
  const t = String(e.team || '').toLowerCase(); if (!t) return null;
  if (t === String(game.home.id).toLowerCase() || t === game.home.name.toLowerCase()) return 'home';
  if (t === String(game.away.id).toLowerCase() || t === game.away.name.toLowerCase()) return 'away'; return null;
}
const scoreText = (g) => (g.state === 'pre' ? 'v' : (g.home.score || '0') + ' - ' + (g.away.score || '0'));
/** the score card: two colour blocks with the team names, the score big, the status, the venue and the competition. */
export function scoreCard(game, leagueName, source = 'ESPN', when = '') {
  const hc = colour(game.home.color, '#6d4aff'), ac = colour(game.away.color, '#a58bff'), status = game.state === 'live' ? 'LIVE ' + (game.status || '') : game.state === 'final' ? game.status || 'FT' : when;
  const alt = leagueName + ': ' + game.home.name + ' ' + (game.state === 'pre' ? 'against' : game.home.score + ' - ' + game.away.score) + ' ' + game.away.name + (status ? ', ' + status : '') + (game.venue ? ', ' + game.venue : '') + '.';
  return wrap(220, alt, '<rect x="0" y="0" width="14" height="150" fill="' + hc + '"/><rect x="' + (W - 14) + '" y="0" width="14" height="150" fill="' + ac + '"/>' + txt(300, 34, leagueName, 14, '#a3a0b3', 'middle', 600)
    + txt(30, 100, cut(game.home.name, 18), 26, '#ecebf5', 'start', 700) + txt(W - 30, 100, cut(game.away.name, 18), 26, '#ecebf5', 'end', 700) + txt(300, 150, scoreText(game), 54, '#ffffff', 'middle', 800)
    + txt(300, 182, status, 16, game.state === 'live' ? '#ff6b7e' : '#a3a0b3', 'middle', 600) + txt(300, 204, cut(game.venue, 50), 13, '#a3a0b3', 'middle') + credit(220, source));
}
/** the timeline: a 90-minute axis, the home side's goals above it and the away side's below, cards as small squares, with the minutes as labels. */
export function timeline(game, source = 'ESPN') {
  const ev = (game.events || []).map((e) => ({ ...e, m: minuteOf(e.min), side: sideOf(e, game) })).filter((e) => e.m != null && e.side && /^(goal|pen|owngoal|red|yellow)$/.test(e.kind)), x = (m) => 30 + Math.min(m, 100) / 90 * 540, mid = 90;
  const marks = ev.map((e) => { const up = (e.kind === 'owngoal' ? (e.side === 'home' ? 'away' : 'home') : e.side) === 'home', y = up ? mid - 26 : mid + 26, cx = x(e.m);
    const shape = e.kind === 'red' || e.kind === 'yellow' ? '<rect x="' + (cx - 5) + '" y="' + (y - 7) + '" width="10" height="14" fill="' + (e.kind === 'red' ? '#d6334a' : '#f2c230') + '" data-min="' + e.m + '" data-kind="' + e.kind + '"/>' : '<circle cx="' + cx.toFixed(1) + '" cy="' + y + '" r="8" fill="#ffffff" data-min="' + e.m + '" data-kind="' + e.kind + '"/>';
    return '<line x1="' + cx.toFixed(1) + '" y1="' + mid + '" x2="' + cx.toFixed(1) + '" y2="' + y + '" stroke="#6a667a"/>' + shape + txt(cx.toFixed(1), up ? y - 14 : y + 24, e.m + "'", 11, '#ecebf5', 'middle'); }).join('');
  const alt = 'Timeline of ' + game.home.name + ' ' + (game.home.score || '0') + ' - ' + (game.away.score || '0') + ' ' + game.away.name + ': ' + (ev.length ? ev.map((e) => (e.kind === 'red' ? 'red card' : e.kind === 'yellow' ? 'yellow card' : e.kind === 'pen' ? 'penalty' : e.kind === 'owngoal' ? 'own goal' : 'goal') + ' for ' + (e.side === 'home' ? game.home.name : game.away.name) + ' at ' + e.m + ' minutes').join(', ') : 'no goals or cards listed') + '.';
  const axis = '<line x1="30" y1="' + mid + '" x2="570" y2="' + mid + '" stroke="#a3a0b3"/>' + [0, 45, 90].map((m) => txt(x(m), mid + 4 - 0, '', 1, '#000') + '<line x1="' + x(m) + '" y1="' + (mid - 5) + '" x2="' + x(m) + '" y2="' + (mid + 5) + '" stroke="#a3a0b3"/>' + txt(x(m), 172, m + "'", 11, '#a3a0b3', 'middle')).join('');
  return wrap(190, alt, txt(30, 24, game.home.name + ' (above)', 12, '#a3a0b3') + txt(570, 24, game.away.name + ' (below)', 12, '#a3a0b3', 'end') + axis + marks + credit(190, source));
}
/** stats bars: for each paired statistic with numbers on both sides, two bars that share the width in proportion. */
export function statsBars(home, away, stats, source = 'ESPN') {
  const rows = (stats || []).map((s) => ({ ...s, h: parseFloat(s.home), a: parseFloat(s.away) })).filter((s) => Number.isFinite(s.h) && Number.isFinite(s.a) && s.h + s.a > 0).slice(0, 8), h = 52 + rows.length * 34;
  const alt = 'Team stats, ' + home + ' against ' + away + ': ' + rows.map((s) => s.label + ' ' + s.home + ' to ' + s.away).join(', ') + '.';
  const body = rows.map((s, i) => { const y = 56 + i * 34, tot = s.h + s.a, wh = Math.max(2, s.h / tot * 250), wa = Math.max(2, s.a / tot * 250);
    return txt(300, y - 6, s.label, 12, '#a3a0b3', 'middle') + '<rect x="' + (298 - wh) + '" y="' + y + '" width="' + wh.toFixed(1) + '" height="12" fill="#a58bff" data-stat="' + esc(s.label) + '" data-side="home"/><rect x="302" y="' + y + '" width="' + wa.toFixed(1) + '" height="12" fill="#6d4aff" data-stat="' + esc(s.label) + '" data-side="away"/>' + txt(30, y + 11, s.home, 13, '#ecebf5') + txt(570, y + 11, s.away, 13, '#ecebf5', 'end'); }).join('');
  return wrap(h, alt, txt(30, 28, cut(home, 22), 14, '#ecebf5', 'start', 700) + txt(570, 28, cut(away, 22), 14, '#ecebf5', 'end', 700) + body + credit(h, source));
}
/** the win-chance curve: the home side's chance (0 to 100) at each reading of this visit, with the 50 per cent line. */
export function curve(points, home, away, source = 'Verse\'s own model on ESPN') {
  const p = (points || []).map(Number).filter((n) => Number.isFinite(n)), step = p.length > 1 ? 540 / (p.length - 1) : 0, y = (v) => 150 - v * 1.2;
  const alt = 'Win chance for ' + home + ' against ' + away + (p.length ? ': ' + home + ' ' + p[p.length - 1] + ' per cent now, from ' + p[0] + ' per cent at the first reading, across ' + p.length + ' readings' : ': no readings yet') + '. Verse\'s own estimate from score and clock.';
  return wrap(190, alt, '<line x1="30" y1="' + y(50) + '" x2="570" y2="' + y(50) + '" stroke="#6a667a" stroke-dasharray="4 4"/>' + txt(570, y(50) - 4, '50%', 11, '#a3a0b3', 'end') + (p.length ? '<polyline fill="none" stroke="#a58bff" stroke-width="3" points="' + p.map((v, i) => (30 + i * step).toFixed(1) + ',' + y(v).toFixed(1)).join(' ') + '"/>' : '') + txt(30, 24, home, 12, '#a3a0b3') + credit(190, source));
}
/** the lineups on a pitch where the feed gives a formation such as "4-3-3" (goalkeeper, then a row per number); sides share the pitch, home on the left. */
export function pitch(game, lineups, source = 'ESPN') {
  const sides = ['home', 'away'].map((s) => (lineups || []).find((l) => l.side === s && l.formation && l.starters && l.starters.length >= 8)).filter(Boolean); if (!sides.length) return null;
  const dots = sides.map((l) => { const rows = [[1], ...String(l.formation).split('-').map((n) => [+n])].map((r) => r[0]); let i = 0, out = ''; const left = l.side === 'home', n = rows.length;
    rows.forEach((cnt, ri) => { const cx = left ? 40 + ri * (240 / (n - 1)) : 560 - ri * (240 / (n - 1)); for (let k = 0; k < cnt; k++) { const p = l.starters[i++]; if (!p) break; const cy = 60 + (k + 0.5) * (200 / cnt); out += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="13" fill="' + (left ? '#a58bff' : '#6d4aff') + '" data-player="' + esc(p.name) + '"/>' + txt(cx.toFixed(1), (cy + 4).toFixed(1), p.n || '', 11, '#ffffff', 'middle', 700) + txt(cx.toFixed(1), (cy + 26).toFixed(1), cut(String(p.name).split(' ').pop(), 10), 9, '#ecebf5', 'middle'); } });
    return out; }).join('');
  const alt = 'Lineups for ' + game.home.name + ' against ' + game.away.name + ': ' + sides.map((l) => l.team + ' in a ' + l.formation + ': ' + l.starters.map((p) => p.name).join(', ')).join('. ') + '.';
  return wrap(320, alt, '<rect x="20" y="50" width="560" height="220" rx="6" fill="#1f6b3a" stroke="#ffffff" stroke-opacity=".6"/><line x1="300" y1="50" x2="300" y2="270" stroke="#ffffff" stroke-opacity=".6"/><circle cx="300" cy="160" r="26" fill="none" stroke="#ffffff" stroke-opacity=".6"/>' + dots + txt(30, 30, sides[0].team, 13, '#ecebf5', 'start', 700) + (sides[1] ? txt(570, 30, sides[1].team, 13, '#ecebf5', 'end', 700) : '') + credit(320, source));
}
/** a collage of a day's results: one tile per game, up to twelve, in two columns with the team colours beside each name. */
export function collage(games, leagueName, dayLabel, source = 'ESPN') {
  const gs = (games || []).filter((g) => g.state !== undefined && g.home).slice(0, 12), rows = Math.ceil(gs.length / 2), h = 60 + rows * 54 + 20;
  const alt = leagueName + ', ' + dayLabel + ': ' + (gs.length ? gs.map((g) => g.home.name + ' ' + (g.state === 'pre' ? 'v' : g.home.score + '-' + g.away.score) + ' ' + g.away.name).join('; ') : 'no games') + '.';
  const tiles = gs.map((g, i) => { const x = 20 + (i % 2) * 280, y = 56 + Math.floor(i / 2) * 54; return '<rect x="' + x + '" y="' + y + '" width="270" height="46" rx="8" fill="#1d1a28"/><rect x="' + x + '" y="' + y + '" width="6" height="46" rx="3" fill="' + colour(g.home.color, '#6d4aff') + '"/>'
    + txt(x + 16, y + 19, cut(g.home.name, 17), 13, '#ecebf5', 'start', g.home.winner ? 700 : 400) + txt(x + 16, y + 38, cut(g.away.name, 17), 13, '#ecebf5', 'start', g.away.winner ? 700 : 400)
    + (g.state === 'pre' ? txt(x + 258, y + 29, g.state === 'pre' ? 'v' : '', 15, '#a3a0b3', 'end') : txt(x + 258, y + 19, g.home.score, 14, '#ffffff', 'end', 700) + txt(x + 258, y + 38, g.away.score, 14, '#ffffff', 'end', 700)); }).join('');
  return wrap(h, alt, txt(20, 34, leagueName + ' · ' + dayLabel, 16, '#ecebf5', 'start', 700) + tiles + credit(h, source));
}
