// The scores page (void-live-deploy/scores/index.html): everything after its first paint. Loaded by the page once its load event has fired, so the page's own load
// time is its HTML alone; the first view's data is already on its way (the early fetch in the page's head). Kept on this device: followed teams and leagues, the last answers.
import { mountRelated } from '/lib/toolkit.js';
import * as S from '/lib/scores.js';

const $ = (id) => document.getElementById(id), KEY = 'a2m.void.scores.v1', CKEY = 'a2m.void.scores.cache.v1', POLL = 30000;
const lang = navigator.language || 'en', FALLBACK = { story: 'Story', details: 'Details', follow: 'Follow', unfollow: 'Unfollow', next: 'Next games', noNext: 'No next games listed', back: 'Back', team: 'Team' }, W = new Proxy(S.wordsFor(lang), { get: (t, k) => (t[k] != null ? t[k] : FALLBACK[k] != null ? FALLBACK[k] : typeof k === 'string' ? k : '') }), // a words file older than this page (a cached module beside new HTML) never leaves a button unnamed
 de = /^de\b/i.test(lang);
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object' ? v : d; } catch (_) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
const mem = load(KEY, { teams: [], leagues: [], last: '' });
const h = (tag, a, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(a || {})) { if (v === false || v == null) continue; if (k === 'text') e.textContent = v; else if (/^on[a-z]+$/.test(k) && typeof v === 'function') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null) e.append(c); return e; };
const out = $('out'), note = $('note');
// ---- state, kept in the address so a link holds the league, the day and the open game or team ----
const q = new URLSearchParams(location.search), today = () => S.localDay();
const state = { league: S.leagueOf(q.get('league')) ? q.get('league') : (S.leagueOf(mem.last) ? mem.last : (de ? 'bundesliga' : 'epl')), date: S.dateOk(q.get('date') || '') ? q.get('date') : today(),
  span: q.get('span') === '7' ? 7 : 1, tab: ['scores', 'standings', 'mine', 'pickem', 'whatif', 'draft', 'sports', 'reports'].includes(q.get('tab')) ? q.get('tab') : 'scores', game: /^[\w-]{1,24}$/.test(q.get('game') || '') ? q.get('game') : '', story: /^\d{1,12}$/.test(q.get('story') || '') ? q.get('story') : '', team: /^\d{1,12}$/.test(q.get('team') || '') ? q.get('team') : '', tn: (q.get('tn') || '').slice(0, 60) };
