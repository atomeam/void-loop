/**
 * uuid skill — generate a random UUID. "generate a uuid", "new uuid", "uuid please"
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
export function isUuid(text) {
  return /^(?:please\s+)?(?:(?:generate|make|give\s+me|create|new)\s+(?:a\s+)?uuid|uuid(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function gen() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function run(text, api) {
  const { showPage, esc } = api;
  const id = gen();
  const el = showPage((p) => {
    p.innerHTML = `<h2>UUID</h2><p style="font-size:20px;font-family:monospace">${esc(id)}</p><div class="sub">say “another uuid” for one more</div>`;
  });
  return 'uuid';
}

export default {
  name: 'uuid',
  examples: ['generate a uuid', 'new uuid', 'uuid'],
  nearMisses: ['what is a uuid', 'uuid generator tool'],
  match(lower, text) { return isUuid(text); },
  run,
  suite() {
    const ok = isUuid('generate a uuid') && isUuid('new uuid') && !isUuid('my uuid');
    return { ok, got: 'match works' };
  }
};
