// Tools pack 2 (owner, 2026-10-18; items 21 to 40, those not already live): the task board, the time questions, busy blocks.
// Pure logic and the stage asks against a fake stage; the browser section "tools pack 2" in test_void.mjs plays them on the page.
// Run: node --test tools/tools-pack-2.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDay, isoWeek, ageOf, daysBetween, clockMinutes, clockText, lengthText, weekdayOf, validIso, addDays, spanMinutes } from '../void-live-deploy/lib/date-words.js';
import { parseTask, addTask, completeTask, moveTask, clearDone, restoreTask, view, counts, isOverdue, dueText, findTask, cleanTask } from '../void-live-deploy/lib/tasks.js';
import { parseMeeting, parseWeek, weekCard, parseSince, daysSince, ageCard, isMeetingCalc } from '../void-live-deploy/lib/time-math.js';
import { parseBlock, parseBlocks, blockIntent, summary, freeGaps, clashes } from '../void-live-deploy/lib/day-blocks.js';
import task, { taskIntent, ask as taskAsk, boardSaved } from '../void-live-deploy/skills/task-board.js';
import tm from '../void-live-deploy/skills/time-math.js';
import bb, { ask as blockAsk } from '../void-live-deploy/skills/busy-blocks.js';

const NOW = new Date(2026, 9, 18); // Sunday 18 October 2026

test('dates: the words people use for a day', () => {
  assert.equal(weekdayOf('2026-10-18'), 0);
  assert.equal(findDay('call mum friday', NOW).iso, '2026-10-23');
  assert.equal(findDay('call mum friday', NOW).rest, 'call mum');
  assert.equal(findDay('sunday', NOW).iso, '2026-10-25', 'a weekday said on that weekday is next week\'s');
  assert.equal(findDay('tomorrow', NOW).iso, '2026-10-19');
  assert.equal(findDay('in 3 days', NOW).iso, '2026-10-21');
  assert.equal(findDay('oct 25', NOW).iso, '2026-10-25');
  assert.equal(findDay('oct 5', NOW).iso, '2027-10-05', 'a due day already gone means next year');
  assert.equal(findDay('oct 5', NOW, 'past').iso, '2026-10-05');
  assert.equal(findDay('3 may 1990', NOW).iso, '1990-05-03');
  assert.equal(findDay('feb 29', NOW).iso, '2028-02-29', 'february 29 waits for a leap year');
  assert.equal(findDay('2026-02-30', NOW), null);
  assert.equal(findDay('nothing here', NOW), null);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(daysBetween('2026-10-18', '2026-12-25'), 68);
  assert.ok(validIso('2024-02-29') && !validIso('2026-02-29'));
});

test('dates: ISO weeks, ages and clock times', () => {
  assert.deepEqual(isoWeek('2026-10-18'), { year: 2026, week: 42 });
  assert.deepEqual(isoWeek('2021-01-03'), { year: 2020, week: 53 });
  assert.deepEqual(isoWeek('2026-12-31'), { year: 2026, week: 53 });
  assert.deepEqual(isoWeek('2024-12-30'), { year: 2025, week: 1 });
  const a = ageOf('1990-05-03', '2026-10-18');
  assert.equal(`${a.years} ${a.months} ${a.days}`, '36 5 15');
  assert.equal(a.nextBirthdayIn, 197);
  assert.equal(ageOf('2000-02-29', '2026-02-28').years, 25);
  assert.equal(ageOf('2000-02-29', '2026-03-01').years, 26);
  assert.equal(ageOf('2026-10-18', '2026-10-18').totalDays, 0);
  assert.equal(ageOf('2030-01-01', '2026-10-18'), null);
  assert.equal(clockMinutes('9:30'), 570);
  assert.equal(clockMinutes('2:15pm'), 855);
  assert.equal(clockMinutes('12am'), 0);
  assert.equal(clockMinutes('1'), 780, 'a bare 1 is the afternoon');
  assert.equal(clockMinutes('25'), null);
  assert.equal(clockText(570), '9:30 am');
  assert.equal(clockText(0), '12:00 am');
  assert.equal(lengthText(105), '1 h 45 min');
  assert.equal(lengthText(120), '2 h');
  assert.equal(lengthText(45), '45 min');
  assert.equal(spanMinutes(1380, 60), 120);
});

