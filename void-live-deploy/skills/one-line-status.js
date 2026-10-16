/**
 * one-line-status skill — a one-line status from Void's better ledger.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "one line status", "status in one line", "void one-liner".
 * Surfaces the latest trend as a single line. Empty surface stays empty.
 */
import { betterHtml } from '../lib/better.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const ASK_RE = /^(?:(?:show|give me|what(?:'s| is))\s+)?(?:the\s+)?one[- ]?line\s+status$|^status\s+in\s+one\s+line$|^void one[- ]?liner$/i;
export function oneLineOf(text) { return ASK_RE.test(CLEAN(text)); }

async function run(text, api) {
  if (!oneLineOf(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>One-line status</h2><div class="sub">\u2026</div>'; });
  try {
    const rows = await fetch('/void.better.json', { cache: 'no-cache' }).then((r) => r.json());
    if (api._pageStill && !api._pageStill(el)) return 'one-line-status';
    const html = betterHtml(esc, rows);
    const line = html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : 'No measure yet.';
    el.innerHTML = '<h2>One-line status</h2><p style="font-size:18px">' + esc(line) + '</p>';
  } catch (_) {
    el.innerHTML = '<h2>One-line status</h2><p>The ledger could not be read just now.</p>';
  }
  return 'one-line-status';
}

export default {
  name: 'one-line-status',
  examples: ['one line status', 'status in one line', 'void one-liner'],
  nearMisses: ['status', 'void status', 'better trend', 'growth'],
  match(lower, text) { return oneLineOf(text); },
  run,
  suite() {
    const ok = oneLineOf('one line status') && oneLineOf('status in one line') && !oneLineOf('status') && !oneLineOf('growth');
    return { ok, got: ok ? 'matched' : 'missed' };
  },
};
