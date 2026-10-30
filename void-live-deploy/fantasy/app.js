// The fantasy page (void-live-deploy/fantasy/index.html): everything after its first paint. Imported once the load event has fired. The sheet the visitor pastes or opens is read and kept
// on this device (a2m.void.fantasy.v1) and never sent anywhere; the pure work is lib/fantasy.js. The only network calls are for box scores, through /api/scores, for the
// "Stats from box scores" tab, and they carry a league, a day or a game id, never the sheet.
import { mountRelated } from '/lib/toolkit.js';
import * as S from '/lib/scores.js';
import * as F from '/lib/fantasy.js';

const $ = (id) => document.getElementById(id), KEY = 'a2m.void.fantasy.v1', EKEY = 'a2m.void.fantasy.games.v1';
const h = (tag, a, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(a || {})) { if (v === false || v == null) continue; if (k === 'text') e.textContent = v; else if (/^on[a-z]+$/.test(k) && typeof v === 'function') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null) e.append(c); return e; };
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
const out = $('out'), note = $('note'), say = (t, bad) => { note.textContent = t || ''; note.classList.toggle('bad', !!bad); };
const EXAMPLE = 'Player,Pos,Team,Proj,Floor,Ceiling,ADP\nAnn Lee,RB,AAA,15.5,9,24,3\nBob Ray,WR,BBB,14.2,10,20,5\nCy Dee,QB,CCC,21.3,15,29,8\nDee Fox,TE,DDD,9.8,5,16,22\nEd Gray,RB,EEE,12.1,6,21,14\nFay Hill,WR,FFF,13.4,8,19,11\nGus Ito,WR,GGG,11.0,4,22,17\nHal Jay,RB,HHH,10.2,6,15,26';
const tabParam = new URLSearchParams(location.search).get('tab');
let sheet = null, tab = ['compare', 'sit', 'trade', 'board', 'mock', 'box'].includes(tabParam) ? tabParam : 'compare', games = load(EKEY, []);
const state = { names: { compare: [], sit: [], give: [], get: [] }, col: '', floor: '', ceil: '', stat: '', n: 3 };

const TABS = [['compare', 'Compare players'], ['sit', 'Start or sit'], ['trade', 'Trade value'], ['board', 'Draft board'], ['mock', 'Mock draft'], ['box', 'Stats from box scores']];
function drawTabs() { $('tabs').replaceChildren(...TABS.map(([id, label]) => h('button', { type: 'button', 'aria-pressed': String(tab === id), text: label, onclick: () => { tab = id; show(); } }))); }
const colSelect = (id, label, value, cols, onchange, blank) => h('label', { class: 'note', style: 'min-height:0;display:inline-flex;gap:6px;align-items:center' }, label, h('select', { id, class: 'box', onchange: (e) => onchange(e.target.value) }, blank ? h('option', { value: '', text: '(none)' }) : null, cols.map((c) => h('option', { value: c, text: c, selected: c === value ? true : null }))));
/** a player picker: a search box and the matching names as buttons; at most `max` stay chosen */
function picker(key, max, label, redraw) {
  const chosen = state.names[key], q = h('input', { type: 'search', class: 'box', 'aria-label': 'Search players for ' + label, placeholder: 'Search players', style: 'width:100%' }), list = h('div', { class: 'pick' });
  const draw = () => { const f = q.value.trim().toLowerCase(), all = sheet.rows.map((r) => r[sheet.nameCol]), shown = [...chosen, ...all.filter((n) => !chosen.includes(n) && (!f || n.toLowerCase().includes(f)))].slice(0, 40);
    list.replaceChildren(...shown.map((n) => h('button', { type: 'button', 'aria-pressed': String(chosen.includes(n)), text: n, onclick: () => { const i = chosen.indexOf(n); if (i >= 0) chosen.splice(i, 1); else if (chosen.length < max) chosen.push(n); else say('Up to ' + max + ' players here.'); redraw(); } }))); };
  q.addEventListener('input', draw); draw(); return h('div', null, h('h2', { text: label }), q, list);
}
const rows = (r) => h('tr', null, r.map((c) => (c && c.t != null ? h('td', { text: c.t, class: c.best ? 'best' : null }) : h('td', { text: c == null ? '' : String(c) }))));