test('tasks: the words of a task', () => {
  assert.deepEqual(parseTask('call mum due friday high priority 30 min', NOW), { text: 'call mum', due: '2026-10-23', pri: 'high', est: 30, bucket: 'next' });
  assert.deepEqual(parseTask('pay rent by oct 25 !low 2h', NOW), { text: 'pay rent', due: '2026-10-25', pri: 'low', est: 120, bucket: 'next' });
  assert.deepEqual(parseTask('email bob tomorrow p1 est 15m', NOW), { text: 'email bob', due: '2026-10-19', pri: 'high', est: 15, bucket: 'next' });
  assert.equal(parseTask('waiting for Sam to reply', NOW).bucket, 'waiting');
  assert.equal(parseTask('someday: learn piano', NOW).bucket, 'someday');
  assert.equal(parseTask('call at 3pm', NOW).est, 0, 'a time of day is not an estimate');
  assert.equal(parseTask('buy milk', NOW).due, null);
  assert.equal(parseTask('', NOW).text, '');
});

test('tasks: the stack, the places and the archive', () => {
  const tasks = [];
  const mk = (s, b) => addTask(tasks, parseTask(s, NOW, b));
  mk('late report due 2026-10-15 high priority 60 min');
  mk('call mum today 30 min');
  mk('book flights friday');
  mk('buy milk');
  mk('hear back from Sam', 'waiting');
  mk('learn piano', 'someday');
  assert.equal(addTask(tasks, parseTask('', NOW)), null);
  const today = '2026-10-18';
  assert.deepEqual(view(tasks, 'today', today).map((t) => t.text), ['late report', 'call mum']);
  assert.deepEqual(view(tasks, 'all', today).map((t) => t.text), ['late report', 'call mum', 'book flights', 'buy milk']);
  assert.deepEqual(view(tasks, 'waiting', today).map((t) => t.text), ['hear back from Sam']);
  assert.deepEqual(view(tasks, 'someday', today).map((t) => t.text), ['learn piano']);
  const c = counts(tasks, today);
  assert.equal(c.today, 2); assert.equal(c.overdue, 1); assert.equal(c.todayMinutes, 90); assert.equal(c.done, 0);
  assert.ok(isOverdue(tasks[0], today) && !isOverdue(tasks[1], today));
  assert.equal(dueText('2026-10-15', today), '3 days overdue');
  assert.equal(dueText('2026-10-19', today), 'tomorrow');
  assert.equal(dueText('2026-10-23', today), 'Fri');
  assert.equal(dueText('2026-12-01', today), '12/01');
  // finishing moves to the archive; restoring brings it back
  const done = completeTask(tasks, 'call mum', today);
  assert.equal(done.done, today);
  assert.equal(completeTask(tasks, 'call mum', today), null, 'already done');
  assert.deepEqual(view(tasks, 'done', today).map((t) => t.text), ['call mum']);
  assert.equal(counts(tasks, today).today, 1);
  restoreTask(done);
  assert.equal(counts(tasks, today).done, 0);
  assert.equal(moveTask(tasks, 'buy milk', 'someday', today).bucket, 'someday');
  assert.equal(moveTask(tasks, 'buy milk', 'today', today).due, today);
  completeTask(tasks, 'late', today);
  assert.equal(clearDone(tasks), 1);
  assert.equal(findTask(tasks, 'flights').text, 'book flights');
  assert.equal(cleanTask({ text: '  ', due: 'x' }), null);
  assert.equal(cleanTask({ text: 'x', due: 'junk', pri: 'weird', est: -5, bucket: 'q' }).bucket, 'next');
});

