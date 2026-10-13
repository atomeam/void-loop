/**
 * clear-stage skill — "clear the stage", "wipe the stage".
 * Clears every thing on the stage. Empty surface stays empty:
 * nothing to clear means nothing is removed and nothing is published.
 */
const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();

export function clearOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?clear the stage$/.test(t)) return { what: 'all' };
  if (/^(?:please\s+)?wipe the stage$/.test(t)) return { what: 'all' };
  if (/^(?:please\s+)?clear everything$/.test(t)) return { what: 'all' };
  if (/^(?:please\s+)?wipe everything(?: off)?$/.test(t)) return { what: 'all' };
  if (/^(?:please\s+)?clear the board$/.test(t)) return { what: 'all' };
  return null;
}

/** Clear all things. Empty: leave as is. */
export function clearAll(s) {
  const things = { ...(s && s.things || {}) };
  const keys = Object.keys(things);
  if (!keys.length) return { cleared: false, things, html: '', published: false };
  return { cleared: true, count: keys.length, things: {}, html: '', published: false };
}

async function run(text, api) {
  const hit = clearOf(text);
  if (!hit) return 'none';
  const things = api.stage && api.stage.things ? api.stage.things() : {};
  const next = clearAll({ things });
  if (!next.cleared) {
    if (api.say) api.say('already empty');
    return 'clear-stage';
  }
  // clear by deleting each
  for (const id of Object.keys(things)) delete things[id];
  if (api.stage.select) api.stage.select(null);
  if (api.stage.save) api.stage.save();
  if (api.stage.render) api.stage.render();
  if (api.say) api.say('cleared');
  return 'clear-stage';
}

export default {
  name: 'clear-stage',
  examples: ['clear the stage', 'wipe the stage', 'clear everything', 'wipe everything off', 'clear the board'],
  nearMisses: ['clear the calendar', 'what is clear', 'wipe my data', 'clear cookies'],
  clearOf,
  clearAll,
  match(lower, text) { return !!clearOf(text); },
  run,
  suite() {
    const empty = clearAll({ things: {} });
    const one = clearAll({ things: { a: { id: 'a' }, b: { id: 'b' } } });
    const ok = clearOf('clear the stage') && !clearOf('clear the calendar') && empty.cleared === false && Object.keys(empty.things).length === 0
      && one.cleared === true && Object.keys(one.things).length === 0 && one.published === false;
    return { ok, got: ok ? 'all or none' : 'miss' };
  }
};
