/**
 * uuid skill — generate a random UUID v4.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "generate a uuid", "new uuid", "make me a random id".
 * Pure client-side, crypto.randomUUID. Empty surface stays empty.
 */
export function uuidOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:please\s+)?(?:(?:generate|make|create|give|new)\s+(?:me\s+)?(?:a\s+)?(?:random\s+)?(?:uuid|guid|id)|uuid|new\s+uuid)$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  if (!uuidOf(text)) return 'none';
  const id = crypto.randomUUID();
  showPage((p) => {
    p.innerHTML = '<h2>UUID</h2><pre style="font-size:16px;background:rgba(0,0,0,.3);padding:12px;border-radius:8px;user-select:all">' + esc(id) + '</pre>'
      + '<p class="sub">v4 random · copy it · nothing leaves this browser</p>';
  });
  return 'uuid';
}

export default {
  name: 'uuid',
  examples: ['generate a uuid', 'new uuid', 'make me a random id', 'uuid'],
  nearMisses: ['what is a uuid', 'user id', 'my id', 'password'],
  match(lower, text) { return uuidOf(text || lower); },
  run,
  suite() {
    return { ok: uuidOf('generate a uuid') && !uuidOf('hello') };
  },
};
