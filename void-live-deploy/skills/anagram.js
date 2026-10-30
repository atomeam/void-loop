/**
 * anagram skill — scramble a word or check if two words are anagrams
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "anagram of listen", "are silent and listen anagrams", "scramble the word".
 */
export function isAnagram(text) {
  return /^(?:please\s+)?(?:(?:make\s+)?anagram(?:\s+of\s+\w+)?|scramble(?:\s+the\s+)?(?:word\s+)?\w+|are\s+\w+\s+and\s+\w+\s+anagrams?)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
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
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '').split('').sort().join('');
  return norm(a) === norm(b) && norm(a).length > 0;
}

function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '').toLowerCase();
  let html = '<h2>Anagram</h2>';
  const check = /are\s+(\w+)\s+and\s+(\w+)\s+anagrams?/i.exec(t);
  if (check) {
    const yes = areAnagrams(check[1], check[2]);
    html += '<p style="font-size:24px;text-align:center">' + esc(check[1]) + ' and ' + esc(check[2]) + ' are ' + (yes ? '' : 'not ') + 'anagrams.</p>';
  } else {
    const word = /(?:of|word)\s+(\w+)/i.exec(t) || /scramble\s+(?:the\s+)?(?:word\s+)?(\w+)/i.exec(t);
    const w = word ? word[1] : 'listen';
    const scr = scramble(w);
    html += '<p style="font-size:28px;text-align:center">' + esc(w) + ' → ' + esc(scr) + '</p>';
  }
  html += '<div class="sub">say “anagram of cat” or “are cat and act anagrams”</div>';
  showPage((p) => { p.innerHTML = html; });
  return 'anagram';
}

export default {
  name: 'anagram',
  examples: ['anagram of listen', 'scramble the word hello', 'are silent and listen anagrams', 'anagram'],
  nearMisses: ['what is an anagram', 'anagram solver online'],
  match(lower, text) { return isAnagram(text); },
  run,
  suite() {
    const ok = isAnagram('anagram of listen') && isAnagram('are silent and listen anagrams') && !isAnagram('what is an anagram');
    return { ok, got: 'match works' };
  }
};
