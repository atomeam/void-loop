/**
 * load-later: a skill's heavy helpers (rules engines, the 3D lift, the almanac) load on its first run or card, not with the
 * routing order (owner, 2026-10-30: the games and time families sat early in skills/index.json and every skill after them
 * waited for their 760 KB, 350 KB of it helpers that only a game or a sky answer needs). match() and the ask parser stay in the skill's own
 * file and answer at once; only run and the stage card wait for the helpers.
 *   const ready = loadLater(() => import('./x-rules.js').then((m) => { R = m; }));
 *   await ready()        loads once and resolves when the helpers are in; a load that failed is tried again on the next call
 *   ready.done           true once they are in
 *   ready.mount(mount)   a stage kind's mount: draws at once when the helpers are in; otherwise (a board kept from last time,
 *                        drawn again after a reload before anyone asked) it loads them and then draws the stage again, so the
 *                        card comes back with the page's placement, tucks and layout like any redraw
 */
const redrawing = new Set(); // one redraw per stage for all the cards that waited on the same load

export function loadLater(load) {
  let p = null;
  const ready = () => p || (p = Promise.resolve().then(load).then(() => { ready.done = true; }, (e) => { p = null; throw e; }));
  ready.done = false;
  ready.mount = (mount) => function lazyMount(th, stageApi) {
    if (ready.done) return mount(th, stageApi);
    ready().then(() => {
      const things = stageApi && typeof stageApi.things === 'function' ? stageApi.things() : null;
      if (!things || typeof stageApi.render !== 'function') return mount(th, stageApi); // a stage with no redraw of its own: draw this card
      if (things[th.id] !== th || redrawing.has(stageApi)) return; // thrown off meanwhile, or a redraw is already on its way
      redrawing.add(stageApi);
      queueMicrotask(() => { redrawing.delete(stageApi); stageApi.render(); });
    }, (e) => console.warn('[load-later] a card\'s helpers did not load', e && e.message));
  };
  return ready;
}
