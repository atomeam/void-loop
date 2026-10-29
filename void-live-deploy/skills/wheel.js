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
  if (win) {
    bandMini(api, card, 'wheel', { entries: e.map((x) => ({ label: x.label, weight: x.weight })), win }, '3D prize wheel stopping on ' + win);
    // the winner under the 3D wheel, inside the band, so it is seen at once (owner, 2026-10-25: at 390 px the winner in the text box sat under
    // the card's edge, "ann" cut off): room is kept below the figure for the name, one line or two for a long one, never cut
    const band = card && card.querySelector('.vmini');
    if (band) {
      const cap = document.createElement('div'); cap.className = 'wh-band-win'; cap.textContent = win; cap.setAttribute('aria-hidden', 'true');
      cap.style.cssText = 'position:absolute;left:8px;right:8px;bottom:2px;text-align:center;font:700 ' + (win.length <= 14 ? 26 : win.length <= 28 ? 20 : 16) + 'px/1.15 system-ui,-apple-system,sans-serif;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.8);overflow-wrap:anywhere;pointer-events:none';
      band.style.position = 'relative'; band.style.boxSizing = 'content-box'; band.append(cap);
      band.style.paddingBottom = (cap.offsetHeight || 32) + 6 + 'px';
    }
  }
  return 'wheel';
}

export default {
  name: 'wheel',
  examples: ['spin the wheel', 'wheel of names', 'spin a wheel with pizza, tacos and sushi', 'random name picker wheel', 'spinner wheel'],
  nearMisses: ['wheel alignment near me', 'the wheel of time', 'how does a wheel work', 'pick for me', 'wheel', 'make a 3d torus'],
  match(lower, text) { return !!askWheel(text || lower); },
  run
};
