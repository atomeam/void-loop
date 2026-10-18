/**
 * keep-going — the bridge from an approval card to a task that keeps running after the person has left (asked by Verse:
 * "Define the technical bridge between an 'approval card' and a task that keeps running after a user leaves", "a mechanism where an
 * 'approval card' can trigger a task that persists after the user session ends", and "Connect frontier #4 to the 'automations' and
 * 'actions' skills to allow for state changes without direct user input").
 *
 * The mechanism: the ask "keep <automation> running every 2 hours" stops on the confirm line (tool 'automation.keep', gated).
 * Only the owner's yes runs the executor below, once, inside its execution record (lib/actions.js). The executor does not run
 * anything itself: it changes the rule's STATE in D1 (switched on, on the clock). From then on the clock (POST /api/automations/tick,
 * every 15 minutes) runs the rule with no browser open; each step it takes is its own record in the owner's actions card
 * (automation.<step>), a failure opens the status card, and "stop keeping <automation>" (the same yes) switches it off again.
 * The rule's own fence still applies (lib/automations.js: repos, branches, public https only, a run cap): the yes widens nothing.
 * The pure half (the ask, the schedule) has no D1; the executor takes the automations store as an argument.
 */
import { EVERY_MIN, EVERY_MAX } from './automations.js';

const UNIT = { minute: 1, minutes: 1, min: 1, mins: 1, hour: 60, hours: 60, hr: 60, hrs: 60, day: 1440, days: 1440 };
const ID = '([a-z0-9][a-z0-9-]{1,38}[a-z0-9])';
const KEEP = new RegExp('^keep\\s+(?:my\\s+|the\\s+)?(?:automation\\s+|rule\\s+)?' + ID + '(?:\\s+automation|\\s+rule)?\\s+(?:running|going|on)(?:\\s+(?:every|each)\\s+(\\d+|other|an?)?\\s*(minutes?|mins?|hours?|hrs?|days?))?$', 'i');
const STOP = new RegExp('^(?:stop\\s+keeping|stop\\s+running|switch\\s+off|turn\\s+off)\\s+(?:my\\s+|the\\s+)?(?:automation\\s+|rule\\s+)?' + ID + '$', 'i');

/** Minutes between runs from "every 2 hours" parts; clamped to what the clock allows. Pure. */
export function everyOf(n, unit) {
  const u = UNIT[String(unit || 'hours').toLowerCase()] || 60, k = /^\d+$/.test(String(n || '')) ? Number(n) : 1;
  return Math.max(EVERY_MIN, Math.min(EVERY_MAX, k * u));
}

/** The ask as { toolName, args } for the confirm line, or null. "keep morning-digest running every 2 hours" / "stop keeping morning-digest". Pure. */
export function keepAsk(text) {
  const t = String(text || '').trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
  let m = KEEP.exec(t);
  if (m) return { toolName: 'automation.keep', args: { id: m[1].toLowerCase(), every: everyOf(m[2], m[3]), on: true } };
  m = STOP.exec(t);
  if (m) return { toolName: 'automation.keep', args: { id: m[1].toLowerCase(), every: 0, on: false } };
  return null;
}

export function keepLine(a) {
  const x = a || {};
  if (!x.on) return `Stop keeping “${x.id}” running?`;
  const e = x.every % 1440 === 0 ? (x.every / 1440 === 1 ? 'day' : x.every / 1440 + ' days') : x.every % 60 === 0 ? (x.every === 60 ? 'hour' : x.every / 60 + ' hours') : x.every + ' minutes';
  return `Keep “${x.id}” running by itself every ${e}, even when you are not here?`;
}

/**
 * The executor, after the yes. store: { get(env, id, scope), save(env, rule, opts), setEnabled(env, id, on, scope) } (lib/automations-run.js).
 * Owner's own rules only (scope ''). Returns the sentence that goes in the execution record; a rule that does not exist throws (record: failed).
 */
export async function keepGoing(args, env, store) {
  const a = args || {}, id = String(a.id || '');
  const found = await store.get(env, id, '');
  if (!found) throw new Error('no automation called ' + id + ' (say "my automations" to see them)');
  if (!a.on) { await store.setEnabled(env, id, false, ''); return id + ' is switched off; it runs again only when you start it'; }
  const every = Number(a.every);
  if (!Number.isInteger(every) || every < EVERY_MIN || every > EVERY_MAX) throw new Error('every is whole minutes from ' + EVERY_MIN + ' to ' + EVERY_MAX);
  const r = found.rule;
  if (r.when && r.when.on === 'webhook') throw new Error(id + ' answers a webhook; changing it to a schedule would cut its link, so it stays as it is');
  const next = { ...r, enabled: true, when: { on: 'schedule', every } }; // match, if any, is dropped: a schedule's event is the tick
  const out = await store.save(env, next, { scope: '' });
  if (!out.ok) throw new Error('the rule would not save: ' + (out.errors || []).join('; ').slice(0, 200));
  return id + ' now runs by itself every ' + every + ' minutes (the clock ticks every ' + EVERY_MIN + '); its steps show in your actions card';
}
