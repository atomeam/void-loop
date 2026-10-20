/**
 * palette skill — generates a harmonious color palette card on the stage (new idea: useful for design, phone-cut, or stage styling).
 * "color palette", "make a palette", "generate colors", "a palette of blues".
 * Empty surface stays empty. Pure client-side, no fetch. Uses stage summon.
 */
function wantsPalette(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').trim();
  return /^(?:(?:make|generate|give me|open|show)\s+(?:a\s+|me\s+)?)?(?:color\s+)?palette(?:\s+of\s+\w+)?$|^colors$|^a\s+palette$/.test(t);
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card palette-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(300px, calc(100vw - 20px))';
  const colors = th.colors || ['#1a1a2e', '#16213e', '#0f3460', '#e94560', '#533483'];
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;height:120px;border-radius:8px;overflow:hidden';
  colors.forEach(c => {
    const sw = document.createElement('div');
    sw.style.cssText = 'flex:1;background:' + c;
    sw.title = c;
    row.appendChild(sw);
  });
  const head = document.createElement('div'); head.className = 'g-head';
  head.innerHTML = '<span class="g-title">Palette</span><span class="g-sub">tap a color to copy</span>';
  el.append(head, row);
  row.addEventListener('click', (e) => {
    if (e.target.title) navigator.clipboard.writeText(e.target.title).catch(() => {});
  });
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

function run(text, api) {
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7']; // simple harmonious
  api.summon('palette', { colors, center: true });
  api.say('A color palette is on the stage. Tap a swatch to copy its hex. It stays after a reload.');
  return 'palette';
}

export default {
  name: 'palette',
  examples: [
    'color palette',
    'make a palette',
    'generate colors',
    'a palette of blues'
  ],
  nearMisses: [
    'paint',
    'color me',
    'palette knife',
    'color picker'
  ],
  match(lower, text) { return wantsPalette(text || lower); },
  run,
  stageKinds: { palette: { mount } },
  suite() {
    return { ok: wantsPalette('color palette') && wantsPalette('make a palette') && !wantsPalette('hello') };
  },
};
