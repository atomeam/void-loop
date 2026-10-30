// The scores page's shared code (void-live-deploy/scores/, functions/api/scores.js, tools/scores.test.mjs): Versus' ESPN floor. Pure: the closed
// list of leagues, date checks, and the readers that turn three public feeds into one shape the page draws. Nothing here fetches.
//
// SOURCES (all free, no key, read by Verse's server only, never by a visitor's browser):
//   - ESPN's public site API (site.api.espn.com): scoreboard, standings, one game's summary, a team's schedule, for every league but F1. It is
//     UNOFFICIAL and undocumented (ESPN can change or close it without notice), so every reader below tolerates missing fields, and the last good
//     answer is kept on the edge and on the device when it fails.
//   - openligadb.de: the Bundesliga's community-run open database, the fallback for that league's games when ESPN does not answer.
//   - Jolpica (api.jolpi.ca/ergast): the open continuation of the Ergast F1 API, the only source for F1 (races, results, standings).
// Not built, on purpose: odds, fantasy, video, alerts, logos (a team is its name, its colour and its letters).

/** The leagues, closed: a request names one of these ids and nothing else reaches a feed. kind: espn | f1; grp picks the standings columns. */
export const LEAGUES = Object.freeze([
  { id: 'epl', name: 'Premier League', de: 'Premier League', kind: 'espn', path: 'soccer/eng.1', grp: 'soccer', ico: 'football' },
  { id: 'laliga', name: 'La Liga', de: 'La Liga', kind: 'espn', path: 'soccer/esp.1', grp: 'soccer', ico: 'football' },
  { id: 'bundesliga', name: 'Bundesliga', de: 'Bundesliga', kind: 'espn', path: 'soccer/ger.1', grp: 'soccer', ico: 'football', alt: 'openliga' },
  { id: 'seriea', name: 'Serie A', de: 'Serie A', kind: 'espn', path: 'soccer/ita.1', grp: 'soccer', ico: 'football' },
  { id: 'ligue1', name: 'Ligue 1', de: 'Ligue 1', kind: 'espn', path: 'soccer/fra.1', grp: 'soccer', ico: 'football' },
  { id: 'mls', name: 'MLS', de: 'MLS', kind: 'espn', path: 'soccer/usa.1', grp: 'soccer', ico: 'football' },
  { id: 'ucl', name: 'Champions League', de: 'Champions League', kind: 'espn', path: 'soccer/uefa.champions', grp: 'soccer', ico: 'football' },
  { id: 'nba', name: 'NBA', de: 'NBA', kind: 'espn', path: 'basketball/nba', grp: 'nba', ico: 'basketball' },
  { id: 'nfl', name: 'NFL', de: 'NFL', kind: 'espn', path: 'football/nfl', grp: 'nfl', ico: 'football' },
  { id: 'mlb', name: 'MLB', de: 'MLB', kind: 'espn', path: 'baseball/mlb', grp: 'mlb', ico: 'baseball' },
  { id: 'nhl', name: 'NHL', de: 'NHL', kind: 'espn', path: 'hockey/nhl', grp: 'nhl', ico: 'hockey' },
  { id: 'f1', name: 'Formula 1', de: 'Formel 1', kind: 'f1', path: '', grp: 'f1', ico: 'race' },
]);
export const LEAGUE_IDS = LEAGUES.map((l) => l.id);
export const leagueOf = (id) => LEAGUES.find((l) => l.id === id) || null;
export const VIEWS = Object.freeze(['scores', 'standings', 'game', 'team']);

