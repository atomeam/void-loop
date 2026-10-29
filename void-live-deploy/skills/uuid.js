/**
 * uuid skill — generate a random UUID
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "generate a uuid", "random uuid", "make a guid"
 */
export function isUuid(text) {
  return /^(?:please\s+)?(?:(?:generate|make|create|give\s+me)\s+(?:a\s+)?(?:random\s+)?(?:uuid|guid)|random\s+(?:uuid|guid)|(?:uuid|guid)\s+please)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function generate() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
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
  examples: ['generate a uuid', 'random uuid', 'make a guid', 'another uuid'],
  nearMisses: ['what is a uuid', 'uuid of a file', 'change my uuid'],
  match(lower, text) { return isUuid(text); },
  run,
  suite() {
    const ok = isUuid('generate a uuid') && isUuid('random uuid') && !isUuid('what is a uuid');
    return { ok, got: 'match works' };
  }
};
