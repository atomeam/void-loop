// The scores page's "Sports" tab (loaded when it is opened): a grid of sports to browse, one search box across every sport (TheSportsDB through /api/sportsearch),
// athletes born on this day (Wikipedia's "On this day", read by the browser), a strip of what this device holds, and the free API's plain description.
// Icons are emoji, no logo files. A sport with no free live feed in Verse says so and links out; nothing here is invented.
const SPORTS = [
  ['Soccer', '⚽', ['epl', 'laliga', 'bundesliga', 'seriea', 'ligue1', 'mls', 'ucl']], ['Basketball', '🏀', ['nba']], ['American football', '🏈', ['nfl']], ['Baseball', '⚾', ['mlb']], ['Ice hockey', '🏒', ['nhl']], ['Motorsport (Formula 1)', '🏎️', ['f1']],
  ['Tennis', '🎾'], ['Cricket', '🏏'], ['Golf', '⛳'], ['Rugby', '🏉'], ['Boxing', '🥊'], ['MMA', '🥋'], ['Cycling', '🚴'], ['Australian rules', '🏟️'], ['Esports', '🎮'], ['Volleyball', '🏐'], ['Snooker and pool', '🎱'], ['Darts', '🎯'],
  ['Athletics', '🏃'], ['Skiing', '⛷️'], ['Ice skating', '⛸️'], ['Wrestling', '🤼'], ['Handball', '🤾'], ['Table tennis', '🏓'], ['Badminton', '🏸'], ['Swimming', '🏊'], ['Gymnastics', '🤸'], ['Rowing', '🚣'], ['Sailing', '⛵'], ['Surfing', '🏄'],
  ['Climbing', '🧗'], ['Fencing', '🤺'], ['Archery', '🏹'], ['Weightlifting', '🏋️'], ['Judo', '🥋'], ['Bowling', '🎳'], ['Lacrosse', '🥍'], ['Field hockey', '🏑'], ['Motorcycle racing', '🏍️'], ['Triathlon', '🏊'], ['Netball', '🏐'], ['Skateboarding', '🛹'],
];
const BORN = /footballer|soccer|basketball|baseball|hockey|racing driver|driver|boxer|cricketer|tennis|golfer|athlete|swimmer|sprinter|runner|cyclist|rugby|wrestler|gymnast|skier|skater|quarterback|player|coach|sportsperson|olympic/i;
const load = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (_) { return {}; } };

