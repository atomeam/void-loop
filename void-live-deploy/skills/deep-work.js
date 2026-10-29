/**
 * deep-work skill - a focus shield over the stage (asked by the owner, 2026-10-18): "shield everything except the notepad for 25
 * minutes" dims every stage thing but the named kinds to 15% and runs a focus timer in a small bar; "lift the shield", the bar's
 * Lift button or the timer's end brings everything back. Nothing is moved, changed or saved: the dimming is only a style a redraw
 * re-applies, and a reload shows everything. A kind that is not on the stage says so and shields nothing; asks that only look like
 * it ("shield everything except the weekend") name no kind and are not taken.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { kindFor, KNOWN } from './type-filter.js';

export const DIM = 0.15, DEFAULT_MIN = 25, MAX_MIN = 180;
const CLEAN = (t) => String(t || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const SHIELD = /^(?:shield|dim)\s+everything\s+(?:except|but)\s+(?:the\s+|my\s+)?([a-z][a-z ,&-]{1,60}?)(?:\s+for\s+(\d{1,3})\s*(?:minutes?|mins?|m))?$/;
const LIFT = /^(?:(?:lift|drop|end|remove|turn\s+off)\s+(?:the\s+)?shield|shield\s+off)$/;

/** what the ask wants: { op: 'shield', words: [..], minutes } | { op: 'lift' } | null. Every named word must be a kind the stage can hold. Pure. */
export function shieldOf(text) {
  const t = CLEAN(text); let m;
  if (LIFT.test(t)) return { op: 'lift' };
  if (!(m = SHIELD.exec(t))) return null;
  const words = m[1].split(/\s*(?:,|&|\band\b)\s*(?:the\s+|my\s+)?/).map((w) => w.trim()).filter(Boolean);
  if (!words.length || words.length > 5 || !words.every((w) => kindFor(w, KNOWN))) return null;
  const minutes = m[2] ? Math.max(1, Math.min(MAX_MIN, +m[2])) : DEFAULT_MIN;
  return { op: 'shield', words, minutes };
}
/** seconds left until `endAt` (never negative). Pure. */
export const remaining = (endAt, now) => Math.max(0, Math.ceil((endAt - now) / 1000));
/** "24:09" for a number of seconds. Pure. */
export const clock = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
/** the opacity a thing gets: 1 for a kept kind, DIM for the rest. Pure. */
export const opacityFor = (kind, keep) => (keep.has(kind) ? 1 : DIM);

let keep = null, endAt = 0, tick = 0, watcher = null, apiRef = null;
const stageEl = () => document.getElementById('stage');
function apply() {
  const st = stageEl(); if (!st) return;
  const things = apiRef.stage.things();
  for (const el of st.querySelectorAll(':scope > [data-id]')) {
    const th = things[el.dataset.id];
    if (keep) { const o = opacityFor(th && th.kind, keep); el.style.opacity = o === 1 ? '' : String(o); el.style.transition = 'opacity .4s'; if (o === 1) el.removeAttribute('data-shielded'); else el.setAttribute('data-shielded', ''); }
    else if (el.hasAttribute('data-shielded') || el.style.opacity) { el.style.opacity = ''; el.removeAttribute('data-shielded'); }
  }
}
function paintBar() {
  const bar = document.getElementById('deep-work-bar'); if (!bar) return;
  const left = remaining(endAt, Date.now());
  bar.querySelector('[data-left]').textContent = clock(left);
  if (left <= 0) lift(apiRef, 'focus time is up · the shield is lifted');
}
function lift(api, msg) {
  keep = null; endAt = 0; clearInterval(tick); tick = 0;
  if (watcher) { watcher.disconnect(); watcher = null; }
  apiRef = api || apiRef; apply();
  const bar = document.getElementById('deep-work-bar'); if (bar) bar.remove();
  document.documentElement.dataset.deepWork = 'off';
  if (api && msg) api.say(msg);
}
function drawBar(api, esc, names) {
  let bar = document.getElementById('deep-work-bar');
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'deep-work-bar'; bar.setAttribute('role', 'timer'); bar.setAttribute('aria-label', 'Focus shield');
    bar.style.cssText = 'position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:7;display:flex;gap:12px;align-items:center;padding:7px 14px;border-radius:999px;background:rgba(20,18,34,.9);border:1px solid rgba(255,255,255,.2);font:14px system-ui,sans-serif;color:#eee';
    document.body.appendChild(bar);
    bar.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button')) lift(api, 'the shield is lifted'); });
  }
  bar.innerHTML = '<span>Focus · keeping ' + esc(names.join(', ')) + '</span><b data-left style="font-variant-numeric:tabular-nums">' + clock(remaining(endAt, Date.now())) + '</b>'
    + '<button type="button" style="cursor:pointer;border-radius:999px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;padding:3px 12px;font:inherit">Lift</button>'; // void-review: ok: the kind names are escaped, the rest is static
}

function run(text, api) {
  const want = shieldOf(text); if (!want) return 'none';
  const { esc, say } = api; apiRef = api;
  if (want.op === 'lift') { if (!keep) { say('no shield is up'); return 'deep-work'; } lift(api, 'the shield is lifted'); return 'deep-work'; }
  const on = new Set(Object.values(api.stage.things()).map((t) => t.kind));
  const kinds = want.words.map((w) => kindFor(w, [...on, ...KNOWN]));
  const missing = want.words.filter((w, i) => !on.has(kinds[i]));
  if (missing.length) { say('no ' + missing.join(' or ') + ' on the stage, so nothing is shielded'); return 'deep-work'; }
  keep = new Set(kinds); endAt = Date.now() + want.minutes * 60000;
  if (!watcher && stageEl()) { watcher = new MutationObserver(apply); watcher.observe(stageEl(), { childList: true }); } // a redraw keeps the shield
  clearInterval(tick); tick = setInterval(paintBar, 1000);
  apply(); drawBar(api, esc, want.words); document.documentElement.dataset.deepWork = 'on';
  say('shield up for ' + want.minutes + ' minute' + (want.minutes === 1 ? '' : 's') + ' · say "lift the shield" to end it');
  return 'deep-work';
}

export default {
  name: 'deep-work',
  shieldOf,
  examples: ['shield everything except the notepad for 25 minutes', 'lift the shield', 'dim everything except the timer'],
  nearMisses: ['shield everything except the weekend', 'sword and shield', 'lift weights for 25 minutes', 'shield wall tactics'],
  match(lower, text) { return !!shieldOf(text || lower); },
  run,
};
