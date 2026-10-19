/**
 * hue-of-day skill — the color of today, derived from the date so the same day always gives the same hue.
 * "color of the day", "what's today's color", "hue of today".
 * Empty surface stays empty; the result is a color card.
 */
export function hueOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:what(?:'s| is)\s+)?(?:the\s+)?(?:color|colour|hue)\s+of\s+(?:the\s+)?(?:day|today)$|^today'?s\s+(?:color|colour|hue)$/.test(t);
}
export function dayHue(now = new Date()) {
  const day = now.getFullYear() * 372 + (now.getMonth() + 1) * 31 + now.getDate();
  return day % 360;
}
export function suite() {
  if (!hueOf('color of the day')) return { ok: false, got: 'match' };
  if (hueOf('what color is the sky')) return { ok: false, got: 'near' };
  const h = dayHue(new Date(2026, 9, 19)); if (typeof h !== 'number' || h < 0 || h > 359) return { ok: false, got: 'hue' };
  return { ok: true };
}
async function run(text, api) {
  if (!hueOf(text)) return 'none';
  const { showPage, esc } = api;
  const h = dayHue();
  const hex = '#' + [0, 1, 2].map(i => Math.round(255 * (0.5 + 0.5 * Math.cos((h / 60 + i) * Math.PI / 3))).toString(16).padStart(2, '0')).join('');
  showPage((p) => {
    p.innerHTML = '<h2>Color of the day</h2><div style="width:120px;height:120px;border-radius:50%;background:hsl(' + h + ',70%,55%);margin:12px auto;box-shadow:0 0 0 8px rgba(255,255,255,.08)"></div>'
      + '<div style="text-align:center;font-size:18px">hsl(' + h + ', 70%, 55%)</div><div class="sub">the same day always gives the same hue</div>';
  });
  return 'hue-of-day';
}
export default {
  name: 'hue-of-day',
  examples: ['color of the day', "what's today's color", 'hue of today'],
  nearMisses: ['what color is the sky', 'paint it blue', 'change the look'],
  match(lower, text) { return hueOf(text); },
  suite,
  run,
};
