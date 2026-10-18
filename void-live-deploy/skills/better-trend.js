/**
 * better-trend skill — surfaces void.better.json as a one-line trend on the growth card.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "show the better trend", "void better json trend", "growth trend one line".
 * Reads /void.better.json if present. Empty surface stays empty.
 */
export function trendOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /(?:show|surface|display)\s+(?:the\s+)?(?:void\s+)?better(?:\.json)?\s+(?:on\s+(?:the\s+)?growth\s+card|as\s+a\s+one-line\s+trend|trend)|growth\s+card\s+trend|better\s+trend/.test(t) ? true : null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!trendOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Growth card · better trend</h2><div class="sub">loading void.better.json…</div>'; });
  try {
    const r = await fetch('/void.better.json');
    if (!api._pageStill || !api._pageStill(el)) return 'better-trend';
    if (!r.ok) {
      el.innerHTML = '<h2>Growth card · better trend</h2><p>void.better.json not available yet. The one-line trend will appear here once the scorecard lands.</p>';
      return 'better-trend';
    }
    const data = await r.json();
    const line = data.trend || data.oneLine || JSON.stringify(data).slice(0, 80) + '…';
    el.innerHTML = '<h2>Growth card · better trend</h2><p class="sub">' + esc(line) + '</p><div class="src">From void.better.json · empty stage stays empty</div>';
    return 'better-trend';
  } catch (_) {
    el.innerHTML = '<h2>Growth card · better trend</h2><p>Could not read the better scorecard just now.</p>';
    return 'none';
  }
}

export default {
  name: 'better-trend',
  examples: ['show the better trend', 'void better json trend', 'surface void.better.json on the growth card as a one-line trend', 'growth card trend'],
  nearMisses: ['what is better', 'void better', 'growth', 'scorecard'],
  match(lower, text) { return !!trendOf(text || lower); },
  run,
  suite() {
    const ok = !!trendOf('show the better trend') && trendOf('hello') === null;
    return { ok, got: 'better-trend match' };
  },
};
