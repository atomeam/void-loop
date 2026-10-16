/**
 * quote skill — a daily quote that stays on the stage.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "quote of the day", "show me a quote", "inspirational quote".
 * Uses a small set of public-domain quotes. Empty surface stays empty.
 */
const QUOTES = [
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein' },
  { text: 'What you do speaks so loudly that I cannot hear what you say.', author: 'Ralph Waldo Emerson' },
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
  { text: 'You miss 100% of the shots you don\'t take.', author: 'Wayne Gretzky' },
  { text: 'Be the change that you wish to see in the world.', author: 'Mahatma Gandhi' },
  { text: 'The journey of a thousand miles begins with one step.', author: 'Lao Tzu' },
  { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
];

export function quoteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:show|give|tell)\s+(?:me\s+)?(?:a\s+)?(?:daily\s+|today'?s\s+)?(?:inspirational\s+|motivational\s+)?quote(?:\s+of\s+the\s+day)?|quote\s+of\s+the\s+day|inspirational\s+quote|a\s+quote)$/.test(t) || null;
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card quote-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(320px, calc(100vw - 20px));padding:16px;background:rgba(20,20,30,.85);border-radius:12px;border:1px solid rgba(255,255,255,.1)';
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  el.innerHTML = '<div class="g-title" style="font-size:18px;line-height:1.4;margin-bottom:8px">' + q.text + '</div><div class="g-sub" style="opacity:.7">— ' + q.author + '</div>';
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

function run(text, api) {
  if (!quoteOf(text)) return 'none';
  api.summon('quote', { center: true });
  api.say('A quote is on the stage. It stays after a reload.');
  return 'quote';
}

export default {
  name: 'quote',
  examples: ['quote of the day', 'show me a quote', 'inspirational quote', 'a quote'],
  nearMisses: ['what is a quote', 'quote me', 'stock quote', 'price quote'],
  match(lower, text) { return !!quoteOf(text); },
  run,
  stageKinds: { quote: { mount } },
  suite() {
    return { ok: !!quoteOf('quote of the day') && quoteOf('stock quote') === null && QUOTES.length >= 5 };
  },
};
