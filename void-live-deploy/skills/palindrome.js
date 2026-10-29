/**
 * palindrome skill — check if a word or phrase is a palindrome
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "is racecar a palindrome", "palindrome check for a man a plan a canal panama", "is it a palindrome: kayak".
 * Empty surface stays empty.
 */
export function isPalindromeAsk(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  return /^(?:please\s+)?(?:is\s+.+?\s+a\s+palindrome|palindrome\s+check(?:\s+for)?\s+.+|is\s+it\s+a\s+palindrome:\s+.+)$/i.test(t);
}

export function isPalindrome(str) {
  const clean = String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean.length > 0 && clean === clean.split('').reverse().join('');
}

function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  let phrase = '';
  const m1 = t.match(/^is\s+(.+?)\s+a\s+palindrome$/i);
  const m2 = t.match(/^palindrome\s+check(?:\s+for)?\s+(.+)$/i);
  const m3 = t.match(/^is\s+it\s+a\s+palindrome:\s+(.+)$/i);
  if (m1) phrase = m1[1];
  else if (m2) phrase = m2[1];
  else if (m3) phrase = m3[1];
  const yes = isPalindrome(phrase);
  showPage((p) => {
    p.innerHTML = '<h2>Palindrome</h2><p style="font-size:24px">' + esc(yes ? 'Yes, “' + phrase + '” is a palindrome' : 'No, “' + phrase + '” is not a palindrome') + '</p>';
  });
  return 'palindrome';
}

export default {
  name: 'palindrome',
  examples: ['is racecar a palindrome', 'palindrome check for a man a plan a canal panama', 'is it a palindrome: kayak'],
  nearMisses: ['what is a palindrome', 'palindrome meaning'],
  match(lower, text) { return isPalindromeAsk(text); },
  run,
  suite() {
    const ok = isPalindromeAsk('is racecar a palindrome') && isPalindrome('racecar') && !isPalindromeAsk('what is a palindrome');
    return { ok, got: 'match works' };
  }
};