const DAY = 86400000;
/** 'YYYY-MM-DD' for a Date (UTC parts) */
export const ymd = (d) => d.toISOString().slice(0, 10);
/** true for a real calendar day between 2000-01-01 and 400 days from `now` (a past final can be asked for; a far future cannot). Pure. */
export function dateOk(s, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const t = Date.parse(s + 'T00:00:00Z');
  return Number.isFinite(t) && ymd(new Date(t)) === s && t >= Date.UTC(2000, 0, 1) && t <= now + 400 * DAY;
}
/** the day `n` days from `s` ('YYYY-MM-DD'). Pure. */
export const shiftDay = (s, n) => ymd(new Date(Date.parse(s + 'T00:00:00Z') + n * DAY));
/** today as the visitor's own calendar day ('YYYY-MM-DD'), from a local Date. */
export const localDay = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// text from a feed is untrusted: control characters out, a length cap, and the page draws it with textContent only
const str = (v, n = 80) => (v == null ? '' : String(v)).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const hex = (v) => (/^[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toLowerCase() : '');
const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const scoreOf = (v) => { if (v && typeof v === 'object') v = v.displayValue != null ? v.displayValue : v.value; const s = v == null ? '' : String(v).trim(); return /^\d{1,3}(?:\.0+)?$/.test(s) ? String(parseInt(s, 10)) : ''; };
export const idOk = (s) => /^\d{1,12}$/.test(String(s));

/** one ESPN event (a scoreboard row, or a team schedule row) as { id, state: pre|live|final, status, start, home, away, venue, events, round }. Pure. */
export function readEvent(ev) {
  if (!ev || typeof ev !== 'object') return null;
  const comp = arr(ev.competitions)[0] || {}, cs = arr(comp.competitors);
  if (cs.length < 2) return null;
  const st = ev.status || comp.status || {}, ty = st.type || {};
  const state = ty.state === 'in' ? 'live' : ty.state === 'post' || ty.completed === true ? 'final' : 'pre';
  const side = (h) => {
    const c = cs.find((x) => x.homeAway === h) || cs[h === 'home' ? 0 : 1] || {}, t = c.team || {};
    const rec = (c.records || c.record || []); const r0 = Array.isArray(rec) ? rec[0] : null;
    return { id: str(t.id, 12), name: str(t.displayName || t.name || t.location), short: str(t.shortDisplayName || t.name || t.abbreviation, 30), abbr: str(t.abbreviation, 6), color: hex(t.color),
      score: scoreOf(c.score), winner: !!c.winner, record: str(r0 && (r0.summary || r0.displayValue), 14) };
  };
  const home = side('home'), away = side('away');
  if (!home.name || !away.name) return null;
  const detail = arr(comp.details).map((d) => {
    const ty2 = (d && d.type) || {}, who = arr(d && d.athletesInvolved)[0] || {};
    return { min: str(d && d.clock && d.clock.displayValue, 10), kind: d && d.redCard ? 'red' : d && d.yellowCard ? 'yellow' : d && d.scoringPlay ? (d.ownGoal ? 'owngoal' : d.penaltyKick ? 'pen' : 'goal') : 'other',
      text: str(ty2.text, 30), who: str(who.displayName || who.shortName, 40), team: str(d && d.team && d.team.id, 12) };
  }).filter((d) => d.kind !== 'other').slice(0, 30);
  return { id: str(ev.id, 12), state, status: state === 'pre' ? '' : str(ty.shortDetail || ty.detail || ty.description, 24), start: str(ev.date || comp.date, 24), home, away,
    venue: str(comp.venue && comp.venue.fullName, 60), events: detail, round: str(ev.week && ev.week.number ? 'W' + ev.week.number : '', 6) };
}
/** an ESPN scoreboard / schedule answer as [game]. Pure. */
export const readScoreboard = (j) => arr(j && j.events).map(readEvent).filter(Boolean).slice(0, 80);

// the columns a table shows, by sport: [header, ESPN stat name(s) tried in order]
const COLS = {
  soccer: [['P', 'gamesPlayed'], ['W', 'wins'], ['D', 'ties', 'draws'], ['L', 'losses'], ['GD', 'pointDifferential', 'goalDifference'], ['Pts', 'points']],
  nba: [['W', 'wins'], ['L', 'losses'], ['Pct', 'winPercent'], ['GB', 'gamesBehind'], ['Strk', 'streak']],
  mlb: [['W', 'wins'], ['L', 'losses'], ['Pct', 'winPercent'], ['GB', 'gamesBehind'], ['Strk', 'streak']],
  nfl: [['W', 'wins'], ['L', 'losses'], ['T', 'ties'], ['Pct', 'winPercent'], ['PF', 'pointsFor'], ['PA', 'pointsAgainst']],
  nhl: [['GP', 'gamesPlayed'], ['W', 'wins'], ['L', 'losses'], ['OTL', 'otLosses', 'overtimeLosses'], ['Pts', 'points'], ['Strk', 'streak']],
};
/** how many of a conference's teams make the playoffs by rank, said plainly: NBA 6 direct and 4 more in the play-in, NFL 7, NHL 8, MLB 6 per league. */
export const PLAYOFF = Object.freeze({ nba: { in: 6, playin: 4, inNote: { text: 'Playoffs (by rank)', color: '1f8f4e' }, playinNote: { text: 'Play-in (by rank)', color: 'e0a800' } }, nfl: { in: 7, inNote: { text: 'Playoffs (by rank; division winners and tiebreakers not modelled)', color: '1f8f4e' } },
  nhl: { in: 8, inNote: { text: 'Playoffs (by rank; divisions and tiebreakers not modelled)', color: '1f8f4e' } }, mlb: { in: 6, inNote: { text: 'Playoffs (by rank; division winners and tiebreakers not modelled)', color: '1f8f4e' } } });
export const colsOf = (grp) => (COLS[grp] || []).map((c) => c[0]);
/** an ESPN standings answer as { groups: [{ name, cols, rows: [{ rank, id, name, abbr, cells }] }] }. Pure. */
export function readStandings(j, grp) {
  const defs = COLS[grp] || [];
  const mk = (name, entries) => {
    const rows = arr(entries).map((e, i) => {
      const t = (e && e.team) || {}, stats = new Map(arr(e && e.stats).map((s) => [s.name, s]));
      const pick = (names) => { for (const n of names) { const s = stats.get(n); if (s && (s.displayValue != null || s.value != null)) return str(s.displayValue != null ? s.displayValue : s.value, 8); } return ''; };
      const rk = num((stats.get('rank') || stats.get('playoffSeed') || {}).value);
      const nt = (e && e.note) || null; // ESPN marks a cut-line row (Champions League, relegation, playoffs) with a note: its words and colour
      return { rank: rk != null ? rk : i + 1, id: str(t.id, 12), name: str(t.displayName || t.name), abbr: str(t.abbreviation, 6), cells: defs.map((d) => pick(d.slice(1))), note: nt && nt.description ? { text: str(nt.description, 40), color: hex(String(nt.color || '').replace('#', '')) } : null };
    }).filter((r) => r.name);
    rows.sort((a, b) => a.rank - b.rank);
    // US leagues: ESPN marks no cut-line, so the conference's playoff places are drawn from the rank by the plain rule (division winners and tiebreakers are NOT modelled)
    const cut = PLAYOFF[grp]; if (cut && /conference|league|east|west|afc|nfc/i.test(name || '') && !rows.some((r) => r.note)) rows.forEach((r) => { const n = r.rank <= cut.in ? cut.inNote : cut.playin && r.rank <= cut.in + cut.playin ? cut.playinNote : null; if (n) r.note = n; });
    const legend = [...new Map(rows.filter((r) => r.note).map((r) => [r.note.text, r.note])).values()];
    return { name: str(name, 40), cols: defs.map((d) => d[0]), rows: rows.slice(0, 40), legend };
  };
  const kids = arr(j && j.children), groups = kids.length ? kids.map((c) => mk(c.name, c.standings && c.standings.entries)) : [mk('', j && j.standings && j.standings.entries)];
  return { groups: groups.filter((g) => g.rows.length).slice(0, 8) };
}

/** one game's summary (ESPN /summary) as { game, events, stats, lineups, players }. Pure. */
export function readSummary(j) {
  const h = j && j.header, hc = h && arr(h.competitions)[0];
  const game = hc ? readEvent({ id: h.id, date: hc.date, status: hc.status, competitions: [hc] }) : null;
  const events = arr(j && j.keyEvents).map((k) => ({ min: str(k.clock && k.clock.displayValue, 10), kind: k.scoringPlay ? 'goal' : /red/i.test((k.type || {}).text || '') ? 'red' : /yellow/i.test((k.type || {}).text || '') ? 'yellow' : 'other',
    text: str(k.shortText || k.text || (k.type || {}).text, 120), team: str(k.team && k.team.displayName, 40) })).filter((k) => k.kind !== 'other' && k.min).slice(0, 40);
  const stats = arr(((j && j.boxscore) || {}).teams).map((t) => ({ team: str(t.team && (t.team.abbreviation || t.team.displayName), 12), side: t.homeAway || '',
    stats: arr(t.statistics).map((s) => ({ label: str(s.label || s.name, 30), value: str(s.displayValue, 12) })).filter((s) => s.label && s.value).slice(0, 14) }));
  const lineups = arr(j && j.rosters).map((r) => ({ team: str(r.team && r.team.displayName, 40), side: r.homeAway || '', formation: /^\d(?:-\d){1,4}$/.test(String(r.formation && (r.formation.name || r.formation) || '')) ? String(r.formation.name || r.formation) : '',
    starters: arr(r.roster).filter((p) => p.starter).sort((x, y) => (+x.formationPlace || 99) - (+y.formationPlace || 99)).map((p) => ({ n: str(p.jersey, 3), name: str(p.athlete && p.athlete.displayName, 40), pos: str(p.position && p.position.abbreviation, 4) })).slice(0, 14) })).filter((r) => r.starters.length);
  const players = arr(((j && j.boxscore) || {}).players).map((t) => ({ team: str(t.team && (t.team.abbreviation || t.team.displayName), 12),
    groups: arr(t.statistics).slice(0, 4).map((g) => ({ name: str(g.name || g.type, 20), labels: arr(g.labels).slice(0, 10).map((l) => str(l, 6)),
      rows: arr(g.athletes).slice(0, 14).map((a) => ({ name: str(a.athlete && (a.athlete.shortName || a.athlete.displayName), 30), stats: arr(a.stats).slice(0, 10).map((s) => str(s, 10)) })) })) }));
  const plays = arr(j && j.plays).slice(-80).reverse().map((p2) => ({ clock: str(p2.clock && p2.clock.displayValue, 10), period: str(p2.period && p2.period.number, 2), text: str(p2.text || p2.shortText, 140), home: scoreOf(p2.homeScore), away: scoreOf(p2.awayScore), scoring: !!p2.scoringPlay })).filter((p2) => p2.text).slice(0, 60)
    .concat(arr(j && j.commentary).slice(-60).reverse().map((c) => ({ clock: str(c.time && c.time.displayValue, 10), period: '', text: str(c.text, 160), home: '', away: '', scoring: false })).filter((c) => c.text)).slice(0, 60);
  // the same pairing's earlier games, and each side's last five (ESPN's summary carries these for most leagues; absent ones are simply not shown)
  const h2h = arr(j && (j.seasonseries || j.headToHeadGames)).flatMap((ss) => arr(ss.events || ss.games)).slice(0, 8).map((x) => ({ date: str(x.date || x.gameDate, 24), text: str(x.score || x.summary || ((x.homeTeamScore != null ? x.homeTeamScore + '-' + x.awayTeamScore : '')), 24), who: str(x.homeTeamName || (x.homeTeam && x.homeTeam.displayName) || '', 30) + ' ' + str(x.awayTeamName || (x.awayTeam && x.awayTeam.displayName) || '', 30) })).filter((x) => x.text);
  const last5 = arr(j && j.lastFiveGames).map((t) => ({ team: str(t.team && (t.team.abbreviation || t.team.displayName), 12), games: arr(t.events).slice(0, 5).map((x) => ({ r: str(x.gameResult, 1), opp: str(x.opponent && (x.opponent.abbreviation || x.opponent.displayName), 12), score: str(x.score, 12) })).filter((x) => /^[WDL]$/.test(x.r)) })).filter((t) => t.games.length);
  return { game, events, stats, lineups, players, plays, h2h, last5 };
}

/** the rows of a standings group whose numbers do not add up, as [{ name, why }] (soccer: played = won + drawn + lost and points = 3 x won + drawn;
 *  US leagues: Pct = W / (W + L) to three places where the table gives it). The page does not hide them: the test and this check say when a
 *  feed's table is wrong, so a wrong table is never passed on silently. Pure. */
export function rowIssues(group, grp) {
  const out = [], i = (c) => group.cols.indexOf(c), n = (row, c) => { const v = parseFloat(String(row.cells[i(c)]).replace('+', '')); return Number.isFinite(v) ? v : null; };
  for (const r of group.rows) {
    if (grp === 'soccer') { const p = n(r, 'P'), w = n(r, 'W'), d = n(r, 'D'), l = n(r, 'L'), pts = n(r, 'Pts'); if ([p, w, d, l].every((x) => x != null) && p !== w + d + l) out.push({ name: r.name, why: 'P is not W+D+L' }); if ([w, d, pts].every((x) => x != null) && pts !== 3 * w + d && !/deduct/i.test(r.name)) out.push({ name: r.name, why: 'Pts is not 3W+D (a points deduction, or a wrong table)' }); }
    else if (i('Pct') >= 0) { const w = n(r, 'W'), l = n(r, 'L'), pc = n(r, 'Pct'); if ([w, l, pc].every((x) => x != null) && w + l > 0 && Math.abs(w / (w + l) - pc) > 0.0015) out.push({ name: r.name, why: 'Pct is not W/(W+L)' }); }
  }
  return out;
}
const icsEsc = (t) => String(t).replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, ' ');
const icsT = (ms) => new Date(ms).toISOString().replace(/[-:]|\.\d{3}/g, '');
/** one upcoming game as an .ics calendar file (for /calendar/ and any calendar app): the start in UTC, two hours long (three for US football). Pure. */
export function icsOf(game, league) {
  const t = Date.parse(game && game.start); if (!Number.isFinite(t)) return '';
  const len = (league && league.id === 'nfl' ? 3 : 2) * 3600000, title = game.kind === 'race' ? game.name : game.home.name + ' vs ' + game.away.name;
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Verse//Scores//EN', 'BEGIN:VEVENT', 'UID:' + game.id + '@a-to-mind.com', 'DTSTAMP:' + icsT(Date.now()), 'DTSTART:' + icsT(t), 'DTEND:' + icsT(t + len),
    'SUMMARY:' + icsEsc(title), 'LOCATION:' + icsEsc(game.venue || ''), 'DESCRIPTION:' + icsEsc((league ? league.name + '. ' : '') + 'https://a-to-mind.com/scores/?league=' + (league ? league.id : '')), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
}

