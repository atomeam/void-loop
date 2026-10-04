/**
 * zoom-figure skill — zoom in on the figure, collector detail, progressive.
 * Detail steps up in this browser only (no texture download). An empty stage
 * stays empty: no figure is invented.
 */
const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
export const LOD_MAX = 3;
const BUDGET = { 1: 24, 2: 96, 3: 280 };

export function zoomOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?zoom in on the figure$/.test(t)) return { act: 'in' };
  if (/^(?:please\s+)?zoom in$/.test(t)) return { act: 'in' };
  if (/^(?:please\s+)?closer on the figure$/.test(t)) return { act: 'in' };
  if (/^(?:please\s+)?zoom out on the figure$/.test(t)) return { act: 'out' };
  return null;
}

export function nextLod(level, dir) {
  const n = Math.max(0, Number(level) || 0);
  if (dir === 'out') return Math.max(0, n - 1);
  return Math.min(LOD_MAX, n + 1);
}

export function detailFor(level) {
  const lod = Math.max(0, Math.min(LOD_MAX, Number(level) || 0));
  return { lod, tris: BUDGET[lod] || 0, remote: false, html: '', published: false };
}

async function run(text, api) {
  const hit = zoomOf(text);
  if (!hit) return 'none';
  const things = api.stage && api.stage.things ? api.stage.things() : {};
  const selected = api.stage && api.stage.selected ? api.stage.selected() : null;
  const list = Object.values(things).filter((t) => t && (t.kind === 'fig3d' || t.kind === 'figure'));
  const th = (selected && things[selected] && list.includes(things[selected])) ? things[selected] : list[list.length - 1];
  if (!th) {
    if (api.say) api.say('no figure here');
    return 'zoom-figure';
  }
  th.lod = nextLod(th.lod, hit.act);
  if (api.stage.save) api.stage.save();
  if (api.stage.render) api.stage.render();
  if (api.say) api.say('detail ' + th.lod);
  return 'zoom-figure';
}

export default {
  name: 'zoom-figure',
  examples: ['zoom in on the figure', 'zoom in', 'closer on the figure', 'zoom out on the figure'],
  nearMisses: ['spin the figure', 'summon a figure', 'what is zoom', 'zoom in on the map'],
  zoomOf,
  nextLod,
  detailFor,
  match(lower, text) { return !!zoomOf(text); },
  run,
  suite() {
    const d0 = detailFor(0), d1 = detailFor(nextLod(0, 'in')), d3 = detailFor(nextLod(LOD_MAX, 'in'));
    const ok = !!zoomOf('zoom in on the figure') && d0.tris === 0 && d0.remote === false && d0.published === false && d1.lod === 1 && d1.tris === 24 && d3.lod === LOD_MAX && zoomOf('spin the figure') === null;
    return { ok, got: ok ? 'lod steps' : 'miss' };
  }
};
