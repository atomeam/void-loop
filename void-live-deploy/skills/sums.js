/**
 * sums skill — a word problem worked on the card (no model). "if 3 apples cost 2.40 how much do 7 cost",
 * "a train travels 120 km in 2 hours what is its speed". A bare "how much is left" has nothing to subtract from.
 */
/** { kind: 'which' } or { kind: 'sum', value, line } or null. Pure. */
export function sumOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!t || t.length > 180) return null;
  if (/^how much is left$/i.test(t)) return { kind: 'which' };
  let m = t.match(/(\d+(?:\.\d+)?)\s+apples?\s+cost\s+\$?(\d+(?:\.\d+)?)\b.*?\b(\d+(?:\.\d+)?)\b/i);
  if (m && Number(m[1])) {
    const value = Math.round(Number(m[3]) / Number(m[1]) * Number(m[2]) * 100) / 100;
    return { kind: 'sum', value, line: m[3] + ' × (' + m[2] + ' / ' + m[1] + ') = ' + value };
  }
  m = t.match(/(\d+(?:\.\d+)?)\s*km\b.*?\b(\d+(?:\.\d+)?)\s*hours?/i);
  if (m && Number(m[2])) {
    const value = Math.round(Number(m[1]) / Number(m[2]) * 10) / 10;
    return { kind: 'sum', value, line: m[1] + ' km / ' + m[2] + ' h = ' + value + ' km/h' };
  }
  m = t.match(/\bhave\s+(\d+(?:\.\d+)?)\b.*\bhalf\b.*\bfind\s+(\d+(?:\.\d+)?)/i);
  if (m) {
    const value = Number(m[1]) / 2 + Number(m[2]);
    return { kind: 'sum', value, line: m[1] + ' / 2 + ' + m[2] + ' = ' + value };
  }
  m = t.match(/(\d+(?:\.\d+)?)\s+\S+\s+cuestan\s+(\d+(?:\.\d+)?)\b.*?\b(\d+(?:\.\d+)?)\b/i);
  if (m && Number(m[1])) {
    const value = Math.round(Number(m[3]) / Number(m[1]) * Number(m[2]) * 100) / 100;
    return { kind: 'sum', value, line: m[3] + ' × (' + m[2] + ' / ' + m[1] + ') = ' + value };
  }
  m = t.match(/^\d+(?:\s*[+\-]\s*\d+)+$/);
  if (m) {
    const parts = t.split(/[+\-]/).map(n => Number(n.trim()));
    const op = t.includes('-') ? '-' : '+';
    const value = op === '+' ? parts.reduce((a, b) => a + b, 0) : parts.reduce((a, b) => a - b, 0);
    return { kind: 'sum', value, line: t };
  }
  return null;
}

function run(text, api) {
  const q = sumOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  showPage((el) => {
    el.dataset.cardKind = 'Sum';
    if (q.kind === 'which') {
      el.innerHTML = '<h2>How much is left</h2><p>Which total? There are several things that could be left, and this ask does not name one.</p>';
      return;
    }
    const shown = Number.isInteger(q.value) ? String(q.value) : q.value.toFixed(2);
    el.innerHTML = '<h2>' + esc(shown) + '</h2><p>' + esc(q.line) + '</p><div class="src">Worked out on this device.</div>';
  });
  return 'sums';
}

export default {
  name: 'sums',
  examples: ['if 3 apples cost 2.40 how much do 7 cost', 'a train travels 120 km in 2 hours what is its speed', '400 + 562 + 129'],
  nearMisses: ['what is 15% of 80', 'add vat to 100', 'how much is bitcoin', 'recipe for apple pie'],
  match(lower, text) { return !!sumOf(text || lower); },
  run,
};
