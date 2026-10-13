/**
 * inspire skill — a short inspirational quote or motivation line
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), suite() }
 * "inspire me", "tell me a quote", "motivate me", "give me a quote".
 */
const QUOTES = [
  'The only way to do great work is to love what you do. — Steve Jobs',
  'Believe you can and you\'re halfway there. — Theodore Roosevelt',
  'It does not matter how slowly you go as long as you do not stop. — Confucius',
  'Everything you\'ve ever wanted is on the other side of fear. — George Addair',
  'Success is not final, failure is not fatal: it is the courage to continue that counts. — Winston Churchill',
  'The future belongs to those who believe in the beauty of their dreams. — Eleanor Roosevelt',
  'Do what you can, with what you have, where you are. — Theodore Roosevelt',
  'You miss 100% of the shots you don\'t take. — Wayne Gretzky',
  'The best time to plant a tree was 20 years ago. The second best time is now. — Chinese Proverb',
  'What you get by achieving your goals is not as important as what you become by achieving your goals. — Zig Ziglar'
];
export function isInspire(text) {
  return /^(?:please\s+)?(?:inspire\s+me|motivate\s+me|tell\s+me\s+(?:a\s+)?quote|give\s+me\s+(?:a\s+)?quote|(?:a\s+)?quote(?:\s+please)?|motivational\s+quote)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
export function suite() {
  return { ok: isInspire('inspire me') && isInspire('tell me a quote') && !isInspire('what is a quote') };
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  showPage((p) => {
    p.innerHTML = '<h2>Inspiration</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(q) + '</p><div class="sub">say “inspire me” for another</div>';
  });
  return 'inspire';
}
export default {
  name: 'inspire',
  examples: ['inspire me', 'tell me a quote', 'motivate me', 'give me a quote'],
  nearMisses: ['what is a quote', 'history of quotes', 'quote of the day meaning'],
  match(lower, text) { return isInspire(text); },
  run,
  suite
};
