/**
 * banner skill - make a simple text banner card.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Invented for growth (2026-10-20).
 */
const WHEN = /^(?:make|create|generate|give me)?\s*(?:a\s+)?(?:text\s+)?banner\s+(?:that\s+says|for|with)\s+(.+)$/i;

function run(text, api) {
  const { showPage, esc } = api;
  const m = String(text).match(WHEN);
  const words = m ? m[1].trim() : 'Hello Verse';
  showPage((el) => {
    el.innerHTML = '<h2>Banner</h2>'
      + '<div style="font-size:2.5em;font-weight:800;text-align:center;padding:24px;background:linear-gradient(90deg,#ff3d7f,#7a5cff);color:#fff;border-radius:16px;letter-spacing:-0.02em">' + esc(words) + '</div>'
      + '<div class="src">Drawn in this browser · no external source</div>';
  });
  return 'banner';
}

export default {
  name: 'banner',
  examples: ['make a banner that says Welcome', 'banner for Verse', 'text banner with Hello world'],
  nearMisses: ['what is a banner', 'web banner sizes', 'banner ad'],
  match(lower) { return WHEN.test(String(lower || '').trim()); },
  run,
  suite() {
    const ok = WHEN.test('make a banner that says Welcome') && !WHEN.test('what is a banner');
    return { ok };
  },
};
