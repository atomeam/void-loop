/**
 * random-color skill - show a random color
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const WHEN = /^(?:please\s+)?(?:show\s+(?:me\s+)?(?:a\s+)?random\s+color|random\s+color|give\s+me\s+a\s+color)$/i;

function randomHex() {
  return '#' + Math.floor(Math.random()*0xffffff).toString(16).padStart(6, '0');
}

function run(text, api) {
  const { showPage, esc } = api;
  const hex = randomHex();
  showPage((el) => {
    el.innerHTML = '<h2>Random color</h2><div style="width:200px;height:120px;background:' + hex + ';border-radius:12px;margin:10px auto"></div><p style="text-align:center;font-size:24px">' + esc(hex) + '</p><div class="src">Random hex \u00b7 as of ' + new Date().toISOString().slice(0, 7) + '</div>';
  });
  return 'random-color';
}

export default {
  name: 'random-color',
  examples: ['show me a random color', 'random color'],
  nearMisses: ['what is a color', 'color theory'],
  match(lower) { return WHEN.test(String(lower || '').trim()); },
  run,
  suite() {
    const ok = WHEN.test('show me a random color') && !WHEN.test('what is a color');
    return { ok, got: ok ? undefined : 'match failed' };
  }
};
