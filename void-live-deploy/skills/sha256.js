/**
 * sha256 — SHA-256 of a string in the browser. "sha256 of hello", "hash this: verse".
 * Uses SubtleCrypto; never sent anywhere. Contract: { name, examples, nearMisses, match, run, suite }
 */
export function shaOf(text) {
  const t = String(text || '').trim();
  let m = t.match(/^(?:sha-?256|sha256)\s+(?:of|for|hash)\s*:?\s*(.{1,500})$/i)
    || t.match(/^(?:hash|digest)\s+(?:this|of)\s*:?\s*(.{1,500})$/i)
    || t.match(/^sha-?256\s*:\s*(.{1,500})$/i);
  if (m) return { s: m[1].trim() };
  return null;
}

async function digest(s) {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function run(text, api) {
  const q = shaOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  let hex;
  try { hex = await digest(q.s); } catch (_) {
    api.say('hash needs a secure context');
    return 'sha256';
  }
  showPage((p) => {
    p.innerHTML = '<h2>SHA-256</h2>'
      + '<div class="sub">“' + esc(q.s.length > 80 ? q.s.slice(0, 80) + '…' : q.s) + '”</div>'
      + '<div style="font-size:14px;font-family:ui-monospace,monospace;word-break:break-all;margin:10px 0;line-height:1.4">' + esc(hex) + '</div>'
      + '<button type="button" class="tr-copy sha-copy">copy</button>'
      + '<p style="color:#8a8a8a">computed in your browser · not sent anywhere</p>';
  });
  const el = document.querySelector('.vpage');
  const b = el && el.querySelector('.sha-copy');
  if (b) b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(hex); b.textContent = 'copied'; } catch (_) { b.textContent = 'select to copy'; }
  });
  api.say(hex.slice(0, 16) + '…');
  return 'sha256';
}

export default {
  name: 'sha256',
  examples: ['sha256 of hello', 'hash this: verse', 'sha-256: a-to-mind'],
  nearMisses: ['sha256 mining', 'blockchain hash rate', 'password hash'],
  match(lower, text) { return !!shaOf(text); },
  run,
  suite() {
    return { ok: !!shaOf('sha256 of hello') && shaOf('sha256 mining') === null };
  },
};
