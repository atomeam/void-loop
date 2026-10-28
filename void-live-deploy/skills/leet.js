/**
 * leet skill — convert text to 1337 speak
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "leet hello", "1337 speak for world", "convert to leet".
 */
const MAP = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', l: '1' };

export function isLeet(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  return /^(?:please\s+)?(?:(?:leet|1337|l33t)\s+(?:speak\s+)?(?:for\s+)?(.+)|convert\s+(.+)\s+to\s+(?:leet|1337))$/.test(t);
}

function toLeet(s) {
  return String(s).toLowerCase().replace(/[aeiostl]/g, (c) => MAP[c] || c);
}

function run(text, api) {
  const { showPage, esc } = api;
  const m = /(?:leet|1337|l33t)\s+(?:speak\s+)?(?:for\s+)?(.+)|convert\s+(.+)\s+to\s+(?:leet|1337)/i.exec(text);
  const phrase = (m && (m[1] || m[2]) || 'hello world').trim();
  const out = toLeet(phrase);
  showPage((p) => {
    p.innerHTML = '<h2>1337</h2><p style="font-size:24px;font-weight:300">' + esc(out) + '</p><div class="sub">from “' + esc(phrase) + '”</div><div class="src">Simple letter swaps.</div>';
  });
  return 'leet';
}

export default {
  name: 'leet',
  examples: ['leet hello', '1337 speak for world', 'convert cool to leet'],
  nearMisses: ['what is leet', 'leet code', 'speak leet'],
  match(lower, text) { return isLeet(text); },
  run,
  suite() {
    const ok = isLeet('leet hello') && isLeet('convert world to 1337') && !isLeet('what is leet');
    return { ok, got: 'match works' };
  }
};
