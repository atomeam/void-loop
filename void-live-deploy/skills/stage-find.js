/**
 * stage-find skill — find things on the stage (tools pack 5, owner 2026-10-18; numbers 91, 92, 96, 97, 99):
 * "search kept items for pizza" / "find milk on the stage" (91, 92: a card of the matches, each with a go button),
 * "show all timers on the stage" / "search the stage by kind: timer" (92), "jump to the milk note" (97: the thing is picked and scrolled to),
 * "recently kept" (96: the kept cards, newest first), "what changed today" (99: added, edited and dismissed things since midnight,
 * from the log the stage keeps in this browser, lib/stage-watch.js). Device-local; nothing leaves the browser.
 * "show only clocks" stays with type-filter (it hides, this lists); "search vimeo for ..." and every web search are not taken.
 */
import { findIntent, searchThings, byKind, kindWord, KIND_ALIAS, BASIC_KINDS, jumpTarget, recentlyKept, todaysChanges, changeLine } from '../lib/stage-find.js';
import { watchStage, flush, readJson, CHANGES_KEY } from '../lib/stage-watch.js';
import { listPage, goTo } from '../lib/pack5-ui.js';

const STATE_KEY = 'a2m.void.state.v1';
const savedThings = () => { const s = readJson(STATE_KEY, {}); return s && typeof s === 'object' ? s : {}; };
const kindsOf = (things) => [...new Set(Object.values(things || {}).filter((t) => t && t.kind).map((t) => t.kind).concat(BASIC_KINDS))];

/** the intent, with a kind word or a jump phrase kept only when the stage can answer it. Pure over `things`. */
export function resolve(text, things) {
  const it = findIntent(text);
  if (!it) return null;
  const kinds = kindsOf(things);
  if (it.op === 'search') { // "find all timers on the stage" is a kind ask
    const k = kindWord(it.q.replace(/^(?:all|every|any)\s+/, ''), kinds, KIND_ALIAS);
    return k && /^(?:all|every)\s/.test(it.q) ? { op: 'kind', kind: k } : it;
  }
  if (it.op === 'kind') { const k = kindWord(it.word, kinds, KIND_ALIAS); return k ? { op: 'kind', kind: k } : null; }
  if (it.op === 'jump') return jumpTarget(things, it.phrase) ? it : null;
  return it;
}

async function run(text, api) {
  const live = api.stage.things();
  const it = resolve(text, live);
  if (!it) return 'none';
  if (it.op === 'changed' || it.op === 'recent-kept') flush(api.stage); // the log must hold what just happened
  const pick = (r) => goTo(api.stage, r.id);
  const rows = (hits) => hits.map((h) => ({ id: h.id, text: h.label, sub: h.kind }));
  if (it.op === 'jump') {
    const t = jumpTarget(live, it.phrase);
    if (!t) { api.say('nothing like that on the stage'); return 'stage-find'; }
    goTo(api.stage, t.id); api.say('here: ' + t.label);
    return 'stage-find';
  }
  if (it.op === 'search') {
    const hits = searchThings(live, it.q, it.kept ? { kind: 'kept' } : {});
    listPage(api, (it.kept ? 'Kept items' : 'The stage') + ' matching "' + it.q + '"', rows(hits), { empty: 'Nothing on ' + (it.kept ? 'your kept cards' : 'the stage') + ' holds "' + it.q + '".', foot: hits.length + ' found on this device', onPick: pick });
    return 'stage-find';
  }
  if (it.op === 'kind') {
    const hits = byKind(live, it.kind);
    listPage(api, 'Every ' + it.kind + ' on the stage', rows(hits), { empty: 'No ' + it.kind + ' on the stage.', foot: hits.length + ' found', onPick: pick });
    return 'stage-find';
  }
  if (it.op === 'recent-kept') {
    const hits = recentlyKept(live, readJson(CHANGES_KEY, []));
    listPage(api, 'Recently kept', rows(hits), { empty: 'Nothing kept on the stage yet. Say "keep this" under an answer.', foot: 'Newest first, from this device', onPick: pick });
    return 'stage-find';
  }
  // changed today
  const log = todaysChanges(readJson(CHANGES_KEY, []));
  listPage(api, 'What changed today', log.map((e) => ({ id: e.id, text: changeLine(e), sub: new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })),
    { empty: 'Nothing has changed on the stage today.', foot: 'Added, edited and dismissed things since midnight, kept only in this browser', onPick: (r) => { if (live[r.id]) goTo(api.stage, r.id); else api.say('that one was dismissed · say "show the undo pile"'); } });
  return 'stage-find';
}

export default {
  name: 'stage-find',
  examples: ['search kept items for pizza', 'search the stage for milk', 'show all timers on the stage', 'search the stage by kind: sticky', 'recently kept', 'what changed today'],
  nearMisses: ['search vimeo for big buck bunny', 'find a rumble video about bitcoin', 'show only clocks', 'what changed in the news today', 'go to sleep', 'jump to conclusions', 'where is the moon tonight'],
  resolve,
  match(lower, text) { const a = text || lower; return !!findIntent(a) && !!resolve(a, savedThings()); }, // the saved stage is read only for an ask that looks like one of ours
  run,
  decorate(stageApi) { watchStage(stageApi); },
};
