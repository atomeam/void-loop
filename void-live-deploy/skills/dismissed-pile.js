/**
 * dismissed-pile skill — the undo pile (tools pack 5, owner 2026-10-18; numbers 93 and 94): everything taken off the stage
 * (dismissed, thrown off, taken off by "take this off") lands on a pile of the last 20 in this browser, and "show the undo pile" /
 * "what did I dismiss" lists them, each with a restore button; "restore the last dismissed", "restore dismissed 3" or
 * "restore the timer" puts one back where it was (one "undo" takes the restore away again). The pile is watched by lib/stage-watch.js
 * on every redraw; plain "undo" (one step back) stays the page's own. Device-local; nothing leaves the browser.
 */
import { pileIntent, takeFromPile, thingLabel } from '../lib/stage-find.js';
import { watchStage, flush, readJson, writeJson, PILE_KEY } from '../lib/stage-watch.js';
import { listPage, goTo } from '../lib/pack5-ui.js';

/** put pile entry `entry` back on the stage (a new id when its own is taken). Returns the id. */
export function putBack(stageApi, entry) {
  const things = stageApi.things(), th = JSON.parse(JSON.stringify(entry.thing));
  if (typeof stageApi.snapshot === 'function') stageApi.snapshot(); // so "undo" takes the restore away
  if (things[th.id]) th.id = th.kind + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  things[th.id] = th;
  stageApi.select(th.id); stageApi.save(); stageApi.render();
  // the restore is recorded now: the watcher looks only once redraws settle, so a restore and a quick second dismissal cancelled out and the
  // pile and "what changed today" missed both (the restore button's path; the browser suite's undo pile check)
  flush(stageApi);
  return th.id;
}

function show(api) {
  const pile = readJson(PILE_KEY, []);
  const rows = pile.map((e) => ({ text: e.label || e.kind, sub: e.kind + ' · ' + new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }));
  const el = listPage(api, 'The undo pile', rows, { action: 'restore', empty: 'Nothing dismissed lately. What you send away stays here, the last 20.', foot: 'Dismissed things, newest first, kept only in this browser',
    onPick: (r, b) => {
      const i = rows.indexOf(r), cur = readJson(PILE_KEY, []), { entry, pile: rest } = takeFromPile(cur, i + 1);
      if (!entry) return;
      writeJson(PILE_KEY, rest);
      const id = putBack(api.stage, entry);
      b.textContent = 'back'; b.disabled = true;
      goTo(api.stage, id);
    } });
  return el;
}

async function run(text, api) {
  const it = pileIntent(text);
  if (!it) return 'none';
  flush(api.stage); // what was dismissed a moment ago is on the pile before it is read
  if (it.op === 'show') { show(api); return 'dismissed-pile'; }
  const cur = readJson(PILE_KEY, []);
  const { entry, pile } = takeFromPile(cur, it.op === 'restore' ? it.n : { name: it.name });
  if (!entry) { api.say(cur.length ? 'nothing like that on the pile' : 'the pile is empty'); return 'dismissed-pile'; }
  writeJson(PILE_KEY, pile);
  const id = putBack(api.stage, entry);
  api.say('back: ' + thingLabel(entry.thing));
  goTo(api.stage, id);
  return 'dismissed-pile';
}

export default {
  name: 'dismissed-pile',
  examples: ['show the undo pile', 'what did I dismiss', 'last 20 dismissed', 'restore the last dismissed', 'restore dismissed 2'],
  nearMisses: ['undo', 'dismiss this', 'what is a dismissal', 'restore my password', 'restore factory settings', 'bring back the 90s'],
  pileIntent,
  // "restore the timer" is only the pile's when the pile holds something like it, so other restore asks pass through
  match(lower, text) {
    const it = pileIntent(text || lower);
    if (!it) return false;
    if (it.op !== 'restore-name') return true;
    return !!takeFromPile(readJson(PILE_KEY, []), { name: it.name }).entry;
  },
  run,
  decorate(stageApi) { watchStage(stageApi); },
};
