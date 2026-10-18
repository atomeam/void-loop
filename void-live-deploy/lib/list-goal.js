/**
 * list-goal — a goal (or threshold) on a list, and how dense the list is against it. Asked by Void (2026-10-18): "Create a
 * 'density-indicator' for the lists that count, showing at a glance how close a list is to a specific threshold or goal."
 * goalOf(text) reads what an ask sets: { goal: n } for "set a goal of 10 on the list", "goal: 10 items", "aim for 5 on my
 * shopping list", "the list is full at 8" (a threshold is a goal), { clear: true } for "clear the goal", and null for anything
 * else ("set a goal to run 5k", "my goals", "set a 10 minute timer", "add 10 items to the list" are not a list goal: an ask
 * must name the list, or be the bare "goal: N" form). density(count, goal) is what the card draws: the filled share (0 to 1),
 * the state (under, near = within one of the goal, met = at or past it) and the label "7 of 10". The count is every item on
 * the list, done or not. Pure; no DOM, nothing kept here (the goal lives on the list thing, skills/list.js).
 */

const LIST = "(?:the\\s+|my\\s+|this\\s+|our\\s+)?(?:[a-z][a-z-]*\\s+)?list(?:'s)?";
const WORD = '(?:goal|target|threshold)';
const N = '(\\d{1,4})(?:\\s+items?)?';
const SET = [
  // "set a goal of 10 on the list", "put the goal at 8 for my shopping list", "set the list goal to 10"
  new RegExp('^(?:please\\s+)?(?:set|put|make)\\s+(?:a\\s+|the\\s+)?(?:list(?:\'s)?\\s+)?' + WORD + '\\s+(?:of\\s+|to\\s+|at\\s+)?' + N + '\\s+(?:on|for)\\s+' + LIST + '$'),
  new RegExp('^(?:please\\s+)?(?:set|put|make)\\s+' + LIST + '\\s+' + WORD + '\\s+(?:of\\s+|to\\s+|at\\s+)?' + N + '$'),
  // "goal: 10 items", "list goal: 10", "threshold: 8"
  new RegExp('^(?:list\\s+)?' + WORD + '\\s*:\\s*' + N + '$'),
  // "aim for 5 on my shopping list"
  new RegExp('^(?:please\\s+)?aim\\s+for\\s+' + N + '\\s+(?:on|for)\\s+' + LIST + '$'),
  // "the list is full at 8", "my shopping list is full at 12 items"
  new RegExp('^' + LIST + '\\s+is\\s+(?:full|done|complete)\\s+at\\s+' + N + '$'),
  // "list goal 10", "the list threshold is 8", "list target = 6"
  new RegExp('^' + LIST + '\\s+' + WORD + '\\s*(?::|of|is|=)?\\s*' + N + '$'),
];
const CLEAR = [
  new RegExp('^(?:please\\s+)?(?:clear|remove|drop|unset|forget|delete)\\s+(?:the\\s+|my\\s+)?(?:list(?:\'s)?\\s+)?' + WORD + '(?:\\s+(?:on|from|for|of)\\s+' + LIST + ')?$'),
  new RegExp('^no\\s+(?:list\\s+)?' + WORD + '$'),
];

const tidy = (text) => String(text || '').toLowerCase().replace(/\s+/g, ' ').replace(/[\s.!?]+$/g, '').trim();

/** what an ask sets on the list: { goal: n } | { clear: true } | null. Pure. */
export function goalOf(text) {
  const t = tidy(text);
  if (!t) return null;
  if (CLEAR.some((re) => re.test(t))) return { clear: true };
  for (const re of SET) {
    const m = re.exec(t);
    if (m) { const n = parseInt(m[1], 10); return n > 0 ? { goal: n } : null; }
  }
  return null;
}

/** how dense a list of `count` items is against `goal`: { ratio, state, label }, or null when there is no goal. Pure. */
export function density(count, goal) {
  const g = Math.floor(Number(goal) || 0), c = Math.max(0, Math.floor(Number(count) || 0));
  if (g <= 0) return null;
  const ratio = Math.min(1, c / g);
  const state = c >= g ? 'met' : g - c <= 1 ? 'near' : 'under';
  return { ratio, state, label: c + ' of ' + g };
}
