/**
 * palette skill — generate a random color palette
 * "show a color palette", "random colors", "generate a palette"
 * Pure client-side, no external calls. Empty surface stays empty.
 */
export function isPalette(text) {
  return /^(?:(?:show|give|generate|make|get)\\s+(?:me\\s+)?)?(?:a\\s+|another\\s+|random\\s+)?(?:color\\s+)?palette(?:\\s+of\\s+colors)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function randomHex() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

function run(text, api) {
  const { showPage, esc } = api;
  const colors = Array.from({ length: 5 }, randomHex);
  showPage((el) => {
    el.innerHTML = '<h2>Color palette</h2><div style="display:flex;gap:8px;margin:12px 0">'
      + colors.map(c => `<div style="width:48px;height:48px;background:${esc(c)};border-radius:8px" title="${esc(c)}"></div>`).join('')
      + '</div><div class="sub">' + colors.map(esc).join(' · ') + '</div><div class="src">Generated in this browser</div>';
  });
  return 'palette';
}

export default {
  name: 'palette',
  examples: ['show a color palette', 'random palette', 'generate a palette'],
  nearMisses: ['what is a palette', 'paint palette', 'color of the sky'],
  match(lower, text) { return isPalette(text); },
  run,
  suite() {
    return { ok: isPalette('show a color palette') && !isPalette('hello') };
  },
};
