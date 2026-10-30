// brain-everywhere: Verse Brain on every Verse page (owner, 2026-10-30: "make it so its brain can be used with all the tools and pages").
// /visit.js adds this module to every page 1.5 s after the page has loaded (tools/beacon-pages.test.mjs keeps /visit.js on every page of the
// sitemap). The page then has one way in to the one brain of this browser, with no import:
//   read   window.verseBrain.state()     what the brain does and thinks now (lib/brain-bridge.js summaryOf), or null
//          window.verseBrain.read()      the same, as a promise: if no tab runs the brain, this page starts it and answers from it
//          window.verseBrain.on(fn)      fn(state) at each new state
//   write  window.verseBrain.tell(text)  words become ideas and goals (lib/brain.js ask)
//          window.verseBrain.reward()    "good" for what the brain did last
//          document.dispatchEvent(new CustomEvent('verse:brain', { detail: { text } }))   the same as tell, for a script that does not
//          look for window.verseBrain ({ detail: { reward: true } } is the same as reward)
//   where  once a page, the brain is told which page the visitor opened (its title, as ideas and not as a goal)
// A tool row (lib/toolkit.js mountRelated, the "Use with" row of the tool pages) also shows what the brain thinks about while a brain
// runs, as a link to /brain/.
//
// One brain a browser. When another tab runs it (the stage, /brain/ or another page), this page talks to that one over the
// BroadcastChannel (lib/brain-bridge.js). When no tab answers in WAIT_MS, a write is kept on this device in the lists the brain reads first
// when it starts (HEARD_KEY: the asks, the same list the tool pages' ask bar keeps; SEEN_KEY: the pages opened), and a read starts the
// brain here (lib/brain-host.js ensureHost) if no other tab of this browser holds LOCK. Nothing here is sent to a server: BroadcastChannel
// and localStorage stay in this browser. An owner key ("unlock ...") is never kept or told. Tests: tools/brain-everywhere.test.mjs.
import { connectBrain } from './brain-bridge.js';

export const HEARD_KEY = 'a2m.brain.heard.v1', HEARD_MAX = 24; // the same list as lib/brain-route.js (the test checks it)
export const SEEN_KEY = 'a2m.brain.seen.v1', SEEN_MAX = 24;
export const LOCK = 'verse-brain-host', WAIT_MS = 1500, POLL_MS = 2000, EVENT = 'verse:brain', TEXT_MAX = 120;
const OWNER_KEY = /^\s*(?:unlock\s*)+\S{16,}/i;
const clean = (t) => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, TEXT_MAX);

/** the page's own name for the brain: its title without the site name, or its first heading, or its path. Pure on the strings. */
export function pageName(title, h1, path) {
  const t = clean(String(title || '').replace(/\s*[|·:\-–]\s*(?:Verse|a-to-mind(?:\.com)?)\s*$/i, ''));
  if (t && !/^verse$/i.test(t)) return t;
  return clean(h1) || clean(String(path || '').replace(/^\/|\/$/g, '').replace(/[-/]+/g, ' ')) || 'the stage';
}

/** add one entry to a list kept on this device (newest last, at most max). Never an owner key. -> true when kept. */
export function keepIn(store, key, entry, max) {
  if (!store || !entry || !clean(entry.text) || OWNER_KEY.test(entry.text)) return false;
  try {
    const q = JSON.parse(store.getItem(key) || '[]'), list = Array.isArray(q) ? q : [];
    list.push({ ...entry, text: clean(entry.text) }); store.setItem(key, JSON.stringify(list.slice(-max))); return true;
  } catch (_) { return false; }
}

/** take a kept list once (the brain calls it when it starts): its entries with text, oldest first; the list is then empty. */
export function takeAll(store, key, max) {
  if (!store) return [];
  let q = []; try { q = JSON.parse(store.getItem(key) || '[]'); store.removeItem(key); } catch (_) { q = []; }
  return (Array.isArray(q) ? q : []).filter((a) => a && typeof a.text === 'string' && clean(a.text) && !OWNER_KEY.test(a.text)).slice(-max);
}

/** what one tool row shows while a brain runs: "Verse Brain: <what it thinks about>" (or what it does), or null. Pure. */
export function chipText(state) {
  if (!state || state.type !== 'state') return null;
  const t = state.thinking ? clean(state.thinking) : '', a = state.action && state.action !== 'rest' ? clean(state.action) : '';
  return 'Verse Brain: ' + (t ? 'thinking about ' + t : a ? a : 'resting');
}