let fmode = 'ppr', timer = 0, token = 0, again = () => {}, sort = { c: -1, up: false };
const needle = () => ($('find').value || '').trim().toLowerCase();
const hit = (g) => !needle() || [g.home && g.home.name, g.away && g.away.name, g.name, g.home && g.home.abbr, g.away && g.away.abbr].some((x) => x && String(x).toLowerCase().includes(needle()));
const url = () => { const p = new URLSearchParams({ league: state.league }); if (state.date !== today()) p.set('date', state.date); if (state.tab !== 'scores') p.set('tab', state.tab); if (state.span === 7) p.set('span', '7'); if (state.game) p.set('game', state.game); if (state.story && state.tab === 'reports') p.set('story', state.story); if (state.team) { p.set('team', state.team); p.set('tn', state.tn); } return '/scores/?' + p; };
const push = () => { try { history.replaceState(null, '', url()); } catch (_) {} };
const say = (t, bad) => { note.textContent = t || ''; note.classList.toggle('bad', !!bad); };
// ---- data: the API, the last good answer kept on the device ----
const api = async (p, early) => {
  const qs = new URLSearchParams(p).toString(), ck = load(CKEY, {});
  if (early && ck[qs]) early({ j: ck[qs].j, from: ck[qs].t, saved: true }); // the last good copy is on screen at once, with its time, while the feed is asked
  try {
    let j; const ea = window.__early; if (ea && ea.qs === qs) { window.__early = null; j = await ea.p; } else j = await (await fetch('/api/scores?' + qs, { headers: { accept: 'application/json' } })).json();
    if (!j.ok) throw new Error(j.kind || 'away');
    ck[qs] = { t: Date.now(), j }; const keys = Object.keys(ck).sort((a, b) => ck[b].t - ck[a].t); for (const k of keys.slice(40)) delete ck[k]; save(CKEY, ck);
    return { j, from: j.stale ? Date.parse(j.at) : 0 };
  } catch (_) { if (ck[qs]) return { j: ck[qs].j, from: ck[qs].t, saved: true }; return null; }
};
const clock = (t) => new Date(t).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
const dayLabel = (d) => new Date(d + 'T12:00:00').toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' });
// ---- favourites ----
const isFav = (lg, t) => mem.teams.some((x) => x.l === lg && x.i === t.id);
const toggleTeam = (lg, t) => { const i = mem.teams.findIndex((x) => x.l === lg && x.i === t.id); if (i >= 0) mem.teams.splice(i, 1); else if (t.id) mem.teams.push({ l: lg, i: t.id, n: t.name }); save(KEY, mem); };
const favBtn = (lg, t, redraw) => { const on = isFav(lg, t); return h('button', { type: 'button', class: 'star', 'aria-pressed': on ? 'true' : 'false', 'aria-label': (on ? W.unfollow : W.follow) + ' ' + t.name, text: on ? '★' : '☆', onclick: () => { toggleTeam(lg, t); redraw(); } }); };
// ---- drawing ----
const teamLine = (lg, g, side, redraw) => {
  const t = g[side], won = g.state === 'final' && t.winner, lost = g.state === 'final' && g[side === 'home' ? 'away' : 'home'].winner;
  const link = t.id && !t.id.startsWith('ol') && S.leagueOf(lg).kind === 'espn' ? h('a', { class: 'tn', href: '/scores/?league=' + lg + '&team=' + t.id + '&tn=' + encodeURIComponent(t.name), text: t.name, onclick: (e) => { e.preventDefault(); state.team = t.id; state.tn = t.name; state.game = ''; state.tab = 'scores'; run(); } }) : h('span', { class: 'tn', text: t.name });
  return h('div', { class: 'tm' + (won ? ' w' : '') + (lost ? ' l' : '') }, t.id && !t.id.startsWith('ol') ? favBtn(lg, t, redraw) : null, h('span', { class: 'dot', style: t.color ? 'background:#' + t.color : null }), link, h('span', { class: 'sc', text: g.state === 'pre' ? '' : t.score }));
};
const stOf = (g) => g.state === 'live' ? h('div', { class: 'st live', text: W.live + (g.status ? ' ' + g.status : '') }) : g.state === 'final' ? h('div', { class: 'st', text: (g.status && g.status.length <= 10 ? g.status : W.ft) }) : h('div', { class: 'st', text: g.start ? clock(g.start) : '' });
const gameLi = (lg, g, redraw) => {
  if (g.kind === 'race') return h('li', null, stOf(g), h('div', null, h('div', { class: 'tn', text: g.name }), h('div', { class: 'st', style: 'text-align:left', text: g.venue })), h('button', { type: 'button', class: 'gm', text: W.results, onclick: () => { state.game = g.id; run(); } }));
  const fav = isFav(lg, g.home) || isFav(lg, g.away);
  return h('li', { class: fav ? 'fav' : null }, stOf(g), h('div', null, teamLine(lg, g, 'home', redraw), teamLine(lg, g, 'away', redraw)), g.id && !g.id.startsWith('ol') ? h('div', { style: 'display:flex;flex-direction:column;gap:2px' }, h('button', { type: 'button', class: 'gm', text: W.details, onclick: () => { state.game = g.id; run(); } }), g.state !== 'live' ? h('button', { type: 'button', class: 'gm', text: W.story, onclick: () => { state.tab = 'reports'; state.story = g.id; state.game = ''; run(); } }) : null) : h('span'));
};
const gamesList = (lg, games, redraw, byTime) => { const s = games.filter(hit).sort((a, b) => (byTime ? 0 : ((isFav(lg, b.home) || isFav(lg, b.away)) - (isFav(lg, a.home) || isFav(lg, a.away))) || ({ live: 0, pre: 1, final: 2 }[a.state] - { live: 0, pre: 1, final: 2 }[b.state])) || String(a.start).localeCompare(String(b.start))); return h('ul', { class: 'games' }, s.map((g) => gameLi(lg, g, redraw))); };
const setNote = (r) => {
  const bits = [];
  if (!navigator.onLine) bits.push(W.offline.trim());
  if (r && (r.saved || r.from)) bits.push((r.saved ? W.saved : W.stale) + ' ' + clock(r.from) + '.');
  if (r && r.j && r.j.at && !r.saved && !r.from) bits.push(W.updated + ' ' + clock(r.j.at) + '.');
  bits.push(W.delayed); say(bits.join(' '), !!(r && (r.saved || r.from)));
};
const sorry = () => { out.replaceChildren(h('p', { class: 'empty', text: W.failed })); say(W.failed, true); };
const anyLive = (list) => list.some((g) => g.state === 'live');
// the three views
const weekDraw = (lg, games, redraw) => { const days = new Map(); for (const g of games.filter(hit).sort((x, y) => String(x.start).localeCompare(String(y.start)))) { const d = S.localDay(new Date(g.start)); (days.get(d) || days.set(d, []).get(d)).push(g); }
  return [...days].flatMap(([d, list]) => [h('h2', { text: dayLabel(d) }), gamesList(lg, list, redraw, true)]); };
