/**
 * remind skill — "remind me at 5" (plan item 7)
 * Uses the confirm line already in lib/approval-core.js (void_approvals / void_ledger).
 * No phone push, no VAPID key, no new connector. An approved reminder is not run until one exists.
 * "remind me at 5", "remind me at 5 to call home". "remind me to call home at 5" (the task first) is the calendar's:
 * it saves the reminder on this device, which works today (tools/bench.json has asked it of the calendar since 2026-10-02).
 */
export function remindOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const s = t.replace(/^(?:please\s+|(?:can|could|would|will)\s+you\s+(?:please\s+)?)/i, '');
  const m = s.match(/^remind me\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?|noon|midnight)(?:\s+to\s+(.{1,80}))?$/i);
  if (!m) return null;
  const what = String(m[2] || '').trim();
  return { when: clock(m[1]), what };
}
function clock(raw) {
  const s = String(raw || '').toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
  if (s === 'noon') return 'noon';
  if (s === 'midnight') return 'midnight';
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!m) return raw;
  let h = +m[1];
  const mi = m[2] || '';
  let ap = m[3] || '';
  if (!ap && !mi && h >= 1 && h <= 7) ap = 'pm';
  if (h < 1 || h > 12 && !mi) return raw;
  const hour = String(h);
  return hour + (mi ? ':' + mi : '') + (ap || '');
}
export function confirmHold(text) {
  const hit = remindOf(text);
  if (!hit) return null;
  return {
    toolName: 'reminder.ping',
    args: { when: hit.when, what: hit.what || '' },
    line: 'Remind you at ' + hit.when + (hit.what ? ' to ' + hit.what : '') + '?',
  };
}
async function run(text, api) {
  const { showPage, esc } = api;
  const hold = confirmHold(text);
  if (!hold) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Reminder</h2>'; });
  el.innerHTML = '<h2>Reminder</h2><p>' + esc(hold.line) + ' Yes / No</p>'
    + '<p>Held for the confirm line. Phone push is not connected, so nothing is sent.</p>'
    + '<div class="src">Uses the confirm line already on Void. No new connector.</div>';
  return 'remind';
}
export default {
  name: 'remind',
  examples: ['remind me at 5', 'remind me at 5pm', 'remind me at 5 to call home', 'please remind me at noon'],
  nearMisses: ['what is a reminder', 'set a timer for 5 minutes', 'remind me to call mom', 'remind me to call mom at 6pm'],
  remindOf,
  confirmHold,
  match(lower, text) { return !!remindOf(text); },
  run
};
