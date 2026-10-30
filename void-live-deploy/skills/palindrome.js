/**
 * palindrome skill — check if a word or phrase is a palindrome
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "is racecar a palindrome", "palindrome of a man a plan a canal panama".
 */
export function isPalindrome(text) {
  return /^(?:please\s+)?(?:is\s+[\w\s]+\s+a\s+palindrome|palindrome(?:\s+of\s+[\w\s]+)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function checkPal(s) {
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean === clean.split('').reverse().join('');
}

function run(text, api) {
  const { showPage, esc } = api;
  const m = /(?:is\s+|of\s+)([\w\s]+)/i.exec(text || '');
  const phrase = m ? m[1].trim() : 'racecar';
  const yes = checkPal(phrase);
  showPage((p) => {
    p.innerHTML = '<h2>Palindrome</h2><p style="font-size:24px;text-align:center">' + esc(phrase) + ' is ' + (yes ? '' : 'not ') + 'a palindrome.</p><div class="sub">say “is racecar a palindrome”</div>';
  });
  return 'palindrome';
}

export default {
  name: 'palindrome',
  examples: ['is racecar a palindrome', 'palindrome of a man a plan a canal panama', 'palindrome'],
  nearMisses: ['what is a palindrome', 'palindrome checker', 'buy palindrome'],
  match(lower, text) { return isPalindrome(text); },
  run,
  suite() {
    const ok = isPalindrome('is racecar a palindrome') && isPalindrome('palindrome') && !isPalindrome('what is a palindrome');
    return { ok, got: 'match works' };
  }
};
