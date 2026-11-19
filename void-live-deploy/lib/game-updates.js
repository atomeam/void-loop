// The game-update book. data/game-updates.json already records Debris Field and Gap Glide Update 1; this reads that shape.
// A lap updates the next round (lowest fun, and every round still comes up). When every round has an update this cycle, the lap
// makes one new original game. It stays hidden until its fun is at least Debris Field's, then it is listed and stays in the walk.
export const BOOK = 'data/game-updates.json';
export const PUBLIC_BOOK = 'void-live-deploy/scoreboard/game-updates.json';
export const BAR_ID = 'debris-field';
export const emptyBook = () => ({ cursor: 0, picks: {}, scores: {}, shown: [], bar: BAR_ID, born: [], cycle: 1, log: [] });
export const PARTS = ['danger', 'goal', 'boss', 'juice', 'phone', 'fair', 'end', 'fun', 'polish'];
export const GAPS = ['danger', 'goal', 'boss', 'juice', 'phone', 'end'];
export const GAP_WORDS = { danger: 'real danger', goal: 'a goal that progresses', boss: 'a boss or climax', juice: 'juice', phone: 'thumb controls', end: 'a clear end screen' };
const R = (id, title, lane, ask, play) => ({ id, title, lane, ask, play, file: 'void-live-deploy/skills/' + id + '-rules.js' });
export const CATALOG = [
  R('debris-field', 'Debris Field', 'arcade', 'debris field', 'arcade'), R('gap-glide', 'Gap Glide', 'arcade', 'gap glide', 'arcade'),
  R('null-waves', 'Null Waves', 'hidden', 'null waves', 'harness'), R('cross-bus', 'Cross the Bus', 'hidden', 'cross the bus', 'harness'),
  R('packet-maze', 'Packet Maze', 'hidden', 'packet maze', 'harness'), R('jump-stack', 'Jump Stack', 'hidden', 'jump stack', 'harness'),
  R('stackwell', 'Stackwell', 'hidden', 'stackwell', 'harness'), R('push-packets', 'Push Packets', 'hidden', 'push packets', 'harness'),
  R('nine-grid', 'Nine Grid', 'hidden', 'nine grid', 'harness'), R('glyph-verse', 'Glyph Verse', 'hidden', 'glyph verse', 'harness'),
  R('three-alike', 'Three Alike', 'hidden', 'three alike', 'harness'), R('token-stand', 'Token Stand', 'hidden', 'token stand', 'harness'),
  R('pong', 'Verse Pong', 'arcade', 'play pong', 'stage'), R('snake', 'Verse Snake', 'arcade', 'play snake', 'stage'),
  R('null-sweep', 'Null Sweep', 'studio', 'null sweep', 'stage'), R('merge-void', 'Merge Verse', 'studio', 'merge verse', 'stage'),
  R('dim-void', 'Dim the Verse', 'studio', 'dim the verse', 'stage'), R('void-breaker', 'Verse Breaker', 'studio', 'verse breaker', 'stage'),
];
// A new game's own words. Commercial titles are refused here, in the tool, and never written onto a page.
const CLONE = /\b(tetris|pac-?man|super mario|zelda|pokemon|minecraft|fortnite|flappy bird|space invaders|asteroids|breakout|candy crush|among us|call of duty)\b/i;
export const gamesOf = (book, catalog = CATALOG) => {
  const born = (book && book.born || []).filter((g) => g && g.id && !catalog.some((c) => c.id === g.id)).map((g) => ({ ...g, lane: 'hidden', play: g.play || 'harness' }));
  return [...catalog, ...born];
};
export const cycleOf = (book) => (book && book.cycle) || 1;
export const funOf = (book, id) => { const s = book && book.scores && book.scores[id]; return s && Number.isFinite(+s.fun) ? +s.fun : 0; };
export function had(book, id) {
  const s = book && book.scores && book.scores[id];
  if (!s || !(+s.update > 0)) return false;
  return cycleOf(book) === 1 || s.cycle === cycleOf(book);
}
const weight = (fun, picks) => (1 + Math.max(0, 100 - fun)) / ((picks || 0) + 1);
/** The next open round, lowest fun first, walking the list so a high one still comes up. Pure. */
export function pickGame(open, book = {}) {
  const picks = book.picks || {}, n = open.length, cursor = ((book.cursor || 0) % n + n) % n;
  let best = -1, index = 0;
  for (let i = 0; i < n; i++) { const idx = (cursor + i) % n, rank = weight(funOf(book, open[idx].id), picks[open[idx].id]); if (rank > best) { best = rank; index = idx; } }
  return { game: open[index], nextCursor: (index + 1) % n };
}
export function nextTask(book, catalog = CATALOG) {
  const open = gamesOf(book, catalog).filter((g) => !had(book, g.id));
  if (!open.length) return { kind: 'invent', cycle: cycleOf(book) };
  const pick = pickGame(open, book), n = ((book.scores && book.scores[pick.game.id] && +book.scores[pick.game.id].update) || 0) + 1;
  return { kind: 'game', ...pick, update: n, title: 'Game update: ' + pick.game.title + ', Update ' + n, text: promptFor(pick.game, n, book.scores && book.scores[pick.game.id] && book.scores[pick.game.id].parts) };
}
export const readWhatsNew = (source, n) => { const m = /export const whatsNew = '([^'\n]{12,180})'/.exec(String(source || '')); return m && m[1].trim().startsWith('Update ' + n + ':') ? m[1].trim() : ''; };
/** the lowest of the six play marks, or null when the review did not score them. Pure. */
export function gapOf(parts) {
  let best = null, key = '';
  for (const k of GAPS) {
    if (!parts || !Number.isFinite(+parts[k])) continue;
    const n = Math.max(0, Math.min(10, Math.round(+parts[k])));
    if (best == null || n < best) { best = n; key = k; }
  }
  return key ? { key, n: best, words: GAP_WORDS[key] } : null;
}
export const promptFor = (game, n, parts) => {
  const gap = gapOf(parts);
  const aim = gap
    ? 'The last review scored ' + gap.words + ' lowest, ' + gap.n + ' of 10. Raise that part. Do not ship a tiny tweak.'
    : 'There is no review yet. Add the one the screen lacks: real danger, a goal that progresses, a boss or climax, juice, thumb controls, or a clear end screen. Do not ship a tiny tweak.';
  return ['Ship Update ' + n + ' of ' + game.title + ' (' + game.id + ', ' + game.lane + '). Edit only ' + game.file + '.', "Add export const whatsNew = 'Update " + n + ": <one plain sentence about that part>'. Draw that sentence on the title and the end.", aim, 'Keep the rules. Do not edit the update book or a workflow.'].join('\n');
};
/** Record Debris Field's fun as the public bar and list every hidden game that already clears it. The update number stays. Pure. */
export function withBar(book, fun, parts) {
  const base = { ...emptyBook(), ...(book || {}) }, scores = { ...base.scores }, prev = { ...(scores[BAR_ID] || {}) };
  const marks = {};
  for (const k of PARTS) if (parts && Number.isFinite(+parts[k])) marks[k] = Math.max(0, Math.min(10, Math.round(+parts[k])));
  const n = Math.round(+fun);
  scores[BAR_ID] = { ...prev, fun: n, ...(Object.keys(marks).length ? { parts: marks } : {}) };
  const shown = new Set(base.shown || []);
  if (n > 0) for (const g of gamesOf({ ...base, scores })) if (g.lane === 'hidden' && funOf({ scores }, g.id) >= n) shown.add(g.id);
  return { ...base, scores, shown: [...shown] };
}
export const inventPrompt = () => ['Make one new original game. Write void-live-deploy/skills/<id>-rules.js only.', "export const id = '<id>'; export const title = '<Original Name>'; export const whatsNew = 'Update 1: <one plain sentence>'; export function create, tick, and draw; export const W and H.", 'An original idea: a goal, something that can go wrong, an ending, and controls a thumb can use. Do not name or copy a commercial game. Do not edit the update book.'].join('\n');
export function bornFrom(source, file, known) {
  const id = (String(source).match(/export const id = '([a-z][a-z0-9-]{2,30})'/) || [])[1];
  const title = (String(source).match(/export const title = '([^'\n]{3,40})'/) || [])[1];
  const note = readWhatsNew(source, 1);
  if (!id || !title || !note) return { why: 'the new game needs id, title, and Update 1' };
  if (!String(file).endsWith('/' + id + '-rules.js')) return { why: 'the file name has to be ' + id + '-rules.js' };
  if (known && known.has(id)) return { why: id + ' already exists' };
  if (CLONE.test(title + '\n' + source)) return { why: 'the words name a commercial game' };
  return { game: { id, title, lane: 'hidden', play: 'harness', ask: title.toLowerCase(), file: 'void-live-deploy/skills/' + id + '-rules.js' }, note };
}
export function scoreFrom(parts) { let s = 0; for (const k of PARTS) s += Math.max(0, Math.min(10, Math.round(+((parts && parts[k]) || 0)))); return Math.round(s * 100 / (PARTS.length * 10)); }
export function decide({ before = null, score = null, broken = '', attempt = 1, hold = false } = {}) {
  if (broken) return { ship: false, retry: attempt < 2, why: broken };
  const after = hold ? (before == null ? 50 : before) : score;
  if (after == null || !Number.isFinite(+after)) return { ship: false, retry: attempt < 2, why: 'the play had no score' };
  if (before != null && after < before) return { ship: false, retry: attempt < 2, why: 'the score dropped from ' + before + ' to ' + after };
  return { ship: true, retry: false, score: after, why: 'score ' + after + (hold ? ', the model was quiet and the play stayed clean' : '') };
}
/** Fold one result into the book. Debris Field and Gap Glide keep the notes they already have. Pure. */
export function applyUpdate(book, game, { fun = null, note = '', at = '', cents = 0, paid = false, provider = '', dropped = false, cursor = 0, born = false, video = '', parts = null } = {}) {
  const base = { cursor: 0, picks: {}, scores: {}, shown: [], bar: BAR_ID, born: [], cycle: 1, log: [], ...(book || {}) };
  const n = dropped ? null : ((base.scores[game.id] && +base.scores[game.id].update) || 0) + 1;
  const scores = { ...base.scores }, prev = scores[game.id] || {};
  const clip = String(video || '').slice(0, 180);
  const marks = {};
  for (const k of PARTS) if (parts && Number.isFinite(+parts[k])) marks[k] = Math.max(0, Math.min(10, Math.round(+parts[k])));
  if (!dropped) scores[game.id] = { ...prev, update: n, note: note || prev.note || '', why: 'shipped', fun: fun == null ? prev.fun : fun, cents: Math.round(((+prev.cents || 0) + (+cents || 0)) * 10000) / 10000, paid: !!(paid || prev.paid), cycle: cycleOf(base), video: clip || prev.video || '', ...(Object.keys(marks).length ? { parts: { ...(prev.parts || {}), ...marks } } : {}) };
  const barFun = funOf({ scores }, base.bar || BAR_ID), shown = new Set(base.shown || []);
  if (!dropped && game.lane === 'hidden' && barFun > 0 && fun != null && fun >= barFun) shown.add(game.id);
  const bornList = born && !dropped ? [...(base.born || []), { id: game.id, title: game.title, file: game.file, ask: game.ask, play: 'harness' }] : (base.born || []);
  const log = [...(base.log || []), { at, id: game.id, title: game.title, n, note, fun: dropped ? null : fun, cents: +cents || 0, paid: !!paid, provider: provider || '', video: clip, dropped: !!dropped, born: !!born }].slice(-200);
  return { ...base, picks: { ...base.picks, [game.id]: (base.picks[game.id] || 0) + (dropped ? 0 : 1) }, scores, shown: [...shown], born: bornList, cursor, cycle: born && !dropped ? cycleOf(base) + 1 : cycleOf(base), log };
}
export const livePages = (names) => (names || []).some((f) => f === BOOK || f === PUBLIC_BOOK || /skills\/[a-z0-9-]+-rules\.js$/.test(f)) ? ['/arcade/', '/scoreboard/'] : [];
