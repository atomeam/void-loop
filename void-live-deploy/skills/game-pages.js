/**
 * game-pages skill - made with tools/new-skill.mjs (docs/UPGRADING.md); owner, 2026-10-26: the games floor of Versus (Lichess) and the small game sites in
 * front of it, each with a page of its own. "sudoku", "solitaire", "word guess game", "chess puzzles", "chess analysis board" answer with a card that opens the
 * page that plays it (lib/game-sites.js gameAskOf, the same ask the tool pages' ask bar routes). "play chess", "checkers", "minesweeper" and "2048" stay with
 * the game cards that play them on the stage (skills/chess.js, checkers.js, null-sweep.js, merge-void.js), whose own pages are linked from here too.
 * Nothing is made here. Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { GAME_SITES, gameAskOf } from '../lib/game-sites.js';
const MINE = ['/games/sudoku/', '/games/solitaire/', '/games/word/', '/chess/?mode=puzzle', '/chess/?mode=analysis', '/chess/?mode=two', '/games/'];
const pageOf = (lower) => { const to = gameAskOf(String(lower || '').trim()); return MINE.includes(to) && !/^games$/i.test(String(lower || '').trim()) ? to : ''; }; // plain "games" stays with the Game Box
function run(text, api) {
  const { showPage, esc } = api, to = pageOf(String(text || '').toLowerCase()) || '/games/', row = GAME_SITES.find((r) => r.path === to.replace(/\?.*$/, '')) || GAME_SITES[1];
  showPage((el) => {
    el.dataset.page = row.path;
    el.innerHTML = '<h2>' + esc(row.name) + '</h2><img src="/og/' + esc(row.path.replace(/^\/|\/$/g, '').replace(/\//g, '-')) + '.png" alt="' + esc(row.name) + ' on Verse: ' + esc(row.tag || '') + '" width="1200" height="630" style="width:100%;height:auto;border-radius:10px"><p>' + esc(row.intro) + '</p>' // void-review: ok: text from the fixed table, escaped; the page's own share picture names the game
      + '<p><a href="' + esc(to) + '" style="font-weight:600">Play it on its page →</a></p><ul style="padding-left:18px;margin:6px 0">'
      + GAME_SITES.filter((r) => r.path !== row.path).map((r) => '<li><a href="' + esc(r.path) + '">' + esc(r.short || r.name) + '</a></li>').join('') + '</ul>' // void-review: ok: fixed table, escaped
      + '<div class="src">Made by Verse · no account, no ads, offline</div>';
  });
  return 'game-pages';
}
export default {
  name: 'game-pages',
  examples: ['sudoku', 'solitaire', 'word guess game', 'chess puzzles', 'chess analysis board'],
  nearMisses: ['play chess', 'minesweeper', 'play 2048', 'play checkers', 'games'],
  match(lower) { return !!pageOf(lower); },
  run,
};