/** start on this page (once a page). env: { win, doc, connect, startHost, locks, wait, path } for tests. -> the api. */
export function start(env = {}) {
  const win = env.win || (typeof window !== 'undefined' ? window : null), doc = env.doc || (win && win.document) || null;
  if (!win) return null;
  if (win.__verseBrainPage) return win.__verseBrainPage;
  const store = (() => { try { return win.localStorage; } catch (_) { return null; } })();
  const conn = (env.connect || connectBrain)(), path = env.path || (win.location && win.location.pathname) || '/';
  const wait = env.wait != null ? env.wait : WAIT_MS, fns = new Set();
  let starting = null;
  // a brain answered on this page once: it is there (a brain in a hidden tab still hears, it only posts when asked)
  const live = () => !!conn.state;

  /** start the brain in this tab when no tab answered and no other tab holds the lock (or the browser has no locks). -> host or null */
  const startHere = () => {
    if (starting) return starting;
    starting = (async () => {
      const locks = env.locks !== undefined ? env.locks : (win.navigator && win.navigator.locks) || null;
      if (locks && typeof locks.request === 'function') {
        const got = await new Promise((res) => {
          locks.request(LOCK, { ifAvailable: true }, (lock) => { res(!!lock); return lock ? new Promise(() => {}) : null; }).catch(() => res(false));
        });
        if (!got) return null;
      }
      const make = env.startHost || (async (o) => (await import('./brain-host.js')).ensureHost(o));
      const self = typeof win.fetch === 'function' ? win.fetch('/self.json').then((r) => (r.ok ? r.json() : null)).catch(() => null) : null;
      return make({ self });
    })().catch(() => null);
    return starting;
  };
  /** wait up to ms for a brain to answer (the hello that connectBrain sends asks the running one to post now) */
  const heard = (ms) => new Promise((res) => {
    if (conn.live) return res(true);
    conn.hello(); let t = null; const off = conn.on(() => { if (conn.live) { off(); clearTimeout(t); res(true); } }); t = setTimeout(() => { off(); res(conn.live); }, ms);
  });

  const api = {
    get live() { return live(); },
    page: pageName(doc && doc.title, doc && doc.querySelector && doc.querySelector('h1') && doc.querySelector('h1').textContent, path),
    state: () => (live() ? conn.state : null),
    read: async () => { if (await heard(wait)) return conn.state; await startHere(); return (await heard(wait)) ? conn.state : null; },
    on: (fn) => { fns.add(fn); if (live()) fn(conn.state); return () => fns.delete(fn); },
    tell: (text) => {
      const t = clean(text); if (!t || OWNER_KEY.test(t)) return false;
      if (live()) return conn.tell(t);
      return keepIn(store, HEARD_KEY, { text: t, from: path, to: path, at: Date.now() }, HEARD_MAX);
    },
    reward: () => (live() ? conn.reward() : false)
  };
  // while this page is in view, it asks the brain for its state every POLL_MS (a brain in a hidden tab posts only when asked)
  const poll = setInterval(() => { if (live() && (!doc || doc.visibilityState !== 'hidden')) conn.hello(); }, env.poll || POLL_MS);
  api.stop = () => { clearInterval(poll); conn.close(); if (win.__verseBrainPage === api) delete win.__verseBrainPage; };
  conn.on((s) => { for (const f of fns) { try { f(s); } catch (_) { /* a listener's own problem */ } } });
  win.__verseBrainPage = api;
  // a host in this tab (the stage, /brain/) sets window.verseBrain itself; this one keeps a host's own api when there is one
  if (!win.verseBrain || !win.verseBrainHost) win.verseBrain = api;
  if (doc && doc.addEventListener) doc.addEventListener(EVENT, (e) => { const d = e && e.detail; if (!d) return; if (d.reward) api.reward(); else if (d.text) api.tell(d.text); });

  // which page this is: told once, as ideas (not a goal), when a brain answers; kept for the next brain when none does
  api.seen = heard(wait).then((ok) => {
    const entry = { text: api.page, from: path, at: Date.now() };
    return ok ? conn.seen(entry.text, path) : keepIn(store, SEEN_KEY, entry, SEEN_MAX);
  });
  // the tool rows: what the brain thinks about, while one runs
  if (doc && doc.querySelectorAll) {
    const paint = (s) => {
      const text = chipText(s); if (!text) return;
      for (const row of doc.querySelectorAll('.tk-row')) {
        let a = row.querySelector('a.tk-brain');
        if (!a) { a = doc.createElement('a'); a.className = 'tk-brain'; a.href = '/brain/'; a.title = 'Verse Brain: open it full screen'; row.append(a); }
        if (a.textContent !== text) a.textContent = text;
      }
    };
    api.on(paint);
  }
  return api;
}

if (typeof window !== 'undefined' && window.document && !window.__verseBrainNoAuto) start();
