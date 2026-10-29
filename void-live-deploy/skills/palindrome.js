/**
 * palindrome skill — check if a word or phrase is a palindrome
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "is racecar a palindrome", "palindrome of a man a plan a canal panama", "check if kayak is a palindrome".
 */
export function isPalindrome(text) {
  const cleaned = String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned.length > 1 && cleaned === cleaned.split('').reverse().join('');
}

export function parsePalindrome(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:is\s+)?(?:['"]?)(.+?)(?:['"]?)\s+(?:a\s+)?palindrome(?:\s+please)?$/i) ||
    t.match(/^(?:check\s+if\s+)?(?:['"]?)(.+?)(?:['"]?)\s+is\s+(?:a\s+)?palindrome$/i) ||
    t.match(/^palindrome\s+(?:of\s+)?(?:['"]?)(.+?)(?:['"]?)$/i);
  return m ? m[1].trim() : null;
}

function run(text, api) {
  const { showPage, esc } = api;
  const phrase = parsePalindrome(text);
  if (!phrase) {
    showPage((p) => { p.innerHTML = '<h2>Palindrome</h2><p>Say <b>is racecar a palindrome</b> or <b>palindrome of a man a plan</b>.</p>'; });
    return 'palindrome';
  }
  const yes = isPalindrome(phrase);
  showPage((p) => {
    p.innerHTML = '<h2>Palindrome?</h2><p style="font-size:36px;font-weight:600;text-align:center">' + (yes ? 'Yes' : 'No') + '</p><div class="sub">“' + esc(phrase) + '”</div><div class="src">Ignores spaces, punctuation and case.</div>';
  });
  return 'palindrome';
}

export default {
  name: 'palindrome',
  examples: ['is racecar a palindrome', 'palindrome of a man a plan a canal panama', 'check if kayak is a palindrome', 'is level a palindrome'],
  nearMisses: ['what is a palindrome', 'palindrome poem', 'palindromic number'],
  match(lower, text) { return !!parsePalindrome(text || lower); },
  run,
  suite() {
    const ok = isPalindrome('racecar') && isPalindrome('a man a plan a canal panama') && !isPalindrome('hello') && !!parsePalindrome('is racecar a palindrome') && !parsePalindrome('what is a palindrome');
    return { ok, got: 'match works' };
  }
};
