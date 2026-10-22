/**
 * growth-spark skill — a one-line spark of recent growth velocity from the ledger.
 * Asks: "growth spark", "show the growth spark", "velocity spark".
 * Counts recent grow/build entries; draws a tiny text spark. Nothing sent.
 * Empty stage stays empty until asked.
 */
export function growthSparkOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:show|open|give me)\s+(?:the\s+)?growth\s+spark$|^growth\s+spark$|^velocity\s+spark$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Growth spark</h2><div class="sub">…</div>'; });
  try {
    const list = await fetch('/void.growth.json').then((r) => r.json());
    if (api._pageStill && !api._pageStill(el)) return 'growth-spark';
    const recent = (Array.isArray(list) ? list : []).filter((e) => e && (e.kind === 'grow' || e.kind === 'build')).slice(0, 7);
    const spark = recent.length ? '█'.repeat(Math.min(5, recent.length)) + '░'.repeat(Math.max(0, 5 - recent.length)) : '░░░░░';
    el.innerHTML = '<h2>Growth spark</h2><div style="font-size:2em;letter-spacing:2px">' + spark + '</div>'
      + '<div class="sub">' + esc(recent.length + ' recent growth changes') + '</div>';
  } catch (_) {
    el.innerHTML = '<h2>Growth spark</h2><p>' + esc('The ledger could not be read just now.') + '</p>';
  }
  return 'growth-spark';
}

export function suite() {
  return growthSparkOf('growth spark') && growthSparkOf('show the growth spark') && !growthSparkOf('growth');
}

export default {
  name: 'growth-spark',
  examples: ['growth spark', 'show the growth spark', 'velocity spark'],
  nearMisses: ['growth', 'how have you grown', 'better trend'],
  match(lower, text) { return growthSparkOf(text); },
  run,
  suite,
};
