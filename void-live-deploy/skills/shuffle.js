/**
 * shuffle skill — shuffle a list of items, pure client-side
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "shuffle these: apple banana cherry", "randomize 1, 2, 3", "shuffle the list a b c".
 */
export function isShuffle(text) {
  return /^(?:please\s+)?(?:shuffle|randomize|mix)\s+(?:these|this|the\s+list|my\s+list)?(?:\s*:)?\s+.+/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function parseItems(text) {
  const t = String(text).replace(/^(?:please\s+)?(?:shuffle|randomize|mix)\s+(?:these|this|the\s+list|my\s+list)?(?:\s*:)?\s+/i, '').trim();
  if (!t) return [];
  return t.split(/\s*,\s*|\s+/).filter(Boolean);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function run(text, api) {
  const { showPage, esc } = api;
  const items = parseItems(text);
  if (items.length < 2) {
    showPage((p) => { p.innerHTML = '<h2>Shuffle</h2><p>Give me at least two items to shuffle, like “shuffle these: red green blue”.</p>'; });
    return 'shuffle';
  }
  const shuffled = shuffle(items);
  showPage((p) => {
    p.innerHTML = '<h2>Shuffled</h2><ol style="font-size:20px;line-height:1.6">' + shuffled.map(i => '<li>' + esc(i) + '</li>').join('') + '</ol><div class="sub">say “shuffle these: …” for another</div><div class="src">Shuffled here on this device.</div>';
  });
  return 'shuffle';
}

export default {
  name: 'shuffle',
  examples: ['shuffle these: apple banana cherry', 'randomize 1, 2, 3, 4', 'mix the list a b c d', 'shuffle red green blue'],
  nearMisses: ['what is shuffle', 'shuffle dance', 'card shuffle game'],
  match(lower, text) { return isShuffle(text); },
  run,
  suite() {
    const ok = isShuffle('shuffle these: a b c') && isShuffle('randomize 1,2,3') && !isShuffle('what is shuffle');
    return { ok, got: 'match works' };
  }
};
