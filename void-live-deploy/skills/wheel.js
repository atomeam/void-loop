/**
 * wheel skill — a decision wheel that stays on the stage.
 * "spin the wheel", "help me decide", "decision wheel for yes or no".
 * Options from the ask or a default set. Pure random pick shown as a card.
 */
export function askOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:spin(?:\s+the)?\s+wheel|decision\s+wheel|help\s+me\s+decide|spin\s+to\s+decide)$/.test(t)) return { options: ['Yes', 'No', 'Maybe', 'Later', 'Ask again'] };
  const m = t.match(/^(?:spin(?:\s+the)?\s+wheel|decision\s+wheel|help\s+me\s+decide)\s+(?:for|between|on)?\s*(.+)$/);
  if (m) {
    const opts = m[1].split(/\s*(?:,|or|and|\/)\s*/).map(s => s.trim()).filter(Boolean);
    if (opts.length >= 2) return { options: opts.slice(0, 12) };
  }
  return null;
}

function run(text, api) {
  const q = askOf(text);
  if (!q) return 'none';
  const pick = q.options[Math.floor(Math.random() * q.options.length)];
  const { showPage, esc } = api;
  showPage((el) => {
    el.innerHTML = '<h2>The wheel says</h2><p style="font-size:28px;font-weight:300;text-align:center">' + esc(pick) + '</p>'
      + '<div class="sub">from: ' + esc(q.options.join(' · ')) + '</div>'
      + '<div class="sub">say "spin the wheel" again for a new spin</div>';
  });
  api.say('The wheel landed on ' + pick);
  return 'wheel';
}

export function suite() {
  const a = askOf('spin the wheel');
  if (!a || a.options.length < 2) return { ok: false, got: 'no options' };
  const b = askOf('spin the wheel for coffee or tea or water');
  if (!b || b.options.length !== 3) return { ok: false, got: JSON.stringify(b) };
  return { ok: true, got: 'asks parse' };
}

export default {
  name: 'wheel',
  examples: ['spin the wheel', 'help me decide', 'decision wheel for yes or no', 'spin the wheel for pizza or sushi'],
  nearMisses: ['what is a wheel', 'steering wheel', 'spin the bottle'],
  match(lower, text) { return !!askOf(text || lower); },
  run,
  suite,
};
