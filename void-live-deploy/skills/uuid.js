/**
 * uuid skill — generate a random UUID v4 (no network)
 * "generate a uuid", "new uuid", "random uuid", "uuid".
 */
export function wantsUuid(text) {
  return /^(?:please\s+)?(?:generate|make|new|random|create)\s+(?:a\s+)?uuid(?:\s+please)?$|^uuid$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function uuid() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  a[6] = (a[6] & 0x0f) | 0x40;
  a[8] = (a[8] & 0x3f) | 0x80;
  const h = Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

async function run(text, api) {
  if (!wantsUuid(text)) return 'none';
  const { showPage, esc } = api;
  const id = uuid();
  showPage((p) => {
    p.innerHTML = '<h2>UUID</h2><p style="font-size:22px;font-family:ui-monospace,monospace;word-break:break-all">' + esc(id) + '</p><div class="sub">UUID version 4</div><div class="src">From this device’s secure random numbers, no network.</div>';
  });
  return 'uuid';
}

export default {
  name: 'uuid',
  examples: ['generate a uuid', 'new uuid', 'random uuid', 'uuid'],
  nearMisses: ['what is a uuid', 'uuid database'],
  match(lower, text) { return wantsUuid(text); },
  run,
  suite() {
    const ok = wantsUuid('generate a uuid') && wantsUuid('uuid') && !wantsUuid('what is a uuid');
    return { ok, got: 'match works' };
  }
};
