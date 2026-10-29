/**
 * scores skill - today's games for a league, from the same feed as the /scores/ page (functions/api/scores.js: ESPN's public site API, OpenLigaDB, Jolpica).
 * "nba scores", "premier league results today", "bundesliga table". The card lists up to eight games (live first) with the score, and is framed with the
 * "Open the full Scores page" link (lib/card-frame.js PAGE_OF). A table ask shows the top eight rows. Nothing is invented: a feed that does not answer says so.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { scoresAsk, leagueOf, localDay } from '../lib/scores.js';

async function run(text, api) {
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
      body = list.length ? '<ul>' + list.map((g) => { const t = g.kind === 'race' ? esc(g.name) : esc(g.home.name) + ' ' + esc(g.home.score) + ' – ' + esc(g.away.score) + ' ' + esc(g.away.name);
        const st = g.state === 'live' ? 'LIVE ' + esc(g.status) : g.state === 'final' ? esc(g.status || 'FT') : new Date(g.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return '<li style="margin:6px 0">' + (g.state === 'pre' ? esc(g.kind === 'race' ? g.name : g.home.name + ' vs ' + g.away.name) : t) + ' <span style="color:#8a8a8a">· ' + st + '</span></li>'; }).join('') + '</ul>' : '<p>No games today.</p>';
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
  examples: ['nba scores', 'premier league scores today', 'bundesliga results', 'premier league table'],
  nearMisses: ['nba team celtics', 'what is the score of 3 plus 4', 'what stadium do the yankees play in', 'live scores'],
  match(lower, text) { return !!scoresAsk(text || lower); },
  run
};
