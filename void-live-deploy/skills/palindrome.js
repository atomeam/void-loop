/**
 * palindrome skill — check if a word or phrase is a palindrome
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "is racecar a palindrome", "check palindrome for a man a plan a canal panama".
 */
export function isPalindromeAsk(text) {
  return /^(?:please\s+)?(?:(?:is|check)\s+(?:if\s+)?)?.+\s+(?:a\s+)?palindrome(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function isPal(s) {
  const norm = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return norm === norm.split('').reverse().join('');
}

function run(text, api) {
  const { showPage, esc } = api;
  const m = /(?:is|check(?:\s+if)?)\s+(.+?)\s+(?:a\s+)?palindrome/i.exec(text || '') || /palindrome\s+(?:for\s+)?(.+)/i.exec(text || '');
  const phrase = m ? m[1].trim() : 'racecar';
  const yes = isPal(phrase);
  showPage((p) => { p.innerHTML = '<h2>Palindrome</h2><p style="font-size:24px;text-align:center">“' + esc(phrase) + '” ' + (yes ? 'is' : 'is not') + ' a palindrome.</p><div class="sub">say “is ' + esc(phrase) + ' a palindrome”</div>'; });
  return 'palindrome';
}

export default {
  name: 'palindrome',
  examples: ['is racecar a palindrome', 'check if a man a plan a canal panama is a palindrome', 'palindrome for kayak'],
  nearMisses: ['what is a palindrome', 'palindrome words', 'anagram'],
  match(lower, text) { return isPalindromeAsk(text); },
  run,
  suite() {
    const ok = isPalindromeAsk('is racecar a palindrome') && isPalindromeAsk('check palindrome for kayak') && !isPalindromeAsk('what is a palindrome');
    return { ok, got: 'match works' };
  }
};
