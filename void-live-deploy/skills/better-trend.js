/**
 * better-trend skill — surface void.better.json as a one-line trend.
 * Contract: { name, examples, nearMisses, match, run, suite }
 * "better trend", "show better score", "is void getting better".
 * Reads /void.better.json and shows the compare line. Empty surface stays empty.
 */
import { betterHtml } from '../lib/better.js';

export function trendOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:show|surface|get)\s+(?:me\s+)?)?(?:the\s+)?(?:better trend|better score|void better|is void getting better)$/.test(t);
}

async function run(text, api) {
  if (!trendOf(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Better trend</h2><div class="sub">reading…</div>'; });
  try {
    const r = await fetch('/void.better.json', { cache: 'no-cache' });
    if (!api._pageStill(el)) return 'better-trend';
    const rows = r.ok ? await r.json() : [];
    const html = betterHtml(esc, rows);
    el.innerHTML = '<h2>Better trend</h2>' + (html || '<p>No better score yet.</p>') + '<div class="src">From <a href="/void.better.json">void.better.json</a></div>';
    return 'better-trend';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Better trend</h2><p>Could not read the better file just now.</p>';
    return 'none';
  }
}

export default {
  name: 'better-trend',
  examples: ['better trend', 'show better score', 'is void getting better', 'surface void better'],
  nearMisses: ['growth', 'how have you grown', 'what is better'],
  match(lower, text) { return trendOf(text); },
  run,
  suite() {
    return { ok: trendOf('better trend') && !trendOf('hello') };
  },
};
