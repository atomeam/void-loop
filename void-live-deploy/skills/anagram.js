/**
 * anagram skill — scramble a word or check if two words are anagrams
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "scramble the word listen", "are silent and listen anagrams", "anagram of silent".
 */
export function phraseOf(text) {
  const m = /^(?:please\s+)?(?:scramble(?:\s+the\s+word)?\s+(.+)|anagram\s+(?:of|for)\s+(.+)|are\s+(.+?)\s+and\s+(.+?)\s+anagrams?)(?:\s+please)?$/i.exec(String(text || '').trim().replace(/[?!.]+$/, ''));
  if (!m) return null;
  return m[1] ? { type: 'scramble', word: m[1].trim() } : m[2] ? { type: 'scramble', word: m[2].trim() } : { type: 'check', a: m[3].trim(), b: m[4].trim() };
}

export function isAnagramAsk(text) {
  return phraseOf(text) !== null;
}

/** true when two strings are anagrams of each other, ignoring spaces, punctuation and case. Pure. */
export function areAnagrams(a, b) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').split('').sort().join('');
  const na = norm(a), nb = norm(b);
  return na.length > 0 && na === nb;
}

/** scramble the letters of a word. Pure. */
export function scramble(word) {
  const arr = String(word || '').split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

function run(text, api) {
  const { showPage, esc } = api;
  const info = phraseOf(text) || { type: 'scramble', word: 'listen' };
  let html = '';
  if (info.type === 'check') {
    const yes = areAnagrams(info.a, info.b);
    html = '<p style="font-size:24px;text-align:center">' + esc(info.a) + ' and ' + esc(info.b) + '</p><p style="font-size:22px;text-align:center;color:' + (yes ? '#4ef0a0' : '#f04e4e') + '">' + (yes ? 'Yes, they are anagrams.' : 'No, they are not anagrams.') + '</p>';
  } else {
    const scrambled = scramble(info.word);
    html = '<p style="font-size:24px;text-align:center">' + esc(info.word) + ' → ' + esc(scrambled) + '</p><div class="sub">say “scramble the word listen” or “are silent and listen anagrams”</div>';
  }
  showPage((p) => { p.innerHTML = '<h2>Anagram</h2>' + html + '<div class="src">Checked and scrambled here on this device.</div>'; });
  return 'anagram';
}

export default {
  name: 'anagram',
  examples: ['scramble the word listen', 'are silent and listen anagrams', 'anagram of silent'],
  nearMisses: ['what is an anagram', 'anagram solver', 'make an anagram'],
  match(lower, text) { return isAnagramAsk(text); },
  run,
  suite() {
    const ok = isAnagramAsk('scramble the word listen') && areAnagrams('silent', 'listen') && !areAnagrams('hello', 'world') && !isAnagramAsk('what is an anagram');
    return { ok, got: 'match and check work' };
  }
};
