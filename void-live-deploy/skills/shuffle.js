/**
 * shuffle skill — shuffle a list written with spaces, on the device.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "shuffle these: apple banana cherry", "mix the list a b c d", "randomize my list red green blue".
 * A list written with commas or "and" ("shuffle red, green, blue") stays with the stage's own chance card (void.html chanceOf),
 * so an ask here names its list ("these", "the list", "my list", "this list") or puts it after a colon.
 */
const LEAD = /^(?:please\s+)?(?:shuffle|randomi[sz]e|mix(?:\s+up)?)(?:\s+(?:these|this\s+list|the\s+list|my\s+list)\s*:?|\s*:)\s*/i;

// The stage's own shuffle (void.html chanceOf) takes a list with a comma or "and"; skills are asked first, so leave it those.
export const stageShuffles = (l) => /^(?:shuffle|randomi[sz]e(?:\s+the\s+order\s+of)?)\s*:?\s+(.+(?:,|\s+and\s+).+)$/.test(l);

const clean = (text) => String(text || '').trim().replace(/[?!.]+$/, '');

export function parseItems(text) {
  const t = clean(text);
  if (!LEAD.test(t)) return [];
  return t.replace(LEAD, '').split(/\s*,\s*|\s+/).filter(Boolean).slice(0, 200);
}

export function isShuffle(text) {
  const t = clean(text);
  if (stageShuffles(t.toLowerCase().replace(/^please\s+/, ''))) return false;
  return parseItems(t).length >= 2;
}

// Fisher-Yates with crypto bytes when the device has them; rejection sampling keeps every order equally likely.
function below(n) {
  const c = globalThis.crypto;
  if (!c || !c.getRandomValues) return Math.floor(Math.random() * n);
  const cap = Math.floor(0x100000000 / n) * n, buf = new Uint32Array(1);
  do c.getRandomValues(buf); while (buf[0] >= cap);
  return buf[0] % n;
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = below(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function run(text, api) {
  const { showPage, esc } = api;
  const shuffled = shuffle(parseItems(text));
  showPage((p) => {
    p.innerHTML = '<h2>Shuffled</h2><ol style="font-size:20px;line-height:1.6">' + shuffled.map((i) => '<li>' + esc(i) + '</li>').join('') + '</ol><div class="sub">say “shuffle these: …” for another</div><div class="src">Shuffled here on this device.</div>';
  });
  return 'shuffle';
}

export default {
  name: 'shuffle',
  examples: ['shuffle these: apple banana cherry', 'mix the list a b c d', 'randomize my list red green blue', 'shuffle: north south east west'],
  nearMisses: ['what is shuffle', 'shuffle dance', 'card shuffle game', 'shuffle red, green, blue', 'randomize 1, 2, 3, 4', 'shuffle tom and jerry', 'shuffle these', 'mix red blue'],
  match(lower, text) { return isShuffle(text); },
  run,
  suite() {
    const ok = isShuffle('shuffle these: a b c') && !isShuffle('shuffle a, b, c') && !isShuffle('what is shuffle') && shuffle([1, 2, 3]).length === 3;
    return { ok, got: ok ? 'match works' : 'match broken' };
  }
};