function show() {
  drawTabs(); say('');
  if (tab === 'box') return boxTab(); // the box-score stats do not need a sheet
  if (!sheet) { out.replaceChildren(h('p', { class: 'empty', text: 'Open or paste a sheet above and press "Use this sheet". Or try the made-up example.' })); return; }
  if (!state.col || !sheet.numeric.includes(state.col)) state.col = sheet.numeric.find((c) => /proj|point|pts|value|fpts/i.test(c)) || sheet.numeric[0] || '';
  const redraw = show, nums = sheet.numeric;
  if (tab === 'compare') {
    const c = F.compare(sheet, state.names.compare), body = [picker('compare', 4, 'Pick two to four players', redraw)];
    body.push(c.players.length < 2 ? h('p', { class: 'empty', text: 'Pick at least two players to compare.' }) : h('div', { class: 'tbl' }, h('table', { 'data-tab': 'compare' }, h('thead', null, h('tr', null, h('th', { text: 'Column' }), c.players.map((p) => h('th', { text: p })))),
      h('tbody', null, c.lines.map((l) => h('tr', null, h('td', { text: l.col + (l.lower ? ' (lower is better)' : '') }), l.raw.map((v, i) => h('td', { text: v === '' ? '' : String(v) + (l.best[i] ? ' ★ best' : ''), class: l.best[i] ? 'best' : null }))))))));
    out.replaceChildren(...body);
  } else if (tab === 'sit') {
    const r = F.startSit(sheet, state.names.sit, state.col, state.floor, state.ceil), body = [h('div', { class: 'row' }, colSelect('scol', 'Compare on', state.col, nums, (v) => { state.col = v; redraw(); }), colSelect('sfloor', 'Floor', state.floor, nums, (v) => { state.floor = v; redraw(); }, true), colSelect('sceil', 'Ceiling', state.ceil, nums, (v) => { state.ceil = v; redraw(); }, true)), picker('sit', 4, 'Pick the players you are choosing between', redraw)];
    body.push(h('div', { class: 'pane' }, h('p', { style: 'margin:0', text: r.ok ? r.verdict : r.why }), r.ok ? h('ol', { class: 'ev' }, r.order.map((p) => h('li', null, h('span', { class: 'm', text: String(p.v) }), h('span', { text: p.name + (p.name === r.start ? ' (start)' : ' (sit)') })))) : null));
    out.replaceChildren(...body);
  } else if (tab === 'trade') {
    const r = F.tradeValue(sheet, state.names.give, state.names.get, state.col);
    out.replaceChildren(h('div', { class: 'row' }, colSelect('tcol', 'Value column', state.col, nums, (v) => { state.col = v; redraw(); })), picker('give', 6, 'You give', redraw), picker('get', 6, 'You get', redraw), h('div', { class: 'pane' }, h('p', { style: 'margin:0', text: r.ok ? r.verdict : r.why }), h('p', { class: 'note', style: 'min-height:0', text: 'This adds up your own column. It knows nothing about league settings, positions or injuries.' })));
  } else if (tab === 'board') {
    const b = F.board(sheet, state.col), shown = sheet.cols.filter((c) => c !== sheet.nameCol).slice(0, 5);
    out.replaceChildren(h('div', { class: 'row' }, colSelect('bcol', 'Rank by', state.col, nums, (v) => { state.col = v; redraw(); }), h('button', { type: 'button', text: 'Copy the board', onclick: async () => { try { await navigator.clipboard.writeText(b.map((x, i) => (i + 1) + '. ' + x.name).join('\n')); say('Board copied.'); } catch (_) { say('This browser cannot copy; select the list instead.', true); } } })),
      h('div', { class: 'tbl' }, h('table', { 'data-tab': 'board' }, h('thead', null, h('tr', null, h('th', { text: '#' }), h('th', { text: 'Player' }), shown.map((c) => h('th', { text: c })))), h('tbody', null, b.slice(0, 300).map((x, i) => rows([i + 1, x.name, ...shown.map((c) => x.row[c])]))))));
  } else if (tab === 'mock') mock(nums);
}
let run = null;
function mock(nums) {
  const b = F.board(sheet, state.col).map((x) => x.name), cfg = load(KEY + '.mock', { teams: 10, rounds: 6, slot: 1 }), num = (k, label, min, max) => h('label', { class: 'note', style: 'min-height:0;display:flex;gap:6px;align-items:center' }, label, h('input', { class: 'box', type: 'number', min, max, value: cfg[k], style: 'width:4.5em', onchange: (e) => { cfg[k] = Math.max(min, Math.min(max, parseInt(e.target.value, 10) || min)); save(KEY + '.mock', cfg); } }));
  const setup = () => out.replaceChildren(h('div', { class: 'row' }, colSelect('mcol', 'Rank by', state.col, nums, (v) => { state.col = v; show(); }), num('teams', 'Teams', 2, 16), num('rounds', 'Rounds', 1, 20), num('slot', 'Your slot', 1, 16), h('button', { type: 'button', class: 'go', text: 'Start the draft', onclick: begin })), h('p', { class: 'note', style: 'min-height:0', text: 'The bots take the best player left by your column, now and then reaching a few places. Nothing here is a real ADP: it is your sheet.' }));
  const begin = () => { const teams = cfg.teams, order = S.draftOrder(teams, Math.min(cfg.rounds, Math.max(1, Math.floor(b.length / teams)))); if (b.length < teams) { say('Your sheet needs at least ' + teams + ' ranked players.', true); return; } run = { pool: b.slice(), order, i: 0, teams: Array.from({ length: teams }, () => []), me: Math.min(cfg.slot, teams) - 1 }; step(); };
  const step = () => { while (run.i < run.order.length && run.order[run.i].team !== run.me) { run.teams[run.order[run.i].team].push(run.pool.splice(S.botPick(run.pool, Math.random()), 1)[0]); run.i++; } draw(); };
  const draw = () => { const fin = run.i >= run.order.length, o = run.order[run.i];
    out.replaceChildren(h('p', { class: 'note', style: 'min-height:0', text: fin ? 'Draft finished.' : 'On the clock: round ' + o.round + ', pick ' + o.pick }), h('div', { class: 'pane' }, h('h2', { text: 'Your team', style: 'margin-top:0' }), h('ol', { class: 'ev' }, run.teams[run.me].map((n) => h('li', null, h('span', { text: n }))))),
      fin ? null : h('div', { class: 'pane' }, h('h2', { text: 'Available', style: 'margin-top:0' }), h('ul', { class: 'games' }, run.pool.slice(0, 12).map((n, i) => h('li', { style: 'grid-template-columns:1fr auto' }, h('span', { text: n }), h('button', { type: 'button', class: 'gm', text: 'Pick', 'aria-label': 'Pick ' + n, onclick: () => { run.teams[run.me].push(run.pool.splice(i, 1)[0]); run.i++; step(); } }))))), h('div', { class: 'row' }, h('button', { type: 'button', text: 'Start again', onclick: setup }))); };
  if (run && run.i < run.order.length + 1 && run.pool) draw(); else setup();
}
// ---- stats Verse works out from box scores it reads: games added one by one, kept on this device ----
function boxTab() {
  const LG = S.LEAGUES.filter((l) => l.kind === 'espn'), pane = h('div'), q = { league: 'nfl', date: S.localDay() };
  const entries = games, stats = [...new Set(entries.flatMap((e) => [...Object.keys(e.stats), ...(e.fpts != null ? ['FPTS'] : [])]))];
  if (!state.stat || !stats.includes(state.stat)) state.stat = stats.includes('FPTS') ? 'FPTS' : stats.includes('YDS') ? 'YDS' : stats[0] || '';
  const d = state.stat ? F.deriveStats(entries, state.stat, state.n) : [], list = h('div', { 'aria-live': 'polite' });
  const find = async () => { list.replaceChildren(h('p', { class: 'note', style: 'min-height:0', text: 'Loading…' })); try { const j = await (await fetch('/api/scores?' + new URLSearchParams({ league: q.league, date: q.date }))).json(); if (!j.ok) throw 0;
      const fin = (j.games || []).filter((g) => g.state === 'final' && g.id && !String(g.id).startsWith('ol')); list.replaceChildren(fin.length ? h('ul', { class: 'games' }, fin.map((g) => h('li', { style: 'grid-template-columns:1fr auto' }, h('span', { text: g.home.name + ' ' + g.home.score + ' - ' + g.away.score + ' ' + g.away.name }), h('button', { type: 'button', class: 'gm', text: 'Add', 'aria-label': 'Add the box score of ' + g.home.name + ' against ' + g.away.name, onclick: () => add(g) })))) : h('p', { class: 'empty', text: 'No finished games on that day.' })); } catch (_) { list.replaceChildren(h('p', { class: 'empty', text: 'The score feed did not answer just now.' })); } };
  const add = async (g) => { try { const j = await (await fetch('/api/scores?' + new URLSearchParams({ league: q.league, view: 'game', id: g.id }))).json(); if (!j.ok) throw 0; const e = F.entriesFrom(j, S.leagueOf(q.league).grp, q.date); if (!e.length) { say('That game has no player box score.', true); return; }
      games = games.filter((x) => !(x.gid === g.id)).concat(e.map((x) => ({ ...x, gid: g.id }))).slice(-4000); save(EKEY, games); say('Added ' + e.length + ' player lines.'); show(); } catch (_) { say('The score feed did not answer just now.', true); } };
  out.replaceChildren(h('p', { class: 'note', style: 'min-height:0', text: 'Add finished games one by one (Verse reads their box scores); averages, the last few games and home and away splits are worked out here. Nothing is projected.' }),
    h('div', { class: 'row' }, colSelect('bl', 'League', q.league, LG.map((l) => l.id), (v) => { q.league = v; }), h('label', { class: 'note', style: 'min-height:0' }, 'Day ', h('input', { type: 'date', class: 'box', value: q.date, 'aria-label': 'Day', onchange: (e) => { q.date = e.target.value; } })), h('button', { type: 'button', class: 'go', text: 'Find games', onclick: find }), games.length ? h('button', { type: 'button', text: 'Clear box scores', onclick: () => { games = []; save(EKEY, games); show(); } }) : null), list,
    games.length ? h('div', { class: 'pane' }, h('div', { class: 'row', style: 'margin:0 0 6px' }, colSelect('dst', 'Stat', state.stat, stats, (v) => { state.stat = v; show(); }), h('label', { class: 'note', style: 'min-height:0' }, 'Last ', h('input', { type: 'number', class: 'box', min: 1, max: 10, value: state.n, style: 'width:4em', 'aria-label': 'Last games', onchange: (e) => { state.n = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 3)); show(); } }), ' games')),
      h('div', { class: 'tbl' }, h('table', { 'data-tab': 'derived' }, h('thead', null, h('tr', null, ['Player', 'Team', 'Games', 'Avg', 'Last ' + state.n, 'Home', 'Away', 'Trend'].map((c) => h('th', { text: c })))), h('tbody', null, d.slice(0, 80).map((x) => rows([x.name, x.team, x.games, x.avg, x.last, x.home, x.away, x.trend])))))) : h('p', { class: 'empty', text: 'No box scores added yet.' }));
}
// ---- the sheet ----
function use(text) { const r = F.parseSheet(text); if (!r.ok) { say(r.why, true); return false; } sheet = r; state.names = { compare: [], sit: [], give: [], get: [] }; state.col = ''; save(KEY, text.slice(0, 300000)); say(r.rows.length + ' players, ' + r.numeric.length + ' number columns: ' + r.numeric.slice(0, 8).join(', ') + '.'); show(); return true; }
$('use').addEventListener('click', () => use($('sheet').value));
$('example').addEventListener('click', () => { $('sheet').value = EXAMPLE; use(EXAMPLE); say('A made-up example: the names and numbers are invented, use your own sheet for real answers.'); });
$('clear').addEventListener('click', () => { $('sheet').value = ''; sheet = null; save(KEY, ''); show(); say('Sheet cleared.'); });
$('file').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; if (f.size > 400000) { say('That file is too large (400 KB at most).', true); return; } const r = new FileReader(); r.onload = () => { $('sheet').value = String(r.result || ''); use($('sheet').value); }; r.readAsText(f); });
$('share').addEventListener('click', async () => { const u = location.origin + location.pathname; try { if (navigator.share) await navigator.share({ title: document.title, url: u }); else { await navigator.clipboard.writeText(u); say('Link copied (your sheet is not in it).'); } } catch (_) { say(u); } });
const saved = load(KEY, ''); if (typeof saved === 'string' && saved) { $('sheet').value = saved; use(saved); } else show();
mountRelated($('related'), '/fantasy/', []);
