// brain-host, Verse Brain for every Verse page, not only while its card is open (owner, 2026-10-29: "how do we get verse to use its grok
// built brain ?"). void.html starts one host in idle time after the page loads. The host makes one brain (lib/brain.js) with what this
// device kept (lib/brain-store.js), and from then on:
//   hears     every ask on the stage (the page's 'void:ask' event, sent after the owner key is handled): the ask becomes ideas and goals
//             (lib/brain.js ask), and the asks layer learns what the visitor asks next and guesses it (heardAsk), counting its hits
//   suggests  the ask box's suggestions come from it (suggest, rank): the asks it expects next first, then the recent ones; typed hints
//             that match equally are ordered by its habits and goals
//   answers   "what are you thinking?" is answered from its own state (answer), and the Verse Brain card shows this same brain
//   runs      2 ticks a second (1 on a phone) in the browser's idle time, while the page is visible and no card drives it: about 6 ms a
//             tick, so about 1% of the main thread; the open card runs it at full speed
//   keeps     what it learned, on this device: every 30 seconds after a change, and when the page hides; and which ideas were lit
//             (lib/brain-glow.js), so a reload keeps the words it was just told as bright as they were, dimmed by the time away
//   bridges   other Verse pages in this browser reach it (lib/brain-bridge.js hostBrain, window.verseBrain)
//   watches   Verse's own health every 15 minutes while the page is visible (lib/brain-watch.js): runs on main, open pull requests
//             and issues, read from GitHub's public API and /incidents.json; a break is an action in its log and pulls its attention.
//             The same look reads what Verse decided (/api/will: its top want, the site it is assimilating, its last run) and its team
//             (/api/team: jobs waiting, agents here): a new decision is an action in its log, a stuck will or an unstaffed queue a break
// Nothing is sent anywhere. The asks it keeps are the visitor's own, on their own device; Forget on the card clears them.
import * as B from './brain.js';
import { loadKept, keep, loadGlow, keepGlow } from './brain-store.js';
import * as Glow from './brain-glow.js';
import { hostBrain } from './brain-bridge.js';
import * as Route from './brain-route.js';
import * as Watch from './brain-watch.js';

export const TICK_MS = 500, TICK_MS_PHONE = 1000, SAVE_MS = 30000;

/** the page's one host: the running one, or a new one. void.html calls it in idle time, the Verse Brain card when it opens (whichever comes
 *  first starts it). opts: { doc, win, seed, early: [{ text, at }] asks the page heard before (only those before the host started are
 *  learned, so none is learned twice), store: { loadKept, keep }, self: a /self.json promise or null, ticking: false never ticks and
 *  bridge: false never bridges (tests) }. Every part runs the same where IndexedDB or BroadcastChannel is missing. */
export function ensureHost(opts = {}) {
  const win = opts.win || (typeof window !== 'undefined' ? window : null), h = win && win.verseBrainHost;
  if (h && h.alive) { const before = (opts.early || []).filter((e) => e && e.at < h.startedAt).map((e) => e.text); if (before.length) h.ready.then(() => { for (const t of before) h.hear(t); }); return h; }
  return startHost({ ...opts, early: (opts.early || []).map((e) => (e && typeof e === 'object' ? e.text : e)) });
}