/** OpenLigaDB matches (getmatchdata/bl1/<season>) played on `day` ('YYYY-MM-DD', UTC) as games. Pure; `now` decides live. */
export function readOpenLiga(list, day, now = Date.now(), span = 1) {
  const last = shiftDay(day, span - 1);
  return (Array.isArray(list) ? list : []).filter((m) => m && String(m.matchDateTimeUTC || '').slice(0, 10) >= day && String(m.matchDateTimeUTC || '').slice(0, 10) <= last).map((m) => {
    const start = Date.parse(m.matchDateTimeUTC), fin = m.matchIsFinished === true;
    const goals = Array.isArray(m.goals) ? m.goals : [], last = goals[goals.length - 1];
    const res = arr(m.matchResults).find((r) => r.resultTypeID === 2) || null;
    const live = !fin && start <= now && now - start < 3 * 3600000;
    const sc = fin && res ? [String(res.pointsTeam1), String(res.pointsTeam2)] : live ? (last ? [String(last.scoreTeam1), String(last.scoreTeam2)] : ['0', '0']) : ['', ''];
    const team = (x, i) => ({ id: 'ol' + str(x && x.teamId, 8), name: str(x && x.teamName), short: str(x && (x.shortName || x.teamName), 30), abbr: '', color: '', score: sc[i],
      winner: fin && res ? (i ? res.pointsTeam2 > res.pointsTeam1 : res.pointsTeam1 > res.pointsTeam2) : false, record: '' });
    const home = team(m.team1, 0), away = team(m.team2, 1);
    return { id: 'ol' + str(m.matchID, 10), state: fin ? 'final' : live ? 'live' : 'pre', status: fin ? 'FT' : live ? 'LIVE' : '', start: new Date(start).toISOString(), home, away,
      venue: str(m.location && m.location.locationStadium, 60), round: str(m.group && m.group.groupOrderID ? 'MD' + m.group.groupOrderID : '', 6),
      events: goals.map((g) => ({ min: str(g.matchMinute, 4) + (g.matchMinute ? "'" : ''), kind: g.isOwnGoal ? 'owngoal' : g.isPenalty ? 'pen' : 'goal', text: str(g.scoreTeam1 + '-' + g.scoreTeam2, 10), who: str(g.goalGetterName, 40), team: '' })).slice(0, 30) };
  });
}
/** the Bundesliga season (the year it starts in) a day belongs to. Pure. */
export const seasonOf = (day) => { const y = +day.slice(0, 4), m = +day.slice(5, 7); return m >= 7 ? y : y - 1; };

