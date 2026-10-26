// Hand-written stand-ins for the score feeds, in the shape ESPN's public site API, OpenLigaDB and Jolpica answer with (written from their documented
// field names, NOT recorded from a live call: the sandbox this was built in could not reach them). tools/scores.test.mjs reads them, and
// tools/scores-page.mjs serves them to the page so a person-like test can run offline. The scores are made up for the test, not real results.
const team = (id, displayName, abbreviation, color) => ({ id, displayName, shortDisplayName: displayName.split(' ').pop(), abbreviation, color });
const comp = (home, hs, away, as, extra = {}) => ({ competitors: [{ homeAway: 'home', score: String(hs), winner: hs > as, team: home }, { homeAway: 'away', score: String(as), winner: as > hs, team: away }], venue: { fullName: 'Test Ground' }, ...extra });
const done = { type: { state: 'post', completed: true, shortDetail: 'FT' } };
export const SCOREBOARD = { events: [
  { id: '1001', date: '2025-05-25T15:00Z', status: done, competitions: [comp(team('359', 'Arsenal', 'ARS', 'ef0107'), 2, team('376', 'Southampton', 'SOU', 'd71920'), 1, { details: [
    { type: { text: 'Goal' }, clock: { displayValue: "12'" }, scoringPlay: true, team: { id: '359' }, athletesInvolved: [{ displayName: 'Test Striker' }] },
    { type: { text: 'Yellow Card' }, clock: { displayValue: "40'" }, yellowCard: true, team: { id: '376' }, athletesInvolved: [{ displayName: 'Test Back' }] },
    { type: { text: 'Red Card' }, clock: { displayValue: "77'" }, redCard: true, team: { id: '376' }, athletesInvolved: [{ displayName: 'Test Keeper' }] }] })] },
  { id: '1002', date: '2025-05-25T15:00Z', status: { type: { state: 'in', completed: false, shortDetail: "67'" } }, competitions: [comp(team('364', 'Liverpool', 'LIV', 'c8102e'), 1, team('384', 'Crystal Palace', 'CRY', '1b458f'), 1)] },
  { id: '1003', date: '2025-05-25T18:30Z', status: { type: { state: 'pre', completed: false, shortDetail: '5/25 - 2:30 PM EDT' } }, competitions: [comp(team('363', 'Chelsea', 'CHE', '034694'), 0, team('393', 'Nottingham Forest', 'NFO', 'dd0000'))] },
  { id: 'bad' }, null,
] };
export const STANDINGS = { children: [{ name: 'English Premier League', standings: { entries: [
  { team: team('364', 'Liverpool', 'LIV'), note: { color: '#81D6AC', description: 'Champions League', rank: 1 }, stats: [{ name: 'rank', value: 1 }, { name: 'gamesPlayed', displayValue: '38' }, { name: 'wins', displayValue: '25' }, { name: 'ties', displayValue: '9' }, { name: 'losses', displayValue: '4' }, { name: 'pointDifferential', displayValue: '+45' }, { name: 'points', displayValue: '84' }] },
  { team: team('359', 'Arsenal', 'ARS'), stats: [{ name: 'rank', value: 2 }, { name: 'gamesPlayed', displayValue: '38' }, { name: 'wins', displayValue: '20' }, { name: 'ties', displayValue: '14' }, { name: 'losses', displayValue: '4' }, { name: 'pointDifferential', displayValue: '+36' }, { name: 'points', displayValue: '74' }] },
  { team: team('363', 'Chelsea', 'CHE'), stats: [{ name: 'rank', value: 3 }, { name: 'gamesPlayed', displayValue: '38' }, { name: 'wins', displayValue: '18' }, { name: 'ties', displayValue: '12' }, { name: 'losses', displayValue: '8' }, { name: 'pointDifferential', displayValue: '+20' }, { name: 'points', displayValue: '66' }] },
  { team: team('393', 'Nottingham Forest', 'NFO'), stats: [{ name: 'rank', value: 4 }, { name: 'gamesPlayed', displayValue: '38' }, { name: 'wins', displayValue: '18' }, { name: 'ties', displayValue: '11' }, { name: 'losses', displayValue: '9' }, { name: 'pointDifferential', displayValue: '+10' }, { name: 'points', displayValue: '65' }] }] } }] };
