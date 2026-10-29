/**
 * gradient skill: "gradient generator", "css gradient", "make a gradient from red to blue" (owner, 2026-10-24: "find the site to conquer and get
 * to work now"; the tower's frontier ranked colorzilla.com). A card with the gradient the ask named (or a starting one), its CSS to copy, and a
 * link to the full editor, /gradient/ (lib/gradient.js): stops with opacity, linear, radial or conic, presets, CSS read back, from a picture.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { askGradient, css, pack, rule, textContrast } from '../lib/gradient.js';

function run(text, api) {
  const { showPage, esc } = api, q = askGradient(text), g = q && q.g; if (!g) return null;
  const c = css(g), href = '/gradient/#' + pack(g), tc = textContrast(g);
  showPage((el) => {
    el.dataset.cardKind = 'CSS gradient';
    el.innerHTML = '<h2>CSS gradient</h2>' // void-review: ok (escaped)
      + '<p style="margin-top:8px;margin-bottom:8px"><span style="height:120px;border-radius:12px;border:1px solid rgba(127,127,127,.3);display:flex;align-items:center;justify-content:center;font-weight:600;background-image:' + esc(c) + ';color:' + esc(tc.text) + '">Text on it</span></p>'
      + '<pre style="white-space:pre-wrap;word-break:break-all;font-size:13px">' + esc(rule(g)) + '</pre>'
      + '<p><a class="gr-open" href="' + esc(href) + '" style="display:inline-block;padding:8px 18px;border-radius:999px;background:#6d4aff;color:#fff;text-decoration:none;font-weight:600">Edit the gradient</a></p>'
      + '<div class="src">Stops with opacity, linear, radial or conic, presets, reverse, hue and saturation; paste CSS to edit it or take the colours from a picture. Nothing is sent anywhere.</div>';
  });
  return 'gradient';
}

export default {
  name: 'gradient',
  examples: ['gradient generator', 'css gradient', 'make a gradient from red to blue', 'gradient from blue to neon pink', 'gradient from #ff5f6d to #ffc371', 'radial gradient generator', 'generate a gradient blue to pink', 'make a 2d sunset with blue and orange', 'generate a gradient background', 'fix the gradient on this', 'render a sphere with pink to blue'],
  nearMisses: ['gradient descent', 'the gradient of a hill', 'calculate the gradient of y = 2x', 'colour picker', 'what is a gradient', 'draw a picture of a cat', 'make a list with milk, eggs', 'make a plan with sam'],
  match(lower, text) { return !!askGradient(text || lower) || lower.includes('generate a gradient') || lower.includes('fix the gradient') || lower.match(/gradient from .+ to .+/); },
  run
};
