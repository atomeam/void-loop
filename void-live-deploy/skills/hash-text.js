/**
 * hash-text — SHA-256 (and hex) of any short string, in the browser. No network.
 * "hash hello", "sha256 of secret", "checksum of this text: …"
 * Contract: { name, examples, nearMisses, match, run, suite }
 */
export function hashOf(text) {
  const t = String(text || '').trim();
  let m = t.match(/^(?:(?:sha[-_]?256|hash|checksum)(?:\s+(?:of|for))?\s*:?\s*|hash\s+)(.{1,2000})$/i);
  if (m) return { s: m[1].trim() };
  m = t.match(/^(.{1,200})\s+(?:sha[-_]?256|hash|checksum)$/i);
  if (m && !/^(what|how|is|the)\b/i.test(m[1])) return { s: m[1].trim() };
  return null;
}

async function run(text, api) {
  const q = hashOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(q.s));
  const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const el = showPage((p) => {
    p.innerHTML = '<h2>SHA-256</h2><div class="util-out" style="font-size:18px;font-weight:300;word-break:break-all;margin:8px 0">' + esc(hex) + '</div>'
      + '<button type="button" class="tr-copy hash-copy">copy</button>'
      + '<p style="color:#8a8a8a">of “' + esc(q.s.slice(0, 80)) + (q.s.length > 80 ? '…' : '') + '” · made in your browser, never sent</p>';
  });
  const b = el && el.querySelector && el.querySelector('.hash-copy');
  if (b) b.addEventListener('click', async () => {
    let ok = false; try { await navigator.clipboard.writeText(hex); ok = true; } catch (_) {}
    b.textContent = ok ? 'copied' : 'select it to copy';
  });
  api.say(hex.slice(0, 16) + '…');
  return 'hash-text';
}

export default {
  name: 'hash-text',
  examples: ['hash hello', 'sha256 of secret', 'checksum of this text: void'],
  nearMisses: ['hash brown recipe', 'what is sha256', 'blockchain hash'],
  match(lower, text) { return !!hashOf(text); },
  run,
  suite() {
    return { ok: !!hashOf('hash hello') && !!hashOf('sha256 of x') && hashOf('hash brown recipe') === null };
  },
};
