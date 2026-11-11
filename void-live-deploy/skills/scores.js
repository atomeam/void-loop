/**
 * scores skill - today's games for a league, from the same feed as the /scores/ page (functions/api/scores.js: ESPN's public site API, OpenLigaDB, Jolpica).
 * "nba scores", "premier league results today", "bundesliga table". The card lists up to eight games (live first) with the score, and is framed with the
 * "Open the full Scores page" link (lib/card-frame.js PAGE_OF). A table ask shows the top eight rows. Nothing is invented: a feed that does not answer says so.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { scoresAsk, teamScoreAsk, teamGame, leagueOf, localDay, LEAGUE_IDS } from '../lib/scores.js';

const cap = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
// "what was the chiefs score last night": every league's board for that day (today, then yesterday when no day was named), and the first game the team is in
async function runTeam(t, api) {
  const { showPage, esc } = api, title = cap(t.team) + ' score';
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(title) + '</h2><div class="sub">\u2026</div>'; });
  const dayOf = (n) => localDay(new Date(Date.now() - n * 864e5)), days = t.day === 'yesterday' ? [1] : t.day === 'today' ? [0] : [0, 1];
  let answered = 0, src = '', hit = null, when = 0;
  // at most 2 days; each day's leagues are one Promise.all, and a hit today stops the loop
  for (const n of days) {
    const boards = await Promise.all(LEAGUE_IDS.filter((id) => id !== 'f1').map((league) => // void-review: ok
      fetch('/api/scores?' + new URLSearchParams({ league, date: dayOf(n) })).then((r) => r.json())
      .then((j) => { if (j && j.ok) { answered++; src = src || j.source || ''; return { league, games: j.games || [] }; } return null; }, () => null)));
    if (!api._pageStill(el)) return 'scores';
    hit = teamGame(boards.filter(Boolean), t.team); when = n;
    if (hit) break;
  }
  if (!hit) {
    el.innerHTML = '<h2>' + esc(title) + '</h2>' + (answered ? '<p>No ' + esc(cap(t.team)) + ' game ' + (days.length > 1 ? 'today or yesterday' : days[0] ? 'yesterday' : 'today') + ' in the leagues Verse follows (' + esc(LEAGUE_IDS.filter((id) => id !== 'f1').map((id) => leagueOf(id).name).join(', ')) + ').</p>'
      : '<p>The score feed didn\'t answer just now. Ask again in a moment, or open the Scores page.</p>');
    return answered ? 'scores' : 'none';
  }
  const g = hit.game, lg = leagueOf(hit.league);
  const line = g.state === 'pre' ? esc(g.home.name) + ' vs ' + esc(g.away.name) : esc(g.home.name) + ' ' + esc(g.home.score) + ' \u2013 ' + esc(g.away.score) + ' ' + esc(g.away.name);
  const st = g.state === 'live' ? 'Live, ' + esc(g.status) : g.state === 'final' ? esc(g.status || 'Final') : 'Starts ' + esc(new Date(g.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const win = g.state === 'final' ? [g.home, g.away].find((s) => s.winner) : null;
  el.innerHTML = '<h2>' + esc(title) + '</h2><div class="sub">' + esc(lg.name) + ', ' + (when ? 'yesterday' : 'today') + '</div><p style="font-size:1.2em">' + line + '</p><p>' + st + (win ? '. ' + esc(win.name) + ' won.' : '') + '</p>'
    + '<div class="src">Source: ' + esc(src || 'public score feeds') + ' \u00b7 data may be delayed</div>';
  return 'scores';
}

// one game on the board: live first, then upcoming (its kick-off in the visitor's time), then final
function gameRow(g, esc, withDay = false) {
  const t = g.kind === 'race' ? esc(g.name) : esc(g.home.name) + ' ' + esc(g.home.score) + ' \u2013 ' + esc(g.away.score) + ' ' + esc(g.away.name);
  const at = new Date(g.start), time = at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const st = g.state === 'live' ? 'LIVE ' + esc(g.status) : g.state === 'final' ? esc(g.status || 'FT') : (withDay ? at.toLocaleDateString([], { weekday: 'short' }) + ' ' : '') + time;
  return '<li style="margin:6px 0">' + (g.state === 'pre' ? esc(g.kind === 'race' ? g.name : g.home.name + ' vs ' + g.away.name) : t) + ' <span style="color:#8a8a8a">\u00b7 ' + st + '</span></li>';
}
const dayLabel = (iso) => new Date(iso).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
// a day with no games still answers (as a league's own scores page does): the latest results from the last seven days, else the next games in
// the coming seven, else the table as it stands (a league between seasons). Each is the same /api/scores feed; nothing is invented.
async function nearest(league, esc) {
  const get = (q) => fetch('/api/scores?' + new URLSearchParams(q)).then((r) => r.json()).catch(() => null);
  const dayOf = (n) => localDay(new Date(Date.now() + n * 864e5));
  const [past, next] = await Promise.all([get({ league, date: dayOf(-7), span: '7' }), get({ league, date: dayOf(1), span: '7' })]);
  const games = (j) => (j && j.ok && Array.isArray(j.games) ? j.games : []).filter((g) => g && g.start);
  const finals = games(past).filter((g) => g.state === 'final').sort((a, b) => String(b.start).localeCompare(String(a.start)));
  if (finals.length) {
    const day = localDay(new Date(finals[0].start)), last = finals.filter((g) => localDay(new Date(g.start)) === day).slice(0, 8);
    return '<h3>Latest results, ' + esc(dayLabel(finals[0].start)) + '</h3><ul>' + last.map((g) => gameRow(g, esc)).join('') + '</ul>';
  }
  const ahead = games(next).filter((g) => g.state === 'pre').sort((a, b) => String(a.start).localeCompare(String(b.start))).slice(0, 8);
  if (ahead.length) return '<h3>Next games, from ' + esc(dayLabel(ahead[0].start)) + '</h3><ul>' + ahead.map((g) => gameRow(g, esc, true)).join('') + '</ul>';
  const t = await get({ league, view: 'standings' }), g = t && t.ok && (t.groups || [])[0];
  if (!g || !Array.isArray(g.rows) || !g.rows.length) return '';
  // the points column (football's Pts, baseball's Pct), else the last one
  const cols = g.cols || [], fi = cols.findIndex((c) => /^(?:pts|p|pct)$/i.test(c)), ci = fi >= 0 ? fi : cols.length - 1;
  return '<h3>No games in the last week or the next; the table as it stands' + (g.name ? ' (' + esc(g.name) + ')' : '') + '</h3><ol>' + g.rows.slice(0, 8).map((r) => '<li>' + esc(r.name) + ' <span style="color:#8a8a8a">\u00b7 ' + esc(cols[ci] || '') + ' ' + esc((r.cells || [])[ci] || '') + '</span></li>').join('') + '</ol>';
}

async function run(text, api) {
  const team = !scoresAsk(text) && teamScoreAsk(text); if (team) return runTeam(team, api);
  const { showPage, esc } = api, ask = scoresAsk(text), lg = leagueOf(ask.league), title = lg.name + (ask.tab === 'standings' ? ' table' : ' scores');
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(title) + '</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('/api/scores?' + new URLSearchParams(ask.tab === 'standings' ? { league: ask.league, view: 'standings' } : { league: ask.league, date: localDay() })).then((r) => r.json());
    if (!api._pageStill(el)) return 'scores';
    if (!j || !j.ok) throw 0;
    let body;
    if (ask.tab === 'standings') { const g = (j.groups || [])[0]; if (!g) throw 0; body = '<ol>' + g.rows.slice(0, 8).map((r) => '<li>' + esc(r.name) + ' <span style="color:#8a8a8a">· ' + esc(g.cols.slice(-1)[0] + ' ' + (r.cells.slice(-1)[0] || '')) + '</span></li>').join('') + '</ol>'; }
    else {
      const rank = { live: 0, pre: 1, final: 2 }, list = (j.games || []).slice().sort((a, b) => rank[a.state] - rank[b.state]).slice(0, 8);
      body = list.length ? '<ul>' + list.map((g) => gameRow(g, esc)).join('') + '</ul>' : '<p>No games today.</p>' + await nearest(ask.league, esc);
      if (!api._pageStill(el)) return 'scores';
    }
    el.innerHTML = '<h2>' + esc(title) + '</h2><div class="sub">' + (ask.tab === 'standings' ? 'The table now' : 'Today, kick-offs in your time') + (j.stale ? ' (last saved copy)' : '') + '</div>' + body
      + '<div class="src">Source: ' + esc(j.source || 'public score feeds') + ' · data may be delayed</div>';
  } catch (_) {
    if (api._pageStill(el)) el.innerHTML = '<h2>' + esc(title) + '</h2><p>The score feed didn\'t answer just now. Ask again in a moment, or open the Scores page.</p>';
  }
  return 'scores';
}

export default {
  name: 'scores',
  examples: ['nba scores', 'premier league scores today', 'bundesliga results', 'premier league table', 'what was the chiefs score last night', 'did the yankees win'],
  nearMisses: ['nba team celtics', 'what is the score of 3 plus 4', 'what stadium do the yankees play in', 'live scores', 'what is my credit score', 'what is the score'],
  match(lower, text) { return !!(scoresAsk(text || lower) || teamScoreAsk(text || lower)); },
  run
};
