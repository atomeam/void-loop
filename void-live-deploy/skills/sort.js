/**
 * sort skill — sort a list of items alphabetically or numerically
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "sort apple banana cherry", "sort these numbers 3 1 2", "alphabetical sort".
 */
export function isSort(text) {
  return /^(?:please\s+)?(?:(?:alphabetical\s+)?sort(?:\s+these)?(?:\s+numbers)?(?:\s+\S+)+)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '').toLowerCase();
  const nums = /numbers?/i.test(t);
  const items = t.replace(/^(?:please\s+)?(?:alphabetical\s+)?sort(?:\s+these)?(?:\s+numbers)?\s+/, '').trim().split(/\s+/).filter(Boolean);
  const sorted = nums ? items.map(Number).sort((a, b) => a - b).map(String) : items.slice().sort();
  showPage((p) => {
    p.innerHTML = '<h2>Sort</h2><p style="font-size:24px;text-align:center">' + esc(items.join(' ')) + ' → ' + esc(sorted.join(' ')) + '</p><div class="sub">say “sort a b c” or “sort numbers 3 1 2”</div>';
  });
  return 'sort';
}

export default {
  name: 'sort',
  examples: ['sort apple banana cherry', 'sort numbers 3 1 2', 'alphabetical sort hello world'],
  nearMisses: ['what is sort', 'sort algorithm'],
  match(lower, text) { return isSort(text); },
  run,
  suite() {
    const ok = isSort('sort a b c') && isSort('sort numbers 1 2') && !isSort('what is sort');
    return { ok, got: 'match works' };
  }
};
