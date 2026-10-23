/**
 * showcase skill: "look what I made". Verse puts what it built since you were last here on the right, as a carousel.
 * time, instead of a changelog to read (the owner, 2026-10-11: overnight growth should hit you when you drop in).
 * "show me what you made", "what's new", "what did you make for me", "look what you did": everything the verse built,
 * newest first, with no ceiling (owner, 2026-10-16: "there should not be a limit or stopping point on recent work;
 * it used to stop at five). One at a time, so a thousand is as easy to page through as three; Done dismisses all.
 * visitor also gets one quiet line on their first touch, "I made 1,204 new things while you were away" (when
 * called by the page); a first visit gets nothing, so the empty page stays empty.
 * Each step runs the change's own ask through the stage (stageApi.ask), so the actual card or thing is live:
 * above the ask box says "1 of 3", the change in plain words, and Next -> (takes that step's thing off the tray),
 * Keep (leaves them and runs the next) and Done. The person moves it on: it never advances by itself.
 * Where the ask comes from: the ledger line's `try` (tools/finish.mjs --try), else a few recent ledger entries
 * (old ledger lines are never edited). Never a quoted ask fished out of a line: tried, it ran "call this new tool",
 * saved a routine; a demo must change nothing the person did not ask for, so each ask here is one the author ran.
 * Previewed once (owner, 2026-10-16: "it's only supposed to preview once"): the asks offered are saved in a set the
 * line shows (a2m.void.shown.v1), tapped or not, and never offered again; what is new is what is newer than what
 * remembers when it was (a2m.void.growthSeen.v1), so a newcomer is not told about everything ever built.
 */
