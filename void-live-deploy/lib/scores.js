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
export const colsOf = (grp) => (COLS[grp] || []).map((c) => c[0]);
/** an ESPN standings answer as { groups: [{ name, cols, rows: [{ rank, id, name, abbr, cells }] }] }. Pure. */
export function readStandings(j, grp) {
  const defs = COLS[grp] || [];
  const mk = (name, entries) => {
    const rows = arr(entries).map((e, i) => {
      const t = (e && e.team) || {}, stats = new Map(arr(e && e.stats).map((s) => [s.name, s]));
      const pick = (names) => { for (const n of names) { const s = stats.get(n); if (s && (s.displayValue != null || s.value != null)) return str(s.displayValue != null ? s.displayValue : s.value, 8); } return ''; };
      const rk = num((stats.get('rank') || stats.get('playoffSeed') || {}).value);
      return { rank: rk != null ? rk : i + 1, id: str(t.id, 12), name: str(t.displayName || t.name), abbr: str(t.abbreviation, 6), cells: defs.map((d) => pick(d.slice(1))) };
    }).filter((r) => r.name);
    rows.sort((a, b) => a.rank - b.rank);
    return { name: str(name, 40), cols: defs.map((d) => d[0]), rows: rows.slice(0, 40) };
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
  const lineups = arr(j && j.rosters).map((r) => ({ team: str(r.team && r.team.displayName, 40), side: r.homeAway || '',
    starters: arr(r.roster).filter((p) => p.starter).map((p) => ({ n: str(p.jersey, 3), name: str(p.athlete && p.athlete.displayName, 40), pos: str(p.position && p.position.abbreviation, 4) })).slice(0, 14) })).filter((r) => r.starters.length);
  const players = arr(((j && j.boxscore) || {}).players).map((t) => ({ team: str(t.team && (t.team.abbreviation || t.team.displayName), 12),
    groups: arr(t.statistics).slice(0, 4).map((g) => ({ name: str(g.name || g.type, 20), labels: arr(g.labels).slice(0, 10).map((l) => str(l, 6)),
      rows: arr(g.athletes).slice(0, 14).map((a) => ({ name: str(a.athlete && (a.athlete.shortName || a.athlete.displayName), 30), stats: arr(a.stats).slice(0, 10).map((s) => str(s, 10)) })) })) }));
  return { game, events, stats, lineups, players };
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
export function readOpenLiga(list, day, now = Date.now()) {
  return (Array.isArray(list) ? list : []).filter((m) => m && String(m.matchDateTimeUTC || '').slice(0, 10) === day).map((m) => {
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
export function readF1Races(j, day, now = Date.now()) {
  const races = (((j || {}).MRData || {}).RaceTable || {}).Races || [];
  return races.filter((r) => r && r.date === day).map((r) => {
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

/** how long (seconds) an answer may be kept: a live day is short, a settled final is long, standings are an hour. Pure. */
export function ttlFor(view, data, day, now = Date.now()) {
  if (view === 'standings') return 3600;
  if (view === 'team') return 600;
  const games = view === 'game' ? (data && data.game ? [data.game] : []) : (data && data.games) || [];
  if (games.some((g) => g.state === 'live')) return 20;
  if (view === 'game') return games.length && games.every((g) => g.state === 'final') ? 6 * 3600 : 60;
  const age = Date.parse(day + 'T00:00:00Z') - now;
  if (age < -2 * DAY) return games.every((g) => g.state === 'final') ? 6 * 3600 : 900;
  return age > 2 * DAY ? 1800 : 60; // today and the days beside it can still change (time zones); a far future schedule moves slowly
}

// ---- the page's words (English; German for a German browser) ----
const EN = { scores: 'Scores', standings: 'Standings', mine: 'My teams', today: 'Today', yesterday: 'Yesterday', tomorrow: 'Tomorrow', live: 'LIVE', ft: 'FT', details: 'Details', back: 'Back', share: 'Share link', copied: 'Link copied',
  follow: 'Follow', unfollow: 'Unfollow', followLeague: 'Follow league', unfollowLeague: 'Following league', none: 'No games on this day.', loading: 'Loading', failed: 'The score feed did not answer just now.', saved: 'Showing the last saved result from',
  stale: 'The feed is not answering, so this is the last good copy from', delayed: 'Data may be delayed by a minute or more.', noMine: 'Follow a team with its star, or a league above, and its games show here.', noMineDay: 'None of your teams play on this day.',
  last: 'Last games', next: 'Next games', events: 'Goals and cards', teamStats: 'Team stats', lineups: 'Starting line-ups', box: 'Box score', kick: 'Kick-off', venue: 'Venue', team: 'Team', offline: 'You are offline. ', refreshing: 'Updates every 30 seconds while a game is live.', race: 'Race', results: 'Result', driver: 'Driver', raceDay: 'Race day', cal: 'Add to calendar', search: 'Search teams', updated: 'Updated', showing: 'Showing the saved copy from', badTable: 'Some numbers in this table do not add up:' };
const DE = { scores: 'Ergebnisse', standings: 'Tabelle', mine: 'Meine Teams', today: 'Heute', yesterday: 'Gestern', tomorrow: 'Morgen', live: 'LIVE', ft: 'Ende', details: 'Details', back: 'Zurück', share: 'Link teilen', copied: 'Link kopiert',
  follow: 'Folgen', unfollow: 'Entfolgen', followLeague: 'Liga folgen', unfollowLeague: 'Liga gefolgt', none: 'Keine Spiele an diesem Tag.', loading: 'Lädt', failed: 'Die Ergebnisquelle hat gerade nicht geantwortet.', saved: 'Zuletzt gespeichertes Ergebnis von',
  stale: 'Die Quelle antwortet nicht, das ist die letzte gute Kopie von', delayed: 'Die Daten können eine Minute oder länger verzögert sein.', noMine: 'Folge einem Team mit dem Stern oder oben einer Liga, dann erscheinen ihre Spiele hier.', noMineDay: 'Keines deiner Teams spielt an diesem Tag.',
  last: 'Letzte Spiele', next: 'Nächste Spiele', events: 'Tore und Karten', teamStats: 'Teamstatistik', lineups: 'Startaufstellung', box: 'Boxscore', kick: 'Anstoß', venue: 'Stadion', team: 'Team', offline: 'Du bist offline. ', refreshing: 'Aktualisiert alle 30 Sekunden, solange ein Spiel läuft.', race: 'Rennen', results: 'Ergebnis', driver: 'Fahrer', raceDay: 'Renntag', cal: 'In den Kalender', search: 'Teams suchen', updated: 'Aktualisiert', showing: 'Gespeicherte Kopie von', badTable: 'Manche Zahlen in dieser Tabelle gehen nicht auf:' };
export const wordsFor = (lang) => (/^de\b/i.test(lang || '') ? DE : EN);
