/**
 * lorem skill — generate lorem ipsum placeholder text
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "lorem ipsum", "generate placeholder text", "give me some lorem".
 */
const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';

export function isLorem(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  return /^(?:please\s+)?(?:(?:generate|give\s+me|make)\s+(?:some\s+)?(?:lorem|placeholder)\s*(?:ipsum|text)?|lorem\s*(?:ipsum)?|placeholder\s+text)$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  const n = /(\d+)/.exec(text) ? Math.min(5, Math.max(1, +RegExp.$1)) : 1;
  const paras = Array.from({ length: n }, () => LOREM).join('</p><p>');
  showPage((p) => {
    p.innerHTML = '<h2>Lorem ipsum</h2><p>' + paras + '</p><div class="sub">say “generate more lorem” or “3 paragraphs of lorem”</div><div class="src">Classic placeholder text.</div>';
  });
  return 'lorem';
}

export default {
  name: 'lorem',
  examples: ['lorem ipsum', 'generate placeholder text', 'give me some lorem', '3 paragraphs of lorem'],
  nearMisses: ['what is lorem ipsum', 'latin text', 'dummy text meaning'],
  match(lower, text) { return isLorem(text); },
  run,
  suite() {
    const ok = isLorem('lorem ipsum') && isLorem('generate placeholder text') && !isLorem('what is lorem ipsum');
    return { ok, got: 'match works' };
  }
};
