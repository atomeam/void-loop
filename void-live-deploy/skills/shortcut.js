/**
 * shortcut skill — a contextual shortcut (asked by Verse: "a 'Contextual Shortcut' skill that looks at my current 'time' or 'body and
 * mind' family and suggests one of the new 'everything' services (e.g., suggesting food if it's dinner time)").
 * "what should I do now", "suggest something for right now": it reads the clock on this device (nothing is sent, no place is
 * asked) and offers ONE next thing from the time family (timer, today) or the body and mind family (sleep, breathing, food),
 * and the out-in-the-world services (food and rides): food at meal times, a ride in the commute hours, a wind-down late, a
 * calm break midday. One button runs the suggestion as if typed; "another" shows the next best one. Quiet by design: it never
 * runs anything by itself and it never orders or pays (food and rides only open the services card).
 */
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const ASK = /^(?:(?:hey\s+)?(?:verse|void),?\s+)?(?:please\s+)?(?:what\s+should\s+i\s+do(?:\s+(?:now|next|right\s+now))|what\s+(?:do\s+you\s+suggest|now)(?:\s+for\s+me)?|(?:suggest|give\s+me|show\s+me)\s+(?:me\s+)?(?:something|a\s+shortcut|one\s+thing)(?:\s+(?:for\s+(?:right\s+)?now|to\s+do(?:\s+now)?|for\s+this\s+time))?|(?:a\s+)?(?:contextual\s+)?shortcut|something\s+for\s+right\s+now)$/;
export const shortcutOf = (text) => ASK.test(CLEAN(text));

/** the suggestions for an hour (0-23), best first: { ask, line, family }. Pure. */
export function suggestionsFor(hour) {
  const h = ((Math.floor(Number(hour)) % 24) + 24) % 24, S = [];
  const meal = (ask, line) => S.push({ ask, line, family: 'out in the world' });
  if (h >= 17 && h < 21) meal('food and rides', 'it is dinner time: order food, or get a ride to it');
  else if (h >= 11 && h < 14) meal('food and rides', 'it is lunch time: food delivered, or a ride to somewhere to eat');
  else if (h >= 6 && h < 10) { S.push({ ask: 'recipe for pancakes', line: 'breakfast: a recipe to start the day', family: 'words and the world' }); }
  if ((h >= 7 && h < 10) || (h >= 16 && h < 19)) S.push({ ask: 'get me a ride to the airport', line: 'commute hours: a ride, so you do not have to drive', family: 'out in the world' });
  if (h >= 21 || h < 5) S.push({ ask: 'when should i wake up if i go to sleep now', line: 'it is late: when to wake so you are rested', family: 'body and mind' });
  if (h >= 21 || h < 5) S.push({ ask: 'box breathing', line: 'winding down: a minute of slow breathing', family: 'body and mind' });
  if (h >= 14 && h < 17) S.push({ ask: 'box breathing', line: 'mid-afternoon: a calm minute before the last stretch', family: 'body and mind' });
  S.push({ ask: 'set a timer for 25 minutes', line: 'one focused block, timed', family: 'time' });
  S.push({ ask: 'my calendar', line: 'what is next on your calendar', family: 'time' });
  return S;
}

function run(text, api) {
  const { showPage, esc } = api, hour = new Date().getHours(), list = suggestionsFor(hour);
  let i = 0;
  showPage((el) => {
    const draw = () => {
      const s = list[i % list.length];
      el.innerHTML = '<h2>Right now</h2><div class="sub">it is ' + esc(String(hour).padStart(2, '0') + ':' + String(new Date().getMinutes()).padStart(2, '0')) + ' on this device · from ' + esc(s.family) + '</div>'
        + '<p data-shortcut-line>' + esc(s.line) + '</p><p><button type="button" data-shortcut-go>' + esc(s.ask) + '</button> <button type="button" data-shortcut-next>another</button></p>'
        + '<div class="src">Your clock only; nothing is sent, ordered or paid · the button asks it as if you typed it</div>';
      el.querySelector('[data-shortcut-go]').addEventListener('click', () => { const t = s.ask; if (api.stage && api.stage.ask) api.stage.ask(t); });
      el.querySelector('[data-shortcut-next]').addEventListener('click', () => { i++; draw(); });
    };
    draw();
  });
  return 'shortcut';
}

export default {
  name: 'shortcut',
  examples: ['what should I do now', 'suggest something for right now', 'give me a shortcut', 'what should I do next'],
  nearMisses: ['what should I do about my taxes', 'keyboard shortcut for copy', 'shortcut to the airport'],
  match(lower, text) { return shortcutOf(text || lower); },
  shortcutOf,
  suggestionsFor,
  run,
};
