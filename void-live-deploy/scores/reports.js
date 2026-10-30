// "Verse reports" tab (loaded when it is opened): the day's top stories, a game's recap or preview, the league brief and the weekly roundup, from /api/report (written by Verse
// from the score feeds' data, template first, the model's wording only when it checks out against the data), each with the picture Verse draws from the same data.
// Every piece says "Written by Verse from ESPN data" and when. No odds, no injuries, no quotes.
import * as G from '/lib/matchgfx.js';
import { box } from '/scores/gfx.js';
import { dailyArtImg, dailyArtInfo, mountCredit } from '/lib/daily-art.js';

/** draw the tab into c.out. c: { S, h, api, state, out, say, setNote, W, lang, clock, run, token } */
export async function view(c) {
  const { S, h, state, out } = c, tk = c.token(), lg = S.leagueOf(state.league), de = /^de\b/i.test(c.lang);
  const T = de ? { top: 'Top-Geschichten', brief: 'Liga-Überblick', week: 'Wochenrückblick', back: 'Zurück', none: 'Keine Geschichten für diesen Tag.', away: 'Die Geschichte ist gerade nicht erreichbar.', note: 'Die Texte schreibt Verse aus den Daten der Ergebnisquellen (auf Englisch); ein Entwurf nach Vorlage steht immer bereit.', tmpl: 'nach Vorlage geschrieben', pol: 'Wortlaut vom Verse-Modell, gegen die Daten geprüft' }
    : { top: 'Top stories', brief: 'League brief', week: 'Weekly roundup', back: 'Back', none: 'No stories for this day.', away: 'The story is not reachable just now.', note: 'Written by Verse from the score feeds\' data: a template draft first, the model\'s wording only when every number and name in it is in the data.', tmpl: 'written from a template', pol: "wording polished by Verse's model, checked against the data" };
  if (lg.kind !== 'espn') { out.replaceChildren(h('p', { class: 'empty', text: T.none })); return false; }
  // the day's picture for a league or a game (lib/daily-art.js): a CC-licensed photo of the teams or venue when one is found, else Verse's own illustration; its box is sized before
  // the picture arrives (CLS 0), a picture that fails to load is dropped, and every picture carries its true credit line
  const art = (o = {}) => { const a = dailyArtImg('sports', state.league, { day: state.date, photo: true, ...o }); if (!a.src) return null;
    const credit = h('p', { class: 'note', style: 'min-height:0;margin:4px 0 0' }), fig = h('figure', { style: 'margin:0 0 10px' }, h('img', { src: a.src, width: a.width, height: a.height, alt: a.alt, style: a.style, loading: 'lazy', decoding: 'async' }), credit);
    fig.querySelector('img').addEventListener('error', () => fig.remove()); dailyArtInfo('sports', state.league, { day: state.date, photo: true, ...o }).then((i) => { if (i) mountCredit(credit, i); else fig.remove(); }).catch(() => fig.remove()); return fig; };
  const get = async (q) => { const j = await (await fetch('/api/report?' + new URLSearchParams({ league: state.league, ...q }))).json().catch(() => null); return j && j.ok ? j : null; };
  const story = (j, extra = [], pic = null) => h('div', { class: 'pane' }, pic, h('h2', { text: j.headline, style: 'margin-top:0' }), h('p', { text: j.body, style: 'margin:0 0 8px' }), h('p', { class: 'note', style: 'min-height:0', text: j.label + ' · ' + (j.polished ? T.pol : T.tmpl) }), ...extra);
  const date = state.date, wkStart = S.weekStart(date, state.league);
  if (state.story) {
    const day = await c.api({ league: state.league, date }); if (tk !== c.token()) return false;
    const g = day && (day.j.games || []).find((x) => x.id === state.story), kind = g ? (g.state === 'final' ? 'recap' : 'preview') : 'recap', j = await get({ kind, id: state.story }); if (tk !== c.token()) return false;
    const back = h('div', { class: 'row' }, h('button', { type: 'button', text: '‹ ' + T.back, onclick: () => { state.story = ''; c.run(); } }));
    if (!j) { out.replaceChildren(back, h('p', { class: 'empty', text: T.away })); return false; }
    const pics = g ? [box(h, G.scoreCard(g, lg.name, 'ESPN', g.start ? c.clock(g.start) : ''), 'verse-story-' + g.id, c.say)].concat(g.events && g.events.length ? [box(h, G.timeline(g), 'verse-timeline-' + g.id, c.say)] : []) : [];
    out.replaceChildren(back, story(j, pics, g ? art({ q: [g.home.name, g.away.name, g.venue].filter(Boolean).join(' '), date: S.localDay(new Date(g.start || date)) }) : art({ q: lg.name }))); c.setNote({ j: day ? day.j : {} }); return false;
  }
  const [top, brief, week, day] = await Promise.all([get({ kind: 'top', date }), get({ kind: 'brief', date }), get({ kind: 'week', date: wkStart }), c.api({ league: state.league, date })]); if (tk !== c.token()) return false;
  const kids = [h('p', { class: 'note', style: 'min-height:0', text: T.note })];
  kids.push(h('h2', { text: T.top }));
  kids.push(top && top.stories.length ? h('ul', { class: 'games' }, top.stories.map((s) => h('li', { style: 'grid-template-columns:56px minmax(0,1fr)' }, h('div', { class: 'st' + (s.state === 'live' ? ' live' : ''), text: s.state === 'live' ? c.W.live : s.state === 'final' ? c.W.ft : c.clock(s.start) }), h('button', { type: 'button', style: 'text-align:left;border-radius:10px;min-height:44px;width:100%', text: s.headline, onclick: () => { state.story = s.id; c.run(); } })))) : h('p', { class: 'empty', text: T.none }));
  if (day && (day.j.games || []).length) kids.push(h('h2', { text: lg.name }), box(h, G.collage(day.j.games, lg.name, date, 'ESPN'), 'verse-' + state.league + '-' + date, c.say));
  if (brief) kids.push(story(brief, [], art({ q: lg.name }))); if (week) kids.push(story(week, [], art({ q: lg.name + ' week', day: wkStart })));
  out.replaceChildren(...kids); c.setNote({ j: top || {} }); return false;
}
