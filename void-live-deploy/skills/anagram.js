/**
 * anagram skill — scramble a word or check if two words are anagrams
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "anagram", "scramble word", "are these anagrams".
 */
export function isAnagram(text) {
  return /^(?:please\s+)?(?:(?:scramble|anagram)(?:\s+(?:a\s+)?word)?|are\s+these\s+anagrams|check\s+anagrams?)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function scramble(w) {
  const a = w.split('');
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
  const update = (p, out = '') => {
    p.innerHTML = '<h2>Anagram</h2><p>Enter a word to scramble, or two words to check:</p>' +
      '<input id="ana-in" style="font-size:18px;width:80%" placeholder="word or word1 word2"> <button id="ana-go" class="g-btn">Go</button>' +
      (out ? '<p style="font-size:22px;margin-top:12px">' + esc(out) + '</p>' : '') +
      '<div class="sub">say “anagram” to start over</div>';
    const inp = p.querySelector('#ana-in'), btn = p.querySelector('#ana-go');
    const go = () => {
      const v = (inp.value || '').trim();
      const parts = v.split(/\s+/);
      let result = '';
      if (parts.length === 1 && parts[0]) result = 'Scrambled: ' + scramble(parts[0]);
      else if (parts.length >= 2) result = isAnag(parts[0], parts[1]) ? 'Yes, they are anagrams' : 'No, not anagrams';
      else result = 'Enter a word or two';
      update(p, result);
    };
    btn.addEventListener('click', (e) => { e.stopPropagation(); go(); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.stopPropagation(); go(); } });
  };
  showPage((p) => update(p));
  return 'anagram';
}

export default {
  name: 'anagram',
  examples: ['anagram', 'scramble a word', 'are these anagrams', 'check anagrams'],
  nearMisses: ['what is an anagram', 'anagram solver', 'word games'],
  match(lower, text) { return isAnagram(text); },
  run,
  suite() {
    const ok = isAnagram('anagram') && isAnagram('scramble a word') && !isAnagram('what is an anagram');
    return { ok, got: 'match works' };
  }
};
