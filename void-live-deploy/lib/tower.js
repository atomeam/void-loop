// Real sites (owner, 2026-10-22: "let's tackle real sites"): each floor is one named, real site, named in plain text only as a comparison
// (no logos, brand art or styling, nothing implying affiliation; Verse's own skills keep their own names). The order here is provisional;
// once head-to-head checks exist, floors sort easiest to hardest by the measured gap (aspects still lost). Never a claimed win without
// verified evidence.
// The tower (owner, 2026-10-22): "a-to-mind should be the only website you need", shown as a fighting-game ladder. Each floor is a site
// category (generic labels and original glyphs, never brand names or logos), easiest at the bottom, hardest at the top. The gate is hard: a
// floor is beaten only when EVERY aspect on its checklist is verified by an automated head-to-head check (Verse measured against the best
// site in the category, with evidence) as better or equal-and-better. One regressed aspect and the floor is not beaten. Verse may work on
// higher floors, but the marker only climbs past a floor whose gate passes. The best sites' detailed checklists come from passive study and
// stay private; this public side names generic aspects only and counts. Pure.

export const COMMON_ASPECTS = ['speed', 'accuracy', 'completeness', 'mobile', 'accessibility', 'offline', 'sharing', 'design polish', 'reliability'];
// easiest at the bottom (index 0) to hardest at the top; extra aspects are generic names for what the best site in the category offers
export const FLOORS = [
  { id: 'calculator', site: 'calculator.net', url: 'https://www.calculator.net/', ask: 'what is 17% of 240', label: 'Calculator', glyph: '÷', extra: ['history', 'unit and scientific modes'] },
  { id: 'timer and clock', site: 'timeanddate.com', url: 'https://www.timeanddate.com/', ask: 'set a timer for 5 minutes', label: 'Timer and clock', glyph: '◷', extra: ['alarms', 'world time'] },
  { id: 'weather', site: 'weather.gov', url: 'https://www.weather.gov/', ask: 'weather in boston', label: 'Weather', glyph: '☂', extra: ['hourly and daily forecast', 'alerts', 'radar'] },
  { id: 'translate', site: 'Google Translate', url: 'https://translate.google.com/', ask: 'translate hello to spanish', label: 'Translate', glyph: '⇄', extra: ['language count', 'speech in and out', 'camera text'] },
  { id: 'recipes', site: 'Allrecipes', url: 'https://www.allrecipes.com/', ask: 'pancake recipe', label: 'Recipes', glyph: '◒', extra: ['search by ingredient', 'scaling', 'step mode'] },
  { id: 'calendar', site: 'Google Calendar', url: 'https://calendar.google.com/', ask: 'my calendar', label: 'Calendar', glyph: '▦', extra: ['reminders', 'invites', 'recurring events'] },
  { id: 'docs and notes', site: 'Google Docs', url: 'https://docs.google.com/', ask: 'notepad', label: 'Docs and notes', glyph: '✎', extra: ['rich formatting', 'search', 'version history'] },
  { id: 'sports', site: 'ESPN', url: 'https://www.espn.com/', ask: 'nba scores', label: 'Sports', glyph: '◎', extra: ['live scores', 'schedules', 'standings'] },
  { id: 'finance', site: 'Yahoo Finance', url: 'https://finance.yahoo.com/', ask: 'markets', label: 'Finance', glyph: '△', extra: ['live quotes', 'charts', 'watchlists'] },
  { id: 'maps', site: 'Google Maps', url: 'https://www.google.com/maps', ask: 'map of lisbon', label: 'Maps', glyph: '⌖', extra: ['directions', 'place search', 'live traffic'] },
  { id: 'news', site: 'BBC News', url: 'https://www.bbc.com/news', ask: 'news', label: 'News', glyph: '▤', extra: ['breadth of sources', 'freshness', 'topic following'] },
  { id: 'photos', site: 'Google Photos', url: 'https://photos.google.com/', ask: 'my photos', label: 'Photos', glyph: '◰', extra: ['editing', 'albums', 'search by content'] },
  { id: 'games', site: 'Lichess', url: 'https://lichess.org/', ask: 'play chess', label: 'Games', glyph: '♟', extra: ['catalogue size', 'online play', 'ratings and ladders'] },
  { id: 'learning', site: 'Khan Academy', url: 'https://www.khanacademy.org/', ask: 'quiz me', label: 'Learning', glyph: '✦', extra: ['courses', 'progress tracking', 'practice'] },
  { id: 'music', site: 'Spotify', url: 'https://open.spotify.com/', ask: 'play music', label: 'Music', glyph: '♪', extra: ['catalogue', 'playlists', 'recommendations'] },
  { id: 'podcasts', site: 'Apple Podcasts', url: 'https://podcasts.apple.com/', ask: 'play the podcast', label: 'Podcasts', glyph: '◉', extra: ['catalogue', 'subscriptions', 'playback controls'] },
  { id: 'travel', site: 'Google Flights', url: 'https://www.google.com/travel/flights', ask: 'flights to paris', label: 'Travel', glyph: '✈', extra: ['search across providers', 'price tracking', 'itineraries'] },
  { id: 'jobs', site: 'LinkedIn Jobs', url: 'https://www.linkedin.com/jobs/', ask: 'find jobs', label: 'Jobs', glyph: '⚒', extra: ['listing breadth', 'alerts', 'applications'] },
  { id: 'shopping', site: 'Amazon', url: 'https://www.amazon.com/', ask: 'store', label: 'Shopping', glyph: '⊡', extra: ['catalogue', 'checkout', 'delivery tracking'] },
  { id: 'chat', site: 'WhatsApp Web', url: 'https://web.whatsapp.com/', ask: 'chat', label: 'Chat', glyph: '❝', extra: ['groups', 'media', 'calls'] },
  { id: 'video', site: 'YouTube', url: 'https://www.youtube.com/', ask: 'play a video', label: 'Video', glyph: '▶', extra: ['catalogue', 'streaming quality', 'recommendations'] },
  { id: 'social', site: 'Reddit', url: 'https://www.reddit.com/', ask: 'social', label: 'Social', glyph: '⁂', extra: ['feed', 'following', 'posting and replies'] },
  { id: 'email', site: 'Gmail', url: 'https://mail.google.com/', ask: 'my email', label: 'Email', glyph: '✉', extra: ['sending and receiving', 'spam filtering', 'search'] },
  { id: 'search', site: 'Google Search', url: 'https://www.google.com/', ask: 'who wrote hamlet', label: 'Search', glyph: '⌕', extra: ['web coverage', 'freshness', 'answer quality'] },
];
export const aspectsOf = (f) => COMMON_ASPECTS.concat(f.extra || []);
const OK = new Set(['better', 'equal-and-better']);

