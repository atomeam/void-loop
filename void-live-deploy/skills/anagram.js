/**
 * anagram skill — scramble a word or check if two words are anagrams
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "anagram of hello", "are listen and silent anagrams", "scramble word".
 */
export function isAnagram(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:please\s+)?(?:anagram(?:s)?\s+(?:of|for)\s+\S+|scramble\s+\S+|are\s+\S+\s+and\s+\S+\s+anagrams?)(?:\s+please)?$/i.test(t);
}

export function areAnagrams(a, b) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '').split('').sort().join('');
  return norm(a) === norm(b) && a && b;
}

function scramble(word) {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  let html = '';
  const check = /are\s+(\S+)\s+and\s+(\S+)\s+anagrams?/i.exec(t);
  if (check) {
    const a = check[1], b = check[2];
    const yes = areAnagrams(a, b);
    html = '<p style="font-size:22px;text-align:center">' + esc(a) + ' and ' + esc(b) + ' ' + (yes ? 'are' : 'are not') + ' anagrams.</p>';
  } else {
    const m = /(?:anagram(?:s)?\s+(?:of|for)|scramble)\s+(\S+)/i.exec(t);
    const word = m ? m[1] : 'hello';
    const scr = scramble(word);
    html = '<p style="font-size:28px;text-align:center;font-family:monospace">' + esc(scr) + '</p><div class="sub">scramble of “' + esc(word) + '”</div>';
  }
  showPage((p) => { p.innerHTML = '<h2>Anagram</h2>' + html + '<div class="sub">say “anagram of word” or “are a and b anagrams”</div>'; });
  return 'anagram';
}

export default {
  name: 'anagram',
  examples: ['anagram of hello', 'scramble verse', 'are listen and silent anagrams'],
  nearMisses: ['what is an anagram', 'anagram puzzle', 'buy anagram'],
  match(lower, text) { return isAnagram(text); },
  run,
  suite() {
    const ok = isAnagram('anagram of hello') && isAnagram('are cat and tac anagrams') && !isAnagram('what is anagram');
    return { ok, got: 'match works' };
  }
};
