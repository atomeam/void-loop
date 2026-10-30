/**
 * anagram skill — scramble a word or check if two words are anagrams
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "anagram of listen", "are silent and listen anagrams", "scramble the word".
 */
export function isAnagram(text) {
  return /^(?:please\s+)?(?:(?:is|are)\s+.+\s+anagrams?|anagram\s+(?:of\s+)?[a-z]+|scramble\s+(?:the\s+)?(?:word\s+)?[a-z]+)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function isAnag(a, b) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '').split('').sort().join('');
  return norm(a) === norm(b) && a !== b;
}

function scramble(word) {
  const arr = word.toLowerCase().split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '').trim();
  let html = '';
  const check = /(?:is|are)\s+(.+?)\s+and\s+(.+?)\s+anagrams?/i.exec(t);
  if (check) {
    const a = check[1].trim(), b = check[2].trim();
    html = '<p style="font-size:24px;text-align:center">' + esc(a) + ' and ' + esc(b) + ' ' + (isAnag(a, b) ? 'are' : 'are not') + ' anagrams.</p>';
  } else {
    const m = /(?:anagram\s+(?:of\s+)?|scramble\s+(?:the\s+)?(?:word\s+)?)([a-z]+)/i.exec(t);
    const word = m ? m[1] : 'listen';
    html = '<p style="font-size:24px;text-align:center">Scramble of ' + esc(word) + ': ' + esc(scramble(word)) + '</p><div class="sub">say “anagram of ' + esc(word) + '” again for another</div>';
  }
  showPage((p) => { p.innerHTML = '<h2>Anagram</h2>' + html; });
  return 'anagram';
}

export default {
  name: 'anagram',
  examples: ['anagram of listen', 'are silent and listen anagrams', 'scramble the word cat'],
  nearMisses: ['what is an anagram', 'anagram puzzle', 'words'],
  match(lower, text) { return isAnagram(text); },
  run,
  suite() {
    const ok = isAnagram('anagram of listen') && isAnagram('are silent and listen anagrams') && !isAnagram('what is an anagram');
    return { ok, got: 'match works' };
  }
};
