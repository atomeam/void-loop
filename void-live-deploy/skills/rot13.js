/**
 * rot13 skill — ROT13 letter substitution (no key; pure)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "rot13 of hello", "hello in rot13", "rot13 the quick brown fox".
 * Each letter moves 13 places in the alphabet; numbers and punctuation stay. Applying it twice returns the original.
 * Empty surface stays empty (page card only).
 */
export function rot13(s) {
  return String(s || '').replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

/** the text to encode, or null. Pure. */
export function rotOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!/rot\s*13|rot13/i.test(t)) return null;
  if (/what\s+is\s+rot\s*13|define\s+rot\s*13|how\s+does\s+rot\s*13/i.test(t)) return null;
  let m = t.match(/^(?:rot\s*13\s+(?:of|for|on)\s+)(.+)$/i);
  if (m) return m[1].trim();
  m = t.match(/^(.+?)\s+in\s+rot\s*13$/i);
  if (m) return m[1].trim();
  m = t.match(/^(?:encode|decode|apply)\s+rot\s*13\s+(?:to|on)\s+(.+)$/i);
  if (m) return m[1].trim();
  return null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const src = rotOf(text);
  if (!src) return 'none';
  const out = rot13(src);
  showPage((p) => {
    p.innerHTML = '<h2>ROT13</h2><div class="sub">' + esc(src) + '</div>'
      + '<div style="font-size:28px;font-weight:300;line-height:1.4;margin:8px 0;word-break:break-word">' + esc(out) + '</div>'
      + '<p style="color:#8a8a8a">Each letter moves 13 places in the alphabet (A↔N, B↔O, …). Numbers and punctuation stay put. Apply it again to get the original back.</p>';
  });
  return 'rot13';
}

export default {
  name: 'rot13',
  examples: ['rot13 of hello', 'hello in rot13', 'rot13 the quick brown fox'],
  nearMisses: ['what is rot13', 'define rot13', 'how does rot13 work', 'rot 13 degrees'],
  match(lower, text) { return !!rotOf(text || lower); },
  run,
  suite() {
    const a = rot13('hello') === 'uryyb' && rot13('uryyb') === 'hello' && rot13('Hello, World!') === 'Uryyb, Jbeyq!';
    const b = rotOf('rot13 of hello') === 'hello' && rotOf('hello in rot13') === 'hello' && !rotOf('what is rot13');
    const ok = a && b;
    return { ok, got: ok ? 'pass' : JSON.stringify({ a, b, r: rot13('hello'), of: rotOf('rot13 of hello') }) };
  }
};
