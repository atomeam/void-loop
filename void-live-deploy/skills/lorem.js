/**
 * lorem skill — generate lorem ipsum placeholder text
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "lorem", "generate placeholder text", "give me some lorem", "3 paragraphs of lorem".
 * "lorem ipsum", "placeholder text" and the util skill's other asks are util's (asked before this one), so this one leaves them alone.
 */
import { utilOf } from './util.js';

const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';

/** how many paragraphs (1 to 5) the ask wants, or 0 when it is not one for this skill. Pure. */
export function paragraphsOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  const m = /^(?:please\s+)?(?:(?:generate|give\s+me|make)\s+(?:some\s+|more\s+)?(?:lorem|placeholder)\s*(?:ipsum|text)?|(\d{1,2})\s+paragraphs?\s+of\s+(?:lorem|placeholder)\s*(?:ipsum|text)?|lorem\s*(?:ipsum)?|placeholder\s+text)$/.exec(t);
  if (!m || utilOf(text)) return 0;
  return Math.min(5, Math.max(1, +m[1] || 1));
}

export function isLorem(text) {
  return paragraphsOf(text) > 0;
}

function run(text, api) {
  const { showPage, esc } = api;
  const n = paragraphsOf(text) || 1;
  showPage((p) => {
    p.innerHTML = '<h2>Lorem ipsum</h2><p>' + Array.from({ length: n }, () => esc(LOREM)).join('</p><p>') + '</p><div class="sub">say “generate more lorem” or “3 paragraphs of lorem”</div><div class="src">Classic placeholder text.</div>';
  });
  return 'lorem';
}

export default {
  name: 'lorem',
  examples: ['lorem', 'generate placeholder text', 'give me some lorem', '3 paragraphs of lorem'],
  nearMisses: ['what is lorem ipsum', 'latin text', 'dummy text meaning', 'lorem ipsum', '3 paragraphs of lorem ipsum'],
  match(lower, text) { return isLorem(text); },
  run,
  suite() {
    const ok = isLorem('lorem') && isLorem('generate placeholder text') && !isLorem('what is lorem ipsum');
    return { ok, got: 'match works' };
  }
};
