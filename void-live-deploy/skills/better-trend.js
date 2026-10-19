/**
 * better-trend skill — surface void.better.json on the growth card as a one-line trend (inbox open row).
 * "show the better trend", "surface the better score", "how is Verse getting better".
 */
import { betterHtml } from '../lib/better.js';

export function betterOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:show|surface|what is|how's|how is)\s+(?:the\s+)?(?:better\s+(?:trend|score|number)|void\.better\.json)(?:\s+trend)?$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Better trend</h2><div class="sub">loading…</div>'; });
  try {
    const r = await fetch('/void.better.json');
    if (!r.ok) throw new Error('http ' + r.status);
    const rows = await r.json();
    if (!api._pageStill(el)) return 'better-trend';
    el.innerHTML = '<h2>Better trend</h2>' + betterHtml(esc, Array.isArray(rows) ? rows : []);
    return 'better-trend';
  } catch (_) {
    if (!api._pageStill(el)) return 'better-trend';
    el.innerHTML = '<h2>Better trend</h2><p>The better score could not be read just now.</p>';
    return 'better-trend';
  }
}

export default {
  name: 'better-trend',
  examples: ['show the better trend', 'surface the better score', 'how is Verse getting better'],
  nearMisses: ['show the growth', 'what is better', 'trend analysis'],
  match(lower, text) { return betterOf(text); },
  run,
  suite() {
    return { ok: !!betterOf('show the better trend') && !betterOf('show the growth') };
  },
};
