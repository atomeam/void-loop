/**
 * base64 skill — encode or decode text to/from Base64 (no key; pure)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "encode hello to base64", "base64 encode world", "decode aGVsbG8=", "base64 decode SGVsbG8=".
 * Shows the result on a card. Empty surface stays empty.
 */
export function base64Of(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:base64\s+)?(?:encode|to\s+base64)\s+(.+)$/i);
  if (m) return { op: 'encode', data: m[1].trim() };
  m = t.match(/^(?:base64\s+)?decode\s+(.+)$/i);
  if (m) return { op: 'decode', data: m[1].trim() };
  m = t.match(/^(.+)\s+(?:to|as)\s+base64$/i);
  if (m) return { op: 'encode', data: m[1].trim() };
  return null;
}

export function doBase64({ op, data }) {
  try {
    if (op === 'encode') return btoa(unescape(encodeURIComponent(data)));
    if (op === 'decode') return decodeURIComponent(escape(atob(data)));
  } catch (_) { return null; }
  return null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = base64Of(text);
  if (!q) return 'none';
  const out = doBase64(q);
  if (out == null) {
    showPage((p) => { p.innerHTML = '<h2>Base64</h2><p>Could not ' + esc(q.op) + ' that. Check the text and try again.</p>'; });
    return 'base64';
  }
  showPage((p) => {
    p.innerHTML = '<h2>Base64 ' + esc(q.op) + '</h2><p style="font-size:18px;word-break:break-all">' + esc(out) + '</p>'
      + '<div class="src">Pure in the browser. Nothing left this page.</div>';
  });
  return 'base64';
}

export default {
  name: 'base64',
  examples: ['encode hello to base64', 'base64 encode world', 'decode aGVsbG8=', 'base64 decode SGVsbG8='],
  nearMisses: ['what is base64', 'base64 meaning', 'encode a video'],
  match(lower, text) { return !!base64Of(text); },
  run,
  suite() {
    const e = base64Of('encode hello to base64');
    const d = base64Of('decode aGVsbG8=');
    const ok = e && e.op === 'encode' && e.data === 'hello' && doBase64(e) === 'aGVsbG8='
      && d && d.op === 'decode' && doBase64(d) === 'hello' && base64Of('hello') === null;
    return { ok, got: ok ? 'pass' : 'fail' };
  },
};
