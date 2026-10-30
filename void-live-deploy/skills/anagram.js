/**
 * anagram skill — scramble a word or check if two words are anagrams
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "anagram of listen", "are silent and listen anagrams", "scramble the word".
 * Empty surface stays empty: the card appears only when summoned.
 */
export function isAnagram(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:please\s+)?(?:(?:is\s+|are\s+)?(?:\w+\s+and\s+\w+\s+)?anagrams?|anagram\s+(?:of\s+)?\w+|scramble\s+(?:the\s+)?(?:word\s+)?\w+)$/i.test(t);
}

function scramble(word) {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

function areAnagrams(a, b) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '').split('').sort().join('');
  return norm(a) === norm(b) && a !== b;
}

function run(text, api) {
  const { showPage, esc } = api;
  const t = text.toLowerCase();
  const check = /(\w+)\s+and\s+(\w+)/.exec(t);
  if (check && areAnagrams(check[1], check[2])) {
    showPage((p) => { p.innerHTML = '<h2>Anagrams</h2><p style="font-size:24px;text-align:center">Yes: ' + esc(check[1]) + ' and ' + esc(check[2]) + ' are anagrams.</p>'; });
    return 'anagram';
  }
  const of = /(?:anagram\s+of\s+|scramble\s+(?:the\s+)?(?:word\s+)?)(\w+)/i.exec(text);
  const word = of ? of[1] : 'listen';
  const scrambled = scramble(word);
  showPage((p) => { p.innerHTML = '<h2>Anagram</h2><p style="font-size:28px;text-align:center">' + esc(scrambled) + '</p><div class="sub">from “' + esc(word) + '”</div>'; });
  return 'anagram';
}

export default {
  name: 'anagram',
  examples: ['anagram of listen', 'are silent and listen anagrams', 'scramble the word'],
  nearMisses: ['what is an anagram', 'anagram puzzle', 'words'],
  match(lower, text) { return isAnagram(text); },
  run,
  suite() {
    const ok = isAnagram('anagram of listen') && isAnagram('are silent and listen anagrams') && !isAnagram('what is an anagram');
    return { ok, got: 'match works' };
  }
};
