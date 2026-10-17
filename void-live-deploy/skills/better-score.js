/**
 * better-score skill — show the void better score as its own card.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "void better score", "show the void score", "what's my better score".
 * Reads /void.better.json (appended daily by tools/better.mjs). Empty surface stays empty.
 */
import { betterHtml } from '../lib/better.js';

export function wantsScore(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:show|give|what(?:'s| is))\s+(?:the\s+|my\s+)?)?(?:void\s+)?(?:better\s+)?score(?:\s+card)?$|^(?:void\s+)?better\s+score$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!wantsScore(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Void better score</h2><div class="sub">reading the score…</div>'; });
  try {
    const r = await fetch('/void.better.json', { cache: 'no-cache' });
    if (!api._pageStill || !api._pageStill(el)) return 'better-score';
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const rows = await r.json();
    const html = betterHtml(esc, rows);
    el.innerHTML = '<h2>Void better score</h2>' + (html || '<p>No score recorded yet.</p>') + '<div class="src">From <a href="/void.better.json">void.better.json</a></div>';
    return 'better-score';
  } catch (_) {
    if (!api._pageStill || !api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Void better score</h2><p>The score could not be read just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'better-score',
  examples: ['void better score', 'show the void score', "what's my better score", 'void score'],
  nearMisses: ['growth', 'how have you grown', 'what did you do today'],
  match(lower, text) { return wantsScore(text); },
  run,
  suite() {
    return { ok: wantsScore('void better score') && wantsScore('show the void score') && !wantsScore('growth') };
  },
};
