// Did the wanted ability answer? The bench (tools/bench.mjs) and anything else reading the page's own loop log ask this one
// question. A want is a regex alternative on the log's note: "skill:weather" names the skill; a plain "timer", "list" or "calc"
// names the ability, whichever code answered it. The page's own parser used to log "timer"; the skill it moved out to
// (cleanup step 6, skills/timer.js) logs "skill:timer", and both are the timer answering. Until 2026-10-16 the prefix made
// 20 first-session asks read as misses on main, and the growth card called the timer, list and calc failing when they were not.
// Pure.
export function isRouted(want, note) {
  const w = String(want || '').trim();
  if (!w) return false;
  const re = new RegExp('^(?:' + w + ')');
  const n = String(note || '');
  return re.test(n) || (n.startsWith('skill:') && re.test(n.slice(6)));
}
