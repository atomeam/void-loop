/**
 * advice skill — a short piece of advice from the free Advice Slip API (no key).
 * "give me advice", "what should I do", "advice please".
 * Empty surface stays empty.
 */
export function adviceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:please\s+)?(?:give\s+(?:me\s+)?(?:some\s+)?advice|(?:what\s+)?should\s+i\s+do|advice(?:\s+please)?|random\s+advice|life\s+advice)$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!adviceOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Advice</h2><div class="sub">thinking…</div>'; });
  try {
    const j = await fetch('https://api.adviceslip.com/advice').then((r) => r.json());
    if (!api._pageStill(el)) return 'advice';
    const slip = j.slip && j.slip.advice;
    if (!slip) throw 0;
    el.innerHTML = '<h2>Advice</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(slip) + '</p><div class="sub">say “give me advice” for another</div>'
      + '<div class="src">Source: <a href="https://adviceslip.com/" target="_blank" rel="noopener">Advice Slip</a> (no key)</div>';
    return 'advice';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Advice</h2><p>The advice service did not answer. Try again in a moment. Meanwhile: start with what is in front of you.</p>';
    return 'advice';
  }
}

export default {
  name: 'advice',
  examples: ['give me advice', 'what should I do', 'advice please'],
  nearMisses: ['what is advice', 'legal advice', 'financial advice'],
  match(lower, text) { return adviceOf(text); },
  run,
  suite() {
    return { ok: adviceOf('give me advice') && !adviceOf('hello') && !adviceOf('what is advice') };
  },
};
