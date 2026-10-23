/**
 * fortune skill — a short fortune cookie message.
 * "tell me a fortune", "fortune cookie", "random fortune".
 * Empty surface stays empty.
 */
const FORTUNES = [
  'A pleasant surprise is waiting for you.',
  'Your hard work will soon pay off.',
  'Now is the time to try something new.',
  'A friend will bring good news.',
  'Trust your instincts today.',
  'Something you lost will soon be found.',
  'Adventure awaits if you look for it.',
  'Your kindness will be returned.',
  'A small change will bring big results.',
  'Today is a good day to start.',
];

export function isFortune(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:please\s+)?(?:tell\s+(?:me\s+)?(?:a\s+)?fortune|fortune\s+cookie|random\s+fortune|give\s+me\s+a\s+fortune)$/.test(t);
}

function pick() {
  return FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
}

async function run(text, api) {
  if (!isFortune(text)) return 'none';
  const { showPage, esc } = api;
  const msg = pick();
  showPage((p) => {
    p.innerHTML = '<h2>A fortune</h2><p style="font-size:22px;line-height:1.45;font-style:italic;font-weight:300">"' + esc(msg) + '"</p><div class="sub">say “another fortune” for one more</div>';
  });
  return 'fortune';
}

export default {
  name: 'fortune',
  examples: ['tell me a fortune', 'fortune cookie', 'random fortune'],
  nearMisses: ['what is a fortune', 'fortune 500', 'tell me my fortune number'],
  match(lower, text) { return isFortune(text); },
  run,
  suite() {
    const ok = isFortune('tell me a fortune') && isFortune('fortune cookie') && !isFortune('what is a fortune') && FORTUNES.includes(pick());
    return { ok, got: 'fortune match works' };
  },
};
