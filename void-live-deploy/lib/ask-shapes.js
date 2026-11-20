// Asks that have a shape but no fixed words ("weather in <any place>", "<any dish> recipe"). skills/first.json knows an ask only word for word,
// so on a phone, where the skill files wait for the first tap, "weather in Lakeland Florida" had to wait for every skill ranked above the
// weather one to arrive, answered "I could not find it" first and drew the right card only a long while later. A shape names the one skill file
// that takes the whole family, so the page loads that file at once, the same way it does for a known ask.
// tools/ask-shapes.test.mjs proves, with the real skills, that no skill ranked above the named file takes any ask of these shapes.
import { snailOf } from './snail-card.js'; // 'show me a snail' and its kin: the figure skill's free 3D snail card
const PLACE = "[a-z][a-z .,'-]{1,48}";
const DISH = "[a-z][a-z' -]{1,48}";
export const SHAPES = [
  { file: 'time', re: new RegExp(`^(?:(?:what(?:'s|s| is)|how(?:'s| is)) )?(?:the )?(?:weather|forecast|temperature) (?:in|for|at|near) ${PLACE}\\??$`) },
  { file: 'time', re: new RegExp(`^${PLACE} (?:weather|forecast)\\??$`) },
  { file: 'recipe', re: new RegExp(`^(?:(?:give|show|get) me |find |i want |i need )?(?:a |an |the )?recipes? (?:for|of) ${DISH}$`) },
  { file: 'recipe', re: new RegExp(`^${DISH} recipes?$`) },
  { file: 'recipe', re: new RegExp(`^how (?:do i|to|can i) (?:make|cook|bake) ${DISH}$`) },
];
/** the skill file that takes every ask of this shape, or '' . `lower` is the ask lowercased with its spaces collapsed. Pure. */
export function shapeFile(lower) {
  const t = String(lower || '').trim();
  if (!t || t.length > 90) return '';
  for (const s of SHAPES) if (s.re.test(t)) return s.file;
  if (snailOf(t)) return 'figure'; // on a phone the first ask came before skills/first.json: the snail ask answered from the model instead of the card
  return '';
}
