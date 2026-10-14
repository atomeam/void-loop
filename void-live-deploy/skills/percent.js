/**
 * percent skill — what is N% of M. Pure math.
 * Empty surface stays empty.
 */
function percentOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  const m = t.match(/^(?:what\s+is\s+|calculate\s+)?(\d+(?:\.\d+)?)\s*%\s+of\s+(\d+(?:\.\d+)?)$/) ||
            t.match(/^(?:what\s+is\s+)?(\d+(?:\.\d+)?)\s+percent\s+of\s+(\d+(?:\.\d+)?)$/);
  if (m) {
    const pct = parseFloat(m[1]), base = parseFloat(m[2]);
    if (pct >= 0 && pct <= 1000 && base > 0 && base < 1e9) return { pct, base };
  }
  return null;
}
async function run(text, api) {
  const hit = percentOf(text);
  if (!hit) return 'none';
  const { showPage, esc } = api;
  const result = (hit.base * hit.pct / 100).toFixed(2).replace(/\.00$/, '');
  showPage((el) => {
    el.innerHTML = '<h2>Percent</h2><p style="font-size:32px;font-weight:300">' + esc(result) + '</p><div class="sub">' + hit.pct + '% of ' + hit.base + '</div>';
  });
  return 'percent';
}
export default {
  name: 'percent',
  examples: ['what is 20% of 50', '15 percent of 80', 'what is 10% of 200'],
  nearMisses: ['what is percent', 'percentage sign', '20 of 50'],
  match(lower, text) { return !!percentOf(text); },
  run
};
