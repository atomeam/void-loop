/**
 * palindrome skill — check if a word or phrase is a palindrome
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "is racecar a palindrome", "palindrome check for a man a plan a canal panama", "check if kayak is a palindrome".
 */
export function phraseOf(text) {
  const m = /^(?:please\s+)?(?:is\s+(.+?)\s+a\s+palindrome|palindrome\s+(?:check\s+)?(?:for|of)\s+(.+)|check\s+if\s+(.+?)\s+is\s+a\s+palindrome)(?:\s+please)?$/i.exec(String(text || '').trim().replace(/[?!.]+$/, ''));
  return m ? (m[1] || m[2] || m[3]).trim() : null;
}

export function isPalindromeAsk(text) {
  return phraseOf(text) !== null;
}

/** true when the phrase reads the same forwards and backwards, ignoring spaces, punctuation and case. Pure. */
export function isPalindrome(phrase) {
  const clean = String(phrase || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean.length > 0 && clean === clean.split('').reverse().join('');
}

function run(text, api) {
  const { showPage, esc } = api;
  const phrase = phraseOf(text) || 'racecar';
  const yes = isPalindrome(phrase);
  showPage((p) => {
    p.innerHTML = '<h2>Palindrome</h2><p style="font-size:28px;text-align:center">' + esc(phrase) + '</p><p style="font-size:22px;text-align:center;color:' + (yes ? '#4ef0a0' : '#f04e4e') + '">' + (yes ? 'Yes, it is a palindrome.' : 'No, it is not a palindrome.') + '</p><div class="sub">say “is racecar a palindrome”</div><div class="src">Checked here on this device.</div>';
  });
  return 'palindrome';
}

export default {
  name: 'palindrome',
  examples: ['is racecar a palindrome', 'palindrome check for a man a plan a canal panama', 'check if kayak is a palindrome'],
  nearMisses: ['what is a palindrome', 'palindrome examples', 'make a palindrome'],
  match(lower, text) { return isPalindromeAsk(text); },
  run,
  suite() {
    const ok = isPalindromeAsk('is racecar a palindrome') && isPalindrome('racecar') && isPalindrome('a man a plan a canal panama') && !isPalindrome('hello') && !isPalindromeAsk('what is a palindrome');
    return { ok, got: 'match and check work' };
  }
};
