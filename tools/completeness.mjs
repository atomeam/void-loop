// Completeness (asked by Adam: "no property or money section" in the property game; "Verse needs to learn to check things it can't think of yet").
// Every game card is read against the basics a player expects from the best version of a game. Each basic is a GENERAL rule: when one game
// was found missing something (no money panel), the miss became a rule that now runs on every game (every game with a currency shows balances).
// Four ways it finds what nobody thought to check:
//   rules       the basics, each one born from a miss (origin says which); a "must" rule fails the check, a "should" rule is filed as a want
//   analogy     a basic most similar games have and this one lacks (cross-skill: what one has that its peers do not)
//   fuzz        every example ask is mutated (case, punctuation, spacing, a typo, filler words): matching must never throw, near misses must stay out
//   expectations  a private, passive study (tools/study-engine.mjs) may add expected features in private memory; only topic counts land here
//   node tools/completeness.mjs [--write]   prints the table; --write regenerates the table in docs/COMPLETENESS.md
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const here = path.dirname(new URL(import.meta.url).pathname), root = path.resolve(here, '..'), skillsDir = path.join(root, 'void-live-deploy', 'skills');

export const RULES = [
  { id: 'rules-help', need: 'must', label: 'how to play is on the card', has: /rulesLine\(|g-rules|class(Name)?\s*=\s*['"][^'"]*rules|howTo|How to play/i, origin: 'every game card must teach itself' },
  { id: 'restart', need: 'must', label: 'new game / play again', has: /New game|Play again|Rematch|newGame|restart|\.again\b|Again|another quiz|Next quiz/i, origin: 'a game with an end must offer another round' },
  { id: 'save-resume', need: 'must', skip: /arcadeCard\(/, label: 'a game in progress survives a reload', has: /stageApi\.save|api\.save\(|\.save\s*&&|localStorage/, origin: 'reloading lost games' },
  { id: 'end-screen', need: 'must', label: 'says who won or how it ended', has: /win|won|draw|tie|game over|Game over/i, origin: 'a game must end clearly' },
  { id: 'turn-status', need: 'should', skip: /arcadeCard\(/, label: 'whose turn / what to do now, announced', has: /aria-live|g-status/, origin: 'screen-reader persona could not tell whose turn it was' },
  // born from the property game miss (2026-10-22): money was a line of text, property only coloured ticks on the board
  { id: 'balance-panel', need: 'must', applies: /\bmoney\b|\bchips\b|\bcoins\b|\bfuel\b|\bbank\b/, label: 'every game with a currency shows each player\'s balance in its own panel', has: /balance|mono-players|chip-count|stack|pot/i, origin: 'property game had no money section' },
  { id: 'inventory-panel', need: 'must', applies: /owned\(|inventory|\bdeeds?\b|Treasury/, label: 'every game where players hold things lists what each holds', has: /holdings|mono-set|g-hand|inventory|your hand|d-panel|Treasury|class(Name)?\s*=\s*['"][^'"]*hand/i, origin: 'property game had no property section' },
  { id: 'score', need: 'should', applies: /\bscore\b|points|\bwins\b/, label: 'a running score is visible', has: /g-score|score|Net worth/i, origin: 'games that keep score must show it' },
  { id: 'undo', need: 'should', only: ['tictactoe', 'connect4', 'othello', 'go', 'chess', 'checkers', 'mancala'], label: 'take back a move (against Verse)', has: /undo|Undo|take back|Take back/, origin: 'board-game players expect a take-back' },
  { id: 'mobile', need: 'should', label: 'fits a phone (no fixed width over 360 px)', test: (src) => !/width:\s*(3[6-9]\d|[4-9]\d\d|\d{4})px(?!\s*,)/.test(src.replace(/min\([^)]*\)/g, '')), origin: 'mobile persona' },
];

export const EXTRA_GAMES = ['pong', 'snake', 'quiz', 'duel'];
// rules Verse learned from mined gaps (tools/expectations.mjs --learn) join the built-in ones, so each miss is checked on every game
const learnedFile = path.join(here, 'completeness-rules.json');
if (fs.existsSync(learnedFile)) for (const r of JSON.parse(fs.readFileSync(learnedFile, 'utf8'))) if (!RULES.some((x) => x.id === r.id)) RULES.push({ ...r, applies: r.applies ? new RegExp(r.applies, 'i') : null, has: new RegExp(r.has, 'i') }); // void-review: ok (the patterns are Verse's own, written by tools/expectations.mjs from its fixed VOCAB, never a visitor's)
export function isGame(src) { return /game-card/.test(src) && /stageKinds/.test(src); }
export function audit(name, src) {
  const rows = [];
  for (const r of RULES) {
    if (r.only && !r.only.includes(name)) continue; // a take-back belongs to placement games, not dice, cards or real time
    if ((r.applies && !r.applies.test(src)) || (r.skip && r.skip.test(src))) continue; // a real-time arcade round is seconds long: nothing to resume
    const ok = r.test ? r.test(src) : r.has.test(src);
    rows.push({ id: r.id, need: r.need, ok, label: r.label });
  }
  return { name, rows, missing: rows.filter((r) => !r.ok) };
}
// cross-skill analogy: a "should" basic that at least half of the other games have but this one lacks
export function analogies(audits) {
  const out = [];
  const ids = [...new Set(audits.flatMap((a) => a.rows.map((r) => r.id)))];
  for (const id of ids) {
    const withIt = audits.filter((a) => a.rows.some((r) => r.id === id && r.ok));
    const applies = audits.filter((a) => a.rows.some((r) => r.id === id));
    if (withIt.length * 2 < applies.length) continue;
    for (const a of applies) if (!withIt.includes(a)) out.push({ game: a.name, id, peers: withIt.slice(0, 3).map((x) => x.name) });
  }
  return out;
}
// fuzz: mutated asks
const typo = (s) => (s.length > 4 ? s.slice(0, 2) + s[3] + s[2] + s.slice(4) : s);
export const mutate = (s) => [s.toUpperCase(), '  ' + s + '  ', s + '!', s + '?', s.replace(/ /g, '  '), 'please ' + s, typo(s), s + ' 🙂', ''];
export function fuzz(skill) {
  const bad = [];
  const m = (t) => { try { return !!skill.match(String(t).toLowerCase().trim(), String(t).trim()); } catch (e) { bad.push({ ask: 'mutation threw: ' + e.message }); return false; } };
  for (const ex of skill.examples || []) for (const t of mutate(ex)) m(t);
  for (const nm of skill.nearMisses || []) if (m(nm)) bad.push({ ask: 'a near miss matched' });
  return bad;
}

export async function loadGames() {
  const out = [];
  const fam = fs.readFileSync(path.join(skillsDir, 'games.js'), 'utf8');
  const names = [...JSON.parse((fam.match(/parts: (\[[^\]]*\])/) || [, '[]'])[1].replace(/'/g, '"')), ...EXTRA_GAMES].filter((n) => !['rack', 'eightball'].includes(n)) // rack is the picker, the eight ball a fortune toy, not games with an end;
  const read = (f) => (fs.existsSync(path.join(skillsDir, f)) ? fs.readFileSync(path.join(skillsDir, f), 'utf8') : '');
  for (const name of names) {
    let src = read(name + '.js'); if (!src) continue;
    // a game's own rules file and the shared frames it imports count as part of it (the frame may give every game its New game button)
    src += read(name + '-rules.js');
    // a frame loaded later with import('./side-card.js') (lib/load-later.js, owner 2026-10-30) is as much the game's as one imported at the top
    for (const m of src.matchAll(/(?:from |import\()'\.\/((?:side-card|game-kit|game-frame)[\w-]*\.js)'/g)) src += read(m[1]);
    out.push({ file: name + '.js', name, src });
  }
  return out;
}
// nothing is ever finished (owner, 2026-10-22): no game is marked done; each keeps a rolling next upgrade
export const ROLLING = ['a stronger, explainable Verse opponent', 'a shareable replay of the last game', 'a daily challenge with a streak count',
  'stats across games kept on this device', 'a guided first game for a new player', 'larger touch targets and a phone-first layout pass',
  'screen-reader announcements for every move', 'a saved card for each finished game'];
export const nextUpgrade = (a) => a.missing.length ? a.missing[0].label : ROLLING[[...a.name].reduce((n, c) => n + c.charCodeAt(0), 0) % ROLLING.length];
export function table(audits) {
  const lines = ['| Game | Missing basics | Next upgrade |', '|---|---|---|'];
  for (const a of audits) lines.push('| ' + a.name + ' | ' + (a.missing.map((r) => r.label + (r.need === 'must' ? ' (must)' : '')).join('; ') || 'none of the listed basics') + ' | ' + nextUpgrade(a) + ' |');
  return lines.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const games = await loadGames(), audits = games.map((g) => audit(g.name, g.src));
  const t = table(audits), an = analogies(audits);
  console.log(t); console.log('\nanalogy gaps: ' + an.length + ' (' + an.map((x) => x.game + ':' + x.id).join(', ') + ')');
  if (process.argv.includes('--write')) {
    const doc = path.join(root, 'docs', 'COMPLETENESS.md'); let d = fs.readFileSync(doc, 'utf8');
    d = d.replace(/<!-- table -->[\s\S]*<!-- \/table -->/, '<!-- table -->\n' + t + '\n<!-- /table -->'); fs.writeFileSync(doc, d);
  }
}
