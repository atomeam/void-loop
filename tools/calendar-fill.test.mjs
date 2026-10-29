// calendar-fill (skills/calendar-fill.js): on an empty device (localStorage and a few DOM calls stubbed), what a sentence writes into the calendar's
// own store (a2m.void.calendar.v1) and the card that says so: German adds with the day and time read right, "when is", a move to another day and
// another time that keeps the length, a delete that asks first unless it says "event", Confirm and Undo, and the asks it leaves alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map(); globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const node = (tag) => ({ tag, className: '', style: { cssText: '' }, children: [], on: {}, _t: '', get textContent() { return this._t + this.children.map((c) => c.textContent).join(''); }, set textContent(v) { this._t = String(v); this.children = []; },
  append(...cs) { this.children.push(...cs); }, replaceChildren(...cs) { this._t = ''; this.children = cs; }, addEventListener(t, f) { this.on[t] = f; } });
globalThis.document = { createElement: node, createTextNode: (t) => Object.assign(node('#text'), { _t: String(t) }) };
const sk = (await import('../void-live-deploy/skills/calendar-fill.js')).default;

const events = () => JSON.parse(mem.get('a2m.void.calendar.v1') || '{"events":[]}').events;
const all = (n) => [n, ...n.children.flatMap(all)];
let refreshed = 0;
const ask = (text) => { const el = node('div'); const r = sk.run(text, { showPage: () => el, refreshThings: () => refreshed++ }); return { r, el, lines: () => el.children.map((c) => c.textContent), button: (label) => all(el).find((x) => x.tag === 'button' && x.textContent === label), links: all(el).filter((x) => x.href).map((x) => x.href) }; };
const click = (b) => b.on.click({ stopPropagation() {} });
const ymd = (d) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
const day = (s) => new Date(s.slice(0, 10) + 'T12:00');

test('examples taken, near misses refused, on an empty device; matching writes nothing', () => {
  for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), e);
  for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), n);
  assert.ok(sk.match('termin beim arzt am montag um 9 uhr', 'Termin beim Arzt am Montag um 9 Uhr'));
  for (const a of ['when is my yoga', 'move the yoga to Saturday', 'delete the yoga event', 'dinner', 'what time is it']) assert.ok(!sk.match(a.toLowerCase(), a), a); // nothing to find yet
  assert.deepEqual(events(), []); // reading may mark the old agenda as moved, but no event is written
});

test('"Zahnarzt morgen 15 Uhr": tomorrow 15:00 to 16:00, said in words, Undo takes it away', () => {
  const c = ask('Zahnarzt morgen 15 Uhr');
  assert.equal(c.r, 'calendar-fill'); assert.equal(refreshed, 1); // the stage's calendar card is drawn again
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const ev = events(); assert.equal(ev.length, 1); assert.equal(ev[0].title, 'Zahnarzt');
  assert.equal(ev[0].start, ymd(tomorrow) + 'T15:00'); assert.equal(ev[0].end, ymd(tomorrow) + 'T16:00');
  assert.equal(c.lines()[0], 'Zahnarzt'); assert.match(c.lines()[1], /^Put "Zahnarzt" in your calendar for \w+day, .+, 3:00 PM to 4:00 PM \(1 hour\)\.$/);
  assert.deepEqual(c.links, ['/calendar/']);
  click(c.button('Undo')); assert.equal(events().length, 0); assert.equal(c.lines()[0], 'Undone');
  // its first example, "Zahnarzt morgen 15 Uhr in den Kalender", lands at the same time and is titled "Zahnarzt": the "in den Kalender" is where it goes, not its name
  const ex = ask(sk.examples[0]); assert.equal(events()[0].start, ymd(tomorrow) + 'T15:00'); assert.equal(events()[0].title, 'Zahnarzt'); assert.equal(ex.lines()[0], 'Zahnarzt');
  click(ex.button('Undo')); assert.equal(events().length, 0);
});

test('the "to my calendar" / "in den Kalender" tail is never part of the title, in English or German', async () => {
  const L = await import('../void-live-deploy/lib/chat-calendar.js'), now = new Date(2026, 9, 29, 10);
  const title = (t) => L.plan({ events: [] }, L.parseIntent(t), now, 'en').title;
  for (const t of ['Zahnarzt morgen 15 Uhr in den Kalender', 'Zahnarzt morgen 15 Uhr in meinen Kalender', 'Zahnarzt morgen 15 Uhr im Kalender eintragen']) assert.equal(title(t), 'Zahnarzt', t);
  for (const t of ['dentist tomorrow 3pm to my calendar', 'dentist tomorrow 3pm in my calendar', 'dentist tomorrow at 3pm on the calendar']) assert.equal(title(t), 'Dentist', t);
  assert.equal(title('meeting with Sam tomorrow 10am for an hour'), 'Meeting with Sam'); // nothing to strip, nothing stripped
});

test('Yoga on Friday at 18: added, asked when, moved to Saturday, then to 7pm, keeping its hour', () => {
  ask('trage Yoga am Freitag 18 Uhr in den Kalender ein');
  let e = events().find((x) => x.title === 'Yoga'); assert.equal(day(e.start).getDay(), 5); assert.equal(e.start.slice(11), '18:00'); assert.equal(e.end.slice(11), '19:00');
  const fri = e.start.slice(0, 10);
  assert.ok(sk.match('when is my yoga', 'when is my yoga'));
  const w = ask('when is my yoga'); assert.match(w.lines()[1], /^Yoga: Friday, .+, 6:00 PM to 7:00 PM \(1 hour\)\.$/);
  assert.equal(events().length, 1); // a question writes nothing
  const m = ask('move the yoga to Saturday'); assert.match(m.lines()[1], /^Moved "Yoga" from Friday, .+ to Saturday, .+, 6:00 PM to 7:00 PM \(1 hour\)\.$/);
  e = events()[0]; assert.equal(day(e.start).getDay(), 6); assert.equal(e.start.slice(11), '18:00'); assert.equal(e.end.slice(11), '19:00');
  const sat = e.start.slice(0, 10);
  ask('change the yoga to 7pm'); e = events()[0]; assert.equal(e.start, sat + 'T19:00'); assert.equal(e.end, sat + 'T20:00');
  click(m.button('Undo')); assert.equal(events()[0].start, fri + 'T18:00'); // Undo of the move puts the Friday back
});

test('delete: a bare "delete the yoga" asks first, Confirm deletes, Undo restores; "delete the yoga event" deletes at once', () => {
  const before = events()[0];
  const c = ask('delete the yoga'); assert.equal(c.lines()[0], 'Write this?'); assert.match(c.lines()[1], /^Delete "Yoga" \(.+\)\?$/);
  assert.equal(events().length, 1); // nothing written unseen
  click(c.button('Confirm')); assert.equal(events().length, 0); assert.match(c.lines()[1], /^Deleted "Yoga"/);
  click(c.button('Undo')); assert.deepEqual(events(), [before]);
  const d = ask('delete the yoga event'); assert.equal(d.lines()[0], 'Yoga'); assert.equal(events().length, 0);
  const cancel = ask('trage Yoga am Freitag 18 Uhr in den Kalender ein') && ask('delete the yoga'); click(cancel.button('Cancel'));
  assert.deepEqual(cancel.lines(), ['Cancelled', 'Nothing was written.']); assert.equal(events().length, 1);
});