/** Jolpica races in a season (races.json) that run on `day`, as F1 "games" (a race has no two sides: results hold the order). Pure. */
export function readF1Races(j, day, now = Date.now(), span = 1) {
  const last = shiftDay(day, span - 1);
  const races = (((j || {}).MRData || {}).RaceTable || {}).Races || [];
  return races.filter((r) => r && r.date >= day && r.date <= last).map((r) => {
    const start = Date.parse(r.date + 'T' + (r.time || '13:00:00Z')); const state = now < start ? 'pre' : now - start < 3 * 3600000 ? 'live' : 'final';
    const c = r.Circuit || {}, l = c.Location || {};
    return { id: 'f1-' + str(r.season, 4) + '-' + str(r.round, 3), kind: 'race', state, status: state === 'final' ? 'FIN' : state === 'live' ? 'LIVE' : '', start: new Date(start).toISOString(), name: str(r.raceName), round: str(r.round, 3), season: str(r.season, 4),
      venue: str([c.circuitName, l.locality, l.country].filter(Boolean).join(', '), 80), results: [] };
  });
}
/** Jolpica results.json as the finishing order [{ pos, driver, team, time, grid, points }]. Pure. */
export function readF1Results(j) {
  const r = ((((j || {}).MRData || {}).RaceTable || {}).Races || [])[0];
  return ((r && r.Results) || []).map((x) => ({ pos: str(x.positionText || x.position, 3), driver: str(((x.Driver || {}).givenName || '') + ' ' + ((x.Driver || {}).familyName || '')), code: str((x.Driver || {}).code, 4),
    team: str((x.Constructor || {}).name, 30), time: str((x.Time || {}).time || x.status, 20), grid: str(x.grid, 3), points: str(x.points, 4) })).slice(0, 22);
}
/** Jolpica driver + constructor standings as { groups } in the same shape as readStandings. Pure. */
export function readF1Standings(drivers, cons) {
  const dl = ((((drivers || {}).MRData || {}).StandingsTable || {}).StandingsLists || [])[0], cl = ((((cons || {}).MRData || {}).StandingsTable || {}).StandingsLists || [])[0];
  const d = { name: 'Drivers', cols: ['Wins', 'Pts'], rows: ((dl && dl.DriverStandings) || []).map((s) => ({ rank: num(s.position) || 0, id: '', name: str(((s.Driver || {}).givenName || '') + ' ' + ((s.Driver || {}).familyName || '')), abbr: str((s.Driver || {}).code, 4), cells: [str(s.wins, 3), str(s.points, 6)] })).slice(0, 30) };
  const c = { name: 'Constructors', cols: ['Wins', 'Pts'], rows: ((cl && cl.ConstructorStandings) || []).map((s) => ({ rank: num(s.position) || 0, id: '', name: str((s.Constructor || {}).name), abbr: '', cells: [str(s.wins, 3), str(s.points, 6)] })).slice(0, 14) };
  return { groups: [d, c].filter((g) => g.rows.length) };
}

