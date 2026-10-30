/**
 * uuid skill — generate a random UUID
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "generate a uuid", "random uuid", "make a guid"
 */
export function isUuid(text) {
  return /^(?:please\s+)?(?:(?:generate|make|create|give\s+me)\s+(?:a\s+|another\s+)?(?:random\s+|new\s+)?(?:uuid|guid)|(?:random|another)\s+(?:uuid|guid)|(?:uuid|guid)\s+please)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

// crypto.randomUUID where the browser has it (every current one); the template with crypto bytes, then Math.random, as the fallbacks
export function generate() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = c && c.getRandomValues ? c.getRandomValues(new Uint8Array(16)) : null;
  let i = 0;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = b ? b[i++] & 15 : Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function run(text, api) {
  const { showPage, esc } = api;
  const id = generate();
  showPage((p) => {
    p.innerHTML = '<h2>UUID</h2>'
      + '<p style="font-size:24px;font-family:monospace;word-break:break-all;background:rgba(255,255,255,.05);padding:12px;border-radius:8px">' + esc(id) + '</p>'
      + '<div class="sub">Version 4 UUID. Copy it now — it is not stored.</div>'
      + '<div class="sub">say “another uuid” for one more</div>';
  });
  return 'uuid';
}

export default {
  name: 'uuid',
  // "generate a uuid", "make a guid" and "new guid" are util's (its uuid card, rank 460; issue #1695); this one takes the asks util leaves: random, another, please
  examples: ['random uuid', 'another uuid', 'random guid', 'uuid please'],
  nearMisses: ['what is a uuid', 'uuid of a file', 'change my uuid'],
  match(lower, text) { return isUuid(text); },
  run,
  suite() {
    const ok = isUuid('generate a uuid') && isUuid('random uuid') && isUuid('another uuid') && !isUuid('what is a uuid') && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(generate());
    return { ok, got: 'match works' };
  }
};