// the league's coming fixtures after the day shown, drawn into the room kept for them (the first view never waits on this)
async function nextGames(tk) {
  const lg = state.league, from = S.shiftDay(state.date, 1), list = $('nextList'), none = $('nextNone'); $('nextH').textContent = W.next;
  const r = await api({ league: lg, date: from, span: 7 }); if (tk !== token) return;
  const games = ((r && r.j.games) || []).filter((g) => g.state === 'pre' && S.localDay(new Date(g.start)) > state.date).sort((a, b) => String(a.start).localeCompare(String(b.start))).slice(0, 4); // four rows of about 99 px fill the 450 px kept for them (measured at 390 px), so nothing below moves
  list.replaceChildren(...games.map((g) => { const li = gameLi(lg, g, () => nextGames(tk)); li.querySelector('.st').append(h('br'), dayLabel(S.localDay(new Date(g.start)))); return li; }));
  none.textContent = W.noNext; none.hidden = games.length > 0; list.hidden = !games.length;
}
async function scoresView(tk) {
  const lg = state.league, week = state.span === 7, from = week ? S.weekStart(state.date, lg) : state.date;
  const paint = (r) => { const games = r.j.games || []; again = () => paint(r); setNote(r);
    const body = !games.filter(hit).length ? [h('p', { class: 'empty', text: W.none })] : week ? weekDraw(lg, games, () => paint(r)) : [gamesList(lg, games, () => paint(r))];
    out.replaceChildren(...body); if (!week && !paint.next) { paint.next = true; nextGames(tk); } if (r.j.revalidating && !paint.again) { paint.again = true; setTimeout(() => { if (tk === token) run(true); }, 2500); } return anyLive(games); };
  const r = await api(week ? { league: lg, date: from, span: 7 } : { league: lg, date: from }, (c) => { if (tk === token) paint(c); }); if (tk !== token) return;
  if (!r) return sorry();
  return paint(r);
}
async function tableView(tk) {
  const lg = state.league, grp = S.leagueOf(lg).grp;
  let form = {}, elo = {}, asked = false;
  const paint = (r) => {
    const groups = r.j.groups || []; again = () => paint(r); setNote(r);
    const hasForm = Object.keys(form).length > 0;
    const bad = groups.flatMap((g) => S.rowIssues(g, grp));
    const draw = () => out.replaceChildren(...(groups.length ? groups.map((g) => { const rows = g.rows.filter((x) => !needle() || x.name.toLowerCase().includes(needle()) || x.abbr.toLowerCase() === needle());
      if (sort.c >= 0 && sort.c < g.cols.length) rows.sort((a, b) => ((parseFloat(String(a.cells[sort.c]).replace('+', '')) || 0) - (parseFloat(String(b.cells[sort.c]).replace('+', '')) || 0)) * (sort.up ? 1 : -1));
      return h('div', null, g.name ? h('h2', { text: g.name }) : null, h('div', { class: 'tbl' }, h('table', { 'data-tab': 'standings' },
        h('thead', null, h('tr', null, h('th', { text: '#' }), h('th', { text: W.team }), g.cols.map((c, ci) => h('th', { 'aria-sort': sort.c === ci ? (sort.up ? 'ascending' : 'descending') : 'none' }, h('button', { type: 'button', class: 'srt', text: c, 'aria-label': 'Sort by ' + c, onclick: () => { sort = { c: ci, up: sort.c === ci ? !sort.up : false }; draw(); } }))), hasForm ? h('th', { text: W.form }) : null, hasForm ? h('th', { text: W.rating, title: W.rating }) : null)),
        h('tbody', null, rows.map((row) => h('tr', { class: isFav(lg, row) ? 'fav' : null }, h('td', { text: String(row.rank), class: row.note ? 'cut' : null, style: row.note && row.note.color ? 'box-shadow: inset 4px 0 0 #' + row.note.color : null, title: row.note ? row.note.text : null }),
          h('td', { class: 'nm' }, row.id && S.leagueOf(lg).kind === 'espn' ? [favBtn(lg, row, draw), h('a', { href: '/scores/?league=' + lg + '&team=' + row.id + '&tn=' + encodeURIComponent(row.name), text: row.name, onclick: (e) => { e.preventDefault(); state.team = row.id; state.tn = row.name; run(); } })] : row.name),
          row.cells.map((c) => h('td', { text: c })), hasForm ? h('td', { class: 'frm' }, (form[row.id] || []).slice().reverse().map((f) => h('span', { class: 'fd ' + f.r, title: f.r + ' ' + f.score + ' ' + f.opp, text: f.r }))) : null, hasForm ? h('td', { text: elo[row.id] ? String(elo[row.id].elo) : '' }) : null)))),
        g.legend && g.legend.length ? h('p', { class: 'note', style: 'min-height:0;margin:6px 8px', text: W.cut + ': ' + g.legend.map((l) => l.text).join(' · ') }) : null));
    }) : [h('p', { class: 'empty', text: W.none })]), ...(bad.length ? [h('p', { class: 'note bad', text: W.badTable + ' ' + bad.slice(0, 4).map((b) => b.name + ' (' + b.why + ')').join('; ') })] : []));
    again = draw; draw();
    if (!asked && S.leagueOf(lg).kind === 'espn' && S.leagueOf(lg).grp === 'soccer') { asked = true; api({ league: lg, view: 'form', date: S.localDay() }).then((f) => { if (f && f.j.form && tk === token) { form = f.j.form; elo = f.j.elo || {}; paint(r); } }); } // the last five results, drawn when they arrive
    return false;
  };
  const r = await api({ league: lg, view: 'standings' }, (c) => { if (tk === token) paint(c); }); if (tk !== token) return;
  if (!r) return sorry();
  return paint(r);
}
async function mineView(tk) {
  const mine = mem.teams, lgs = [...new Set([...mem.leagues, ...mine.map((t) => t.l)])].slice(0, 6);
  if (!lgs.length) { say(W.delayed); out.replaceChildren(h('p', { class: 'empty', text: W.noMine })); return false; }
  const rs = await Promise.all(lgs.map((l) => api({ league: l, date: state.date }))); if (tk !== token) return;
  const parts = []; let live = false, worst = null;
  lgs.forEach((l, i) => {
    const r = rs[i]; if (!r) return; if (r.saved || r.from) worst = r;
    const all = mem.leagues.includes(l), games = (r.j.games || []).filter((g) => all || isFav(l, g.home) || isFav(l, g.away));
    if (!games.length) return; live = live || anyLive(games);
    parts.push(h('div', null, h('h2', { text: S.leagueOf(l)[de ? 'de' : 'name'] }), gamesList(l, games, () => run(true))));
  });
  setNote(worst); out.replaceChildren(...(parts.length ? parts : [h('p', { class: 'empty', text: W.noMineDay })])); return live;
}
// the forecast at the ground, by the venue's town (the weather page looks the name up)
const vwx = (g) => (g && g.city ? h('a', { id: 'vwx', href: '/weather/?place=' + encodeURIComponent(g.city), text: W.vwx }) : null);
async function gameView(tk) {
  const lg = state.league, isF1 = S.leagueOf(lg).kind === 'f1';
  if (isF1) { const r = await api({ league: lg, date: state.date }); if (tk !== token) return; const g = r && (r.j.games || []).find((x) => x.id === state.game); if (!g) return sorry(); setNote(r);
    out.replaceChildren(backBtn(), h('div', { class: 'pane' }, h('h2', { text: g.name, style: 'margin-top:0' }), h('p', { class: 'note', text: g.venue + ' · ' + dayLabel(state.date) + (g.state === 'pre' ? ' · ' + clock(g.start) : '') }),
      g.results.length ? h('div', { class: 'tbl' }, h('table', null, h('thead', null, h('tr', null, h('th', { text: '#' }), h('th', { text: W.driver }), h('th', { text: 'Grid' }), h('th', { text: 'Pts' }), h('th', { text: W.results }))), h('tbody', null, g.results.map((x) => h('tr', null, h('td', { text: x.pos }), h('td', { text: x.driver }), h('td', { text: x.grid }), h('td', { text: x.points }), h('td', { text: x.time })))))) : h('p', { class: 'empty', text: W.none }))); return g.state === 'live'; }
  const r = await api({ league: lg, view: 'game', id: state.game }); if (tk !== token) return;
  if (!r) return sorry(); setNote(r);
  const j = r.j, g = j.game, side = (hs) => (g ? g[hs] : { name: '', score: '' });
  const kids = [backBtn()];
  if (g) kids.push(h('div', { class: 'pane' }, h('div', { class: 'big' }, h('span', { text: side('home').name }), h('b', { text: (side('home').score || '–') + ' : ' + (side('away').score || '–') }), h('span', { text: side('away').name })),
    h('p', { class: 'note', style: 'text-align:center;min-height:0', text: [g.state === 'live' ? W.live + ' ' + g.status : g.state === 'final' ? g.status || W.ft : W.kick + ' ' + (g.start ? clock(g.start) : ''), g.venue].filter(Boolean).join(' · ') })));
  if (g && g.state === 'pre' && g.start) kids.push(h('div', { class: 'row' }, h('button', { type: 'button', text: W.cal, onclick: () => { const f = S.icsOf(g, S.leagueOf(lg)); if (!f) return; const a = h('a', { href: URL.createObjectURL(new Blob([f], { type: 'text/calendar' })), download: 'game.ics' }); document.body.append(a); a.click(); a.remove(); } }),
    // the same game on Verse's own calendar, its time in this device's zone: the calendar opens it as "Add to my calendar" (lib/calendar.js ?e=)
    (() => { let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) {} const e = S.calendarEvent(g, S.leagueOf(lg), tz); return e ? h('a', { id: 'vcal', href: '/calendar/?e=' + e, text: W.vcal }) : null; })(),
    // the same moment on the time page, in each city the visitor keeps there
    (() => { const t = Date.parse(g.start); return Number.isFinite(t) ? h('a', { id: 'vtime', href: '/time/?at=' + encodeURIComponent(new Date(t).toISOString().replace(/\.000Z$/, 'Z')), text: W.vtime }) : null; })(),
    vwx(g)));
  else if (g && g.state === 'live' && g.city) kids.push(h('div', { class: 'row' }, vwx(g)));
  const wp = g && S.winProb(g, S.leagueOf(lg).grp);
  if (wp) { let pts = []; try { pts = JSON.parse(sessionStorage.getItem('a2m.void.scores.wp.' + g.id)) || []; } catch (_) {} pts.push(Math.round(wp.home * 100)); pts = pts.slice(-90); try { sessionStorage.setItem('a2m.void.scores.wp.' + g.id, JSON.stringify(pts)); } catch (_) {}
    const ns = 'http://www.w3.org/2000/svg', sv = document.createElementNS(ns, 'svg'); sv.setAttribute('viewBox', '0 0 100 24'); sv.setAttribute('width', '100%'); sv.setAttribute('height', '40'); sv.setAttribute('role', 'img'); sv.setAttribute('aria-label', 'Home win chance over this visit'); const pl = document.createElementNS(ns, 'polyline'); pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', 'currentColor'); pl.setAttribute('stroke-width', '1.5'); pl.setAttribute('points', pts.map((v, i) => (pts.length < 2 ? 0 : i * 100 / (pts.length - 1)) + ',' + (24 - v * 0.24)).join(' ')); sv.append(pl);
    kids.push(h('div', { class: 'pane' }, h('h2', { text: W.winp, style: 'margin-top:0' }), h('p', { class: 'note', style: 'min-height:0', text: g.home.short + ' ' + Math.round(wp.home * 100) + '%' + (wp.draw ? ' · ' + (de ? 'Remis' : 'Draw') + ' ' + Math.round(wp.draw * 100) + '%' : '') + ' · ' + g.away.short + ' ' + Math.round(wp.away * 100) + '%' }), sv)); }
  const ev = j.events.length ? j.events : (g && g.events) || [];
  if (ev.length) kids.push(h('div', { class: 'pane' }, h('h2', { text: W.events, style: 'margin-top:0' }), h('ul', { class: 'ev' }, ev.map((e) => h('li', null, h('span', { class: 'm', text: e.min }), h('span', { text: (e.kind === 'red' ? '🟥 ' : e.kind === 'yellow' ? '🟨 ' : '⚽ ') + (e.who || e.text) + (e.team ? ' (' + e.team + ')' : '') }))))));
  if (j.last5 && j.last5.length) kids.push(h('div', { class: 'pane' }, h('h2', { text: W.last5, style: 'margin-top:0' }), j.last5.map((t) => h('p', { class: 'note', style: 'min-height:0;margin:2px 0' }, t.team + ' ', t.games.map((x) => h('span', { class: 'fd ' + x.r, title: x.r + ' ' + x.score + ' ' + x.opp, text: x.r }))))));
  if (j.h2h && j.h2h.length) kids.push(h('div', { class: 'pane' }, h('h2', { text: W.h2h, style: 'margin-top:0' }), h('ul', { class: 'ev' }, j.h2h.map((x) => h('li', null, h('span', { class: 'm', text: x.date ? new Date(x.date).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: '2-digit' }) : '' }), h('span', { text: (x.who.trim() ? x.who.trim() + ' ' : '') + x.text }))))));
  if (j.plays && j.plays.length) kids.push(h('div', { class: 'pane' }, h('h2', { text: W.plays, style: 'margin-top:0' }), h('ul', { class: 'ev' }, j.plays.map((x) => h('li', null, h('span', { class: 'm', text: (x.period ? 'P' + x.period + ' ' : '') + x.clock }), h('span', { text: x.text + (x.scoring && x.home !== '' ? ' (' + x.home + '-' + x.away + ')' : ''), style: x.scoring ? 'font-weight:700' : null }))))));
  if (j.stats.length === 2 && j.stats[0].stats.length) { const [a, b] = j.stats, cells = []; a.stats.forEach((s, i) => { const o = b.stats.find((x) => x.label === s.label); if (o) cells.push(h('span', { text: s.value }), h('span', { text: s.label }), h('span', { text: o.value })); });
    kids.push(h('div', { class: 'pane' }, h('h2', { text: W.teamStats + ' · ' + a.team + ' / ' + b.team, style: 'margin-top:0' }), h('div', { class: 'cmp' }, cells))); }
  if (j.lineups.length) kids.push(h('div', { class: 'pane' }, h('h2', { text: W.lineups, style: 'margin-top:0' }), j.lineups.map((l) => h('p', { class: 'note', style: 'min-height:0', text: l.team + ': ' + l.starters.map((p) => (p.n ? p.n + ' ' : '') + p.name).join(', ') }))));
  const nfl = S.leagueOf(lg).grp === 'nfl';
  if (nfl && j.players.length) kids.push(h('div', { class: 'row' }, h('div', { class: 'seg', role: 'group', 'aria-label': 'Fantasy scoring' }, [['ppr', 'PPR'], ['half', 'Half'], ['std', 'Standard']].map(([m, t]) => h('button', { type: 'button', 'aria-pressed': String(fmode === m), text: t, onclick: () => { fmode = m; gameView(tk); } }))), h('span', { class: 'note', style: 'min-height:0;flex:1 1 200px', text: W.fpts })));
  for (const t of j.players) for (const gr of t.groups) if (gr.rows.length) { const fp = nfl && S.fantasyPoints(gr.name, gr.labels, gr.rows[0].stats, fmode) !== null;
    kids.push(h('div', { class: 'pane' }, h('h2', { text: W.box + ' · ' + t.team + ' · ' + gr.name, style: 'margin-top:0' }), h('div', { class: 'tbl' }, h('table', null,
    h('thead', null, h('tr', null, h('th', { text: '' }), h('th', { text: '' }), gr.labels.map((l) => h('th', { text: l })), fp ? h('th', { text: 'FPTS' }) : null)), h('tbody', null, gr.rows.map((p, i) => h('tr', null, h('td', { text: String(i + 1) }), h('td', { text: p.name }), gr.labels.map((_, k) => h('td', { text: p.stats[k] || '' })), fp ? h('td', { text: String(S.fantasyPoints(gr.name, gr.labels, p.stats, fmode)) }) : null))))))); }
  if (g) { const slot = h('div', { style: 'min-height:260px' }); kids.push(slot); let wpPts = []; try { wpPts = JSON.parse(sessionStorage.getItem('a2m.void.scores.wp.' + g.id)) || []; } catch (_) {}
    import('/scores/gfx.js').then((m) => { if (tk === token) slot.replaceChildren(m.pane(h, g, j, S.leagueOf(lg).name, wpPts, g.start ? clock(g.start) : '', say)); }).catch(() => {}); }
  out.replaceChildren(...kids); return !!(g && g.state === 'live');
}
async function teamView(tk) {
  const lg = state.league, r = await api({ league: lg, view: 'team', team: state.team }); if (tk !== token) return;
  if (!r) return sorry(); setNote(r);
  const games = r.j.games || [], last = games.filter((g) => g.state === 'final').slice(-5).reverse(), next = games.filter((g) => g.state !== 'final').slice(0, 5);
  const star = state.team ? favBtn(lg, { id: state.team, name: state.tn || '' }, () => teamView(tk)) : null;
  const dated = (g) => dayLabel(S.localDay(new Date(g.start)));
  let nextList = next; if (!nextList.length) { const wk = await api({ league: lg, date: today(), span: 7 }); if (tk !== token) return; nextList = ((wk && wk.j.games) || []).filter((g) => g.state === 'pre' && (g.home.id === state.team || g.away.id === state.team)).slice(0, 5); }
  const sec = (title, list, none) => [h('h2', { text: title }), list.length ? h('ul', { class: 'games' }, list.map((g) => { const li = gameLi(lg, g, () => teamView(tk)); li.querySelector('.st').append(h('br'), dated(g)); return li; })) : h('p', { class: 'empty', text: none })];
  out.replaceChildren(backBtn(), h('div', { class: 'row' }, star, h('h2', { text: state.tn || W.team, style: 'margin:0' })), ...sec(W.next, nextList, W.noNext), ...sec(W.last, last, W.none));
  return anyLive(games);
}
const backBtn = () => h('div', { class: 'row' }, h('button', { type: 'button', text: '‹ ' + W.back, onclick: () => { if (state.game) state.game = ''; else { state.team = ''; state.tn = ''; } run(); } }));
// ---- the loop ----
async function run(quiet) {
  clearTimeout(timer); const tk = ++token; push();
  const lg = S.leagueOf(state.league); mem.last = state.league; save(KEY, mem);
  document.title = lg.name + ' ' + (state.tab === 'standings' ? W.standings : W.scores) + ' · Verse';
  for (const a of $('leagues').children) { const on = a.getAttribute('href').endsWith('league=' + state.league); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }
  for (const [id, t] of [['tScores', 'scores'], ['tTable', 'standings'], ['tMine', 'mine'], ['tPick', 'pickem'], ['tWhat', 'whatif'], ['tDraft', 'draft'], ['tSports', 'sports'], ['tReports', 'reports']]) $(id).setAttribute('aria-pressed', String(state.tab === t));
  const fl = mem.leagues.includes(state.league); $('favLeague').setAttribute('aria-pressed', String(fl)); $('favLeague').textContent = fl ? W.unfollowLeague : W.followLeague;
  $('nextg').hidden = !(state.tab === 'scores' && !state.team && !state.game && state.span === 1); $('days').hidden = state.tab === 'standings' || state.tab === 'whatif' || state.tab === 'draft' || state.tab === 'sports' || !!state.team;
  $('date').value = state.date; $('vDay').setAttribute('aria-pressed', String(state.span === 1)); $('vWeek').setAttribute('aria-pressed', String(state.span === 7)); $('prev').setAttribute('aria-label', state.span === 7 ? W.prevWeek : 'Previous day'); $('next').setAttribute('aria-label', state.span === 7 ? W.nextWeek : 'Next day'); if (!quiet) { say(W.loading + '…'); }
  let live = false;
  try { live = state.game ? await gameView(tk) : state.team ? await teamView(tk) : state.tab === 'standings' ? await tableView(tk) : state.tab === 'reports' ? await (await import('/scores/reports.js')).view({ S, h, api, state, out, say, setNote, W, lang, clock, run, token: () => token }) : state.tab === 'sports' ? await (await import('/scores/sports.js')).view({ S, h, out, say, W, lang, mem, open: (id) => { state.league = id; state.tab = 'scores'; state.game = ''; state.team = ''; run(); } }) : state.tab === 'pickem' || state.tab === 'whatif' || state.tab === 'draft' ? await (await import('/scores/more.js')).view(state.tab, { S, h, api, state, out, say, setNote, lang, W, clock, token: () => token }) : state.tab === 'mine' ? await mineView(tk) : await scoresView(tk); } catch (e) { console.error('scores', e); sorry(); }
  if (tk === token && live) { timer = setTimeout(() => { if (document.visibilityState === 'visible' && navigator.onLine) run(true); else timer = setTimeout(() => run(true), POLL); }, POLL); say(note.textContent + ' ' + W.refreshing); }
}
// ---- controls ----
for (const a of $('leagues').children) a.addEventListener('click', (e) => { e.preventDefault(); state.league = new URL(a.href).searchParams.get('league'); state.game = ''; state.team = ''; state.tn = ''; if (state.tab === 'mine') state.tab = 'scores'; run(); });
const tab = (t) => () => { state.tab = t; state.story = ''; state.game = ''; state.team = ''; state.tn = ''; run(); };
$('tScores').addEventListener('click', tab('scores')); $('tTable').addEventListener('click', tab('standings')); $('tMine').addEventListener('click', tab('mine')); $('tPick').addEventListener('click', tab('pickem')); $('tWhat').addEventListener('click', tab('whatif')); $('tDraft').addEventListener('click', tab('draft')); $('tSports').addEventListener('click', tab('sports')); $('tReports').addEventListener('click', tab('reports'));
const setSpan = (n) => () => { state.span = n; state.game = ''; state.team = ''; if (state.tab !== 'scores') state.tab = 'scores'; run(); };
$('vDay').addEventListener('click', setSpan(1)); $('vWeek').addEventListener('click', setSpan(7));
const goDay = (d) => { if (S.dateOk(d)) { state.date = d; state.game = ''; state.team = ''; if (state.tab === 'standings') state.tab = 'scores'; run(); } };
$('prev').addEventListener('click', () => goDay(S.shiftDay(state.date, -state.span))); $('next').addEventListener('click', () => goDay(S.shiftDay(state.date, state.span)));
$('dYes').addEventListener('click', () => goDay(S.shiftDay(today(), -1))); $('dToday').addEventListener('click', () => goDay(today())); $('dTom').addEventListener('click', () => goDay(S.shiftDay(today(), 1)));
$('date').addEventListener('change', () => goDay($('date').value));
$('favLeague').addEventListener('click', () => { const i = mem.leagues.indexOf(state.league); if (i >= 0) mem.leagues.splice(i, 1); else mem.leagues.push(state.league); save(KEY, mem); run(true); });
$('find').addEventListener('input', () => again());
$('share').addEventListener('click', async () => { const u = location.origin + url(); try { if (navigator.share) await navigator.share({ title: document.title, url: u }); else { await navigator.clipboard.writeText(u); say(W.copied); } } catch (_) { say(u); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && timer) run(true); });
addEventListener('online', () => run(true));
for (const e of document.querySelectorAll('[data-k]')) if (de && W[e.dataset.k]) e.textContent = W[e.dataset.k];
if (de) { document.documentElement.lang = 'de'; $('sub').textContent = 'Live-Ergebnisse, Spielpläne und Tabellen für Fußball, NBA, NFL, MLB, NHL und Formel 1. Keine Werbung, keine Wetten.'; }
run();
mountRelated($('related'), '/scores/', []);