/** each team's last five results from a run of scoreboard games, newest first: { teamId: [{ r: W|D|L, opp, score }] }. Pure. */
export function formOf(games) {
  const fin = (games || []).filter((g) => g.state === 'final' && g.home.score !== '' && g.away.score !== '').sort((a, b) => String(b.start).localeCompare(String(a.start))), out = {};
  for (const g of fin) for (const [me, you] of [[g.home, g.away], [g.away, g.home]]) {
    if (!me.id) continue; const a = out[me.id] = out[me.id] || []; if (a.length >= 5) continue;
    const m = +me.score, y = +you.score; a.push({ r: m > y ? 'W' : m < y ? 'L' : 'D', opp: you.abbr || you.short || you.name, score: me.score + '-' + you.score });
  }
  return out;
}
/** the first day of the week a day is in (Tuesday for the NFL, whose week runs Thursday to Monday; Monday for the rest). Pure. */
export function weekStart(day, leagueId) {
  const dow = new Date(day + 'T00:00:00Z').getUTCDay(), first = leagueId === 'nfl' ? 2 : 1;
  return shiftDay(day, -((dow - first + 7) % 7));
}

/** how long (seconds) an answer may be kept: a live day is short, a settled final is long, standings are an hour. Pure. */
export function ttlFor(view, data, day, now = Date.now()) {
  if (view === 'standings') return 3600;
  if (view === 'team') return 600;
  if (view === 'form') return 1800;
  const games = view === 'game' ? (data && data.game ? [data.game] : []) : (data && data.games) || [];
  if (games.some((g) => g.state === 'live')) return 20;
  if (view === 'game') return games.length && games.every((g) => g.state === 'final') ? 6 * 3600 : 60;
  const age = Date.parse(day + 'T00:00:00Z') - now;
  if (age < -2 * DAY) return games.every((g) => g.state === 'final') ? 6 * 3600 : 900;
  return age > 2 * DAY ? 1800 : 60; // today and the days beside it can still change (time zones); a far future schedule moves slowly
}

// ---- tiers 2 and 3: what can be worked out from the feeds above, on the device, labelled as Verse's own ----

/** NFL fantasy points of one box-score row, from the passing, rushing and receiving tables ESPN gives (labels YDS, TD, INT, REC): passing 1 per 25 yards,
 *  4 per touchdown, -2 per interception; rushing and receiving 1 per 10 yards, 6 per touchdown; receptions 1 (PPR), 0.5 (half) or 0 (standard). Fumbles,
 *  two-point plays, kickers and defences are NOT in these tables, so it is an estimate and the page says so. mode: 'ppr' | 'half' | 'std'. Pure. */
export function fantasyPoints(groupName, labels, stats, mode = 'ppr') {
  const at = (l) => { const i = (labels || []).indexOf(l); const v = i >= 0 ? parseFloat(String((stats || [])[i]).replace(/[^0-9.-]/g, '')) : NaN; return Number.isFinite(v) ? v : 0; }, g = String(groupName || '').toLowerCase();
  if (g.startsWith('pass')) return Math.round((at('YDS') / 25 + at('TD') * 4 - at('INT') * 2) * 10) / 10;
  if (g.startsWith('rush')) return Math.round((at('YDS') / 10 + at('TD') * 6) * 10) / 10;
  if (g.startsWith('rec')) return Math.round((at('YDS') / 10 + at('TD') * 6 + at('REC') * (mode === 'ppr' ? 1 : mode === 'half' ? 0.5 : 0)) * 10) / 10;
  return null;
}
/** the game's progress as a share of regulation time, from the status text ("67'", "45'+2'", "4:12 - 3rd", "Q3 4:12", "P2 10:00"), or null when it cannot be read. Pure. */
export function progressOf(status, leagueGrp) {
  const t = String(status || '');
  if (leagueGrp === 'soccer') { const m = /^(\d{1,3})'(?:\+(\d+))?/.exec(t.trim()); return m ? Math.min(1, (+m[1]) / 90) : /^(?:HT|Half)/i.test(t) ? 0.5 : null; }
  const len = { nba: 12, nfl: 15, nhl: 20 }[leagueGrp], n = { nba: 4, nfl: 4, nhl: 3 }[leagueGrp]; if (!len) return null;
  const m = /(\d{1,2}):(\d{2})\s*-\s*(\d)(?:st|nd|rd|th)/i.exec(t) || /(?:Q|P)(\d)\s+(\d{1,2}):(\d{2})/i.exec(t); if (!m) return null;
  const per = m.length === 4 && /^\d{1,2}$/.test(m[1]) && /^\d$/.test(m[3]) && /-/.test(t) ? +m[3] : +m[1], min = m.length === 4 && /-/.test(t) ? +m[1] : +m[2], sec = m.length === 4 && /-/.test(t) ? +m[2] : +m[3];
  if (per > n) return 1; const left = min * 60 + sec, total = len * 60;
  return Math.min(1, Math.max(0, (per - 1) / n + (total - left) / total / n));
}
const poisson = (k, l) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; };
/** the chance of each result from the score and the clock, Verse's own model (not a bookmaker's, not ESPN's): football with Poisson goals for the time left
 *  (1.4 goals a side a game), the others a normal spread of the remaining points (NBA 13 points, NFL 13.5, NHL 2.3 goals over a whole game). { home, draw, away } as
 *  numbers 0 to 1, or null when the clock cannot be read. Pure. */
