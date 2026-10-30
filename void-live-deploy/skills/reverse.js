/**
 * reverse skill — reverse a string or words
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "reverse hello", "reverse the words in this sentence", "reverse text".
 */
export function isReverse(text) {
  return /^(?:please\s+)?(?:reverse(?:\s+the\s+words\s+in)?(?:\s+\S+)?|reverse\s+text)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function reverse(str, words = false) {
  if (words) return str.split(/\s+/).reverse().join(' ');
  return str.split('').reverse().join('');
}

function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '').trim();
  const words = /words\s+in/i.test(t);
  const m = /reverse\s+(?:the\s+words\s+in\s+)?(.+)/i.exec(t);
  const input = m ? m[1].replace(/please$/i, '').trim() : 'hello';
  const out = reverse(input, words);
  showPage((p) => {
    p.innerHTML = '<h2>Reverse</h2><p style="font-size:24px;text-align:center">' + esc(input) + ' → ' + esc(out) + '</p><div class="sub">say “reverse hello” or “reverse the words in this is a test”</div>';
  });
  return 'reverse';
}

export default {
  name: 'reverse',
  examples: ['reverse hello', 'reverse the words in this is a test', 'reverse text'],
  nearMisses: ['what is reverse', 'reverse engineering'],
  match(lower, text) { return isReverse(text); },
  run,
  suite() {
    const ok = isReverse('reverse hello') && isReverse('reverse the words in hi') && !isReverse('what is reverse');
    return { ok, got: 'match works' };
  }
};
