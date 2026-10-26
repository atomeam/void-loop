/**
 * riddle skill — a random riddle from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a riddle", "random riddle", "a riddle".
 */
export function isRiddle(text) {
  return /^(?:please\s+)?(?:tell\s+(?:me\s+)?(?:a|another|one\s+more)\s+riddle|(?:another|a|random)\s+riddle|riddle(?:\s+please)?|give\s+me\s+a\s+riddle)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A riddle</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://riddles-api.vercel.app/random', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'riddle';
    if (!j || !j.riddle) throw 0;
    el.innerHTML = '<h2>A riddle</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(j.riddle) + '</p><details><summary>Answer</summary><p>' + esc(j.answer || 'Unknown') + '</p></details><div class="sub">say “another riddle” for one more</div>'
      + '<div class="src">Source: <a href="https://riddles-api.vercel.app/" target="_blank" rel="noopener">riddles-api</a></div>';
    return 'riddle';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A riddle</h2><p>What has keys but can\'t open locks?</p><details><summary>Answer</summary><p>A piano</p></details>';
    return 'riddle';
  }
}

export default {
  name: 'riddle',
  examples: ['tell me a riddle', 'random riddle', 'a riddle', 'another riddle'],
  nearMisses: ['what is a riddle', 'riddle me this complex', 'puzzle game'],
  match(lower, text) { return isRiddle(text); },
  run,
  suite() {
    const ok = isRiddle('tell me a riddle') && isRiddle('random riddle') && !isRiddle('what is a riddle');
    return { ok, got: 'match works' };
  }
};