/** one floor's gate from its evidence ({ [aspect]: { verdict, verse, best, at, evidence } }): beaten only when every aspect passes with evidence. Pure. */
export function gate(floor, ev = {}) {
  const all = aspectsOf(floor), passed = all.filter((a) => ev[a] && OK.has(ev[a].verdict) && ev[a].evidence);
  const regressed = all.filter((a) => ev[a] && ev[a].verdict === 'worse' && ev[a].was && OK.has(ev[a].was));
  return { measured: all.some((a) => ev[a]), lost: all.filter((a) => ev[a] && ev[a].verdict === 'worse'), beaten: passed.length === all.length, n: passed.length, m: all.length, left: all.filter((a) => !passed.includes(a)), regressed };
}

/** the whole tower: each floor's gate, coverage (replaced, partial, missing from lap.items.json) and skills; the marker is the lowest floor
 *  whose gate fails (floors above it can be worked on, even beaten, but the marker does not pass a floor that is not). Pure. */
export function tower(onlySite = [], evidence = {}) {
  const cov = new Map((onlySite || []).map((r) => [r.category, r]));
  const floors = FLOORS.map((f, i) => { const g = gate(f, (evidence || {})[f.id] || {}), c = cov.get(f.id) || {}; return { ...f, floor: i + 1, ...g, coverage: c.status || 'missing', skills: c.skills || [] }; });
  // easiest to hardest by measured gap: floors with any head-to-head evidence sort by aspects still lost; the rest keep the provisional order
  floors.sort((a, b) => ((a.measured ? a.m - a.n : 1e3) - (b.measured ? b.m - b.n : 1e3)) || a.floor - b.floor); floors.forEach((f, i) => { f.floor = i + 1; });
  const at = floors.findIndex((f) => !f.beaten), marker = at < 0 ? floors.length : at;
  for (const f of floors) f.state = f.floor - 1 < marker ? 'beaten' : f.floor - 1 === marker ? 'current' : 'ahead';
  return { floors, marker: marker + 1, beaten: floors.filter((f) => f.beaten).length, total: floors.length };
}
export const towerLine = (t) => 'Tower: floor ' + Math.min(t.marker, t.total) + ' of ' + t.total + ' (' + (t.floors[t.marker - 1] ? t.floors[t.marker - 1].site + ', ' + t.floors[t.marker - 1].n + ' of ' + t.floors[t.marker - 1].m + ' aspects beaten' : 'every floor beaten') + '), ' + t.beaten + ' floors beaten';
