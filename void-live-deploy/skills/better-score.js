/**
 * better-score skill — surface void.better.json as a one-line trend.
 * "how am I doing", "what's my better score", "am I getting better", "growth trend".
 * Empty surface stays empty. Uses existing betterHtml from lib/better.js.
 */
import { betterHtml, compare } from '../lib/better.js';

export function betterOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:how am i doing|what's my better score|am i getting better|growth trend|void better|show the better score|my score)$/.test(t);
}

async function run(text, api) {
  if (!betterOf(text)) return 'none';
  const { showPage, esc, _pageStill } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>How V01D is doing</h2><div class="sub">reading the score…</div>'; });
  try {
    const r = await fetch('/void.better.json', { cache: 'no-cache' });
    if (!_pageStill || !_pageStill(el)) return 'better-score';
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const rows = await r.json();
    const html = betterHtml(esc, rows);
    el.innerHTML = html || '<h2>How V01D is doing</h2><p>No score yet. The daily measure has not run.</p>';
    return 'better-score';
  } catch (e) {
    if (_pageStill && _pageStill(el)) el.innerHTML = '<h2>How V01D is doing</h2><p>The score could not be read just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'better-score',
  examples: ['how am I doing', "what's my better score", 'am I getting better', 'growth trend'],
  nearMisses: ['how are you', 'what is better', 'score a goal', 'better weather'],
  match(lower, text) { return betterOf(text); },
  run,
  suite() {
    return { ok: betterOf('how am I doing') && !betterOf('hello world') };
  },
};