export const SUMMARY = { header: { id: '1001', competitions: [{ date: '2025-05-25T15:00Z', status: done, competitors: SCOREBOARD.events[0].competitions[0].competitors, venue: { fullName: 'Test Ground' } }] },
  keyEvents: [{ clock: { displayValue: "12'" }, scoringPlay: true, type: { text: 'Goal' }, shortText: 'Test Striker Goal', team: { displayName: 'Arsenal' } }, { clock: { displayValue: "77'" }, type: { text: 'Red Card' }, shortText: 'Test Keeper red card', team: { displayName: 'Southampton' } }, { type: { text: 'Kickoff' } }],
  boxscore: { teams: [{ team: { abbreviation: 'ARS' }, homeAway: 'home', statistics: [{ label: 'Possession', displayValue: '61' }, { label: 'Shots', displayValue: '14' }] }, { team: { abbreviation: 'SOU' }, homeAway: 'away', statistics: [{ label: 'Possession', displayValue: '39' }, { label: 'Shots', displayValue: '5' }] }] },
  plays: [{ clock: { displayValue: "12'" }, text: 'Test Striker scores', scoringPlay: true, homeScore: 1, awayScore: 0, period: { number: 1 } }, { clock: { displayValue: "40'" }, text: 'Foul by Test Back' }],
  commentary: [{ time: { displayValue: "90'" }, text: 'Full time.' }],
  seasonseries: [{ events: [{ date: '2025-01-01T00:00Z', score: '1-1', homeTeam: { displayName: 'Southampton' }, awayTeam: { displayName: 'Arsenal' } }] }],
  lastFiveGames: [{ team: { abbreviation: 'ARS' }, events: [{ gameResult: 'W', opponent: { abbreviation: 'CHE' }, score: '2-0' }, { gameResult: 'D', opponent: { abbreviation: 'LIV' }, score: '1-1' }, { gameResult: 'X' }] }],
  rosters: [{ homeAway: 'home', team: { displayName: 'Arsenal' }, roster: [{ starter: true, jersey: '1', athlete: { displayName: 'Test Keeper One' }, position: { abbreviation: 'G' } }, { starter: false, athlete: { displayName: 'Sub' } }] }] };
export const OPENLIGA = [{ matchID: 7, matchDateTimeUTC: '2025-05-17T13:30:00Z', matchIsFinished: true, team1: { teamId: 16, teamName: 'VfB Stuttgart', shortName: 'Stuttgart' }, team2: { teamId: 7, teamName: 'Borussia Dortmund' },
  matchResults: [{ resultTypeID: 1, pointsTeam1: 0, pointsTeam2: 1 }, { resultTypeID: 2, pointsTeam1: 2, pointsTeam2: 1 }], goals: [{ scoreTeam1: 0, scoreTeam2: 1, matchMinute: 20, goalGetterName: 'Test D', isPenalty: false, isOwnGoal: false }, { scoreTeam1: 1, scoreTeam2: 1, matchMinute: 55, goalGetterName: 'Test S', isPenalty: true }], location: { locationStadium: 'Test Arena' }, group: { groupOrderID: 34 } },
  { matchID: 8, matchDateTimeUTC: '2025-05-18T13:30:00Z', matchIsFinished: true, team1: { teamName: 'Other' }, team2: { teamName: 'Other 2' }, matchResults: [] }];
