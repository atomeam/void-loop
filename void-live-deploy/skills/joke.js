/**
 * joke skill — a clean, family-friendly joke from icanhazdadjoke (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "tell me a joke", "make me laugh", "dad joke".
 */
export function isJoke(text) {
  return /^(?:please\s+)?(?:tell\s+(?:me\s+)?(?:a|another|one\s+more|a\s+funny)\s+joke|(?:another|a)\s+joke|joke(?:\s+please)?|make\s+me\s+laugh|(?:tell\s+me\s+a\s+)?dad\s+joke|(?:say|tell\s+me)\s+something\s+funny|got\s+any\s+jokes|make\s+me\s+smile)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
// "a joke about cats", "tell me a dad joke about pizza": the topic, singular, for icanhazdadjoke's search (2026-10-30: these fell to an article);
// asked = the words as the person wrote them, for the card's heading. Pure.
export function jokeTopic(text, asked = false) {
  const m = String(text || '').trim().replace(/[?!.]+$/, '').match(/^(?:please\s+)?(?:(?:tell|give)\s+(?:me\s+)?|do\s+you\s+know\s+|got\s+)?(?:a|an|another|any|some|one)?\s*(?:(?:funny|good|dad|bad)\s+)?jokes?\s+(?:about|on|with)\s+(?:a\s+|an\s+|the\s+)?([a-z][a-z'\s]{1,28}[a-z])$/i);
  if (!m) return '';
  const w = m[1].toLowerCase().replace(/\s+/g, ' ');
  if (/^(?:me|you|us|them|it|this|that|nothing|everything)$/.test(w)) return '';
  return asked ? w : w.replace(/ies$/, 'y').replace(/(?:ches|shes|xes|sses)$|(?<=[^aeiou]u)ses$/, (x) => x.slice(0, -2)).replace(/([^siu])s$/, '$1');
}
/** the jokes from a search that name the topic as a word ("cat" finds "catholic" too). Pure. */
export function aboutTopic(list, topic) {
  const re = new RegExp('\\b' + topic.replace(/[^a-z' ]/g, '').replace(/ /g, '\\s+') + '(?:s|es)?\\b', 'i');
  return (Array.isArray(list) ? list : []).filter((j) => j && typeof j.joke === 'string' && re.test(j.joke));
}
// knock-knock jokes are their own shape (the dad-joke service doesn't do them), so a few classics live here
const KNOCK = [['Lettuce', 'Lettuce in, it\'s cold out here!'], ['Boo', 'Don\'t cry, it\'s only a joke.'], ['Interrupting cow', 'Mo— (moo!)'],
  ['Atch', 'Bless you!'], ['Olive', 'Olive you too.'], ['Cow says', 'No, a cow says moo!'], ['Tank', 'You\'re welcome.'], ['Nobel', 'No bell, that\'s why I knocked.']];
const RIDDLES = [['What has keys but can’t open locks?', 'A piano.'], ['What gets wetter the more it dries?', 'A towel.'], ['What has hands but can’t clap?', 'A clock.'],
  ['What can you catch but not throw?', 'A cold.'], ['What has a neck but no head?', 'A bottle.'], ['What goes up but never comes down?', 'Your age.'], ['What has many teeth but can’t bite?', 'A comb.'],
  ['I’m tall when I’m young and short when I’m old. What am I?', 'A candle.'], ['What runs but never walks?', 'Water (or your nose).'], ['What has one eye but can’t see?', 'A needle.']];
const TWISTERS = ['She sells seashells by the seashore.', 'Peter Piper picked a peck of pickled peppers.', 'How much wood would a woodchuck chuck if a woodchuck could chuck wood?',
  'Red lorry, yellow lorry.', 'Unique New York.', 'Fuzzy Wuzzy was a bear. Fuzzy Wuzzy had no hair.', 'Six slippery snails slid slowly seaward.', 'Toy boat, toy boat, toy boat.'];
export function isRiddle(text) { return /^(?:tell\s+me\s+|give\s+me\s+)?(?:a\s+|another\s+)?riddle$/i.test(String(text || '').trim().replace(/[?!.]+$/, '')); }
export function isTwister(text) { return /^(?:tell\s+me\s+|give\s+me\s+|say\s+)?(?:a\s+|another\s+)?tongue[\s-]*twisters?$/i.test(String(text || '').trim().replace(/[?!.]+$/, '')); }
export function isKnock(text) { return /^(?:(?:tell\s+me\s+)?(?:a\s+|another\s+)?knock[\s-]+knock(?:\s+jokes?)?|knock[\s-]+knock)$/i.test(String(text || '').trim().replace(/[?!.]+$/, '')); }
async function run(text, api) {
  const { showPage, esc } = api;
  if (isRiddle(text)) {
    const [q, a] = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
    const el = showPage((p) => { p.innerHTML = '<h2>A riddle</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(q) + '</p><details><summary style="cursor:pointer;color:#8a8a8a">show the answer</summary><p style="font-size:20px">' + esc(a) + '</p></details>'; });
    return 'joke';
  }
  if (isTwister(text)) {
    showPage((p) => { p.innerHTML = '<h2>Tongue twister</h2><p style="font-size:24px;line-height:1.45;font-weight:300">' + esc(TWISTERS[Math.floor(Math.random() * TWISTERS.length)]) + '</p><div class="sub">say it three times fast</div>'; });
    return 'joke';
  }
  if (isKnock(text)) {
    const [who, line] = KNOCK[Math.floor(Math.random() * KNOCK.length)];
    showPage((p) => { p.innerHTML = '<h2>Knock knock</h2><p style="font-size:20px;line-height:1.7;font-weight:300">Knock knock.<br>Who\'s there?<br>' + esc(who) + '.<br>' + esc(who) + ' who?<br>' + esc(line) + '</p><div class="sub">say “knock knock” for another</div>'; });
    return 'joke';
  }
  const el = showPage((p) => { p.innerHTML = '<h2>A joke</h2><div class="sub">…</div>'; });
  const topic = jokeTopic(text), said = jokeTopic(text, true);
  if (topic) {
    try {
      const j = await fetch('https://icanhazdadjoke.com/search?limit=30&term=' + encodeURIComponent(topic), { headers: { accept: 'application/json' } }).then((r) => r.json());
      if (!api._pageStill(el)) return 'joke';
      const list = aboutTopic(j && j.results, topic);
      if (list.length) {
        const k = list[Math.floor(Math.random() * list.length)];
        el.innerHTML = '<h2>A joke about ' + esc(said) + '</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(k.joke) + '</p><div class="sub">say “another joke about ' + esc(said) + '” for one more</div>'
          + '<div class="src">Source: <a href="https://icanhazdadjoke.com/j/' + encodeURIComponent(k.id || '') + '" target="_blank" rel="noopener">icanhazdadjoke</a></div>';
        return 'joke';
      }
      el.innerHTML = '<h2>A joke about ' + esc(said) + '</h2><p>icanhazdadjoke has no joke about ' + esc(said) + '. Say “tell me a joke” for one on anything.</p>'
        + '<div class="src">Source: <a href="https://icanhazdadjoke.com/search?term=' + encodeURIComponent(topic) + '" target="_blank" rel="noopener">icanhazdadjoke search</a></div>';
      return 'joke';
    } catch (_) {
      if (!api._pageStill(el)) return 'none';
      el.innerHTML = '<h2>A joke about ' + esc(said) + '</h2><p>The joke service didn\'t answer just now. Ask again in a moment.</p>';
      return 'none';
    }
  }
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
  examples: ['tell me a joke', 'make me laugh', 'dad joke', 'knock knock joke', 'a joke about cats', 'tell me a dad joke about pizza'],
  nearMisses: ['what is a joke', 'who is the joker', 'history of comedy', 'jokes about me', 'is this a joke about money'],
  match(lower, text) { return isJoke(text) || isKnock(text) || isRiddle(text) || isTwister(text) || !!jokeTopic(text); },
  run
};