/** draw the tab into c.out. c: { S, h, out, say, W, lang, mem, open(leagueId) } */
export async function view(c) {
  const { S, h, out } = c, de = /^de\b/i.test(c.lang), T = de ? { browse: 'Sport wählen', nofeed: 'Für diese Sportart hat Verse noch keine kostenlose Live-Quelle.', where: 'Mehr dazu in der Datenbank', search: 'Suche in allen Sportarten: Teams, Spiele, Stadien, Spieler', go: 'Suchen', born: 'Heute geboren', stats: 'Auf diesem Gerät', api: 'Kostenlose API', none: 'Nichts gefunden.', away: 'Die Sportdatenbank hat gerade nicht geantwortet.' }
    : { browse: 'Click a sport to browse', nofeed: 'Verse has no free live feed for this sport yet.', where: 'Look it up in the database', search: 'Search every sport: teams, events, venues, players', go: 'Search', born: 'Born on this day', stats: 'On this device', api: 'Free API', none: 'Nothing found.', away: 'The sports database did not answer just now.' };
  const leaguesOf = (ids) => ids.map((id) => S.leagueOf(id));
  const pane = (title, ...kids) => h('div', { class: 'pane' }, h('h2', { text: title, style: 'margin-top:0' }), ...kids);
  // 1. the grid
  const detail = h('div', { 'aria-live': 'polite', style: 'min-height:48px' });
  const grid = h('div', { class: 'chips', role: 'group', 'aria-label': T.browse }, SPORTS.map(([name, ico, ids]) => h('button', { type: 'button', style: 'display:inline-flex;gap:6px;align-items:center', 'aria-label': name, onclick: () => {
    detail.replaceChildren(ids ? h('div', { class: 'chips' }, leaguesOf(ids).map((l) => h('a', { href: '/scores/?league=' + l.id, text: l[de ? 'de' : 'name'], onclick: (e) => { e.preventDefault(); c.open(l.id); } })))
      : h('p', { class: 'note', style: 'min-height:0' }, name + ': ' + T.nofeed + ' ', h('a', { href: 'https://www.thesportsdb.com/', rel: 'noopener', text: T.where })));
  } }, h('span', { 'aria-hidden': 'true', text: ico }), h('span', { text: name }))));
  // 2. the search
  const res = h('div', { 'aria-live': 'polite' }), inp = h('input', { type: 'search', id: 'gq', maxlength: 40, placeholder: T.search, 'aria-label': T.search, style: 'font:inherit;font-size:16px;min-height:40px;border:1px solid var(--line);border-radius:10px;padding:4px 12px;background:var(--box);color:inherit;box-sizing:border-box;flex:1 1 200px;min-width:0' });
  // every kind is always listed, as plain text: the items with the source of each, or "No team found." so a search that finds nothing says so instead of showing nothing
  const groups = [['teams', 'Teams', 'No team found.', (x) => x.name + (x.league ? ' · ' + x.league : '') + (x.sport ? ' (' + x.sport + ')' : '')], ['events', 'Events', 'No event found.', (x) => (x.date ? x.date + ' · ' : '') + x.name + (x.hs !== '' && x.as !== '' ? ' ' + x.hs + '-' + x.as : '') + (x.league ? ' · ' + x.league : '')],
    ['venues', 'Venues', 'No venue found.', (x) => x.name + (x.city ? ', ' + x.city : '') + (x.capacity ? ' · ' + x.capacity + ' seats' : '')], ['players', 'Players', 'No player found.', (x) => x.name + (x.team ? ' · ' + x.team : '') + (x.sport ? ' (' + x.sport + ')' : '') + (x.born ? ' · b. ' + x.born : '')]];
  const find = async () => { const q = inp.value.trim(); if (q.length < 2) return; res.replaceChildren(h('p', { class: 'note', style: 'min-height:0', text: c.W.loading + '…' }));
    try { const j = await (await fetch('/api/sportsearch?q=' + encodeURIComponent(q))).json(); if (!j.ok) throw 0;
      const parts = groups.map(([k, t, none, f]) => h('div', null, h('h2', { text: t }), h('ul', { class: 'ev' }, j[k].length ? j[k].map((x) => h('li', null, h('span', { text: f(x) }), h('span', { class: 'note', style: 'min-height:0;margin-left:auto', text: x.src || '' }))) : [h('li', null, h('span', { text: none }))])));
      res.replaceChildren(...parts, h('p', { class: 'srcs' }, 'Sources: ', h('a', { href: 'https://www.thesportsdb.com/', rel: 'noopener', text: 'TheSportsDB' }), ' (a free community database, may be incomplete) and ESPN\'s public search' + (j.source ? '; this answer came from ' + j.source : '') + '.')); }
    catch (_) { res.replaceChildren(h('p', { class: 'empty', text: T.away })); } };
  if (c.q && /^[\p{L}\p{N} .'’&-]{2,40}$/u.test(c.q)) { inp.value = c.q; find(); } // a link that carries a search (/sports/?q=arsenal) runs it
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') find(); });
  // 3. born on this day, from Wikipedia, kept on the device for the day
  const born = h('ul', { class: 'ev' }), now = new Date(), mm = String(now.getMonth() + 1).padStart(2, '0'), dd = String(now.getDate()).padStart(2, '0'), BK = 'a2m.void.scores.born.v1';
  (async () => { try { let list = load(BK)[mm + dd]; if (!list) { const j = await (await fetch('https://en.wikipedia.org/api/rest_v1/feed/onthisday/births/' + mm + '/' + dd)).json();
      list = (j.births || []).filter((b) => BORN.test((b.pages && b.pages[0] && b.pages[0].description) || '')).slice(0, 12).map((b) => ({ y: b.year, n: String(b.text || '').slice(0, 60), d: String((b.pages[0] && b.pages[0].description) || '').slice(0, 80) })); try { localStorage.setItem(BK, JSON.stringify({ [mm + dd]: list })); } catch (_) {} }
    born.replaceChildren(...(list.length ? list.map((b) => h('li', null, h('span', { class: 'm', text: String(b.y) }), h('span', { text: b.n + ' — ' + b.d }))) : [h('li', null, h('span', { text: T.none }))])); } catch (_) { born.replaceChildren(h('li', null, h('span', { text: T.away }))); } })();
  // 4. what this device holds
  const ck = load('a2m.void.scores.cache.v1'), mem = c.mem;
  const stat = (n, label) => h('div', { style: 'text-align:center;flex:1 1 90px' }, h('b', { style: 'font-size:22px;display:block', text: String(n) }), h('span', { class: 'note', style: 'min-height:0', text: label }));
  // 5. the free API
  const ex = ['/api/scores?league=epl&date=2025-05-25', '/api/scores?league=nba&view=standings', '/api/scores?league=nfl&date=2025-10-21&span=7'];
  const api = [h('p', { class: 'note', style: 'min-height:0', text: 'Read only JSON, no key, no premium tier: public scores, standings, game detail, team schedules and form for 12 leagues. Call it from a server or an agent (no CORS); answers are cached from 20 seconds to 6 hours and the data may be delayed. The description is in ' }, h('a', { href: '/openapi.json', text: 'openapi.json' }), '.'), h('ul', { class: 'ev' }, ex.map((x) => h('li', null, h('a', { href: x, text: x, style: 'color:inherit;overflow-wrap:anywhere' }))))];
  out.replaceChildren(pane(T.browse, grid, detail), pane(T.search, h('div', { class: 'row', style: 'margin:0' }, inp, h('button', { type: 'button', class: 'go', text: T.go, onclick: find })), res), pane(T.born, born, h('p', { class: 'srcs' }, 'Source: ', h('a', { href: 'https://en.wikipedia.org/wiki/Wikipedia:Selected_anniversaries', rel: 'noopener', text: 'Wikipedia' }), ' (CC BY-SA), athletes picked by their one-line description.')),
    pane(T.stats, h('div', { class: 'row', style: 'margin:0;justify-content:space-around' }, stat(S.LEAGUES.length, 'leagues'), stat(SPORTS.length, 'sports to browse'), stat((mem.teams || []).length, 'followed teams'), stat(Object.keys(ck).length, 'saved answers'))), pane(T.api, ...api));
  return false;
}
