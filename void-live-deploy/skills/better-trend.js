/**
 * better-trend skill — surfaces void.better.json on a card as the one-line trend (follow-on to execution layers).
 * Asks: "better trend", "show the better score", "void better json trend", "how is the better score".
 * Uses the existing betterHtml from lib/better.js which already computes the compare line.
 * Empty stage stays empty until asked.
 */
import { betterHtml, compare } from '../lib/better.js';

export function betterTrendOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:show|open|summon|give me|what is)\s+(?:the\s+)?(?:better|void\.better)\s+(?:score|trend|json|line)?$|better\s+trend|void\s+better\s+json|how\s+is\s+the\s+better\s+score/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Better score trend</h2><div class="sub">…</div>'; });
  try {
    const rows = await fetch('/void.better.json').then((r) => r.json());
    if (api._pageStill && !api._pageStill(el)) return 'better-trend';
    const html = betterHtml(esc, Array.isArray(rows) ? rows : []);
    const c = compare(rows);
    el.innerHTML = '<h2>Better score trend</h2>' + (html || '<div class="sub">No better rows yet.</div>') + (c ? '<div class="src">from void.better.json · score ' + esc(c.score) + '</div>' : '');
  } catch (_) {
    el.innerHTML = '<h2>Better score trend</h2><p>' + esc('Could not read void.better.json just now.') + '</p>';
  }
  return 'better-trend';
}

/** one suite check */
export function suite() {
  return betterTrendOf('better trend') && betterTrendOf('show the better score') && !betterTrendOf('growth');
}

export default {
  name: 'better-trend',
  examples: ['better trend', 'show the better score', 'void better json', 'how is the better score'],
  nearMisses: ['growth', 'how have you grown', 'what is better'],
  match(lower, text) { return betterTrendOf(text); },
  run,
  suite,
};
