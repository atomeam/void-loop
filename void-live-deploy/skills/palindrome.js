/**
 * palindrome skill — check if a word or phrase is a palindrome
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "is racecar a palindrome", "palindrome check of a man a plan a canal panama".
 */
export function isPalindromeAsk(text) {
  return /^(?:please\s+)?(?:is\s+.+?\s+(?:a\s+)?palindrome|palindrome(?:\s+check)?\s+(?:of|for)\s+.+?)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

export function isPal(s) {
  const clean = String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean === clean.split('').reverse().join('') && clean.length > 0;
}

function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  let phrase = 'racecar';
  const m1 = /is\s+(.+?)\s+(?:a\s+)?palindrome/i.exec(t);
  const m2 = /palindrome(?:\s+check)?\s+(?:of|for)\s+(.+)/i.exec(t);
  if (m1) phrase = m1[1];
  else if (m2) phrase = m2[1];
  const yes = isPal(phrase);
  showPage((p) => {
    p.innerHTML = '<h2>Palindrome</h2><p style="font-size:22px;text-align:center">“' + esc(phrase) + '” ' + (yes ? 'is' : 'is not') + ' a palindrome.</p><div class="sub">say “is racecar a palindrome”</div>';
  });
  return 'palindrome';
}

export default {
  name: 'palindrome',
  examples: ['is racecar a palindrome', 'palindrome check of a man a plan a canal panama', 'is level a palindrome'],
  nearMisses: ['what is a palindrome', 'palindrome meaning', 'find palindromes'],
  match(lower, text) { return isPalindromeAsk(text); },
  run,
  suite() {
    const ok = isPalindromeAsk('is racecar a palindrome') && isPal('racecar') && !isPalindromeAsk('what is palindrome');
    return { ok, got: 'match works' };
  }
};
