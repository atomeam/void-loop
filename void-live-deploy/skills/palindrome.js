/**
 * palindrome skill — check if a word or phrase is a palindrome
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "palindrome", "is this a palindrome".
 */
export function isPalindromeAsk(text) {
  return /^(?:please\s+)?(?:(?:is\s+(?:this|it)\s+a\s+)?palindrome|(?:check|is)\s+.+\s+a\s+palindrome)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, '')) || /palindrome\s+of\s+/i.test(text);
}

function isPal(s) {
  const c = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return c === c.split('').reverse().join('');
}

function run(text, api) {
  const { showPage, esc } = api;
  const m = text.match(/(?:is\s+)?(.+?)\s+(?:a\s+)?palindrome/i) || text.match(/palindrome\s+of\s+(.+)/i);
  showPage((p) => {
    if (m) {
      const phrase = m[1].trim();
      const yes = isPal(phrase);
      p.innerHTML = '<h2>Palindrome?</h2><p style="font-size:24px;text-align:center">' + esc(phrase) + ': ' + (yes ? 'Yes' : 'No') + '</p>';
    } else {
      p.innerHTML = '<h2>Palindrome</h2><p>Say “is racecar a palindrome” or “check a man a plan a canal panama”</p>';
    }
  });
  return 'palindrome';
}

export default {
  name: 'palindrome',
  examples: ['palindrome', 'is racecar a palindrome', 'check a man a plan a canal panama'],
  nearMisses: ['what is a palindrome', 'palindrome list'],
  match(lower, text) { return isPalindromeAsk(text); },
  run,
  suite() {
    const ok = isPalindromeAsk('palindrome') && isPalindromeAsk('is racecar a palindrome') && !isPalindromeAsk('what is a palindrome');
    return { ok, got: 'match works' };
  }
};
