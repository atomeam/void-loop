/**
 * wordcount skill — how many words in the rest of the ask.
 * Empty surface stays empty.
 */
export function wordCountOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  const m = t.match(/^(?:how many words (?:are )?(?:in|is) |count the words in |word count (?:of |for )?)(.+)$/i);
  if (!m) return null;
  const rest = m[1].trim();
  if (!rest) return null;
  return { text: rest, count: rest.split(/\s+/).filter(Boolean).length };
}
async function run(text, api) {
  const hit = wordCountOf(text);
  if (!hit) return 'none';
  const { showPage, esc } = api;
  showPage((p) => {
    p.innerHTML = '<h2>Word count</h2><div style="font-size:48px;font-weight:300">' + hit.count + '</div>'
      + '<div class="sub">' + esc(hit.count === 1 ? 'word' : 'words') + '</div>'
      + '<p style="color:#8a8a8a;font-size:13px">' + esc(hit.text.slice(0, 120)) + (hit.text.length > 120 ? '…' : '') + '</p>';
  });
  return 'wordcount';
}
export function suite() {
  const a = wordCountOf('how many words in hello world');
  const b = wordCountOf('count the words in one');
  const ok = a && a.count === 2 && b && b.count === 1 && wordCountOf('what is a word') === null;
  return { ok, got: ok ? '2 and 1' : 'miss' };
}
export default {
  name: 'wordcount',
  examples: ['how many words in hello world this is a test', 'count the words in the quick brown fox', 'word count of one two three'],
  nearMisses: ['what is a word', 'count the letters', 'how many characters'],
  match(lower, text) { return !!wordCountOf(text); },
  run,
  suite
};
