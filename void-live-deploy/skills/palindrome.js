/**
 * palindrome skill — check if a word or phrase is a palindrome
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "is racecar a palindrome", "palindrome check", "is a man a plan a canal panama a palindrome".
 */
export function isPalindromeAsk(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:please\s+)?(?:is\s+.+?\s+(?:a\s+)?palindrome|palindrome(?:\s+check)?(?:\s+please)?)$/i.test(t);
}

function isPal(s) {
  const c = String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return c.length > 1 && c === c.split('').reverse().join('');
}

function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  const m = /is\s+(.+?)\s+(?:a\s+)?palindrome/i.exec(t);
  const phrase = m ? m[1] : 'racecar';
  const yes = isPal(phrase);
  showPage((p) => {
    p.innerHTML = '<h2>Palindrome</h2><p style="font-size:24px;text-align:center">“' + esc(phrase) + '” is ' + (yes ? '' : 'not ') + 'a palindrome</p><div class="sub">ignores spaces and punctuation · say “is … a palindrome”</div>';
  });
  return 'palindrome';
}

export default {
  name: 'palindrome',
  examples: ['is racecar a palindrome', 'palindrome check', 'is a man a plan a canal panama a palindrome'],
  nearMisses: ['what is a palindrome', 'palindrome poem', 'is this a word'],
  match(lower, text) { return isPalindromeAsk(text); },
  run,
  suite() {
    const ok = isPalindromeAsk('is racecar a palindrome') && isPalindromeAsk('palindrome check') && !isPalindromeAsk('what is a palindrome');
    return { ok, got: 'match works' };
  }
};
