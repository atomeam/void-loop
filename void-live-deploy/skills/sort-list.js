/**
 * sort-list — sort a list of words or numbers. "sort apple banana zebra", "sort numbers 9 2 15 1".
 * Pure. Contract: { name, examples, nearMisses, match, run, suite }
 */
export function sortOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  let m = t.match(/^sort\s+(?:these\s+)?(?:numbers?\s+)?(.+)$/i)
    || t.match(/^(?:alphabetize|alphabetical\s+order)\s*:?\s*(.+)$/i);
  if (!m) return null;
  const raw = m[1].trim();
  if (/^(?:a\s+list|the\s+list|my\s+list)$/i.test(raw)) return null;
  const parts = raw.split(/[,;]+|\s+/).map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length > 80) return null;
  const allNum = parts.every((p) => /^-?\d+(?:\.\d+)?$/.test(p));
  return { parts, numeric: allNum };
}

async function run(text, api) {
  const q = sortOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  const sorted = q.numeric
    ? [...q.parts].sort((a, b) => +a - +b)
    : [...q.parts].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  showPage((p) => {
    p.innerHTML = '<h2>Sorted</h2>'
      + '<div style="font-size:22px;font-weight:300;margin:10px 0;line-height:1.5">' + esc(sorted.join(', ')) + '</div>'
      + '<p style="color:#8a8a8a">' + sorted.length + ' items · ' + (q.numeric ? 'numeric' : 'alphabetical') + '</p>';
  });
  api.say(sorted.join(', '));
  return 'sort-list';
}

export default {
  name: 'sort-list',
  examples: ['sort apple banana zebra', 'sort numbers 9 2 15 1', 'alphabetize red green blue'],
  nearMisses: ['sort algorithm', 'quick sort', 'sort my photos'],
  match(lower, text) { return !!sortOf(text); },
  run,
  suite() {
    const a = sortOf('sort apple banana zebra'), b = sortOf('sort numbers 9 2 15'), c = sortOf('sort algorithm');
    return { ok: !!(a && !a.numeric && a.parts.length === 3 && b && b.numeric && c === null) };
  },
};
