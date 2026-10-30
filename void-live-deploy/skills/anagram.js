/**
 * anagram skill — scramble a word or check if two words are anagrams
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "anagram of listen", "are silent and listen anagrams", "scramble cat".
 */
export function isAnagram(text) {
  return /^(?:please\\s+)?(?:(?:is\\s+|are\\s+)?(?:[a-z]+\\s+and\\s+[a-z]+\\s+)?anagrams?|anagram\\s+of\\s+[a-z]+|scramble(?:\\s+the)?\\s+word\\s+[a-z]+|check\\s+if\\s+[a-z]+\\s+(?:and\\s+[a-z]+\\s+)?(?:is\\s+)?an\\s+anagram)(?:\\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function sorted(w) { return w.toLowerCase().split('').sort().join(''); }

function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '').toLowerCase();
  let html = '';
  const two = /([a-z]+)\\s+and\\s+([a-z]+)/.exec(t);
  if (two) {
    const a = two[1], b = two[2];
    const yes = sorted(a) === sorted(b) && a !== b;
    html = '<p style="font-size:24px;text-align:center">' + esc(a) + ' and ' + esc(b) + ' ' + (yes ? 'are' : 'are not') + ' anagrams.</p>';
  } else {
    const one = /(?:anagram\\s+of|scramble(?:\\s+the)?\\s+word)\\s+([a-z]+)/.exec(t);
    const word = one ? one[1] : 'listen';
    const letters = word.split('').sort(() => Math.random() - 0.5).join('');
    html = '<p style="font-size:28px;text-align:center">' + esc(letters) + '</p><div class="sub">scrambled from ' + esc(word) + '</div>';
  }
  showPage((p) => { p.innerHTML = '<h2>Anagram</h2>' + html + '<div class="sub">say “anagram of listen” or “are silent and listen anagrams”</div>'; });
  return 'anagram';
}

export default {
  name: 'anagram',
  examples: ['anagram of listen', 'are silent and listen anagrams', 'scramble the word cat', 'check if dog and god are anagrams'],
  nearMisses: ['what is an anagram', 'anagram puzzle', 'buy anagrams'],
  match(lower, text) { return isAnagram(text); },
  run,
  suite() {
    const ok = isAnagram('anagram of listen') && isAnagram('are silent and listen anagrams') && !isAnagram('what is an anagram');
    return { ok, got: 'match works' };
  }
};
