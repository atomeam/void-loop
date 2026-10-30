/**
 * palindrome skill — check if a word or phrase is a palindrome
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "is racecar a palindrome", "palindrome of a man a plan a canal panama", "is this a palindrome".
 * Empty surface stays empty: the card appears only when summoned.
 */
export function isPalindromeAsk(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:please\s+)?(?:is\s+.+\s+a\s+palindrome|palindrome(?:\s+of\s+.+)?|check\s+if\s+.+\s+is\s+a\s+palindrome)$/i.test(t);
}

function isPal(s) {
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean === clean.split('').reverse().join('') && clean.length > 1;
}

function run(text, api) {
  const { showPage, esc } = api;
  const m = /(?:is\s+|palindrome\s+of\s+|check\s+if\s+)(.+?)(?:\s+a\s+palindrome|\s+is\s+a\s+palindrome)?$/i.exec(text) || [null, 'racecar'];
  const phrase = m[1].trim();
  const yes = isPal(phrase);
  showPage((p) => {
    p.innerHTML = '<h2>Palindrome</h2><p style="font-size:24px;text-align:center">“' + esc(phrase) + '” ' + (yes ? 'is' : 'is not') + ' a palindrome.</p>';
  });
  return 'palindrome';
}

export default {
  name: 'palindrome',
  examples: ['is racecar a palindrome', 'palindrome of a man a plan a canal panama', 'is kayak a palindrome'],
  nearMisses: ['what is a palindrome', 'palindrome poem', 'reverse the word'],
  match(lower, text) { return isPalindromeAsk(text); },
  run,
  suite() {
    const ok = isPalindromeAsk('is racecar a palindrome') && isPalindromeAsk('palindrome of radar') && !isPalindromeAsk('what is a palindrome');
    return { ok, got: 'match works' };
  }
};
