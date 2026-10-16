/**
 * uuid skill — generate a UUID v4 (no key; pure crypto)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "make a uuid", "new uuid", "generate uuid", "uuid please".
 * Shows one on a card. Empty surface stays empty.
 */
export function uuidOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:please\s+)?(?:(?:make|generate|new|give me|get)\s+(?:a\s+|an\s+)?)?uu?id(?:\s+please)?$/.test(t) ? true : null;
}

export function makeUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!uuidOf(text)) return 'none';
  const id = makeUuid();
  showPage((p) => {
    p.innerHTML = '<h2>UUID</h2><p style="font-size:18px;font-family:ui-monospace,monospace;word-break:break-all">' + esc(id) + '</p>'
      + '<div class="src">Generated in this browser. Nothing left the page.</div>';
  });
  return 'uuid';
}

export default {
  name: 'uuid',
  examples: ['make a uuid', 'new uuid', 'generate uuid'],
  nearMisses: ['what is a uuid', 'uuid version', 'copy uuid'],
  match(lower, text) { return !!uuidOf(text); },
  run,
  suite() {
    const ok = uuidOf('make a uuid') && !uuidOf('hello') && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(makeUuid());
    return { ok, got: ok ? 'pass' : 'fail' };
  },
};
