// "Verse reports" (void-live-deploy/scores/reports.js, functions/api/report.js): short game stories written from the data /api/scores already holds, never from anything else.
// Two steps, both pure here: (1) a template draft built straight from the facts (always available, no model), (2) a validator that decides whether a model's polished wording
// may replace it: every number, every name and every score in the polished text has to be in the facts, and nothing about odds, injuries, rumours or quoted people may appear.
// A polished text that fails is thrown away and the draft is shown. Nothing here fetches.
import { readScoreboard } from './scores.js';

const clean = (v, n = 80) => (v == null ? '' : String(v)).replace(/[\u0000-\u001f\u007f<>"“”]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th');
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** 'Sunday 25 May' for an ISO start or day (the UTC calendar day; the page shows kick-off times in the reader's own zone). Pure. */
export function dayWords(iso) { const d = new Date(String(iso).length === 10 ? iso + 'T12:00:00Z' : iso); return Number.isFinite(+d) ? DAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] : ''; }

/** the table rows as { teamId: { rank, points, played, name } }, from a readStandings group list (soccer reads its points column, the rest their wins). Pure. */
export function tableIndex(groups) {
  const out = {};
  for (const g of groups || []) for (const r of g.rows || []) { const i = (c) => g.cols.indexOf(c); out[r.id] = { rank: r.rank, name: r.name, points: i('Pts') >= 0 ? r.cells[i('Pts')] : '', record: i('W') >= 0 && i('L') >= 0 ? r.cells[i('W')] + '-' + r.cells[i('L')] : '', group: g.name }; }
  return out;
}

/** the facts of one game's story: only fields the feed gave. kind: 'recap' | 'preview'. Pure. */
export function gameFacts(kind, league, summary, table = {}) {
  const g = summary && summary.game; if (!g) return null;
  const scorers = (summary.events && summary.events.length ? summary.events : g.events || []).filter((e) => e.kind === 'goal' || e.kind === 'pen' || e.kind === 'owngoal').slice(0, 8).map((e) => ({ min: clean(e.min, 10), who: clean(e.who || e.text, 40), team: clean(e.team, 40), kind: e.kind }));
  const reds = (summary.events || []).filter((e) => e.kind === 'red').slice(0, 3).map((e) => ({ min: clean(e.min, 10), text: clean(e.text, 80), team: clean(e.team, 40) }));
  const stat = (label) => { const [a, b] = summary.stats || []; if (!a || !b) return null; const x = a.stats.find((s) => s.label === label), y = b.stats.find((s) => s.label === label); return x && y ? { label, home: x.value, away: y.value } : null; };
  const th = table[g.home.id], ta = table[g.away.id];
  const f = { kind, league: clean(league, 40), state: g.state, day: dayWords(g.start), venue: clean(g.venue, 60), home: clean(g.home.name, 40), away: clean(g.away.name, 40), hs: g.home.score, as: g.away.score, status: clean(g.status, 12),
    scorers, reds, stats: ['Possession', 'Shots', 'Shots on Goal', 'Total Shots'].map(stat).filter(Boolean).slice(0, 2),
    form: (summary.last5 || []).map((t) => ({ team: clean(t.team, 12), results: t.games.map((x) => x.r).join(' ') })).slice(0, 2),
    meetings: (summary.h2h || []).slice(0, 1).map((x) => ({ date: clean(x.date, 10), who: clean(x.who, 70), score: clean(x.text, 12) })),
    table: { home: th ? { rank: th.rank, points: th.points, record: th.record } : null, away: ta ? { rank: ta.rank, points: ta.points, record: ta.record } : null } };
  if (th && ta && /^\d+$/.test(String(th.points)) && /^\d+$/.test(String(ta.points))) f.table.gap = Math.abs(+th.points - +ta.points);
  return f;
}
const goalLine = (s) => s.who + (s.min ? ' (' + s.min + ')' : '') + (s.kind === 'pen' ? ' from the spot' : s.kind === 'owngoal' ? ' with an own goal' : '');
/** the template draft of a recap: { headline, body }. Pure. */
export function draftRecap(f) {
  const h = +f.hs, a = +f.as, win = h > a ? f.home : a > h ? f.away : null, lose = h > a ? f.away : f.home, hi = Math.max(h, a), lo = Math.min(h, a);
  const headline = win ? win + ' beat ' + lose + ' ' + hi + '-' + lo : f.home + ' and ' + f.away + ' draw ' + h + '-' + a;
  const s = [win ? win + ' beat ' + lose + ' ' + hi + '-' + lo + (f.venue ? ' at ' + f.venue : '') + ' in the ' + f.league + '.' : f.home + ' and ' + f.away + ' drew ' + h + '-' + a + (f.venue ? ' at ' + f.venue : '') + ' in the ' + f.league + '.'];
  if (f.scorers.length) s.push('The goals: ' + f.scorers.map(goalLine).join(', ') + '.');
  if (f.reds.length) s.push(f.reds.map((r) => (r.text || 'A red card') + (r.team ? ' for ' + r.team : '') + (r.min ? ' (' + r.min + ')' : '')).join('; ') + '.');
  const p = f.stats.find((x) => x.label === 'Possession'), sh = f.stats.find((x) => /Shots/.test(x.label));
  if (p || sh) s.push([p ? f.home + ' had ' + p.home + '% of the ball to ' + f.away + "'s " + p.away + '%' : '', sh ? (p ? ' and ' : f.home + ' had ') + sh.home + ' shots to ' + sh.away : ''].join('') + '.');
  const t = f.table; if (t.home && t.away && s.length < 4) s.push(f.home + ' are ' + ord(t.home.rank) + (t.home.points ? ' on ' + t.home.points + ' points' : '') + ' and ' + f.away + ' ' + ord(t.away.rank) + (t.away.points ? ' on ' + t.away.points : '') + ' in the table.');
  return { headline, body: s.slice(0, 4).join(' ') };
}
/** the template draft of a preview. Pure. */
export function draftPreview(f) {
  const headline = f.home + ' host ' + f.away;
  const s = [f.home + ' host ' + f.away + (f.day ? ' on ' + f.day : '') + (f.venue ? ' at ' + f.venue : '') + ' in the ' + f.league + '.'];
  const t = f.table; if (t.home && t.away) s.push(f.home + ' are ' + ord(t.home.rank) + (t.home.points ? ' on ' + t.home.points + ' points' : t.home.record ? ' at ' + t.home.record : '') + ', ' + f.away + ' ' + ord(t.away.rank) + (t.away.points ? ' on ' + t.away.points : t.away.record ? ' at ' + t.away.record : '') + (t.gap != null ? ': ' + (t.gap === 0 ? 'level on points' : t.gap + (t.gap === 1 ? ' point' : ' points') + ' apart') : '') + '.');
  if (f.form.length) s.push('Recent form, latest first: ' + f.form.map((x) => x.team + ' ' + x.results).join('; ') + '.');
  if (f.meetings.length) s.push('Last meeting: ' + f.meetings[0].who + ' ' + f.meetings[0].score + '.');
  return { headline, body: s.slice(0, 4).join(' ') };
}
/** the facts and draft of a league's day: finished games, live games, what is next. Pure. */
export function briefFacts(league, day, games, next = [], table = {}) {
  const fin = games.filter((g) => g.state === 'final' && g.home.score !== '').map((g) => ({ home: clean(g.home.name, 40), away: clean(g.away.name, 40), hs: g.home.score, as: g.away.score, margin: Math.abs(+g.home.score - +g.away.score), total: +g.home.score + +g.away.score }));
  const top = Object.values(table).sort((a, b) => a.rank - b.rank).slice(0, 3).map((r) => ({ rank: r.rank, name: clean(r.name, 40), points: r.points, record: r.record }));
  return { kind: 'brief', league: clean(league, 40), day: dayWords(day), played: fin.length, results: fin.slice(0, 8), biggest: fin.slice().sort((a, b) => b.margin - a.margin)[0] || null, live: games.filter((g) => g.state === 'live').length, upcoming: games.filter((g) => g.state === 'pre').length,
    next: next.slice(0, 4).map((g) => ({ home: clean(g.home.name, 40), away: clean(g.away.name, 40), day: dayWords(g.start) })), top };
}
export function draftBrief(f) {
  const headline = f.league + ' brief for ' + f.day;
  if (!f.played && !f.live && !f.upcoming) return { headline, body: 'No ' + f.league + ' games are listed for ' + f.day + '.' + (f.next.length ? ' Next up: ' + f.next.map((g) => g.home + ' v ' + g.away + ' (' + g.day + ')').join('; ') + '.' : '') };
  const s = [];
  if (f.played) s.push(f.played + (f.played === 1 ? ' game finished' : ' games finished') + ' on ' + f.day + ': ' + f.results.slice(0, 5).map((r) => r.home + ' ' + r.hs + '-' + r.as + ' ' + r.away).join('; ') + '.');
  if (f.biggest && f.biggest.margin >= 2) s.push('The widest margin: ' + f.biggest.home + ' ' + f.biggest.hs + '-' + f.biggest.as + ' ' + f.biggest.away + '.');
  if (f.live) s.push(f.live + (f.live === 1 ? ' game is live now.' : ' games are live now.'));
  if (f.top.length) s.push('Top of the table: ' + f.top.map((r) => ord(r.rank) + ' ' + r.name + (r.points ? ' (' + r.points + ' points)' : r.record ? ' (' + r.record + ')' : '')).join(', ') + '.');
  if (f.next.length) s.push('Coming up: ' + f.next.map((g) => g.home + ' v ' + g.away + ' (' + g.day + ')').join('; ') + '.');
  return { headline, body: s.slice(0, 4).join(' ') };
}
/** the weekly roundup's facts and draft, from the week's scoreboard. Pure. */
export function weekFacts(league, start, games) {
  const fin = games.filter((g) => g.state === 'final' && g.home.score !== ''), goals = fin.reduce((n, g) => n + (+g.home.score) + (+g.away.score), 0);
  const big = fin.slice().sort((a, b) => Math.abs(b.home.score - b.away.score) - Math.abs(a.home.score - a.away.score))[0];
  return { kind: 'week', league: clean(league, 40), from: dayWords(start), played: fin.length, total: goals, biggest: big ? { home: clean(big.home.name, 40), away: clean(big.away.name, 40), hs: big.home.score, as: big.away.score } : null, draws: fin.filter((g) => g.home.score === g.away.score).length };
}
export function draftWeek(f) {
  const headline = f.league + ': the week from ' + f.from;
  if (!f.played) return { headline, body: 'No finished ' + f.league + ' games are listed for the week from ' + f.from + ' yet.' };
  const s = [f.played + (f.played === 1 ? ' game was' : ' games were') + ' played in the ' + f.league + ' in the week from ' + f.from + ', with ' + f.total + ' scored in all.'];
  if (f.biggest) s.push('The biggest result: ' + f.biggest.home + ' ' + f.biggest.hs + '-' + f.biggest.as + ' ' + f.biggest.away + '.');
  if (f.draws) s.push(f.draws + (f.draws === 1 ? ' game ended level.' : ' games ended level.'));
  return { headline, body: s.join(' ') };
}
/** headlines from a day's scoreboard alone (no summary needed): final -> the recap headline, upcoming -> the preview headline, live -> "X v Y live". Pure. */
export function topStories(games) {
  const rank = { live: 0, final: 1, pre: 2 };
  return games.filter((g) => g.id && !String(g.id).startsWith('ol') && g.home.score !== undefined).map((g) => {
    const h = +g.home.score, a = +g.away.score;
    const headline = g.state === 'final' ? (h > a ? g.home.name + ' beat ' + g.away.name + ' ' + h + '-' + a : a > h ? g.away.name + ' beat ' + g.home.name + ' ' + a + '-' + h : g.home.name + ' and ' + g.away.name + ' draw ' + h + '-' + a)
      : g.state === 'live' ? g.home.name + ' ' + h + '-' + a + ' ' + g.away.name + ', live' : g.home.name + ' host ' + g.away.name;
    return { id: g.id, state: g.state, headline: clean(headline, 120), start: g.start, margin: Math.abs(h - a) || 0 };
  }).sort((x, y) => rank[x.state] - rank[y.state] || y.margin - x.margin).slice(0, 12);
}

// ---- the validator ----
const WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, hundred: 100 };
const BANNED = /\b(?:odds?|bet|bets|betting|wager\w*|gambl\w*|bookmaker\w*|injur\w*|rumou?rs?|reportedly|sources? say|sacked|transfer\w*)\b|["“”]/i;
// the capitalised words a story may use that are not in the facts: sentence openers and plain connectives, nothing that names a person, team or place
const STOP = new Set('recent coming top the a an in on at of to for and but or as with by from after before while when they their it its his her both each all two this that these those there here despite although then still now up down off over into out than so yet also only more most last next first second third just not no one they\'ll he she we our us who whom which what where why how if is are was were be been has have had do does did will would can could may might must should'.split(' '));
const numbersIn = (t) => [...String(t).matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0].replace(',', '.')).concat([...String(t).toLowerCase().matchAll(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|hundred)\b/g)].map((m) => String(WORDS[m[1]])));
/** the set of numbers, and of lower-case words, a text built from these facts may use. Pure. */
export function allowedOf(facts) {
  const s = JSON.stringify(facts), nums = new Set(numbersIn(s).map((n) => String(parseFloat(n)))), words = new Set([...s.toLowerCase().matchAll(/[\p{L}][\p{L}'’-]*/gu)].map((m) => m[0]));
  for (const k of ['0', '1']) nums.add(k); // "a point", "one" as a plain article-like word is allowed; every other number must be in the facts
  return { nums, words };
}
/** does this wording stick to the facts? Every number must be one of the facts' numbers, every capitalised word one of the facts' words (or a plain connective), and
 *  nothing banned (odds, injuries, rumours, quotes). Returns { ok, why }. Pure. */
export function validate(text, facts) {
  const t = String(text || '').trim(); if (t.length < 20 || t.length > 900) return { ok: false, why: 'length' };
  if (BANNED.test(t)) return { ok: false, why: 'banned wording' };
  const { nums, words } = allowedOf(facts);
  for (const n of numbersIn(t)) if (!nums.has(String(parseFloat(n)))) return { ok: false, why: 'a number not in the facts: ' + n };
  for (const m of t.matchAll(/(?<![\p{L}'’])[A-ZÀ-ÞŁŚŻ][\p{L}'’-]*/gu)) { const w = m[0].toLowerCase().replace(/['’]s$/, ''); if (!words.has(w) && !words.has(m[0].toLowerCase()) && !STOP.has(w)) return { ok: false, why: 'a name not in the facts: ' + m[0] }; }
  return { ok: true, why: '' };
}
/** the polish request's messages: the facts and the draft, and the rules that keep the wording to them. Pure. */
export function polishMessages(facts, draft) {
  return [{ role: 'system', content: "You are Verse's sports desk. Rewrite the DRAFT into a lively report of two to four sentences. Use only the names, numbers and facts in FACTS: add nothing, guess nothing, no quotes from anyone, no betting, odds, injuries or rumours, no mention of a reporter. Reply with the report text only." },
    { role: 'user', content: 'FACTS: ' + JSON.stringify(facts) + '\nDRAFT: ' + draft.body } ];
}
export const LABEL = (source, at) => 'Written by Verse from ' + source + ' data · ' + at;
export { readScoreboard };
