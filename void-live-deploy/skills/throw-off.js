/**
 * throw-off skill — figures-first dismiss
 * "throw it off the screen" sends the open figure or card off the stage.
 * The surface goes back to empty. Nothing is published, renamed, or saved.
 */
export function throwOffOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?throw (?:it|this|the figure|the card) off the screen$/i.test(t)) return { what: 'open' };
  if (/^(?:please\s+)?toss (?:it|this) off the screen$/i.test(t)) return { what: 'open' };
  if (/^(?:please\s+)?throw the figure off$/i.test(t)) return { what: 'figure' };
  return null;
}

/** Toss plan. The stage that comes back has no card, so an empty surface stays empty. */
export function throwOff(stage) {
  const had = !!(stage && (stage.figure || stage.card || stage.open));
  return {
    had,
    x: 120,
    y: -40,
    spin: 18,
    html: '',
    published: false
  };
}

async function run(text, api) {
  const hit = throwOffOf(text);
  if (!hit) return 'none';
  const { showPage, say } = api;
  const el = showPage((p) => { p.innerHTML = ''; });
  const plan = throwOff({ open: true, figure: hit.what !== 'card', card: true });
  if (el && el.style) {
    el.style.transition = 'transform 420ms ease-in, opacity 420ms ease-in';
    el.style.transform = 'translate(' + plan.x + 'vw, ' + plan.y + 'vh) rotate(' + plan.spin + 'deg)';
    el.style.opacity = '0';
    setTimeout(() => { if (el.parentNode) el.remove(); }, 440);
  }
  if (say) say('');
  return plan.had ? 'throw-off' : 'throw-off';
}

export default {
  name: 'throw-off',
  examples: ['throw it off the screen', 'throw this off the screen', 'toss it off the screen', 'throw the figure off'],
  nearMisses: ['throw a ball', 'what is a screen', 'show the magnetize step', 'make a clock'],
  throwOff,
  throwOffOf,
  match(lower, text) { return !!throwOffOf(text); },
  run
};
