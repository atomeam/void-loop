/**
 * better-trend skill — surface void.better.json on the growth card as a one-line trend.
 * "show the better trend", "growth score trend", "is void getting better".
 * Reads /void.better.json and shows the one-line Better score with day and week trend.
 * Empty surface stays empty.
 */
import { betterHtml, compare } from '../lib/better.js';

export function trendOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:show|open|what(?:'s| is))\s+(?:the\s+)?(?:better|growth)\s+(?:trend|score|scorecard)|is\s+(?:void|v01d)\s+getting\s+better|better\s+trend$/.test(t);
}

async function run(text, api) {
  const { showPage, esc, _pageStill } = api;
  if (!trendOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Better trend</h2><div class="sub">reading the scorecard…</div>'; });
  try {
    const r = await fetch('/void.better.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const rows = await r.json();
    if (_pageStill && !_pageStill(el)) return 'better-trend';
    const html = betterHtml(esc, rows);
    const c = compare(rows);
    el.innerHTML = '<h2>Better trend</h2>' + (html || '<p>No better score yet.</p>')
      + (c ? '<div class="src">From <a href="/void.better.json" target="_blank" rel="noopener">void.better.json</a> · score ' + esc(c.score) + (c.day != null ? ', ' + (c.day > 0 ? '+' : '') + esc(c.day) + ' since yesterday' : '') + (c.week != null ? ', ' + (c.week > 0 ? '+' : '') + esc(c.week) + ' on the week' : '') + '</div>' : '');
    return 'better-trend';
  } catch (_) {
    if (_pageStill && !_pageStill(el)) return 'none';
    el.innerHTML = '<h2>Better trend</h2><p>The scorecard could not be read just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'better-trend',
  examples: ['show the better trend', 'growth score trend', 'is void getting better', 'better trend'],
  nearMisses: ['growth', 'how have you grown', 'what is better', 'trend the growth'],
  match(lower, text) { return trendOf(text); },
  run,
  suite() {
    return { ok: trendOf('show the better trend') && !trendOf('hello world') };
  },
};
