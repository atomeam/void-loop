/**
 * dismiss skill — "dismiss this" sends the selected stage thing away.
 * throw-off.js only matches a throw phrase. Empty surface stays empty:
 * nothing selected means nothing is removed and nothing is published.
 */
const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();

export function dismissOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?dismiss this$/.test(t)) return { what: 'selected' };
  if (/^(?:please\s+)?send this away$/.test(t)) return { what: 'selected' };
  if (/^(?:please\s+)?dismiss the selected thing$/.test(t)) return { what: 'selected' };
  if (/^(?:please\s+)?send it away$/.test(t)) return { what: 'selected' };
  return null;
}

/** Remove only the selected id. No selection: leave the stage as it is. */
export function dismissSelected(s) {
  const things = { ...(s && s.things || {}) };
  const id = s && s.selected;
  if (!id || !things[id]) return { removed: false, things, html: '', published: false };
  delete things[id];
  return { removed: true, id, things, html: '', published: false };
}

async function run(text, api) {
  const hit = dismissOf(text);
  if (!hit) return 'none';
  const things = api.stage && api.stage.things ? api.stage.things() : {};
  const selected = api.stage && api.stage.selected ? api.stage.selected() : null;
  const next = dismissSelected({ things, selected });
  if (!next.removed) {
    if (api.say) api.say('nothing selected');
    return 'dismiss';
  }
  delete things[next.id];
  if (api.stage.select) api.stage.select(null);
  if (api.stage.save) api.stage.save();
  if (api.stage.render) api.stage.render();
  if (api.say) api.say('sent away');
  return 'dismiss';
}

export default {
  name: 'dismiss',
  examples: ['dismiss this', 'send this away', 'dismiss the selected thing', 'send it away'],
  nearMisses: ['dismiss figures', 'throw it off the screen', 'what is dismiss', 'send an email to sam'],
  dismissOf,
  dismissSelected,
  match(lower, text) { return !!dismissOf(text); },
  run,
  suite() {
    const empty = dismissSelected({ things: {}, selected: null });
    const one = dismissSelected({ things: { a: { id: 'a' }, b: { id: 'b' } }, selected: 'a' });
    const ok = dismissOf('dismiss this') && !dismissOf('dismiss figures') && empty.removed === false && Object.keys(empty.things).length === 0
      && one.removed === true && !one.things.a && one.things.b && one.published === false;
    return { ok, got: ok ? 'selected only' : 'miss' };
  }
};
