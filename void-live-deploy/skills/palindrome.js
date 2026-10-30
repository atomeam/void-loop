/**
 * palindrome skill — check if a word or phrase is a palindrome
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "is racecar a palindrome", "palindrome of a man a plan a canal panama", "check palindrome".
 */
export function isPalindromeAsk(text) {
  return /^(?:please\s+)?(?:is\s+.+\s+a\s+palindrome|palindrome(?:\s+of\s+.+)?|check\s+if\s+.+\s+is\s+a\s+palindrome)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function isPal(s) {
  const n = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return n === n.split('').reverse().join('') && n.length > 0;
}

function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '');
  let phrase = 'racecar';
  const m = /(?:is|of|if)\s+(.+?)(?:\s+a\s+palindrome)?$/i.exec(t);
  if (m) phrase = m[1].trim();
  const yes = isPal(phrase);
  showPage((p) => {
    p.innerHTML = '<h2>Palindrome</h2><p style="font-size:24px;text-align:center">"' + esc(phrase) + '" is ' + (yes ? '' : 'not ') + 'a palindrome.</p><div class="sub">say “is level a palindrome”</div>';
  });
  return 'palindrome';
}

export default {
  name: 'palindrome',
  examples: ['is racecar a palindrome', 'palindrome of a man a plan a canal panama', 'check if radar is a palindrome', 'palindrome'],
  nearMisses: ['what is a palindrome', 'palindrome meaning'],
  match(lower, text) { return isPalindromeAsk(text); },
  run,
  suite() {
    const ok = isPalindromeAsk('is racecar a palindrome') && isPalindromeAsk('palindrome') && !isPalindromeAsk('what is a palindrome');
    return { ok, got: 'match works' };
  }
};