export function winProb(game, leagueGrp) {
  if (!game || game.state !== 'live') return null; const f = progressOf(game.status, leagueGrp); if (f == null) return null;
  const d = (+game.home.score || 0) - (+game.away.score || 0), left = 1 - f;
  if (leagueGrp === 'soccer') { const l = 1.4 * left; let h = 0, dr = 0, a = 0; for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) { const p = poisson(i, l) * poisson(j, l), t = d + i - j; if (t > 0) h += p; else if (t === 0) dr += p; else a += p; } const z = h + dr + a; return { home: h / z, draw: dr / z, away: a / z }; }
  const sd = { nba: 13, nfl: 13.5, nhl: 2.3, mlb: 3.2 }[leagueGrp]; if (!sd) return null; const sdLeft = sd * Math.sqrt(Math.max(left, 0.0001));
  const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
  const h = 0.5 * (1 + erf((d) / (sdLeft * Math.SQRT2))); return { home: h, draw: 0, away: 1 - h };
}
/** an Elo-style rating per team from a run of finished games (1500 to start, K 20, a home edge of 60 points, a margin factor), { teamId: { name, elo, n } }, newest
 *  games last. Verse's own number from the window it was given, never to be mistaken for anyone else's rating. Pure. */
export function eloOf(games) {
  const r = {}, get = (t) => (r[t.id] = r[t.id] || { name: t.name, elo: 1500, n: 0 });
  for (const g of (games || []).filter((x) => x.state === 'final' && x.home.id && x.away.id && x.home.score !== '' && x.away.score !== '').sort((a, b) => String(a.start).localeCompare(String(b.start)))) {
    const h = get(g.home), a = get(g.away), exp = 1 / (1 + Math.pow(10, -((h.elo + 60) - a.elo) / 400)), hs = +g.home.score, as = +g.away.score, res = hs > as ? 1 : hs < as ? 0 : 0.5;
    const k = 20 * (1 + Math.log(1 + Math.abs(hs - as)) / 2); h.elo += k * (res - exp); a.elo -= k * (res - exp); h.n++; a.n++;
  }
  for (const t of Object.values(r)) t.elo = Math.round(t.elo);
  return r;
}
/** a table with some upcoming games decided by the viewer: picks is { gameId: 'h' | 'd' | 'a' }; each pick adds a win, draw or loss (and soccer points) to the rows, which are
 *  ranked again by points then the goal difference they had (goals in a what-if are not guessed). Returns a new group of the same shape plus the places moved. Pure. */
export function simulate(group, games, picks, grp) {
  const i = (c) => group.cols.indexOf(c), rows = group.rows.map((r) => ({ ...r, cells: r.cells.slice(), was: r.rank })), by = new Map(rows.map((r) => [r.id, r]));
  const add = (r, col, n) => { if (r && i(col) >= 0) r.cells[i(col)] = String((parseFloat(r.cells[i(col)]) || 0) + n); };
  for (const g of games || []) {
    const p = picks[g.id], H = by.get(g.home.id), A = by.get(g.away.id); if (!p || !H || !A || g.state === 'final') continue;
    for (const r of [H, A]) add(r, i('P') >= 0 ? 'P' : 'GP', 1);
    if (grp === 'soccer') { if (p === 'h') { add(H, 'W', 1); add(A, 'L', 1); add(H, 'Pts', 3); } else if (p === 'a') { add(A, 'W', 1); add(H, 'L', 1); add(A, 'Pts', 3); } else { add(H, 'D', 1); add(A, 'D', 1); add(H, 'Pts', 1); add(A, 'Pts', 1); } }
    else { const w = p === 'a' ? A : H, l = p === 'a' ? H : A; add(w, 'W', 1); add(l, 'L', 1); }
  }
  for (const r of rows) if (grp !== 'soccer' && i('Pct') >= 0) { const w = parseFloat(r.cells[i('W')]) || 0, l = parseFloat(r.cells[i('L')]) || 0; r.cells[i('Pct')] = w + l ? (w / (w + l)).toFixed(3).replace(/^0/, '') : ''; }
  const key = (r) => (grp === 'soccer' ? [parseFloat(r.cells[i('Pts')]) || 0, parseFloat(String(r.cells[i('GD')]).replace('+', '')) || 0] : [parseFloat(r.cells[i('Pct')]) || 0, parseFloat(r.cells[i('W')]) || 0]);
  rows.sort((a, b) => { const x = key(a), y = key(b); return y[0] - x[0] || y[1] - x[1] || a.was - b.was; }); rows.forEach((r, n) => { r.rank = n + 1; r.moved = r.was - r.rank; });
  return { ...group, rows };
}
/** a pick'em card scored against the finished games: { right, played, points, total }: straight picks count one each, confidence picks count their rank (higher is surer). Pure. */
export function scorePicks(games, picks, conf = {}) {
  let right = 0, played = 0, points = 0, total = 0;
  for (const g of games || []) { const p = picks[g.id]; if (!p) continue; const c = +conf[g.id] || 1; if (g.state !== 'final') continue; played++; const res = +g.home.score > +g.away.score ? 'h' : +g.home.score < +g.away.score ? 'a' : 'd'; total += c; if (res === p) { right++; points += c; } }
  return { right, played, points, total };
}
/** a survivor entry: the weeks' picks, { weekStart: teamId }, against the week's finished games: 'alive' | 'out' | 'open' (a game not final yet), and the teams already used. Pure. */
export function survivorState(picks, weeks) {
  const used = new Set(); let status = 'alive';
  for (const [wk, team] of Object.entries(picks || {}).sort()) {
    if (used.has(team)) return { status: 'out', why: 'a team used twice', used: [...used] }; used.add(team);
    const g = ((weeks || {})[wk] || []).find((x) => x.home.id === team || x.away.id === team);
    if (!g || g.state !== 'final') { if (status === 'alive') status = 'open'; continue; }
    const mine = g.home.id === team ? g.home : g.away, other = g.home.id === team ? g.away : g.home; if (!(+mine.score > +other.score)) return { status: 'out', why: 'lost or drew in week of ' + wk, used: [...used] };
  }
  return { status, used: [...used] };
}

