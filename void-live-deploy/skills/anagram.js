/**
 * anagram skill — scramble a word or check if two words are anagrams
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "anagram of hello", "scramble listen", "are listen and silent anagrams".
 * Empty surface stays empty.
 */
export function isAnagram(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  return /^(?:please\s+)?(?:anagram(?:s)?\s+of\s+\w+|scramble\s+\w+|are\s+\w+\s+and\s+\w+\s+anagrams?)$/i.test(t);
}

function scramble(word) {
  const a = word.split('');
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.join('');
}

function areAnagrams(a, b) {
  const na = a.toLowerCase().replace(/[^a-z]/g, '').split('').sort().join('');
  const nb = b.toLowerCase().replace(/[^a-z]/g, '').split('').sort().join('');
  return na === nb && na.length > 0;
}

function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  let out = '';
  const sc = t.match(/^(?:anagram(?:s)?\s+of|scramble)\s+(\w+)$/i);
  if (sc) out = scramble(sc[1]);
  const chk = t.match(/^are\s+(\w+)\s+and\s+(\w+)\s+anagrams?$/i);
  if (chk) out = areAnagrams(chk[1], chk[2]) ? 'Yes, they are anagrams' : 'No, not anagrams';
  showPage((p) => {
    p.innerHTML = '<h2>Anagram</h2><p style="font-size:24px">' + esc(out || 'Try “anagram of hello”') + '</p>';
  });
  return 'anagram';
}

export default {
  name: 'anagram',
  examples: ['anagram of hello', 'scramble listen', 'are listen and silent anagrams'],
  nearMisses: ['what is an anagram', 'anagram puzzle'],
  match(lower, text) { return isAnagram(text); },
  run,
  suite() {
    const ok = isAnagram('anagram of hello') && isAnagram('are listen and silent anagrams') && !isAnagram('what is an anagram');
    return { ok, got: 'match works' };
  }
};
