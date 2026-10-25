/**
 * wheel skill: "spin the wheel", "wheel of names", "spin a wheel with pizza, tacos and sushi" (owner, 2026-10-24: "find the site to conquer and
 * get to work now"). With choices in the ask, the card answers at once with a fair winner (lib/wheel.js: the browser's cryptographic random
 * numbers, weights kept) and links to the full wheel to spin it; without, it opens the wheel to type names into. The wheel is /wheel/.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { askWheel, pickIndex, fairRandom, pack } from '../lib/wheel.js';
import { bandMini } from '../lib/card-mini.js';

function run(text, api) {
  const { showPage, esc } = api, q = askWheel(text); if (!q) return null;
  const e = q.entries, href = '/wheel/' + (e.length ? '#' + pack(e) : ''), win = e.length >= 2 ? e[pickIndex(e, fairRandom())].label : '';
  const card = showPage((el) => {
    el.dataset.cardKind = 'Wheel';
    el.innerHTML = '<h2>' + (win ? 'The wheel says' : 'Spin the wheel') + '</h2>' // void-review: ok (escaped)
      + (win ? '<p class="wh-win" style="font-size:40px;font-weight:700;line-height:1.15;margin-top:6px;margin-bottom:6px;overflow-wrap:anywhere">' + esc(win) + '</p><p style="color:#8a8a8a">Out of ' + esc(e.map((x) => x.label + (x.weight > 1 ? ' (×' + x.weight + ')' : '')).join(', ')) + ', picked fairly.</p>'
        : '<p>Type names or choices, one a line, and spin: a fair winner, remove it and spin again, share the wheel as a link.</p>')
      + '<p><a class="wh-open" href="' + esc(href) + '" style="display:inline-block;padding:8px 18px;border-radius:999px;background:#6d4aff;color:#fff;text-decoration:none;font-weight:600">' + (win ? 'Spin it on the wheel' : 'Open the wheel') + '</a></p>'
      + '<div class="src">The winner is drawn with this browser\'s cryptographic random numbers; "Pizza*3" is three times as likely. Nothing is sent anywhere.</div>';
  });
  // the wheel in 3D, spinning to the winner the card drew (skills/mini/wheel.js; owner, 2026-10-25: "3d figure if possible")
  if (win) bandMini(api, card, 'wheel', { entries: e.map((x) => ({ label: x.label, weight: x.weight })), win }, '3D prize wheel stopping on ' + win);
  return 'wheel';
}

export default {
  name: 'wheel',
  examples: ['spin the wheel', 'wheel of names', 'spin a wheel with pizza, tacos and sushi', 'random name picker wheel', 'spinner wheel'],
  nearMisses: ['wheel alignment near me', 'the wheel of time', 'how does a wheel work', 'pick for me', 'wheel', 'make a 3d torus'],
  match(lower, text) { return !!askWheel(text || lower); },
  run
};
