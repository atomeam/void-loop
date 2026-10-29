// The scores page's heavier tabs (loaded only when one is opened, after the first view has drawn): the weekly Pick'em with a confidence mode and a
// tiebreaker, a Survivor tracker (no team twice), and the What-if table (tap an upcoming game, the table moves). Everything is kept on this device
// (a2m.void.scores.picks.v1, a2m.void.scores.survivor.v1); nothing is sent, no account, no wagering. Pure parts live in lib/scores.js.
const PK = 'a2m.void.scores.picks.v1', SV = 'a2m.void.scores.survivor.v1';
const load = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (_) { return {}; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
const L = { en: { pick: 'Pick the winner of each game. Nothing is bet: this is for bragging rights only.', straight: 'Straight', conf: 'Confidence', tb: 'Tiebreaker: total points or goals in the last game', score: 'Right', pts: 'points', share: 'Share my picks', copied: 'Link copied', mine: 'Use these picks', shared: 'Picks shared with you', draw: 'Draw', surv: 'Survivor: one team a week, never the same twice, a loss or a draw is out', choose: 'Choose a team', alive: 'Still alive', out: 'Out', open: 'Waiting for the game', used: 'Already used', none: 'No games this week.', pickNow: 'Pick for this week', reset: 'Reset', wi: 'Tap the result of an upcoming game; the table recalculates. Goals are not guessed: ties on points keep their current goal difference.', moved: 'places moved', games: 'Upcoming games' },
  de: { pick: 'Tippe den Sieger jedes Spiels. Es wird nichts gewettet: nur für die Ehre.', straight: 'Einfach', conf: 'Sicherheit', tb: 'Tiebreaker: Tore oder Punkte im letzten Spiel', score: 'Richtig', pts: 'Punkte', share: 'Meine Tipps teilen', copied: 'Link kopiert', mine: 'Diese Tipps übernehmen', shared: 'Mit dir geteilte Tipps', draw: 'Unentschieden', surv: 'Survivor: ein Team pro Woche, nie zweimal dasselbe, Niederlage oder Remis scheidet aus', choose: 'Team wählen', alive: 'Noch dabei', out: 'Ausgeschieden', open: 'Warte auf das Spiel', used: 'Schon benutzt', none: 'Keine Spiele diese Woche.', pickNow: 'Tipp für diese Woche', reset: 'Zurücksetzen', wi: 'Tippe das Ergebnis eines kommenden Spiels; die Tabelle rechnet neu. Tore werden nicht geraten: bei Punktgleichheit bleibt die aktuelle Tordifferenz.', moved: 'Plätze verschoben', games: 'Kommende Spiele' } };
const play = (g) => g && !g.kind && g.home && g.away;

/** draw one of the tabs into c.out; returns false (nothing live to poll). c: { S, h, api, state, out, say, setNote, lang, run, W, token } */
export async function view(kind, c) {
  if (kind === 'draft') return draftView(c);
  const { S, h, state, out } = c, T = L[/^de\b/i.test(c.lang) ? 'de' : 'en'], lg = S.leagueOf(state.league), tk = c.token();
  const start = S.weekStart(state.date, state.league), grp = lg.grp;
  if (lg.kind !== 'espn') { out.replaceChildren(h('p', { class: 'empty', text: T.none })); return false; }
  const wk = await c.api({ league: state.league, date: start, span: 7 }); if (tk !== c.token()) return false;
  if (!wk) { out.replaceChildren(h('p', { class: 'empty', text: c.W.failed })); c.say(c.W.failed, true); return false; }
  c.setNote(wk);
  const games = (wk.j.games || []).filter(play).sort((a, b) => String(a.start).localeCompare(String(b.start)));
  if (kind === 'pickem') return pickem(c, T, games, start);
  return whatif(c, T, start);
}

function pickem(c, T, games, start) {
  const { S, h, state, out } = c, lg = S.leagueOf(state.league), grp = lg.grp, key = state.league + ':' + start, store = load(PK), card = store[key] || (store[key] = { p: {}, c: {}, tb: '', mode: 'straight' });
  const q = new URLSearchParams(location.search), shared = q.get('pk');
  const sharedPicks = shared && /^[hda-]{1,40}$/.test(shared) ? Object.fromEntries(games.map((g, i) => [g.id, shared[i]]).filter(([, v]) => v && v !== '-')) : null;
  const draw = () => {
    save(PK, store); const sc = S.scorePicks(games, card.p, card.mode === 'conf' ? card.c : {}), kids = [h('p', { class: 'note', style: 'min-height:0', text: T.pick })];
    if (sharedPicks) kids.push(h('div', { class: 'row' }, h('span', { class: 'note', style: 'min-height:0', text: T.shared + ': ' + Object.keys(sharedPicks).length }), h('button', { type: 'button', text: T.mine, onclick: () => { card.p = { ...sharedPicks }; q.delete('pk'); try { history.replaceState(null, '', location.pathname + '?' + q); } catch (_) {} draw(); } })));
    kids.push(h('div', { class: 'row' }, h('div', { class: 'seg', role: 'group', 'aria-label': 'Mode' }, ['straight', 'conf'].map((m) => h('button', { type: 'button', 'aria-pressed': String(card.mode === m), text: T[m], onclick: () => { card.mode = m; if (m === 'conf') games.forEach((g, i) => { if (!card.c[g.id]) card.c[g.id] = i + 1; }); draw(); } })))));
    if (!games.length) kids.push(h('p', { class: 'empty', text: T.none }));
    const ul = h('ul', { class: 'games' });
    games.forEach((g) => {
      const mk = (v, label) => h('button', { type: 'button', 'aria-pressed': String(card.p[g.id] === v), text: label, onclick: () => { if (g.state !== 'pre') return; card.p[g.id] = card.p[g.id] === v ? undefined : v; if (!card.p[g.id]) delete card.p[g.id]; draw(); } });
      const res = g.state === 'final' ? (+g.home.score > +g.away.score ? 'h' : +g.home.score < +g.away.score ? 'a' : 'd') : '';
      ul.append(h('li', null, h('div', { class: 'st', text: g.state === 'final' ? g.status || 'FT' : g.state === 'live' ? c.W.live : c.clock(g.start) }), h('div', { class: 'row', style: 'margin:0' }, mk('h', g.home.short || g.home.name), grp === 'soccer' ? mk('d', T.draw) : null, mk('a', g.away.short || g.away.name)),
        card.mode === 'conf' ? h('label', { class: 'note', style: 'min-height:0' }, h('span', { class: 'vh', text: 'Confidence for ' + g.home.name }), h('input', { type: 'number', min: 1, max: games.length, value: card.c[g.id] || 1, style: 'width:3.2em;min-height:36px', onchange: (e) => { const n = Math.max(1, Math.min(games.length, parseInt(e.target.value, 10) || 1)); const other = Object.keys(card.c).find((k) => k !== g.id && card.c[k] === n); if (other) card.c[other] = card.c[g.id] || 1; card.c[g.id] = n; draw(); } })) : h('span', { class: 'note', style: 'min-height:0', text: res && card.p[g.id] ? (card.p[g.id] === res ? '✓' : '✗') : '' })));
    });
    kids.push(ul);
    kids.push(h('div', { class: 'row' }, h('label', { class: 'note', style: 'min-height:0', for: 'tb', text: T.tb + ' ' }), h('input', { id: 'tb', type: 'number', min: 0, max: 400, value: card.tb, style: 'width:5em;min-height:40px', onchange: (e) => { card.tb = e.target.value.slice(0, 3); save(PK, store); } })));
    kids.push(h('p', { class: 'note', style: 'min-height:0', text: T.score + ' ' + sc.right + '/' + sc.played + (card.mode === 'conf' ? ' · ' + sc.points + '/' + sc.total + ' ' + T.pts : '') }));
    kids.push(h('div', { class: 'row' }, h('button', { type: 'button', text: T.share, onclick: async () => { const code = games.map((g) => card.p[g.id] || '-').join(''), u = location.origin + '/scores/?' + new URLSearchParams({ league: state.league, date: start, tab: 'pickem', pk: code.slice(0, 40) }); try { if (navigator.share) await navigator.share({ url: u, title: document.title }); else { await navigator.clipboard.writeText(u); c.say(T.copied); } } catch (_) { c.say(u); } } })));
    kids.push(survivor(c, T, games, start, draw)); out.replaceChildren(...kids);
  };
  draw(); return false;
}
function survivor(c, T, games, start, redraw) {
  const { S, h, state } = c, all = load(SV), mine = all[state.league] || (all[state.league] = {}), teams = [...new Map(games.flatMap((g) => [g.home, g.away]).map((t) => [t.id, t])).values()];
  const used = Object.entries(mine).filter(([w]) => w !== start).map(([, t]) => t), box = h('div', { class: 'pane' }, h('h2', { text: T.surv, style: 'margin-top:0' }));
  const weeks = { [start]: games }, st = S.survivorState(mine, weeks), label = st.status === 'out' ? T.out + (st.why ? ' (' + st.why + ')' : '') : st.status === 'open' ? T.open : T.alive;
  box.append(h('p', { class: 'note', style: 'min-height:0', text: label }),
    h('div', { class: 'row' }, h('label', { class: 'vh', for: 'sv', text: T.choose }), h('select', { id: 'sv', style: 'font:inherit;min-height:40px;border-radius:10px;padding:4px 8px', onchange: (e) => { if (e.target.value) mine[start] = e.target.value; else delete mine[start]; save(SV, all); redraw(); } },
      h('option', { value: '', text: T.pickNow }), teams.map((t) => h('option', { value: t.id, text: t.name + (used.includes(t.id) ? ' (' + T.used + ')' : ''), disabled: used.includes(t.id) ? true : null, selected: mine[start] === t.id ? true : null })))));
  return box;
}
async function whatif(c, T, start) {
  const { S, h, state, out } = c, lg = S.leagueOf(state.league), tk = c.token();
  const [tb, next] = await Promise.all([c.api({ league: state.league, view: 'standings' }), c.api({ league: state.league, date: S.shiftDay(start, 7), span: 7 })]); if (tk !== c.token()) return false;
  const cur = await c.api({ league: state.league, date: start, span: 7 }); if (tk !== c.token()) return false;
  if (!tb || !cur) { out.replaceChildren(h('p', { class: 'empty', text: c.W.failed })); return false; }
  const upcoming = [...(cur.j.games || []), ...((next && next.j.games) || [])].filter((g, i, all) => play(g) && g.state === 'pre' && all.findIndex((x) => x.id === g.id) === i).sort((a, b) => String(a.start).localeCompare(String(b.start))).slice(0, 24), picks = {};
  const draw = () => {
    const groups = (tb.j.groups || []).map((g) => S.simulate(g, upcoming, picks, lg.grp)), kids = [h('p', { class: 'note', style: 'min-height:0', text: T.wi }), h('h2', { text: T.games })];
    if (!upcoming.length) kids.push(h('p', { class: 'empty', text: T.none }));
    const ul = h('ul', { class: 'games' });
    for (const g of upcoming) { const mk = (v, label) => h('button', { type: 'button', 'aria-pressed': String(picks[g.id] === v), text: label, onclick: () => { if (picks[g.id] === v) delete picks[g.id]; else picks[g.id] = v; draw(); } }); ul.append(h('li', null, h('div', { class: 'st', text: c.clock(g.start) }), h('div', { class: 'row', style: 'margin:0' }, mk('h', g.home.short || g.home.name), lg.grp === 'soccer' ? mk('d', T.draw) : null, mk('a', g.away.short || g.away.name)), h('span'))); }
    kids.push(ul, h('div', { class: 'row' }, h('button', { type: 'button', text: T.reset, onclick: () => { for (const k of Object.keys(picks)) delete picks[k]; draw(); } })));
    for (const g of groups) kids.push(h('div', null, g.name ? h('h2', { text: g.name }) : null, h('div', { class: 'tbl' }, h('table', { 'data-tab': 'whatif' }, h('thead', null, h('tr', null, h('th', { text: '#' }), h('th', { text: c.W.team }), g.cols.map((x) => h('th', { text: x })))),
      h('tbody', null, g.rows.map((r) => h('tr', { class: r.moved ? 'fav' : null }, h('td', { text: String(r.rank) }), h('td', { class: 'nm', text: r.name + (r.moved ? (r.moved > 0 ? ' ▲' + r.moved : ' ▼' + -r.moved) : '') }), r.cells.map((x) => h('td', { text: x }))))))))); 
    out.replaceChildren(...kids);
  };
  draw(); return false;
}

// ---- the mock draft: a snake draft against bots, from a ranked list you paste (there is no free projection or ADP feed to read, so none is claimed) ----
const DK = 'a2m.void.scores.draft.v1';
function draftView(c) {
  const { S, h, out } = c, store = load(DK), cfg = store.cfg || (store.cfg = { teams: 10, rounds: 6, slot: 1, list: '' }), de = /^de\b/i.test(c.lang);
  const T = de ? { intro: 'Füge eine Rangliste ein (beste zuerst, eine pro Zeile). Die Bots wählen meist den Besten. Es gibt keine kostenlose ADP-Quelle: die Liste ist deine.', teams: 'Teams', rounds: 'Runden', slot: 'Dein Platz', start: 'Draft starten', pick: 'Am Zug', yours: 'Dein Team', left: 'Verfügbar', done: 'Draft beendet', again: 'Neu starten' } : { intro: 'Paste a ranked list (best first, one a line). Bots usually take the best left. There is no free ADP feed to read, so the list is yours.', teams: 'Teams', rounds: 'Rounds', slot: 'Your slot', start: 'Start the draft', pick: 'On the clock', yours: 'Your team', left: 'Available', done: 'Draft finished', again: 'Start again' };
  let run = null;
  const num = (id, label, min, max) => h('label', { class: 'note', style: 'min-height:0;display:flex;gap:6px;align-items:center' }, label, h('input', { id, type: 'number', min, max, value: cfg[id.slice(2)], style: 'width:4em;min-height:40px', onchange: (e) => { cfg[id.slice(2)] = Math.max(min, Math.min(max, parseInt(e.target.value, 10) || min)); save(DK, store); } }));
  const setup = () => { out.replaceChildren(h('p', { class: 'note', style: 'min-height:0', text: T.intro }), h('label', { class: 'vh', for: 'dlist', text: 'Players' }), h('textarea', { id: 'dlist', rows: 8, maxlength: 12000, placeholder: '1. Player One\n2. Player Two', style: 'width:100%;box-sizing:border-box;font:inherit;font-size:16px;border:1px solid var(--line);border-radius:10px;padding:8px;background:var(--box);color:inherit', oninput: (e) => { cfg.list = e.target.value; save(DK, store); } }, cfg.list),
    h('div', { class: 'row' }, num('dnteams', T.teams, 2, 16), num('dnrounds', T.rounds, 1, 20), num('dnslot', T.slot, 1, 16), h('button', { type: 'button', class: 'go', text: T.start, onclick: begin }))); const ta = out.querySelector('textarea'); if (ta) ta.value = cfg.list; };
  const begin = () => { const pool = S.playersOf(cfg.list), teams = cfg.teams, order = S.draftOrder(teams, Math.min(cfg.rounds, Math.max(1, Math.floor(pool.length / teams)))); if (pool.length < teams) { c.say('Paste at least ' + teams + ' players.', true); return; } run = { pool, order, i: 0, teams: Array.from({ length: teams }, () => []), me: Math.min(cfg.slot, teams) - 1 }; step(); };
  const step = () => { while (run.i < run.order.length && run.order[run.i].team !== run.me) { const k = S.botPick(run.pool, Math.random()); run.teams[run.order[run.i].team].push(run.pool.splice(k, 1)[0]); run.i++; } show(); };
  const show = () => { const fin = run.i >= run.order.length, o = run.order[run.i];
    out.replaceChildren(h('p', { class: 'note', style: 'min-height:0', text: fin ? T.done : T.pick + ': round ' + o.round + ', pick ' + o.pick }),
      h('div', { class: 'pane' }, h('h2', { text: T.yours, style: 'margin-top:0' }), h('ol', { class: 'ev' }, run.teams[run.me].map((n) => h('li', null, h('span', { text: n }))))),
      fin ? null : h('div', { class: 'pane' }, h('h2', { text: T.left, style: 'margin-top:0' }), h('ul', { class: 'games' }, run.pool.slice(0, 12).map((n, i) => h('li', { style: 'grid-template-columns:1fr auto' }, h('span', { text: n }), h('button', { type: 'button', class: 'gm', text: 'Pick', 'aria-label': 'Pick ' + n, onclick: () => { run.teams[run.me].push(run.pool.splice(i, 1)[0]); run.i++; step(); } }))))),
      h('div', { class: 'row' }, h('button', { type: 'button', text: T.again, onclick: setup }))); };
  setup(); return false;
}
