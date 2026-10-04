/**
 * joke skill — a clean, family-friendly joke from icanhazdadjoke (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a joke", "make me laugh", "dad joke".
 */
export function isJoke(text) {
  return /^(?:please\s+)?(?:tell\s+(?:me\s+)?(?:a|another|one\s+more|a\s+funny)\s+joke|(?:another|a)\s+joke|joke(?:\s+please)?|make\s+me\s+laugh|(?:tell\s+me\s+a\s+)?dad\s+joke|(?:say|tell\s+me)\s+something\s+funny|got\s+any\s+jokes|make\s+me\s+smile)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
// knock-knock jokes are their own shape (the dad-joke service doesn't do them), so a few classics live here
const KNOCK = [['Lettuce', 'Lettuce in, it\'s cold out here!'], ['Boo', 'Don\'t cry, it\'s only a joke.'], ['Interrupting cow', 'Mo— (moo!)'],
  ['Atch', 'Bless you!'], ['Olive', 'Olive you too.'], ['Cow says', 'No, a cow says moo!'], ['Tank', 'You\'re welcome.'], ['Nobel', 'No bell, that\'s why I knocked.']];
export function isKnock(text) { return /^(?:(?:tell\s+me\s+)?(?:a\s+|another\s+)?knock[\s-]+knock(?:\s+jokes?)?|knock[\s-]+knock)$/i.test(String(text || '').trim().replace(/[?!.]+$/, '')); }
async function run(text, api) {
  const { showPage, esc } = api;
  if (isKnock(text)) {
    const [who, line] = KNOCK[Math.floor(Math.random() * KNOCK.length)];
    showPage((p) => { p.innerHTML = '<h2>Knock knock</h2><p style="font-size:20px;line-height:1.7;font-weight:300">Knock knock.<br>Who\'s there?<br>' + esc(who) + '.<br>' + esc(who) + ' who?<br>' + esc(line) + '</p><div class="sub">say “knock knock” for another</div>'; });
    return 'joke';
  }
  const el = showPage((p) => { p.innerHTML = '<h2>A joke</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://icanhazdadjoke.com/', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'joke';
    if (!j || !j.joke) throw 0;
    el.innerHTML = '<h2>A joke</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(j.joke) + '</p><div class="sub">say “another joke” for one more</div>'
      + '<div class="src">Source: <a href="https://icanhazdadjoke.com/j/' + encodeURIComponent(j.id || '') + '" target="_blank" rel="noopener">icanhazdadjoke</a></div>';
    return 'joke';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A joke</h2><p>The joke service didn\'t answer, so here is mine: I tried to catch fog yesterday. Mist.</p>';
    return 'joke';
  }
}
export default {
  name: 'joke',
  examples: ['tell me a joke', 'make me laugh', 'dad joke', 'knock knock joke'],
  nearMisses: ['what is a joke', 'who is the joker', 'history of comedy'],
  match(lower, text) { return isJoke(text) || isKnock(text); },
  run
};