import { publicWhat } from './growth-tree.js'; // the site leaves out quotes of the owner's message
import { reactionBar } from '../lib/reaction-bar.js'; // spectator reactions under a step (the clean stage drops them)
import { targetOf } from '../lib/reactions.js';
import { dockPanel } from '../lib/placement.js'; // where the walkthrough panel goes so it never obscures the stage
export const SEEN_KEY = 'a2m.void.growthSeen.v1'; // when this device first visited: nothing older is new
export const SHOWN_KEY = 'a2m.void.shown.v1'; // the asks already previewed here: a thing is previewed once
export const LEDGER_URL = '/void.growth.json';
const SHOWN_KINDS = new Set(['grow', 'build', 'fix']);
// the ask wants the walkthrough (the phrases the catalog already publishes; a near miss like "what's new in the news" keeps its own skill)
const WALK = (t) => String(t || '').trim().toLowerCase().replace(/[\u2019']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const WALK_RE = /^(?:please\s+)?(?:show me what you(?:'ve|'re)? (?:made|built|did)|show me everything you(?:'ve)? (?:made|built)|what did you make for me|what's new(?: pussycat)?|what is new(?: pussycat)?|look what you (?:did|made))$/;
const DISMISS_ON_DONE = false;

export function markRecentDismissed(iso) {
  if (!iso) return;
  try {
    const cur = localStorage.getItem(SEEN_KEY) || '';
    if (iso > cur) localStorage.setItem(SEEN_KEY, iso);
  } catch {}
}

export function getSeenIso() {
  try {
    return localStorage.getItem(SEEN_KEY) || '';
  } catch {
    return '';
  }
}

function getShownSet() {
  try {
    const raw = localStorage.getItem(SHOWN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function recordShown(asks) {
  try {
    const set = getShownSet();
    for (const a of asks) if (a) set.add(a);
    localStorage.setItem(SHOWN_KEY, JSON.stringify([...set]));
  } catch {}
}

export async function fetchLedger(fetcher = fetch) {
  try {
    const res = await fetcher(LEDGER_URL, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function countUnseenRecent(ledger, seenIso) {
  if (!ledger?.length) return 0;
  const shown = getShownSet();
  let n = 0;
  for (const e of ledger) {
    if (!SHOWN_KINDS.has(e?.kind)) continue;
    if (seenIso && e.at && e.at <= seenIso) continue;
    if (e.ask && shown.has(e.ask)) continue;
    n++;
  }
  return n;
}

export function filterRecentWork(ledger, seenIso) {
  if (!ledger?.length) return [];
  const shown = getShownSet();
  const out = [];
  for (const e of ledger) {
    if (!SHOWN_KINDS.has(e?.kind)) continue;
    if (seenIso && e.at && e.at <= seenIso) continue;
    if (e.ask && shown.has(e.ask)) continue;
    out.push(e);
  }
  return out;
}

export function stepFromLedgerEntry(entry) {
  const ask = (entry.ask || '').trim();
  const label = (entry.summary || entry.what || ask || 'Recently built').slice(0, 120);
  return {
    ask,
    label,
    what: publicWhat(entry.what || entry.summary || ask),
    at: entry.at,
  };
}

export function buildRecentTour(ledger, seenIso) {
  const entries = filterRecentWork(ledger, seenIso);
  if (!entries.length) return null;
  const steps = entries.map(stepFromLedgerEntry);
  return {
    id: 'recently-built',
    title: 'Recently built',
    recent: true,
    newestIso: entries[0]?.at || '',
    steps,
  };
}

export function mountShowcase(stageApi, tour, options = {}) {
  const onDone = options.onDone || (() => {});
  if (!tour?.steps?.length) return { unmount() {} };

  recordShown(tour.steps.map(s => s.ask));

  let container = document.getElementById('void-showcase-panel');
  if (!container) {
    container = document.createElement('div');
    container.id = 'void-showcase-panel';
    document.body.appendChild(container);
  }
  dockPanel(container);

  let currentTeardown = null;

  function render() {
    if (currentTeardown) {
      try { currentTeardown(); } catch {}
      currentTeardown = null;
    }

    if (tour.i >= tour.steps.length) {
      end();
      return;
    }

    const step = tour.steps[tour.i];
    const total = tour.steps.length;
    const numStr = `${tour.i + 1} of ${total}`;

    container.innerHTML = `
      <div class="void-showcase-card" style="font-family: system-ui, sans-serif; background: #111; color: #eee; padding: 12px; border-radius: 8px; border: 1px solid #333;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 12px; opacity: 0.7;">${numStr}</span>
          <button class="void-showcase-close" style="background: none; border: none; color: #888; cursor: pointer;">&times;</button>
        </div>
        <div style="margin-bottom: 12px; font-size: 14px; line-height: 1.4;">${step.label || step.what || ''}</div>
        <div class="void-showcase-tray" style="display: flex; gap: 4px; margin-bottom: 12px; overflow-x: auto;">
          ${tour.steps.map((s, idx) => `<button class="void-showcase-pill" data-idx="${idx}" style="padding: 2px 6px; font-size: 10px; border-radius: 4px; border: 1px solid ${idx === tour.i ? '#666' : '#333'}; background: ${idx === tour.i ? '#222' : '#111'}; color: #ccc; cursor: pointer;">${idx + 1}</button>`).join('')}
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button class="void-showcase-next" style="padding: 4px 12px; background: #22c55e; color: #000; border: none; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">Next &rarr;</button>
          <button class="void-showcase-done" style="padding: 4px 12px; background: #333; color: #eee; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">Done</button>
        </div>
        <div class="void-showcase-reactions" style="margin-top: 8px;"></div>
      </div>
    `;

    const closeBtn = container.querySelector('.void-showcase-close');
    const nextBtn = container.querySelector('.void-showcase-next');
    const doneBtn = container.querySelector('.void-showcase-done');
    const pills = container.querySelectorAll('.void-showcase-pill');
    const rxBox = container.querySelector('.void-showcase-reactions');

    closeBtn?.addEventListener('click', end);
    doneBtn?.addEventListener('click', end);

    nextBtn?.addEventListener('click', () => {
      consume();
      render();
    });

    pills.forEach(p => {
      p.addEventListener('click', (e) => {
        const j = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
        jump(j);
        render();
      });
    });

    if (rxBox && step.ask) {
      try {
        const rx = reactionBar(targetOf(step.ask));
        rxBox.appendChild(rx.el);
      } catch {}
    }

    if (step.ask && stageApi?.ask) {
      try {
        currentTeardown = stageApi.ask(step.ask);
      } catch {}
    }
  }

  function consume() {
    if (tour.recent && tour.steps.length) {
      const step = tour.steps[tour.i];
      if (step?.at) markRecentDismissed(step.at);
      tour.steps.splice(tour.i, 1);
      if (tour.i >= tour.steps.length) {
        tour.i = Math.max(0, tour.steps.length - 1);
      }
    } else {
      tour.i++;
    }
  }

  function jump(j) {
    if (tour.recent && tour.steps.length) {
      const target = tour.steps[j];
      tour.steps.splice(tour.i, 1);
      tour.i = Math.max(0, tour.steps.indexOf(target));
    } else {
      tour.i = j;
    }
  }

  function end() {
    if (tour.recent) {
      if (!DISMISS_ON_DONE && tour.steps.length) {
        consume();
      }
      if (DISMISS_ON_DONE || tour.steps.length === 0) {
        if (tour.newestIso) markRecentDismissed(tour.newestIso);
      }
    }
    unmount();
    onDone();
  }

  function handleKey(e) {
    if (e.key === 'Escape') end();
  }

  window.addEventListener('keydown', handleKey);

  function unmount() {
    window.removeEventListener('keydown', handleKey);
    if (currentTeardown) {
      try { currentTeardown(); } catch {}
      currentTeardown = null;
    }
    if (container) {
      container.remove();
    }
  }

  tour.i = 0;
  render();

  return { unmount };
}

// "look what I made": the ledger's recent work, walked on the stage through the carousel (the book's day links use mountShowcase too)
async function run(text, api) {
  const led = await fetchLedger().catch(() => null);
  const all = /everything|all of (it|them)/i.test(String(text || ''));
  const tour = buildRecentTour(led, all ? '' : getSeenIso());
  if (!tour) {
    try { api.showPage((p) => { p.innerHTML = '<h2>Recently built</h2><div class="sub">nothing new since you were last here</div>'; }); } catch (_) {}
    return 'showcase';
  }
  try { mountShowcase(api.stage, tour); } catch (_) {}
  return 'showcase';
}
export default {
  name: 'showcase',
  examples: ['show me what you made', "what's new", "what's new pussycat", 'what did you make for me', 'look what you did', 'show me everything you made'],
  nearMisses: ["what's new in the news", 'show me what you can do', 'what did you make for dinner'],
  match(lower, text) { return WALK_RE.test(WALK(text || lower)); },
  run,
};