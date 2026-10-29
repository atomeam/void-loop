// remind (skills/remind.js): what a "remind me at" ask reads as (the clock: a bare 1 to 7 is pm, noon, minutes, a.m./p.m.), the confirm-line hold it
// makes (reminder.ping), the card run() draws, and the task-first asks it leaves to the calendar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import remind, { remindOf, confirmHold } from '../void-live-deploy/skills/remind.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

test('examples taken, near misses refused, and a few more asks', () => {
  for (const e of remind.examples) assert.ok(remind.match(e.toLowerCase(), e), e);
  for (const n of remind.nearMisses) assert.ok(!remind.match(n.toLowerCase(), n), n);
  for (const a of ['could you please remind me at 6:30 to stretch', 'Remind me at midnight.', 'can you remind me at 9am']) assert.ok(remind.match(a.toLowerCase(), a), a);
  for (const a of ['remind me in 5 minutes', 'remind me at the station', 'remind me tomorrow at 5', 'reminders at 5']) assert.ok(!remind.match(a.toLowerCase(), a), a);
});

test('the clock: bare 1 to 7 is afternoon, the rest stays as said', () => {
  assert.deepEqual(remindOf('remind me at 5'), { when: '5pm', what: '' });
  assert.deepEqual(remindOf('remind me at 5 to call home'), { when: '5pm', what: 'call home' });
  assert.equal(remindOf('remind me at 7').when, '7pm'); assert.equal(remindOf('remind me at 1').when, '1pm');
  assert.equal(remindOf('remind me at 8').when, '8'); assert.equal(remindOf('remind me at 11').when, '11');
  assert.equal(remindOf('remind me at 5am').when, '5am'); assert.deepEqual(remindOf('remind me at 5 p.m. to call home'), { when: '5pm', what: 'call home' }); assert.equal(remindOf('remind me at 5 pm').when, '5pm');
  // "p.m." / "a.m." at the very end of the ask, its closing dot trimmed with the sentence's
  assert.deepEqual(remindOf('remind me at 5 p.m.'), { when: '5pm', what: '' }); assert.equal(remindOf('remind me at 7 a.m.').when, '7am'); assert.equal(remindOf('Remind me at 10:30 p.m.').when, '10:30pm');
  assert.deepEqual(remindOf('remind me at 5 p.m. to call home.'), { when: '5pm', what: 'call home' });
  assert.equal(remindOf('remind me at 6:30').when, '6:30'); assert.equal(remindOf('remind me at 13:00').when, '13:00');
  assert.equal(remindOf('remind me at 15').when, '15'); assert.equal(remindOf('please remind me at noon').when, 'noon');
  assert.equal(remindOf('remind me to call mom at 6pm'), null);
});

test('the hold: reminder.ping with when and what, and the line to confirm', () => {
  assert.deepEqual(confirmHold('remind me at 5 to call home'), { toolName: 'reminder.ping', args: { when: '5pm', what: 'call home' }, line: 'Remind you at 5pm to call home?' });
  assert.deepEqual(confirmHold('remind me at noon'), { toolName: 'reminder.ping', args: { when: 'noon', what: '' }, line: 'Remind you at noon?' });
  assert.equal(confirmHold('set a timer for 5 minutes'), null);
  assert.equal(remind.confirmHold, confirmHold); assert.equal(remind.remindOf, remindOf);
});

test('run: the card asks Yes / No and says nothing is sent', async () => {
  let el = null; const api = { esc, showPage: (fn) => { el = { innerHTML: '' }; fn(el); return el; } };
  assert.equal(await remind.run('remind me at 5 to <b>call</b> home', api), 'remind');
  assert.ok(el.innerHTML.includes('<p>Remind you at 5pm to &lt;b&gt;call&lt;/b&gt; home? Yes / No</p>'), el.innerHTML);
  assert.ok(el.innerHTML.includes('Phone push is not connected, so nothing is sent.'), el.innerHTML);
  el = null; assert.equal(await remind.run('remind me to call mom', api), 'none'); assert.equal(el, null);
});
