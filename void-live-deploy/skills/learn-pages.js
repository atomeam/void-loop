/**
 * learn-pages skill - made with tools/new-skill.mjs (docs/UPGRADING.md); owner, 2026-10-26: "the objective is to literally go through every site". "periodic table",
 * "times tables", "typing practice", "flashcards", "fraction calculator", "vocabulary quiz", "math practice" answer with a card that opens the learning page that does
 * it (lib/learn-sites.js learnAskOf, the same ask the tool pages' ask bar routes). "quiz me" stays with the quiz card (skills/quiz.js) and "flashcards: a = b" with
 * the study cards (skills/study-cards.js). Nothing is made here. Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { learnAskOf } from '../lib/learn-sites.js';
const PAGES = [['/learn/', 'Learn maths', '25 skills, hints, worked solutions, mastery, spaced review'], ['/learn/fractions/', 'Fraction calculator', 'every step shown'], ['/learn/times/', 'Times tables', 'practice, a speed test, a facts grid'],
  ['/learn/cards/', 'Flashcards', 'spaced repetition, games, a share link'], ['/learn/typing/', 'Typing tutor', 'lessons that open letters as you get fast'], ['/learn/periodic/', 'Periodic table', 'all 118 elements, a symbol quiz'], ['/learn/vocab/', 'Vocabulary quiz', 'a level that rises with you']];
function run(text, api) {
  const { showPage, esc } = api, to = learnAskOf(String(text || '').trim()) || '/learn/', page = PAGES.find((p) => p[0] === to) || PAGES[0];
  showPage((el) => {
    el.dataset.page = to;
    el.innerHTML = '<h2>' + esc(page[1]) + '</h2><p>' + esc(page[2]) + '. Everything runs on your device and your progress stays in this browser; no account.</p>' // void-review: ok: fixed text, escaped
      + '<p><a href="' + esc(to) + '" style="font-weight:600">Open the page →</a></p><ul style="padding-left:18px;margin:6px 0">' + PAGES.filter((p) => p[0] !== to).map(([h, n, d]) => '<li><a href="' + h + '">' + esc(n) + '</a>: ' + esc(d) + '</li>').join('') + '</ul>' // void-review: ok: fixed text and escaped
      + '<div class="src">Made by Verse · exercises generated on your device · element weights: IUPAC</div>';
  });
  return 'learn-pages';
}
export default {
  name: 'learn-pages',
  examples: ['periodic table', 'times tables', 'typing practice', 'flashcards', 'fraction calculator', 'vocabulary quiz', 'math practice'],
  nearMisses: ['quiz me', 'flashcards: hola = hello', 'what is 3/4 + 1/6', 'periodic table of my life', 'times'],
  match(lower) { return !!learnAskOf(String(lower || '').trim()); },
  run,
};
