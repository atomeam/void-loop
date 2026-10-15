/**
 * next-notch skill — shows the next one-up for the current target (ibisPaint X brushes).
 * "next notch", "what notch next", "show the next target", "ibis next".
 * Empty surface stays empty.
 */
export function nextNotchOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:next\s+notch|what(?:'s|\s+is)\s+the\s+next\s+notch|show\s+the\s+next\s+target|ibis(?:paint)?\s+next|next\s+for\s+ibis)$/.test(t);
}

function run(text, api) {
  if (!nextNotchOf(text)) return 'none';
  const { showPage, esc } = api;
  showPage((el) => {
    el.innerHTML = '<h2>Next notch</h2><div class="sub">ibisPaint X · brushes</div>'
      + '<p><b>They:</b> thousands of brushes with thickness, opacity and angle controls and a live preview</p>'
      + '<p><b>Void, one notch past:</b> describe a brush in words ("dry charcoal that catches the paper grain") and Void makes it, then keeps it as yours</p>'
      + '<div class="src">From domains/targets/ibispaint.json</div>';
  });
  return 'next-notch';
}

export default {
  name: 'next-notch',
  examples: ['next notch', 'what is the next notch', 'show the next target', 'ibis next'],
  nearMisses: ['what is a notch', 'next holiday', 'show the board'],
  match(lower, text) { return nextNotchOf(text); },
  run,
  suite() {
    return { ok: nextNotchOf('next notch') && !nextNotchOf('hello') };
  },
};