/** start a host (use ensureHost: one a page). Returns the host. */
export function startHost(opts = {}) {
  const doc = opts.doc || (typeof document !== 'undefined' ? document : null), win = opts.win || (typeof window !== 'undefined' ? window : null);
  const store = opts.store || { loadKept, keep, loadGlow, keepGlow }, now = () => (opts.now ? opts.now() : Date.now()), phone = !!(win && typeof win.matchMedia === 'function' && win.matchMedia('(pointer: coarse)').matches);
  const fresh = (seed) => B.createBrain(seed || ((Date.now() & 0xffff) || 1), { phone });
  const host = { brain: fresh(opts.seed), adopted: false, changed: false, kept: null, verse: null, listeners: new Set(), alive: true, startedAt: Date.now(), restored: [], heardHere: [], told: false, glow: null, lit: [], glowing: false, glowSaved: '' };
  const emit = (type, detail) => { for (const f of host.listeners) { try { f(type, detail); } catch (_) { /* a listener's own problem */ } } };
  const bind = (b) => { if (host.kept) B.loadKnowledge(b, host.kept); if (host.verse) B.knowVerse(b, host.verse); return b; };

  /** the visitor asked Verse something: the brain learns it as a goal and as the next ask after the last one. */
  host.hear = (text) => {
    const t = String(text == null ? '' : text).trim(); if (!t) return null;
    const b = host.brain, h = B.heardAsk(b, t), r = B.ask(b, t);
    host.heardHere.push(t); if (host.heardHere.length > 24) host.heardHere.shift();
    host.changed = true; host.glowing = true; emit('ask', { text: t, hit: h.hit, guess: h.guess, words: r.words || [] });
    return { ...h, answer: r.answer || null, words: r.words || [] };
  };
  /** more than one skill can answer `text`: the brain picks (lib/brain-route.js). names: the skills that match, in the page's order.
   *  Returns { pick, first, changed, why, id } or null when there is no choice. The page tells it what happened with judge(id, good). */
  const routes = () => host.brain.routes || (host.brain.routes = Route.createRoutes());
  host.route = (text, names) => {
    const b = host.brain, focus = b.mind.goals.filter((g) => g.strength > 0.1).map((g) => b.concepts.words[g.idx]).filter(Boolean).concat(Watch.focusOf(watch()));
    const r = Route.route(routes(), text, names, focus); if (r) { host.changed = true; emit('route', r); } return r;
  };
  host.judge = (id, good) => { const ok = Route.outcome(routes(), id, good); if (ok) { host.changed = true; emit('judged', { id, good }); } return ok; };
  host.undoRoute = (id) => { const ok = Route.undo(routes(), id); if (ok) { host.changed = true; emit('undone', { id }); } return ok; };
  /** every action it took or saw, newest first: its picks (lib/brain-route.js) and what it saw of Verse's health (lib/brain-watch.js). */
  host.actions = (top = 12) => [...routes().log, ...watch().log].sort((a, z) => z.at - a.at).slice(0, top).map((a) => ({ ...a }));
  const watch = () => host.brain.watch || (host.brain.watch = Watch.createWatch());
  const json = async (f, u) => { try { const r = await f(u, { headers: { accept: 'application/vnd.github+json' } }); return r && r.ok ? await r.json() : null; } catch (_) { return null; } };
  /** read Verse's health now (the timer calls it every 15 minutes): returns { news, breaks }, or null while a read runs. */
  host.watchNow = async (fetchFn = opts.fetch || (win && typeof win.fetch === 'function' ? (u, o) => win.fetch(u, o) : null)) => {
    if (!fetchFn || host.watching) return null;
    host.watching = true;
    try {
      const S = await import('../skills/status.js'), api = 'https://api.github.com/repos/' + S.REPO;
      const [rows, inc, prs, issues, will, team] = await Promise.all([S.buildState(fetchFn).catch(() => null), json(fetchFn, '/incidents.json'), json(fetchFn, api + '/pulls?state=open&per_page=50'), json(fetchFn, api + '/issues?state=open&per_page=50'), json(fetchFn, '/api/will'), json(fetchFn, '/api/team')]);
      const W = watch(), r = Watch.takeIn(W, Watch.observe({ rows: rows ? S.causesOf(rows, inc) : null, prs: Array.isArray(prs) ? prs : null, issues: Array.isArray(issues) ? issues : null, will, team: team && team.ok ? team : null }));
      const d = Watch.decide(W, Watch.decisionOf(will)); if (d) r.news.push(d);
      host.changed = true; for (const n of r.news) emit('watch', n);
      return r;
    } finally { host.watching = false; }
  };
  host.breaks = () => Watch.breaksOf(watch());
  /** what Verse decided to do next, as its will said at the last look: { want, because, site, tower, at } or null. */
  host.decision = () => (watch().next ? { ...watch().next } : null);
  host.dismiss = (id) => { const ok = Watch.dismiss(watch(), id); if (ok) { host.changed = true; emit('dismissed', { id }); } return ok; };
  host.undismiss = (id) => { const ok = Watch.undismiss(watch(), id); if (ok) { host.changed = true; emit('undismissed', { id }); } return ok; };
  host.watchStats = () => { const W = watch(); return { reads: W.reads, at: W.at, breaks: Watch.breaksOf(W).length }; };
  host.routeStats = () => { const R = routes(); return { picks: R.picks, changed: R.changed, good: R.good, bad: R.bad }; };
  /** the empty ask box: the asks it expects next, then the recent ones (newest first), at most `top`. */
  host.suggest = (recent, top = 5) => B.suggestAsks(host.brain, recent, top);
  /** typed hints that match equally: the brain's order (habit, then nearness to its goals). Higher first. */
  host.rank = (line) => B.askScore(host.brain, line);
  /** a question about itself ("what are you thinking?"), answered from its state, or null when the text is not one. */
  host.answer = (text) => { const r = B.isQuestion(text) ? B.ask(host.brain, text) : null; return r && r.answer ? r.answer.join(' ') : null; };
  /** its hits at guessing the next ask: { guessed, hits, heard }. */
  host.guesses = () => { const A = host.brain.mind.asks; return { guessed: A.guessed, hits: A.hits, heard: A.heard }; };
  /** Reset on the card: a new brain that gets back what this device kept. */
  host.reset = (seed) => { host.brain = bind(fresh(seed)); host.changed = false; host.heardHere = []; host.told = true; return host.brain; };
  /** true while its brain holds only what this page heard on the stage: the card may then give back what it was thinking before a reload,
   *  and the asks heard here are told again on top of it (warm), so nothing of this page is lost. */
  host.onlyHere = () => !host.told;
  host.warm = (b) => { if (host.glow) Glow.loadGlow(b, host.glow, now()); for (const t of host.heardHere) B.ask(b, t); host.told = true; };
  host.on = (fn) => { host.listeners.add(fn); return () => host.listeners.delete(fn); };
  /** keep which ideas are lit, when it changed (or always, with force: the page is hiding, so the time it was kept is now). */
  host.saveGlow = async (force) => {
    if (!host.glowing || !store.keepGlow) return false;
    const g = Glow.glowOf(host.brain, now()), key = Glow.glowKey(g); if (!force && key === host.glowSaved) return false;
    host.glowSaved = key; return !!(await store.keepGlow(g));
  };
  host.save = async (force) => {
    const glow = host.saveGlow(force).catch(() => false);
    if (!host.changed) { await glow; return false; }
    host.changed = false; host.kept = JSON.parse(JSON.stringify(B.knowledgeOf(host.brain))); const ok = !!(await store.keep(host.kept)); await glow; return ok;
  };
  /** Forget on the card: what it kept is gone, and nothing is kept again until it hears something new. */
  host.forgot = () => { host.kept = null; host.changed = false; host.glow = null; host.glowing = false; host.glowSaved = ''; host.brain.mind.asks = { last: null, next: {}, guess: null, guessed: 0, hits: 0, heard: 0 }; host.brain.routes = Route.createRoutes(); };

  // what it kept on this device comes back before the asks heard meanwhile are learned, so they are added to it
  const early = Array.isArray(opts.early) ? opts.early.slice() : [];
  host.ready = Promise.resolve(store.loadKept()).catch(() => null).then(async (k) => {
    if (k && k.v === 1) { host.kept = k; host.restored = B.loadKnowledge(host.brain, k); }
    // the ideas that were lit before the reload come back lit, before the asks heard meanwhile (those are the newest)
    const g = store.loadGlow ? await Promise.resolve(store.loadGlow()).catch(() => null) : null;
    if (g) { host.lit = Glow.loadGlow(host.brain, g, now()); if (host.lit.length) { host.glow = g; host.glowing = true; } }
    for (const t of early) host.hear(t);
    // asks typed on tool pages since it last ran (lib/toolkit.js keeps them on this device): it hears each, and logs where the page sent it
    const ls = win && (() => { try { return win.localStorage; } catch (_) { return null; } })();
    if (ls) { let q = []; try { q = JSON.parse(ls.getItem(Route.HEARD_KEY) || '[]'); ls.removeItem(Route.HEARD_KEY); } catch (_) { q = []; }
      for (const a of (Array.isArray(q) ? q : []).slice(-Route.HEARD_MAX)) if (a && typeof a.text === 'string' && a.text.trim() && !/^\s*(?:unlock\s*)+\S{16,}/i.test(a.text)) { host.hear(a.text); Route.heard(routes(), a.text, a.from, a.to, Number(a.at) || Date.now()); } }
  });
  if (opts.self) Promise.resolve(opts.self).then((j) => { if (j) { host.verse = j; B.knowVerse(host.brain, j); } }).catch(() => {});

  // a tick only when no one else stepped it since the last one (an open card steps it 60 times a second) and the page is visible
  let seen = host.brain.ticks, timer = null, saver = null, bridge = null, watcher = null, firstLook = null;
  const tick = () => {
    const b = host.brain; if (doc && doc.visibilityState === 'hidden') return;
    if (b.ticks !== seen) { seen = b.ticks; return; }
    B.stepBrain(b, { over: false }); seen = b.ticks; if (bridge) bridge.publish();
  };
  const idle = (win && win.requestIdleCallback) ? () => win.requestIdleCallback(tick, { timeout: 400 }) : tick;
  if (opts.ticking !== false) { timer = setInterval(idle, phone ? TICK_MS_PHONE : TICK_MS); saver = setInterval(() => { host.save().catch(() => {}); }, SAVE_MS); }
  // the watch: a first look 20 s after the page settles, then whenever 15 minutes have passed, only while the page is visible
  const look = () => { if (doc && doc.visibilityState === 'hidden') return; if (Watch.due(watch())) host.watchNow().catch(() => {}); };
  if (opts.ticking !== false && opts.watching !== false) { firstLook = setTimeout(() => host.ready.then(look), 20000); watcher = setInterval(look, 60000); }
  const onAsk = (e) => { const t = e && e.detail && e.detail.text; if (t) host.ready.then(() => host.hear(t)); };
  const onHide = () => { if (!doc || doc.visibilityState === 'hidden') host.save(true).catch(() => {}); };
  if (doc) { doc.addEventListener('void:ask', onAsk); doc.addEventListener('visibilitychange', onHide); }
  if (win && win.addEventListener) win.addEventListener('pagehide', onHide);
  if (opts.bridge !== false) bridge = hostBrain(B, () => host.brain, { onWords: (t, from) => { host.changed = true; host.told = true; host.glowing = true; emit('words', { text: t, from }); } });
  host.publish = (force) => (bridge ? bridge.publish(force) : null);
  host.stop = () => {
    host.alive = false; if (win && win.verseBrainHost === host) delete win.verseBrainHost; clearInterval(timer); clearInterval(saver); clearInterval(watcher); clearTimeout(firstLook); if (bridge) bridge.close();
    if (doc) { doc.removeEventListener('void:ask', onAsk); doc.removeEventListener('visibilitychange', onHide); }
    if (win && win.removeEventListener) win.removeEventListener('pagehide', onHide);
  };
  if (win) win.verseBrainHost = host;
  return host;
}
