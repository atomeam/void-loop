/**
 * yesno skill — a simple yes or no, or should I
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "yes or no", "should I go", "yesno".
 */
export function isYesNo(text) {
  return /^(?:please\s+)?(?:yes\s+or\s+no|yesno|should\s+i(?:\s+\w+){0,3}|yes\s+or\s+no\s+please)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  const answer = Math.random() < 0.5 ? 'Yes' : 'No';
  showPage((p) => {
    p.innerHTML = '<h2>Yes or No</h2><p style="font-size:36px;font-weight:300;text-align:center">' + esc(answer) + '</p><div class="sub">say “yes or no” for another</div>';
  });
  return 'yesno';
}

export default {
  name: 'yesno',
  examples: ['yes or no', 'should I go', 'yesno', 'should i'],
  nearMisses: ['what is yes or no', 'yes and no'],
  match(lower, text) { return isYesNo(text); },
  run,
  suite() {
    const ok = isYesNo('yes or no') && isYesNo('should I go') && !isYesNo('what is yes or no');
    return { ok, got: 'match works' };
  }
};