const ALIAS = { 'premier league': 'epl', epl: 'epl', 'english premier league': 'epl', 'la liga': 'laliga', laliga: 'laliga', bundesliga: 'bundesliga', 'serie a': 'seriea', 'ligue 1': 'ligue1', mls: 'mls', 'champions league': 'ucl', ucl: 'ucl', nba: 'nba', nfl: 'nfl', mlb: 'mlb', nhl: 'nhl', f1: 'f1', 'formula 1': 'f1', 'formula one': 'f1' };
/** a plain ask for scores or a table, "nba scores", "premier league results today", "bundesliga table": { league, tab } or null (no league named means null: "scores" alone goes to the page). Pure. */
export function scoresAsk(text) {
  const m = /^(?:live |today'?s? )?(premier league|english premier league|epl|la ?liga|bundesliga|serie a|ligue 1|mls|champions league|ucl|nba|nfl|mlb|nhl|f1|formula 1|formula one) (?:live )?(scores?|results?|fixtures|games|matches|standings?|table|schedule)(?: (?:today|now|tonight))?$/i.exec(String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' '));
  if (!m) return null; const k = m[1].toLowerCase().replace(/^la ?liga$/, 'la liga'); return { league: ALIAS[k], tab: /stand|table/i.test(m[2]) ? 'standings' : 'scores' };
}

// "lakers score last night", "how did the arsenal do yesterday", "did the yankees win": one team's game (2026-10-30: these fell to an article).
const NOT_TEAM = /^(?:my|your|our|their|his|her|the|a|an|what|whats|credit|fico|test|sat|act|gre|gmat|lsat|mcat|quiz|exam|final|game|high|top|best|live|bowling|golf|wordle|chess|match|team|sports?|tennis|cricket|football|soccer|basketball|baseball|hockey|rugby|darts|boxing|ufc|mma|nascar|college|ncaa|world|cup|olympic|olympics)$/i;
/** an ask for one team's game -> { team, day: 'yesterday' | 'today' | '' } | null; never a league ("nba scores" is scoresAsk's) and never a credit or test score. Pure. */
export function teamScoreAsk(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  const pats = [
    /^(?:what was|what'?s|what is) the ([a-z][a-z .'&-]{1,30}?) (?:game )?(?:score|result)(?: (last night|yesterday|today|tonight))?$/,
    /^how did the ([a-z][a-z .'&-]{1,30}?) do(?: (last night|yesterday|today|tonight))?$/,
    /^did the ([a-z][a-z .'&-]{1,30}?) win(?: (last night|yesterday|today|tonight))?$/,
    /^(?:the )?([a-z][a-z .'&-]{1,30}?) (?:game )?(?:score|scores|result|final score)(?: (last night|yesterday|today|tonight))?$/,
  ];
  let team = '', day = '';
  for (const p of pats) {
    const m = p.exec(t);
    if (!m) continue;
    const c = m[1].trim(), words = c.split(' ');
    if (words.length > 3 || words.some((w) => NOT_TEAM.test(w)) || ALIAS[c] || /^(?:la ?liga|formula (?:1|one))$/.test(c)) continue;
    team = c; day = m[2] || ''; break;
  }
  if (!team) return null;
  return { team, day: /last night|yesterday/.test(day) ? 'yesterday' : day ? 'today' : '' };
}
/** the game a team played on a set of scoreboards ([{ league, games }]): the first whose home or away name, short name or abbreviation holds the team as whole words. Pure. */
export function teamGame(boards, team) {
  const want = String(team || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim(); if (!want) return null;
  const has = (side) => side && [side.name, side.short, side.abbr].some((n) => (' ' + String(n || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ') + ' ').includes(' ' + want + ' '));
  for (const b of Array.isArray(boards) ? boards : []) for (const g of Array.isArray(b && b.games) ? b.games : []) if (g && g.kind !== 'race' && (has(g.home) || has(g.away))) return { league: b.league, game: g };
  return null;
}

/** a snake draft's order: teams 0..n-1 each round, the direction flipping every round; [{ pick, round, team }]. Pure. */
export function draftOrder(teams, rounds) {
  const out = []; for (let r = 0; r < rounds; r++) for (let i = 0; i < teams; i++) out.push({ pick: out.length + 1, round: r + 1, team: r % 2 ? teams - 1 - i : i }); return out;
}
/** a bot's choice from the players left (best first, as the pasted or built-in list ranks them): usually the best, sometimes a few places down (`rng` 0 to 1, `reach` places at most). Pure. */
export function botPick(left, rng, reach = 3) { if (!left.length) return -1; const u = rng * rng; return Math.min(left.length - 1, Math.floor(u * (reach + 1))); }
/** the players typed or pasted, one a line ("1. Name", "Name, POS", "Name"): ranked as given, blanks and repeats dropped, at most 300. Pure. */
export function playersOf(text) {
  const seen = new Set(); return String(text || '').split(/\r?\n/).map((l) => str(l.replace(/^\s*\d+[.)\s-]+/, ''), 50)).filter((n) => n && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase())).slice(0, 300);
}

// ---- the page's words (English; German for a German browser) ----
const EN = { scores: 'Scores', standings: 'Standings', mine: 'My teams', today: 'Today', yesterday: 'Yesterday', tomorrow: 'Tomorrow', live: 'LIVE', ft: 'FT', details: 'Details', back: 'Back', share: 'Share link', copied: 'Link copied',
  follow: 'Follow', unfollow: 'Unfollow', followLeague: 'Follow league', unfollowLeague: 'Following league', none: 'No games on this day.', loading: 'Loading', failed: 'The score feed did not answer just now.', saved: 'Showing the last saved result from',
  stale: 'The feed is not answering, so this is the last good copy from', delayed: 'Data may be delayed by a minute or more.', noMine: 'Follow a team with its star, or a league above, and its games show here.', noMineDay: 'None of your teams play on this day.',
  last: 'Last games', next: 'Next games', events: 'Goals and cards', teamStats: 'Team stats', lineups: 'Starting line-ups', box: 'Box score', kick: 'Kick-off', venue: 'Venue', team: 'Team', offline: 'You are offline. ', refreshing: 'Updates every 30 seconds while a game is live.', race: 'Race', results: 'Result', driver: 'Driver', raceDay: 'Race day', story: 'Story', reportsTab: 'Verse reports', sportsTab: 'Sports', draft: 'Mock draft', pickem: "Pick'em", whatif: 'What if', fpts: 'Fantasy points (estimate: no fumbles, kickers or defences)', winp: 'Win chance (Verse\'s own estimate from score and clock)', rating: 'Verse rating', cal: 'Add to calendar', search: 'Search teams', updated: 'Updated', showing: 'Showing the saved copy from', noNext: 'No next games listed', week: 'Week', dayView: 'Day', prevWeek: 'Previous week', nextWeek: 'Next week', thisWeek: 'This week', form: 'Form', plays: 'Play by play', h2h: 'Earlier meetings', last5: 'Last five', cut: 'Table key', badTable: 'Some numbers in this table do not add up:' };
const DE = { scores: 'Ergebnisse', standings: 'Tabelle', mine: 'Meine Teams', today: 'Heute', yesterday: 'Gestern', tomorrow: 'Morgen', live: 'LIVE', ft: 'Ende', details: 'Details', back: 'Zurück', share: 'Link teilen', copied: 'Link kopiert',
  follow: 'Folgen', unfollow: 'Entfolgen', followLeague: 'Liga folgen', unfollowLeague: 'Liga gefolgt', none: 'Keine Spiele an diesem Tag.', loading: 'Lädt', failed: 'Die Ergebnisquelle hat gerade nicht geantwortet.', saved: 'Zuletzt gespeichertes Ergebnis von',
  stale: 'Die Quelle antwortet nicht, das ist die letzte gute Kopie von', delayed: 'Die Daten können eine Minute oder länger verzögert sein.', noMine: 'Folge einem Team mit dem Stern oder oben einer Liga, dann erscheinen ihre Spiele hier.', noMineDay: 'Keines deiner Teams spielt an diesem Tag.',
  last: 'Letzte Spiele', next: 'Nächste Spiele', events: 'Tore und Karten', teamStats: 'Teamstatistik', lineups: 'Startaufstellung', box: 'Boxscore', kick: 'Anstoß', venue: 'Stadion', team: 'Team', offline: 'Du bist offline. ', refreshing: 'Aktualisiert alle 30 Sekunden, solange ein Spiel läuft.', race: 'Rennen', results: 'Ergebnis', driver: 'Fahrer', raceDay: 'Renntag', story: 'Bericht', reportsTab: 'Verse-Berichte', sportsTab: 'Sportarten', draft: 'Mock-Draft', pickem: 'Tippspiel', whatif: 'Was wäre wenn', fpts: 'Fantasy-Punkte (Schätzung: ohne Fumbles, Kicker und Defense)', winp: 'Siegchance (Verses eigene Schätzung aus Stand und Uhr)', rating: 'Verse-Rating', cal: 'In den Kalender', search: 'Teams suchen', updated: 'Aktualisiert', showing: 'Gespeicherte Kopie von', noNext: 'Keine nächsten Spiele gelistet', week: 'Woche', dayView: 'Tag', prevWeek: 'Vorige Woche', nextWeek: 'Nächste Woche', thisWeek: 'Diese Woche', form: 'Form', plays: 'Spielverlauf', h2h: 'Frühere Spiele', last5: 'Letzte fünf', cut: 'Legende', badTable: 'Manche Zahlen in dieser Tabelle gehen nicht auf:' };
export const wordsFor = (lang) => (/^de\b/i.test(lang || '') ? DE : EN);