test('task board: the asks it takes and the look-alikes it leaves', () => {
  assert.deepEqual(taskIntent('add task call mum friday high priority'), { act: 'add', body: 'call mum friday high priority', bucket: 'next' });
  assert.equal(taskIntent('task: pay rent').act, 'add');
  assert.equal(taskIntent('new task buy stamps').act, 'add');
  assert.deepEqual(taskIntent('someday: learn piano'), { act: 'add', body: 'learn piano', bucket: 'someday' });
  assert.deepEqual(taskIntent('someday maybe learn piano'), { act: 'add', body: 'learn piano', bucket: 'someday' });
  assert.deepEqual(taskIntent('add learn piano to someday'), { act: 'add', body: 'learn piano', bucket: 'someday' });
  assert.deepEqual(taskIntent('add waiting for Sam to reply'), { act: 'add', body: 'Sam to reply', bucket: 'waiting' });
  assert.deepEqual(taskIntent('waiting for: the invoice'), { act: 'add', body: 'the invoice', bucket: 'waiting' });
  assert.deepEqual(taskIntent('finish task call mum'), { act: 'done', query: 'call mum' });
  assert.deepEqual(taskIntent('mark task call mum as done'), { act: 'done', query: 'call mum' });
  assert.deepEqual(taskIntent('move task call mum to waiting'), { act: 'move', query: 'call mum', to: 'waiting' });
  assert.equal(taskIntent('delete task call mum').act, 'remove');
  assert.equal(taskIntent('clear done tasks').act, 'clear');
  assert.deepEqual(taskIntent('task board'), { act: 'show', tab: null });
  assert.deepEqual(taskIntent("today's tasks"), { act: 'show', tab: 'today' });
  assert.deepEqual(taskIntent('show the someday maybe pile'), { act: 'show', tab: 'someday' });
  assert.deepEqual(taskIntent('show the waiting for list'), { act: 'show', tab: 'waiting' });
  assert.deepEqual(taskIntent('done tasks'), { act: 'show', tab: 'done' });
  assert.equal(taskIntent('waiting for'), null, 'a bare "waiting for" is not an ask until a board exists');
  assert.equal(taskIntent('waiting for', true).act, 'show');
  for (const a of task.nearMisses) assert.equal(taskIntent(a), null, a);
  for (const a of ['add milk to my list', 'mark milk done', 'add task to my list', 'task force', 'someday', 'tasks for a new puppy owner']) assert.equal(taskIntent(a), null, a);
  assert.equal(boardSaved({ getItem: () => JSON.stringify({ a: { kind: 'tasks' } }) }), true);
  assert.equal(boardSaved({ getItem: () => 'not json' }), false);
});

// a fake stage: the same few calls the skills make
function fakeStage() {
  const things = {}; let sel = null, said = '';
  const stage = { clientWidth: 900, clientHeight: 700 };
  return { stage, things: () => things, select: (id) => { sel = id; }, selected: () => sel, save() {}, render() {}, say: (s) => { said = s; }, said: () => said };
}

test('task board: the asks drive the card on the stage', () => {
  const s = fakeStage();
  assert.equal(taskAsk('', 'add task call mum today high priority 30 min', s), 'task-added');
  assert.equal(taskAsk('', 'someday: learn piano', s), 'task-added');
  assert.equal(taskAsk('', 'add waiting for Sam to reply', s), 'task-added');
  const board = Object.values(s.things()).find((t) => t.kind === 'tasks');
  assert.equal(board.tasks.length, 3);
  assert.deepEqual(board.tasks.map((t) => t.bucket), ['next', 'someday', 'waiting']);
  assert.equal(board.tasks[0].pri, 'high'); assert.equal(board.tasks[0].est, 30);
  assert.equal(taskAsk('', 'finish task call mum', s), 'task-done');
  assert.ok(board.tasks[0].done);
  assert.equal(taskAsk('', 'finish task nothing like it', s), 'task-not-found');
  assert.equal(taskAsk('', 'move task learn piano to waiting', s), 'task-moved');
  assert.equal(board.tasks[1].bucket, 'waiting');
  assert.equal(taskAsk('', 'show the done tasks', s), 'tasks');
  assert.equal(board.tab, 'done');
  assert.equal(taskAsk('', 'clear done tasks', s), 'tasks-cleared');
  assert.equal(board.tasks.length, 2);
  assert.equal(Object.values(s.things()).filter((t) => t.kind === 'tasks').length, 1, 'one board only');
});

