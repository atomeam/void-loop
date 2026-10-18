/**
 * better-spark skill — a small persistent sparkline of daily better scores on the stage (new idea from growth inbox).
 * "better spark", "show the better sparkline", "stage sparkline for better scores".
 * Reads void.better.json, draws with lib/spark.js. Empty surface stays empty.
 */
import { sparkSvg } from '../lib/spark.js';

export function betterSparkOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:show|open|summon)\s+)?(?:the\s+)?(?:better\s+)?(?:score\s+)?spark(?:line)?(?:\s+for\s+(?:the\s+)?better(?:\s+score)?)?$/.test(t);
}

async function run(text, api) {
  if (!betterSparkOf(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Better score sparkline</h2><p>…</p>'; });
  try {
    const r = await fetch('/void.better.json', { cache: 'no-cache' });
    if (!api._pageStill(el)) return 'better-spark';
    const rows = await r.json();
    const points = (Array.isArray(rows) ? rows : []).filter((row) => row && Number.isFinite(+row.score)).slice(-14).map((row) => ({ score: +row.score }));
    const svg = sparkSvg(points, 180, 36, { key: 'score', max: 100, cls: 'better-spark' });
    el.innerHTML = '<h2>Better score sparkline</h2><div class="sub">' + esc(points.length ? points.length + ' days' : 'no scores yet') + '</div>'
      + (svg || '<p>No better scores recorded yet.</p>')
      + '<div class="src">From <a href="/void.better.json">void.better.json</a></div>';
    return 'better-spark';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Better score sparkline</h2><p>The better scores could not be read just now.</p>';
    return 'none';
  }
}

export default {
  name: 'better-spark',
  examples: ['better spark', 'show the better sparkline', 'stage sparkline for better scores', 'sparkline for the better score'],
  nearMisses: ['growth', 'how have you grown', 'what is better'],
  match(lower, text) { return betterSparkOf(text || lower); },
  run,
  suite() {
    return { ok: betterSparkOf('better spark') && betterSparkOf('show the better sparkline') && !betterSparkOf('hello') };
  },
};
