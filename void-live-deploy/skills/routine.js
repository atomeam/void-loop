/**
 * routine — frontier #13's first piece. "call this my morning" keeps the last few asks (the ones the ask box already remembers
 * for its hints) as a routine named "morning" in this browser; "my morning" asks them again, in order, exactly as if typed.
 * "my routines" lists them, "forget my morning" drops one. A routine is only asks Void already answers, so it can do nothing
 * typing them could not; it never leaves this browser. The pure half (the ask, the pick, the store) is lib/routines.js.
 */
import { routineAsk, pick, load, save, remove, recentAsks, MAX_ASKS } from '../lib/routines.js';

const store = () => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch (_) { return null; } };
let running = false; // a routine never runs inside another one

function card(api, title, rows, foot) {
  const { showPage, esc } = api;
  showPage((p) => {
    p.innerHTML = '<h2>' + esc(title) + '</h2>' // void-review: ok: every value goes through esc()
      + (rows.length ? '<ol data-routine-asks>' + rows.map((r) => '<li>' + esc(r) + '</li>').join('') + '</ol>' : '')
      + '<div class="sub" data-routine-foot>' + esc(foot) + '</div>';
  });
}

async function run(text, api) {
  const ls = store(), saved = load(ls), ask = routineAsk(text, saved);
  if (!ask) return 'none';
  const log = (note) => api.loopLog({ domain: 'void.page', ask: text, score: 'pass', note: 'routine:' + note });
  if (ask.kind === 'save') {
    const asks = pick(recentAsks(ls), ask.count);
    if (!asks.length) { card(api, 'Nothing to keep yet', [], 'Ask a few things first, then say "call this my ' + ask.name + '" and I will keep them as a routine.'); log('empty'); return 'routine'; }
    save(ls, ask.name, asks, new Date().toISOString().slice(0, 10));
    card(api, 'Saved "my ' + ask.name + '"', asks, 'Say "my ' + ask.name + '" to ask these again, in this order. It stays in this browser; "forget my ' + ask.name + '" drops it. A routine keeps at most ' + MAX_ASKS + ' asks.');
    api.say('saved my ' + ask.name); log('save'); return 'routine';
  }
  if (ask.kind === 'list') {
    const names = Object.keys(saved);
    card(api, names.length ? 'Your routines' : 'No routines yet', names.map((n) => 'my ' + n + ': ' + saved[n].asks.join(' · ')), names.length ? 'Say one to run it. They stay in this browser.' : 'Ask a few things, then say "call this my morning".');
    log('list'); return 'routine';
  }
  if (ask.kind === 'forget') { remove(ls, ask.name); card(api, 'Forgot "my ' + ask.name + '"', [], 'It is gone from this browser.'); log('forget'); return 'routine'; }
  // run: each ask goes through the same path as typing it, one after another
  if (running) return 'none';
  const asks = (saved[ask.name] && saved[ask.name].asks) || [];
  running = true; log('run');
  try { for (const a of asks) await api.stage.ask(a); } finally { running = false; }
  api.say('my ' + ask.name + ': ' + asks.length + ' ask' + (asks.length === 1 ? '' : 's'));
  return 'routine';
}

export default {
  name: 'routine',
  routineAsk,
  examples: ['call this my morning', 'save that as my evening', 'save the last 2 asks as my study', 'my routines'],
  nearMisses: ['call my mom', 'what is a morning routine', 'save the whales', 'call this number', 'my calendar', 'forget my password'],
  match(lower, text) { return !!routineAsk(text || lower, load(store())); },
  run,
};