export const F1_RACES = { MRData: { RaceTable: { Races: [{ season: '2025', round: '9', raceName: 'Spanish Grand Prix', date: '2025-06-01', time: '13:00:00Z', Circuit: { circuitName: 'Circuit de Barcelona-Catalunya', Location: { locality: 'Montmeló', country: 'Spain' } } }] } } };
export const F1_RESULTS = { MRData: { RaceTable: { Races: [{ Results: [{ position: '1', positionText: '1', grid: '1', points: '25', Driver: { givenName: 'Test', familyName: 'Winner', code: 'WIN' }, Constructor: { name: 'Team A' }, Time: { time: '1:33:15.743' } }, { position: '2', positionText: '2', grid: '3', points: '18', Driver: { givenName: 'Test', familyName: 'Second', code: 'SEC' }, Constructor: { name: 'Team B' }, status: '+10.0s' }] }] } } };
export const F1_DRIVERS = { MRData: { StandingsTable: { StandingsLists: [{ DriverStandings: [{ position: '1', points: '198', wins: '5', Driver: { givenName: 'Test', familyName: 'Winner', code: 'WIN' } }] }] } } };
export const F1_CONS = { MRData: { StandingsTable: { StandingsLists: [{ ConstructorStandings: [{ position: '1', points: '300', wins: '6', Constructor: { name: 'Team A' } }] }] } } };
export const SDB = { teams: { teams: [{ idTeam: '133604', strTeam: 'Arsenal', strSport: 'Soccer', strLeague: 'English Premier League', strCountry: 'England', strStadium: 'Emirates Stadium', strTeamBadge: 'https://x.test/b.png' }] },
  event: { event: [{ idEvent: '1', strEvent: 'Arsenal vs Southampton', dateEvent: '2025-05-25', strLeague: 'English Premier League', strSport: 'Soccer', strHomeTeam: 'Arsenal', strAwayTeam: 'Southampton', intHomeScore: '2', intAwayScore: '1' }] },
  venues: { venues: [{ idVenue: '9', strVenue: 'Emirates Stadium', strLocation: 'London', strCountry: 'England', intCapacity: '60260', strSport: 'Soccer' }] },
  player: { player: [{ idPlayer: '7', strPlayer: 'Test Player <b>', strTeam: 'Arsenal', strSport: 'Soccer', strNationality: 'England', dateBorn: '2000-01-01', strPosition: 'Midfielder' }] } };
export const ESPN_SEARCH = { items: [{ id: '359', type: 'team', displayName: 'Arsenal', sport: 'soccer', description: 'English Premier League' }, { id: '1', type: 'player', displayName: 'Test Winger', subtitle: 'Arsenal', sport: 'soccer' }, { id: '9', type: 'article', displayName: 'Some story' }] };
export const WIKI_BORN = { births: [{ year: 1984, text: 'Test Footballer', pages: [{ description: 'English footballer' }] }, { year: 1950, text: 'A Poet', pages: [{ description: 'American poet' }] }] };
/** a fetch that answers like the three feeds from the fixtures, recording what it was asked (a request to any other host throws) */
export function fakeFeeds(log = []) {
  return async (u) => {
    u = String(u); log.push(u);
    const ok = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o), json: async () => o });
    if (u.startsWith('https://site.api.espn.com/apis/site/v2/sports/')) return u.includes('/summary') ? ok(SUMMARY) : ok(SCOREBOARD);
    if (u.startsWith('https://site.api.espn.com/apis/v2/sports/') && u.endsWith('/standings')) return ok(STANDINGS);
    if (u.startsWith('https://api.openligadb.de/getmatchdata/bl1/')) return ok(OPENLIGA);
    if (u.startsWith('https://api.jolpi.ca/ergast/f1/')) return ok(/results\.json/.test(u) ? F1_RESULTS : /driverStandings/.test(u) ? F1_DRIVERS : /constructorStandings/.test(u) ? F1_CONS : F1_RACES);
    if (u.startsWith('https://www.thesportsdb.com/api/v1/json/123/')) return ok(/searchteams/.test(u) ? SDB.teams : /searchevents/.test(u) ? SDB.event : /searchvenues/.test(u) ? SDB.venues : SDB.player);
    if (u.startsWith('https://site.api.espn.com/apis/common/v3/search')) return ok(ESPN_SEARCH);
    throw new Error('unexpected host ' + u);
  };
}
