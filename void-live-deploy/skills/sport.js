/**
 * sport skill — a team from TheSportsDB public test key (no account)
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
async function run(text, api) {
  const { showPage, esc } = api;
  const q = sportOf(text);
  if (!q) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Team</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=' + encodeURIComponent(q)).then((r) => r.json());
    if (!api._pageStill(el)) return 'sport';
    const team = ((j && j.teams) || [])[0];
    if (!team) throw 0;
    const bits = [team.strLeague, team.strSport, team.strStadium, team.strCountry].filter(Boolean);
    el.innerHTML = '<h2>' + esc(team.strTeam) + '</h2><p style="color:#8a8a8a">' + esc(bits.join(' · ')) + '</p>'
      + (team.intFormedYear ? '<p>Formed ' + esc(String(team.intFormedYear)) + '</p>' : '')
      + '<div class="src">Source: <a href="https://www.thesportsdb.com/team/' + encodeURIComponent(team.idTeam || '') + '" target="_blank" rel="noopener">TheSportsDB</a></div>';
    return 'sport';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Team</h2><p>No team turned up for that name.</p>';
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
