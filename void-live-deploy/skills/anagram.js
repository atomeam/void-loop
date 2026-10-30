/**
 * anagram skill — scramble a word or check if two words are anagrams
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "anagram of listen", "are silent and listen anagrams".
 */
export function isAnagram(text) {
  return /^(?:please\s+)?(?:(?:make\s+)?anagram(?:\s+of\s+[a-z]+)?|are\s+[a-z]+\s+and\s+[a-z]+\s+anagrams?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function scramble(word) {
  return word.split('').sort(() => Math.random() - 0.5).join('');
}
function isAnag(a, b) {
  return a.toLowerCase().split('').sort().join('') === b.toLowerCase().split('').sort().join('');
}

function run(text, api) {
  const { showPage, esc } = api;
  const m = /(?:of\s+|are\s+)([a-z]+)(?:\s+and\s+([a-z]+))?/i.exec(text || '');
  let html = '';
  if (m && m[2]) {
    html = '<p style="font-size:24px;text-align:center">' + esc(m[1]) + ' and ' + esc(m[2]) + ' are ' + (isAnag(m[1], m[2]) ? '' : 'not ') + 'anagrams.</p>';
  } else if (m) {
    html = '<p style="font-size:28px;text-align:center">' + esc(scramble(m[1])) + '</p><div class="sub">from ' + esc(m[1]) + '</div>';
  } else {
    html = '<p style="font-size:24px;text-align:center">' + esc(scramble('listen')) + '</p><div class="sub">example from listen</div>';
  }
  showPage((p) => { p.innerHTML = '<h2>Anagram</h2>' + html + '<div class="sub">say “anagram of cat” or “are cat and act anagrams”</div>'; });
  return 'anagram';
}

export default {
  name: 'anagram',
  examples: ['anagram of listen', 'are silent and listen anagrams', 'anagram'],
  nearMisses: ['what is an anagram', 'anagram solver', 'buy anagram'],
  match(lower, text) { return isAnagram(text); },
  run,
  suite() {
    const ok = isAnagram('anagram of listen') && isAnagram('are silent and listen anagrams') && !isAnagram('what is an anagram');
    return { ok, got: 'match works' };
  }
};
