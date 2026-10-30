/**
 * anagram skill — scramble a word or check if two words are anagrams
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "anagram of cat", "are listen and silent anagrams".
 * Empty surface stays empty; the result is an outcome page.
 */
export function isAnagram(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  return /^(?:please\s+)?(?:anagram(?:s)?\s+(?:of\s+)?\w+|are\s+\w+\s+and\s+\w+\s+anagrams?)$/i.test(t);
}

function scramble(word) {
  const a = word.split('');
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.join('');
}
function isAnag(a, b) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '').split('').sort().join('');
  return norm(a) === norm(b) && a !== b;
}

function run(text, api) {
  const { showPage, esc } = api;
  const t = text.toLowerCase();
  const check = t.match(/are\s+(\w+)\s+and\s+(\w+)\s+anagrams?/);
  if (check) {
    const ok = isAnag(check[1], check[2]);
    showPage((p) => { p.innerHTML = '<h2>Anagram</h2><p>' + esc(check[1]) + ' and ' + esc(check[2]) + ' are ' + (ok ? '' : 'not ') + 'anagrams.</p>'; });
    return 'anagram';
  }
  const of = t.match(/anagram(?:s)?\s+(?:of\s+)?(\w+)/);
  if (of) {
    const sc = scramble(of[1]);
    showPage((p) => { p.innerHTML = '<h2>Anagram</h2><p>Anagram of ' + esc(of[1]) + ': <strong>' + esc(sc) + '</strong></p><div class="sub">say it again for another</div>'; });
    return 'anagram';
  }
  return 'none';
}

export default {
  name: 'anagram',
  examples: ['anagram of cat', 'are listen and silent anagrams'],
  nearMisses: ['what is an anagram', 'anagram puzzle'],
  match(lower, text) { return isAnagram(text); },
  run,
  suite() {
    const ok = isAnagram('anagram of cat') && isAnagram('are listen and silent anagrams') && !isAnagram('what is an anagram');
    return { ok, got: 'match works' };
  }
};
