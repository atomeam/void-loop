/**
 * anagram skill — scramble a word or check if two words are anagrams
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "anagram", "scramble word", "are these anagrams".
 */
export function isAnagram(text) {
  return /^(?:please\s+)?(?:(?:scramble|anagram)(?:\s+(?:of\s+|a\s+)?(?:word|this))?|(?:are\s+(?:these|they)\s+)?anagrams?)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, '')) || /anagram\s+of\s+/i.test(text) || /are\s+.+\s+and\s+.+\s+anagrams/i.test(text);
}

function scramble(w) {
  const a = w.split('');
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.join('');
}
function isAnag(a, b) {
  return a.toLowerCase().replace(/\s/g, '').split('').sort().join('') === b.toLowerCase().replace(/\s/g, '').split('').sort().join('');
}

function run(text, api) {
  const { showPage, esc } = api;
  const m = text.match(/anagram\s+of\s+([a-z]+)/i) || text.match(/scramble\s+([a-z]+)/i);
  const check = text.match(/are\s+([a-z]+)\s+and\s+([a-z]+)\s+anagrams/i);
  showPage((p) => {
    if (m) {
      const word = m[1];
      p.innerHTML = '<h2>Anagram</h2><p style="font-size:24px;text-align:center">' + esc(scramble(word)) + '</p><div class="sub">from ' + esc(word) + '</div>';
    } else if (check) {
      const yes = isAnag(check[1], check[2]);
      p.innerHTML = '<h2>Anagrams?</h2><p style="font-size:24px;text-align:center">' + esc(check[1]) + ' and ' + esc(check[2]) + ': ' + (yes ? 'Yes' : 'No') + '</p>';
    } else {
      p.innerHTML = '<h2>Anagram</h2><p>Say “anagram of hello” or “are listen and silent anagrams”</p>';
    }
  });
  return 'anagram';
}

export default {
  name: 'anagram',
  examples: ['anagram', 'scramble word', 'anagram of hello', 'are listen and silent anagrams'],
  nearMisses: ['what is an anagram', 'anagram dictionary'],
  match(lower, text) { return isAnagram(text); },
  run,
  suite() {
    const ok = isAnagram('anagram') && isAnagram('anagram of hello') && isAnagram('are cat and act anagrams') && !isAnagram('what is an anagram');
    return { ok, got: 'match works' };
  }
};
