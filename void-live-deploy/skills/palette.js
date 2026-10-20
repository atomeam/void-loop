/**
 * palette skill — "color palette for calm", "mood palette ocean", "give me a palette".
 * Pure hex colors from a mood word. Nothing is sent.
 */
const MOODS = {
  calm: ['#a8d5e2', '#f0f8ff', '#87ceeb', '#e0f7fa'],
  ocean: ['#006994', '#0096c7', '#48cae4', '#90e0ef'],
  sunset: ['#ff6b6b', '#ffa500', '#ffd700', '#ff4500'],
  forest: ['#228b22', '#32cd32', '#90ee90', '#006400'],
  night: ['#191970', '#000080', '#4169e1', '#1e90ff'],
  default: ['#cccccc', '#aaaaaa', '#888888', '#666666']
};

export function paletteFrom(mood) {
  const m = String(mood || 'calm').trim().toLowerCase().replace(/[^a-z]/g, '') || 'calm';
  return MOODS[m] || MOODS.default;
}

export function isPalette(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:make|give me|show|create)\s+(?:a\s+)?)?(?:color\s+|mood\s+)?palette(?:\s+(?:for|of|from)\s+\w+)?$|^mood\s+palette(?:\s+\w+)?$/.test(t);
}

export function moodOf(text) {
  const m = String(text || '').trim().toLowerCase().match(/(?:for|of|from)\s+(\w+)/);
  return m ? m[1] : 'calm';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const mood = moodOf(text);
  const colors = paletteFrom(mood);
  const el = showPage();
  if (!api._pageStill(el)) return 'none';
  el.innerHTML = '<h2>A palette</h2>'
    + colors.map((c) => '<span style="display:inline-block;width:40px;height:40px;background:' + esc(c) + ';margin:2px" title="' + esc(c) + '"></span>').join('')
    + '<div class="sub">mood: ' + esc(mood) + '</div>';
  return 'palette';
}

export default {
  name: 'palette',
  examples: ['color palette for calm', 'mood palette ocean', 'give me a palette'],
  nearMisses: ['what is a palette', 'paint colors', 'hex code'],
  match(lower, text) { return isPalette(text); },
  run
};
