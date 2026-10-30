/**
 * palindrome skill — check if a word or phrase is a palindrome
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "is racecar a palindrome", "palindrome check".
 * Empty surface stays empty; the result is an outcome page.
 */
export function isPalindromeAsk(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  return /^(?:please\s+)?(?:is\s+.+\s+a\s+palindrome|palindrome(?:\s+check)?(?:\s+of\s+.+)?)$/i.test(t);
}

function isPal(s) {
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean === clean.split('').reverse().join('');
}

function run(text, api) {
  const { showPage, esc } = api;
  const m = text.match(/is\s+(.+?)\s+a\s+palindrome/i) || text.match(/palindrome(?:\s+check)?(?:\s+of\s+)?(.+)/i);
  const word = m ? m[1].trim() : 'racecar';
  const ok = isPal(word);
  showPage((p) => {
    p.innerHTML = '<h2>Palindrome</h2><p>' + esc(word) + ' is ' + (ok ? '' : 'not ') + 'a palindrome.</p>';
  });
  return 'palindrome';
}

export default {
  name: 'palindrome',
  examples: ['is racecar a palindrome', 'palindrome check of level'],
  nearMisses: ['what is a palindrome', 'palindrome puzzle'],
  match(lower, text) { return isPalindromeAsk(text); },
  run,
  suite() {
    const ok = isPalindromeAsk('is racecar a palindrome') && isPalindromeAsk('palindrome check') && !isPalindromeAsk('what is a palindrome');
    return { ok, got: 'match works' };
  }
};
