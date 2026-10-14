/**
 * uuid skill — a random UUID v4.
 * Empty surface stays empty.
 */
export function isUuid(text) {
  return /^(?:please\s+)?(?:(?:generate|make|give me|create)\s+(?:a\s+)?(?:random\s+)?uuid(?:\s+v4)?|uuid|random uuid)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
export function randomUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
async function run(text, api) {
  if (!isUuid(text)) return 'none';
  const id = randomUuid();
  const { showPage, esc } = api;
  showPage((p) => {
    p.innerHTML = '<h2>UUID</h2><p style="font-size:22px;font-family:monospace;font-weight:300">' + esc(id) + '</p><div class="sub">random v4 · say “uuid” for another</div>';
  });
  return 'uuid';
}
export function suite() {
  const id = randomUuid();
  const ok = isUuid('generate a uuid') && isUuid('uuid') && !isUuid('what is a uuid') && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  return { ok, got: ok ? id.slice(0, 8) : 'miss' };
}
export default {
  name: 'uuid',
  examples: ['generate a uuid', 'random uuid', 'uuid'],
  nearMisses: ['what is a uuid', 'guid', 'make a clock'],
  match(lower, text) { return isUuid(text); },
  run,
  suite
};
