/**
 * palindrome skill — check if a word or phrase is a palindrome
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "is racecar a palindrome", "check palindrome for a man a plan a canal panama".
 */
export function isPalindromeAsk(text) {
  return /^(?:please\\s+)?(?:is\\s+)?(?:check\\s+if\\s+)?(?:the\\s+)?(?:word\\s+|phrase\\s+)?[a-z\\s]+\\s+(?:is\\s+)?a\\s+palindrome|(?:palindrome\\s+(?:check\\s+)?(?:for|of)\\s+[a-z\\s]+)(?:\\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function isPal(s) {
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean === clean.split('').reverse().join('');
}

function run(text, api) {
  const { showPage, esc } = api;
  const m = /(?:is\\s+|check\\s+if\\s+|palindrome\\s+(?:for|of)\\s+)([a-z\\s]+)/i.exec(text || '');
  const phrase = m ? m[1].trim() : 'racecar';
  const yes = isPal(phrase);
  showPage((p) => { p.innerHTML = '<h2>Palindrome</h2><p style="font-size:24px;text-align:center">"' + esc(phrase) + '" ' + (yes ? 'is' : 'is not') + ' a palindrome.</p><div class="sub">say “is racecar a palindrome”</div>'; });
  return 'palindrome';
}

export default {
  name: 'palindrome',
  examples: ['is racecar a palindrome', 'check if a man a plan a canal panama is a palindrome', 'palindrome of level'],
  nearMisses: ['what is a palindrome', 'palindrome poem', 'buy a palindrome'],
  match(lower, text) { return isPalindromeAsk(text); },
  run,
  suite() {
    const ok = isPalindromeAsk('is racecar a palindrome') && isPalindromeAsk('palindrome of level') && !isPalindromeAsk('what is a palindrome');
    return { ok, got: 'match works' };
  }
};
