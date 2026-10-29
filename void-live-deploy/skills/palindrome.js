/**
 * palindrome skill — check if a word or phrase is a palindrome
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "palindrome", "is this a palindrome".
 */
export function isPalindrome(text) {
  return /^(?:please\s+)?(?:(?:check|is\s+this\s+a?)\s+)?palindrome(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function isPal(s) {
  const n = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return n === n.split('').reverse().join('') && n.length > 0;
}

function run(text, api) {
  const { showPage, esc } = api;
  const update = (p, out = '') => {
    p.innerHTML = '<h2>Palindrome</h2><p>Enter a word or phrase:</p>' +
      '<input id="pal-in" style="font-size:18px;width:80%" placeholder="e.g. racecar or a man a plan a canal panama"> <button id="pal-go" class="g-btn">Check</button>' +
      (out ? '<p style="font-size:22px;margin-top:12px">' + esc(out) + '</p>' : '') +
      '<div class="sub">say “palindrome” to start over</div>';
    const inp = p.querySelector('#pal-in'), btn = p.querySelector('#pal-go');
    const go = () => {
      const v = (inp.value || '').trim();
      const result = v ? (isPal(v) ? 'Yes, it is a palindrome' : 'No, not a palindrome') : 'Enter something';
      update(p, result);
    };
    btn.addEventListener('click', (e) => { e.stopPropagation(); go(); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.stopPropagation(); go(); } });
  };
  showPage((p) => update(p));
  return 'palindrome';
}

export default {
  name: 'palindrome',
  examples: ['palindrome', 'is this a palindrome', 'check palindrome'],
  nearMisses: ['what is a palindrome', 'palindrome examples', 'word play'],
  match(lower, text) { return isPalindrome(text); },
  run,
  suite() {
    const ok = isPalindrome('palindrome') && isPalindrome('is this a palindrome') && !isPalindrome('what is a palindrome');
    return { ok, got: 'match works' };
  }
};
