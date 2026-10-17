/**
 * better-trend skill — surface void.better.json on the growth card as a one-line trend.
 * "better trend", "show better score trend", "void.better.json one line".
 * Uses existing betterHtml from lib/better.js. Empty surface stays empty.
 */
import { betterHtml } from '../lib/better.js';

export function betterTrendOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:show\s+)?(?:the\s+)?better\s+(?:score\s+)?trend|^(?:void\.better\.json)\s+(?:one[- ]line|trend)$|^surface\s+void\.better\.json$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!betterTrendOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Better trend</h2><div class="sub">reading void.better.json…</div>'; });
  try {
    const r = await fetch('/void.better.json', { cache: 'no-cache' });
    const rows = r.ok ? await r.json() : [];
    if (api._pageStill && !api._pageStill(el)) return 'better-trend';
    const html = betterHtml(esc, rows);
    el.innerHTML = '<h2>Better trend</h2>' + (html || '<p>No better score yet.</p>') + '<div class="src">From void.better.json via growth card logic.</div>';
  } catch (_) {
    el.innerHTML = '<h2>Better trend</h2><p>Could not read the score just now.</p>';
  }
  return 'better-trend';
}

export default {
  name: 'better-trend',
  examples: ['better trend', 'show better score trend', 'void.better.json one line'],
  nearMisses: ['growth', 'how have you grown', 'better'],
  match(lower, text) { return betterTrendOf(text); },
  run,
  suite() {
    return { ok: betterTrendOf('better trend') && !betterTrendOf('hello') };
  },
};
