/**
 * fortune skill — a short random fortune
 * "tell me a fortune", "fortune cookie", "what's my fortune"
 */
const FORTUNES = [
  'A pleasant surprise is waiting for you.',
  'Your hard work will soon pay off.',
  'Something you lost will soon turn up.',
  'A friend will bring you unexpected joy.',
  'Trust your instincts today.',
  'A small change will lead to big things.',
  'You will find what you are looking for.',
  'Good news is on its way.',
  'An old friend will reappear.',
  'Your kindness will be returned.'
];
export function isFortune(text) {
  return /^(?:please\s+)?(?:tell\s+me\s+(?:a\s+|my\s+)?fortune|fortune\s+cookie|what(?:'s|\s+is)\s+my\s+fortune)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
async function run(text, api) {
  const { showPage, esc } = api;
  const f = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
  showPage((p) => {
    p.innerHTML = '<h2>Fortune</h2><p style="font-size:24px;line-height:1.5;text-align:center;margin:20px 0;font-weight:300">' + esc(f) + '</p><div class="sub">say “tell me a fortune” for another</div>';
  });
  return 'fortune';
}
export default {
  name: 'fortune',
  examples: ['tell me a fortune', 'fortune cookie', "what's my fortune"],
  nearMisses: ['what is a fortune', 'fortune 500', 'tell me a joke'],
  match(lower, text) { return isFortune(text); },
  run,
  suite() {
    const ok = isFortune('tell me a fortune') && isFortune('fortune cookie') && !isFortune('tell me a joke');
    return { ok, got: ok ? 'pass' : 'match failed' };
  }
};
