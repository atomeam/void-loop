/**
 * better-trend skill: "better trend", "how better are you", "your better score" — the one-line trend from void.better.json.
 * Surfaces the daily score and its trend (up/down/flat since yesterday or on the week) as a one-line readout. Empty surface stays empty: no row, no line.
 * Follow-on to execution layers; asked to surface void.better.json on the growth card as a one-line trend (now also summonable alone).
 */
import { betterHtml } from '../lib/better.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const ASK_RE = /^(?:(?:show|give|what(?:'s| is)|how)\s+)?(?:the\s+)?(?:better\s+(?:trend|score|line)|how\s+better\s+(?:are\s+you|is\s+void)|your\s+better\s+(?:score|trend))$/;
export function betterTrendOf(text) { return ASK_RE.test(CLEAN(text)); }

async function run(text, api) {
  if (!betterTrendOf(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Better trend</h2><div class="sub">\u2026</div>'; });
  try {
    const rows = await fetch('/void.better.json', { cache: 'no-cache' }).then((r) => r.json());
    if (api._pageStill && !api._pageStill(el)) return 'better-trend';
    const html = betterHtml(esc, rows);
    el.innerHTML = '<h2>Better trend</h2>' + (html || '<p>No measure yet. The daily score has not been written.</p>');
  } catch (_) {
    el.innerHTML = '<h2>Better trend</h2><p>The better ledger could not be read just now. Try again in a minute.</p>';
  }
  return 'better-trend';
}

export default {
  name: 'better-trend',
  examples: ['better trend', 'how better are you', 'your better score', 'better score', 'what is the better trend'],
  nearMisses: ['what is better', 'how are you', 'growth', 'show the growth'],
  match(lower, text) { return betterTrendOf(text); },
  run,
  suite() {
    const ok = betterTrendOf('better trend') && betterTrendOf('how better are you') && betterTrendOf('your better score') && !betterTrendOf('how are you') && !betterTrendOf('growth');
    return { ok, got: ok ? 'matched' : 'missed' };
  },
};
