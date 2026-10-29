/**
 * sport skill — a team from TheSportsDB, with Wikipedia as the second source.
 * TheSportsDB's public test key needs no account (the old key "3" was retired in 2026 and every ask was refused with a CORS error,
 * site-test issue #1048); when it has no team of the league asked for, the team's Wikipedia summary answers.
 * "nba team celtics", "soccer club barcelona", "what stadium do the yankees play in".
 */
export function sportOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:nba|nfl|mlb|nhl|football|soccer)\s+(?:team|club)\s+(.{2,40})$/i);
  if (m) return m[1];
  m = t.match(/^what\s+stadium\s+do(?:es)?\s+(?:the\s+)?(.{2,40}?)\s+play\s+in$/i);
  if (m) return m[1];
  return null;
}
// the league a "nfl team chiefs" ask names, read against TheSportsDB's strLeague / strSport, so "chiefs" in the NFL is not the rugby side
export const LEAGUES = { nba: /\bNBA\b|Basketball Association/i, nfl: /\bNFL\b|National Football League/i, mlb: /\bMLB\b|Major League Baseball/i, nhl: /\bNHL\b|National Hockey League/i, football: /^Soccer$/i, soccer: /^Soccer$/i };
export function leagueOf(text) { const m = String(text || '').trim().match(/^(nba|nfl|mlb|nhl|football|soccer)\s/i); return m ? m[1].toLowerCase() : ''; }
/** the team TheSportsDB found that plays in the league asked for (any, when none was named). Pure. */
export function pickTeam(teams, league) { const re = LEAGUES[league]; return (teams || []).find((t) => !re || re.test(t.strLeague || '') || re.test(t.strSport || '')) || null; }
async function wikiTeam(q, league) {
  const s = await fetch('https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=' + encodeURIComponent(q + ' ' + (league ? league.toUpperCase() : 'sports') + ' team')).then((r) => r.json());
  const title = s && s.query && s.query.search && s.query.search[0] && s.query.search[0].title; if (!title) return null;
  const p = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_'))).then((r) => r.json());
  return p && p.extract ? { title: p.title || title, extract: String(p.extract).slice(0, 420), url: (p.content_urls && p.content_urls.desktop && p.content_urls.desktop.page) || 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_')) } : null;
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = sportOf(text);
  if (!q) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Team</h2><div class="sub">…</div>'; });
  const league = leagueOf(text);
  try {
    let team = null;
    try {
      const res = await fetch('https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=' + encodeURIComponent(q), { mode: 'cors', headers: { 'Accept': 'application/json' } });
      if (res.ok) { const j = await res.json(); team = pickTeam(j && j.teams, league); }
    } catch (_) {}
    if (!api._pageStill(el)) return 'sport';
    if (team) {
      const bits = [team.strLeague, team.strSport, team.strStadium, team.strCountry].filter(Boolean);
      el.innerHTML = '<h2>' + esc(team.strTeam) + '</h2><p style="color:#8a8a8a">' + esc(bits.join(' · ')) + '</p>'
        + (team.intFormedYear ? '<p>Formed ' + esc(String(team.intFormedYear)) + '</p>' : '')
        + '<div class="src">Source: <a href="https://www.thesportsdb.com/team/' + encodeURIComponent(team.idTeam || '') + '" target="_blank" rel="noopener">TheSportsDB</a></div>';
      return 'sport';
    }
    const w = await wikiTeam(q, league); // the second source: the team's Wikipedia summary
    if (!api._pageStill(el)) return 'sport';
    if (!w) throw 0;
    el.innerHTML = '<h2>' + esc(w.title) + '</h2><p>' + esc(w.extract) + '</p>'
      + '<div class="src">Source: <a href="' + esc(/^https:\/\//.test(w.url) ? w.url : 'https://en.wikipedia.org/') + '" target="_blank" rel="noopener">Wikipedia</a> (TheSportsDB had no ' + esc(league ? league.toUpperCase() + ' ' : '') + 'team by that name)</div>';
    return 'sport';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Team</h2><p>Neither TheSportsDB nor Wikipedia found that team. Try its full name, like “nfl team kansas city chiefs”.</p>';
    return 'sport';
  }
}
export default {
  name: 'sport',
  examples: ['nba team celtics', 'soccer club barcelona', 'nfl team chiefs', 'what stadium do the yankees play in'],
  nearMisses: ['what is soccer', 'sports news', 'latest sports news', 'map of a stadium'],
  match(lower, text) { return !!sportOf(text); },
  run
};
