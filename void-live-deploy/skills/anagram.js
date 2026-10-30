/**
 * anagram skill — scramble a word or check if two words are anagrams
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "anagram of cat", "scramble listen", "are cat and act anagrams".
 */
export function isAnagram(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:please\s+)?(?:(?:anagram|scramble)\s+(?:of\s+)?[a-z]{2,20}|are\s+[a-z]+\s+and\s+[a-z]+\s+anagrams?)$/i.test(t);
}

function scramble(word) {
  const a = word.split('');
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.join('');
}

function isAnagramPair(a, b) {
  const s = (w) => w.toLowerCase().split('').sort().join('');
  return s(a) === s(b) && a.toLowerCase() !== b.toLowerCase();
}

function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  const pair = /are\s+([a-z]+)\s+and\s+([a-z]+)\s+anagrams?/i.exec(t);
  if (pair) {
    const yes = isAnagramPair(pair[1], pair[2]);
    showPage((p) => {
      p.innerHTML = '<h2>Anagrams</h2><p style="font-size:24px;text-align:center">' + esc(pair[1]) + ' and ' + esc(pair[2]) + ' are ' + (yes ? '' : 'not ') + 'anagrams</p>';
    });
  } else {
    const m = /(?:anagram|scramble)\s+(?:of\s+)?([a-z]{2,20})/i.exec(t);
    const word = m ? m[1] : 'listen';
    const out = scramble(word);
    showPage((p) => {
      p.innerHTML = '<h2>Anagram</h2><p style="font-size:28px;text-align:center">' + esc(word) + ' → ' + esc(out) + '</p><div class="sub">say “anagram of word” or “are a and b anagrams”</div>';
    });
  }
  return 'anagram';
}

export default {
  name: 'anagram',
  examples: ['anagram of cat', 'scramble listen', 'are cat and act anagrams'],
  nearMisses: ['what is an anagram', 'anagram puzzle', 'scramble eggs'],
  match(lower, text) { return isAnagram(text); },
  run,
  suite() {
    const ok = isAnagram('anagram of cat') && isAnagram('are cat and act anagrams') && !isAnagram('what is an anagram');
    return { ok, got: 'match works' };
  }
};
