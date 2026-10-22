/**
 * base64-tool skill — encode or decode base64 in the browser (no external call)
 * "base64 encode hello", "base64 decode SGVsbG8=", "encode this to base64"
 */
export function parseBase64(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  let m = t.match(/^(?:base64\s+)?(?:encode|to\s+base64)\s+(.+)$/i);
  if (m) return { mode: 'encode', input: m[1] };
  m = t.match(/^(?:base64\s+)?(?:decode|from\s+base64)\s+(.+)$/i);
  if (m) return { mode: 'decode', input: m[1] };
  return null;
}

export function doBase64(mode, input) {
  try {
    if (mode === 'encode') return btoa(unescape(encodeURIComponent(input)));
    if (mode === 'decode') return decodeURIComponent(escape(atob(input)));
    return null;
  } catch (_) { return null; }
}

async function run(text, api) {
  const { showPage, esc } = api;
  const p = parseBase64(text);
  if (!p) { showPage((el) => { el.innerHTML = '<h2>Base64</h2><p>Say <b>base64 encode hello</b> or <b>base64 decode SGVsbG8=</b>.</p>'; }); return 'base64-tool'; }
  const out = doBase64(p.mode, p.input);
  const el = showPage((e) => { e.innerHTML = '<h2>Base64 ' + p.mode + '</h2><p>Input: ' + esc(p.input) + '</p><p>Output: <code>' + esc(out || 'invalid') + '</code></p>'; });
  return 'base64-tool';
}

export default {
  name: 'base64-tool',
  examples: ['base64 encode hello', 'base64 decode SGVsbG8=', 'encode this to base64 world'],
  nearMisses: ['what is base64', 'base64 of a file', 'md5 hash'],
  match(lower, text) { return !!parseBase64(text || lower); },
  run,
  suite() {
    const enc = doBase64('encode', 'hello');
    const dec = doBase64('decode', enc);
    const ok = parseBase64('base64 encode hello') && dec === 'hello' && !parseBase64('what is base64');
    return { ok };
  },
};