test('time math: meetings, weeks, the age card, days since', () => {
  assert.deepEqual(parseMeeting('how long is a meeting from 9:30 to 11:15'), { start: 570, end: 675, minutes: 105 });
  assert.equal(parseMeeting('meeting 14:00-15:30').minutes, 90);
  assert.deepEqual(parseMeeting('meeting at 9:30 for 45 minutes'), { start: 570, end: 615, minutes: 45 });
  assert.equal(parseMeeting('meeting from 11pm to 1am').minutes, 120);
  assert.equal(parseMeeting('how long is a flight from 9 to 11'), null);
  assert.ok(isMeetingCalc('meeting length calculator'));
  assert.deepEqual(parseWeek('what week number is it', NOW), { iso: '2026-10-18' });
  assert.deepEqual(parseWeek('week number of oct 25', NOW), { iso: '2026-10-25' });
  assert.deepEqual(parseWeek('which week of the year is 2026-12-31', NOW), { iso: '2026-12-31' });
  assert.equal(parseWeek('what week is it in the show', NOW), null);
  assert.equal(parseWeek('week number of pregnancy', NOW), null);
  const w = weekCard('2026-10-18');
  assert.equal(`${w.week} ${w.monday} ${w.sunday} ${w.dayOfYear} ${w.dayName}`, '42 2026-10-12 2026-10-18 291 Sunday');
  assert.deepEqual(parseSince('days since I quit coffee', NOW), { label: 'quit coffee', start: '2026-10-18', counted: false });
  assert.deepEqual(parseSince('how many days since 2026-01-01', NOW), { label: 'Jan 1, 2026', start: '2026-01-01', counted: true });
  assert.equal(parseSince('days since i quit coffee on oct 1', NOW).start, '2026-10-01');
  assert.equal(parseSince('days since the roman empire fell', NOW), null);
  assert.equal(parseSince('days since dec 25', NOW).start, '2025-12-25');
  assert.equal(daysSince('2026-10-01', '2026-10-18'), 17);
  assert.equal(daysSince('2026-12-01', '2026-10-18'), 0, 'never negative');
  const c = ageCard('1990-05-03', '2026-10-18');
  assert.equal(c.line, '36 years, 5 months, 15 days'); assert.equal(c.nextDay, 'Monday');
  for (const a of tm.examples) assert.ok(tm.match(a.toLowerCase(), a), a);
  for (const a of tm.nearMisses) assert.ok(!tm.match(a.toLowerCase(), a), a);
});

test('busy blocks: parsing, free gaps and clashes', () => {
  assert.deepEqual(parseBlock('standup 9-9:30'), { label: 'standup', start: 540, end: 570 });
  assert.deepEqual(parseBlock('12-1 lunch'), { label: 'lunch', start: 720, end: 780 });
  assert.deepEqual(parseBlock('gym 5-6pm'), { label: 'gym', start: 1020, end: 1080 });
  assert.equal(parseBlock('no times here'), null);
  assert.equal(parseBlocks('busy blocks: standup 9-9:30, lunch 12-1 and review 2:30-4').length, 3);
  assert.deepEqual(blockIntent('clear busy blocks'), { act: 'clear' });
  assert.equal(blockIntent('add busy block 5-6pm gym').act, 'add');
  assert.equal(blockIntent('busy blocks').act, 'show');
  for (const a of bb.nearMisses) assert.equal(blockIntent(a), null, a);
  const blocks = parseBlocks('standup 9-9:30, lunch 12-1, review 2:30-4, sync 3:30-4:30');
  const S = summary(blocks);
  assert.equal(S.busy, 210); assert.equal(S.free, 390); assert.equal(S.clashes, 1);
  assert.deepEqual(freeGaps(blocks).map((g) => [g.start, g.end]), [[480, 540], [570, 720], [780, 870], [990, 1080]]);
  assert.deepEqual(clashes(blocks), [[2, 3]]);
  assert.deepEqual(summary([]).gaps, [{ start: 480, end: 1080 }]);
});

test('busy blocks: the asks drive the card on the stage', () => {
  const s = fakeStage();
  assert.equal(blockAsk('', 'busy blocks: standup 9-9:30, lunch 12-1', s), 'busy-blocks');
  assert.equal(blockAsk('', 'add busy block 5-6pm gym', s), 'busy-blocks');
  const card = Object.values(s.things()).find((t) => t.kind === 'busyblocks');
  assert.equal(card.blocks.length, 3);
  assert.equal(Object.values(s.things()).filter((t) => t.kind === 'busyblocks').length, 1);
  assert.equal(blockAsk('', 'clear busy blocks', s), 'busy-blocks-removed');
  assert.equal(Object.keys(s.things()).length, 0);
  assert.equal(blockAsk('', 'clear busy blocks', s), 'no busy blocks');
});
