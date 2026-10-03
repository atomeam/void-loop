// Calendar skill parser. Run: node tools/test_calendar.mjs
// No browser. Confirms local match, gated asks stay off the skill, and Wikipedia is never the path.
import { parseCalendar } from '../void-live-deploy/skills/calendar.js';
import { confirmHold } from '../void-live-deploy/skills/remind.js';
import { parseGatedAsk, confirmLine, GATED } from '../void-live-deploy/lib/approval-core.js';
import { executors } from '../void-live-deploy/functions/api/approval.js';

const results = [];
const check = (name, ok, got) => { results.push({ name, ok: !!ok, got }); };

const show = ['my calendar', 'my calender', 'agenda', "what's next", 'whats next', 'upcoming'];
for (const a of show) {
  const q = parseCalendar(a);
  check('show: ' + a, q && q.kind === 'show', JSON.stringify(q));
}

const hide = ['remove my calendar', 'close the calendar', 'dismiss agenda'];
for (const a of hide) {
  const q = parseCalendar(a);
  check('hide: ' + a, q && q.kind === 'hide', JSON.stringify(q));
}

const add = parseCalendar('call Sam next Tuesday at 4');
check('add: call Sam next Tuesday at 4', add && add.kind === 'add' && /sam/i.test(add.title) && add.at instanceof Date, JSON.stringify(add && { title: add.title, at: add.at }));

const oct = parseCalendar('dentist October 12 at 3pm');
check('add: dentist October 12 at 3pm', oct && oct.kind === 'add' && /dentist/i.test(oct.title) && oct.at.getHours() === 15, JSON.stringify(oct && { title: oct.title, hours: oct.at && oct.at.getHours() }));

const own = parseCalendar('add dentist to my calendar Oct 12 at 3pm');
check('own calendar: add X to my calendar <when> is a local add', own && own.kind === 'add' && /dentist/i.test(own.title) && own.at.getHours() === 15 && own.at.getMonth() === 9, JSON.stringify(own && { title: own.title, at: own.at }));
const own2 = parseCalendar('put lunch with Ana on my calendar tomorrow at noon');
check('own calendar: put X on my calendar tomorrow at noon', own2 && own2.kind === 'add' && /lunch with ana/i.test(own2.title), JSON.stringify(own2));
const noWhen = parseCalendar('add this to my calendar');
check('own calendar without a when asks when (no confirm line, no Wikipedia)', noWhen && noWhen.kind === 'when', JSON.stringify(noWhen));
const gated = ['schedule a meeting with Sam', 'book a call with Sam'];
for (const a of gated) {
  check('gated stays off the skill: ' + a, parseCalendar(a) === null, JSON.stringify(parseCalendar(a)));
}

const near = ['make a 5 minute timer', 'what is a calendar', 'time in Tokyo', 'map of Paris'];
for (const a of near) {
  check('near-miss stays off the skill: ' + a, parseCalendar(a) === null, JSON.stringify(parseCalendar(a)));
}

const hold = confirmHold('remind me at 5');
const gatedRemind = parseGatedAsk('remind me at 5');
check('remind me at 5 stays behind the confirm line and does not push',
  hold && hold.toolName === 'reminder.ping' && hold.line === 'Remind you at 5pm?'
    && gatedRemind && gatedRemind.toolName === 'reminder.ping' && confirmLine(gatedRemind.toolName, gatedRemind.args) === 'Remind you at 5pm?'
    && GATED['reminder.ping'].service === 'reminders' && !executors['reminder.ping']
    && parseCalendar('remind me at 5') === null,
  JSON.stringify({ hold, gatedRemind }));

const bad = results.filter((r) => !r.ok);
for (const r of results) console.log((r.ok ? 'pass ' : 'FAIL ') + r.name + (r.ok ? '' : '  -> ' + (r.got || '')));
console.log(`${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
