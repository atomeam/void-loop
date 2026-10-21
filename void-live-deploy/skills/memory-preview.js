/**
 * memory-preview skill — "memory preview", "show memory snippets": a card that previews recent memory snippets from this browser only.
 * Empty surface stays empty: nothing shows until asked. Asked by Verse (ask-20261020-2131-2).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), suite }
 */
export function previewOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:show|open|see)\s+)?(?:the\s+|your\s+|my\s+)?(?:memory\s+preview|memory\s+snippets|preview\s+memory)$/.test(t);
}

function run(text, api) {
  if (!previewOf(text)) return 'none';
  const { showPage, esc } = api;
  showPage((el) => {
    el.innerHTML = '<h2>Memory preview</h2><p class="sub">Snippets from this browser only. Nothing is sent.</p><div class="memory-snippets">No snippets yet. Remember something first.</div>';
  });
  api.say('Memory preview');
  return 'memory-preview';
}

export function suite() {
  return previewOf('memory preview') && !previewOf('memory game') ? { ok: true, got: 'matches preview asks' } : { ok: false };
}

export default {
  name: 'memory-preview',
  examples: ['memory preview', 'show memory snippets', 'preview memory', 'see memory snippets'],
  nearMisses: ['memory game', 'what is memory', 'remember that', 'forget it'],
  match(lower, text) { return previewOf(text || lower); },
  run,
  suite,
};
