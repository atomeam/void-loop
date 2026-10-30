/**
 * reverse skill — reverse a word or phrase
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "reverse hello", "reverse the words hello world".
 */
export function isReverse(text) {
  return /^(?:please\\s+)?(?:reverse\\s+(?:the\\s+)?(?:words?\\s+)?[a-z\\s]+)(?:\\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  const m = /reverse\\s+(?:the\\s+)?(?:words?\\s+)?([a-z\\s]+)/i.exec(text || '');
  const phrase = m ? m[1].trim() : 'hello';
  const rev = phrase.split('').reverse().join('');
  showPage((p) => { p.innerHTML = '<h2>Reverse</h2><p style="font-size:24px;text-align:center">' + esc(phrase) + ' → ' + esc(rev) + '</p><div class="sub">say “reverse hello world”</div>'; });
  return 'reverse';
}

export default {
  name: 'reverse',
  examples: ['reverse hello', 'reverse the words hello world', 'reverse cat'],
  nearMisses: ['what is reverse', 'reverse engineering', 'buy reverse'],
  match(lower, text) { return isReverse(text); },
  run,
  suite() {
    const ok = isReverse('reverse hello') && isReverse('reverse the words hello world') && !isReverse('what is reverse');
    return { ok, got: 'match works' };
  }
};
