/**
 * palette skill - generate a color palette from a mood or theme.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Invented for growth (2026-10-20).
 */
const WHEN = /^(?:make|create|generate|give me)?\s*(?:a\s+)?(?:color\s+)?palette\s+(?:for|from|of)\s+(.+)$/i;

function colorsFor(mood) {
  const m = String(mood || '').toLowerCase();
  if (/calm|peace|relax/.test(m)) return ['#A8D5E5', '#7EBDC2', '#F2E9E4', '#E6E6FA', '#B8E0D2'];
  if (/energy|energetic|vibrant|joy|happy/.test(m)) return ['#FF6B6B', '#FFE66D', '#4ECDC4', '#45B7D1', '#FFA07A'];
  if (/sunset|dusk|evening|warm/.test(m)) return ['#FF7E5F', '#FEB47B', '#FF6B6B', '#C06C84', '#6C5B7B'];
  return ['#6C5CE7', '#A29BFE', '#FD79A8', '#E17055', '#00B894']; // default
}

function run(text, api) {
  const { showPage, esc } = api;
  const m = String(text).match(WHEN);
  const mood = m ? m[1].trim() : 'calm';
  const cols = colorsFor(mood);
  showPage((el) => {
    el.innerHTML = '<h2>Color palette for ' + esc(mood) + '</h2>'
      + '<div style="display:flex;gap:8px;margin:12px 0">' + cols.map(c => '<div style="width:48px;height:48px;background:' + c + ';border-radius:8px" title="' + c + '"></div>').join('') + '</div>'
      + '<p>' + cols.map(c => esc(c)).join(' · ') + '</p>'
      + '<div class="src">Generated in this browser · no external source</div>';
  });
  return 'palette';
}

export default {
  name: 'palette',
  examples: ['make a color palette for calm', 'palette for sunset', 'color palette from joy'],
  nearMisses: ['what is a palette', 'paint palette', 'palette knife'],
  match(lower) { return WHEN.test(String(lower || '').trim()); },
  run,
  suite() {
    const ok = WHEN.test('make a color palette for calm') && colorsFor('calm').length === 5 && colorsFor('sunset')[0] === '#FF7E5F' && !WHEN.test('what is a palette');
    return { ok };
  },
};
