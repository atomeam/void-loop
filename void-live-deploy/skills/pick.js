/**
 * pick skill — pick one item randomly from a list in the ask (no key; pure)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "pick one of red blue green", "choose randomly between tea and coffee".
 * Empty surface stays empty until asked.
 */
export function pickOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  const m = t.match(/^(?:please\s+)?(?:pick\s+(?:one\s+)?(?:of|from)\s+|choose\s+(?:randomly\s+)?(?:between|from|among)\s+)(.+)$/i);
  if (!m) return null;
  const items = m[1].split(/\s*,\s*|\s+or\s+|\s+and\s+|\s+/).map(s => s.trim()).filter(Boolean);
  if (items.length < 2 || items.length > 20) return null;
  return items;
}
function run(text, api) {
  const { showPage, esc } = api;
  const items = pickOf(text);
  if (!items) return 'none';
  const chosen = items[Math.floor(Math.random() * items.length)];
  showPage((el) => {
    el.innerHTML = '<h2>Pick</h2><div class="sub">from ' + esc(items.join(', ')) + '</div>'
      + '<div style="font-size:48px;font-weight:200;margin:12px 0">' + esc(chosen) + '</div>'
      + '<div class="src">Picked in the browser. Say the ask again for another.</div>';
  });
  return 'pick';
}
export default {
  name: 'pick',
  examples: ['pick one of red blue green', 'choose randomly between tea and coffee'],
  nearMisses: ['pick up the phone', 'what is a pick', 'choose your own adventure'],
  match(lower, text) { return !!pickOf(text || lower); },
  run,
  suite() {
    const a = pickOf('pick one of red blue green');
    const ok = a && a.length === 3 && a.includes('red') && !pickOf('what is a pick');
    return { ok, got: ok ? 'pass' : 'fail' };
  }
};
