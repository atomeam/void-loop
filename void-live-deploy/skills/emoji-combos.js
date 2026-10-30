/**
 * emoji-combos skill: "cat emoji combos", "emoji combos for birthday", "kaomoji cat" (the floor that assimilates emojicombos.com, 2026-10-30).
 * A card of the combos the catalog holds for the tag (lib/emoji-combos.js), each with a Copy button, and a link to the full page /emoji-combos/
 * with the search in it, where several can be collected into one, made into fancy text or drawn in dots. Nothing is sent anywhere.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { search, catalogStats, linkOf } from '../lib/emoji-combos.js';

const clean = (text) => String(text || '').trim().replace(/[?!.]+$/, '');
const KIND = '(?:emoji\\s+combos?|emoji\\s+combinations?|kaomojis?|text\\s+faces?)';
/** the tag an ask wants combos for ('' for the plain ask), or null when the ask is not for combos. Pure. */
export function comboAsk(text) {
  const t = clean(text).replace(/^(?:please\s+)?(?:(?:show|give|find|get)\s+me\s+)?(?:some\s+|an?\s+)?/i, '');
  if (/^(?:what|how|why|who|where|when|is|are|does|do|can)\b/i.test(t)) return null; // a question about combos is not an ask for them
  let m = new RegExp('^' + KIND + '$', 'i').exec(t); if (m) return '';
  m = new RegExp('^' + KIND + '\\s+(?:for|about|with|of)?\\s*([a-z][a-z \' -]{0,40})$', 'i').exec(t); if (m) return m[1].trim().toLowerCase();
  m = new RegExp('^([a-z][a-z \' -]{0,40}?)\\s+' + KIND + '$', 'i').exec(t); if (m) return m[1].trim().toLowerCase();
  return null;
}

function run(text, api) {
  const { showPage, esc } = api, q = comboAsk(text) || '', found = q ? search(q).slice(0, 8) : [], n = catalogStats().combos;
  const page = linkOf({ q });
  showPage((el) => {
    el.dataset.cardKind = 'Emoji combos';
    el.innerHTML = '<h2>' + esc(q ? 'Emoji combos for ' + q : 'Emoji combos') + '</h2>' // void-review: ok (every value escaped)
      + (q && !found.length ? '<p>No combos for ' + esc(q) + ' yet. The full page has ' + n + ' to search, and you can make your own.</p>' : '')
      + (!q ? '<p>Say a word, like "cat emoji combos" or "kaomoji happy". The catalog holds ' + n + ' combos.</p>' : '')
      + '<div class="ec-list">' + found.map((c, i) => '<p style="margin:8px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="font-size:20px;white-space:pre-wrap">' + esc(c.t) + '</span> <button type="button" data-i="' + i + '" style="min-height:32px">Copy</button></p>').join('') + '</div>'
      + '<p><a href="' + esc(page) + '">Open the full page</a> <span class="ec-msg" role="status"></span></p>'
      + '<div class="src">From Verse\'s own catalog of ' + n + ' combos, counted as it is. Nothing is sent anywhere.</div>';
    for (const ev of ['pointerdown', 'keydown']) for (const b of el.querySelectorAll('button,a')) b.addEventListener(ev, (e) => e.stopPropagation());
    const msg = el.querySelector('.ec-msg');
    for (const b of el.querySelectorAll('button[data-i]')) b.addEventListener('click', () => {
      const t = found[+b.dataset.i].t;
      Promise.resolve(navigator.clipboard && navigator.clipboard.writeText(t)).then(() => { msg.textContent = 'Copied'; }, () => { msg.textContent = 'Could not copy here'; });
    });
  });
  return 'emoji-combos';
}

export default {
  name: 'emoji-combos',
  examples: ['cat emoji combos', 'emoji combos for birthday', 'kaomoji happy', 'emoji combos', 'love text faces'],
  nearMisses: ['random emoji', 'emoji fire', 'emoji counts', 'what is a kaomoji', 'emoji keyboard'],
  match(lower, text) { return comboAsk(text || lower) !== null; },
  run,
  suite() {
    const ok = comboAsk('cat emoji combos') === 'cat' && comboAsk('emoji combos for birthday') === 'birthday' && comboAsk('kaomoji happy') === 'happy'
      && comboAsk('emoji combos') === '' && comboAsk('random emoji') === null && comboAsk('what is a kaomoji') === null && search('cat').length > 0;
    return { ok, got: 'match works' };
  },
};
