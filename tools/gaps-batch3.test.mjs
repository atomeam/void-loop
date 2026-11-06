// docs/GAPS.md batch 3 (2026-11-06): an alarm is its own card that says the time it rings at.
//   node --test tools/gaps-batch3.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import timer, { ask, alarmMs, alarmClock, alarmLine } from '../void-live-deploy/skills/timer.js';

// a stage with nothing on it: the parts of stageApi that ask() uses
const stage = () => {
  const things = {}, said = []; let sel = null;
  return { said, things, api: { stage: { clientWidth: 800, clientHeight: 600 }, things: () => things, select: (id) => { sel = id; }, selected: () => sel, save() {}, render() {}, say: (s) => said.push(s) } };
};

test('alarm at 7am: the clock time it rings at, read as the visitor reads a clock', () => {
  const now = new Date(2026, 10, 6, 6, 0, 0);
  assert.equal(alarmClock(alarmMs('alarm at 7am', now), now), '7:00 AM');
  assert.equal(alarmClock(alarmMs('set an alarm for 6:30 pm', now), now), '6:30 PM');
  assert.equal(alarmClock(alarmMs('wake me up at 12am', now), now), '12:00 AM');
  assert.equal(alarmLine({ alarmFor: '7:00 AM', running: true }), 'Alarm for 7:00 AM · rings in this page while it is open');
  assert.equal(alarmLine({ alarmFor: '7:00 AM', running: false, remaining: 5000 }), 'Alarm for 7:00 AM · paused');
  assert.equal(alarmLine({ running: true }), '');
});

test('alarm at 7am: a running alarm card of its own, and the page says when it rings', () => {
  for (const a of ['alarm at 7am', 'set an alarm for 7am', 'wake me up at 7am']) {
    const s = stage();
    assert.equal(ask(a, a, s.api), 'alarm-set', a);
    const [t] = Object.values(s.things);
    assert.ok(t.running && t.alarmFor && /^\d{1,2}:\d\d (AM|PM)$/.test(t.alarmFor), a + ': ' + JSON.stringify(t));
    assert.ok(t.duration > 0 && t.duration <= 24 * 3600000, a);
    assert.match(s.said[0], /^Alarm set for \d{1,2}:\d\d (AM|PM)\. It rings in this page while the page stays open\.$/);
  }
  assert.ok(!timer.match('alarm at 7am'), 'the page asks the timer at its own place, after the skills');
});

test('an alarm never takes over a timer that is already on the stage, and a timer set on an alarm is a timer again', () => {
  const s = stage();
  ask('set a timer for 5 minutes', 'set a timer for 5 minutes', s.api);
  ask('alarm at 7am', 'alarm at 7am', s.api);
  const ts = Object.values(s.things);
  assert.equal(ts.length, 2);
  assert.equal(ts[0].duration, 300000, 'the 5 minute timer is as it was');
  assert.ok(!ts[0].alarmFor && ts[1].alarmFor);
  ask('2 minutes', '2 minutes', s.api); // the alarm is the picked one
  assert.ok(!ts[1].alarmFor && !ts[1].label && ts[1].duration === 120000);
});

import { toolAsk } from '../void-live-deploy/skills/open-tool.js';
test('word counter for essay: what the tool is for does not change the tool', () => {
  for (const a of ['word counter for essay', 'word counter for my essay', 'character counter for twitter']) {
    const r = toolAsk(a);
    assert.ok(r && /word-count/.test(JSON.stringify(r)), a + ': ' + JSON.stringify(r));
  }
  assert.equal(toolAsk('for essay'), null);
});

import { upsideDown, smallCaps, circled, strike, zalgo, runTextTool } from '../void-live-deploy/lib/text-tools.js';
import { textToolByName } from '../void-live-deploy/skills/text-tools.js';
test('fancy text: upside down, small caps, bubble, strikethrough and zalgo, each a Unicode mapping', () => {
  assert.equal(upsideDown('Hello, world!'), "¡plɹoʍ 'ollǝH");
  assert.equal(upsideDown(upsideDown('pod')), 'pod');
  assert.equal(smallCaps('hello box'), 'ʜᴇʟʟᴏ ʙᴏx');
  assert.equal(circled('Hi 2026'), 'Ⓗⓘ ②⓪②⑥');
  assert.equal(strike('no way'), 'n̶o̶ w̶a̶y̶');
  const z = zalgo('hi', 'heavy', () => 0.99);
  assert.equal(z.replace(/[̀-ͯ]/g, ''), 'hi');
  assert.ok(z.length >= 2 + 2 * 24, 'heavy puts 12 marks a side on each letter at most');
  assert.equal(zalgo('a b', 'light', () => 0).replace(/[̀-ͯ]/g, ''), 'a b');
  assert.equal(runTextTool('strikethrough text: hi').text, 'h̶i̶');
  assert.equal(runTextTool('strikethrough: hi').text, '~~hi~~', 'Markdown strikethrough stays as it was');
  for (const [a, id] of [['upside down text', 'upside-down'], ['small caps text', 'small-caps'], ['bubble text', 'bubble'], ['strikethrough text', 'strike'], ['zalgo text', 'zalgo']]) assert.equal(textToolByName(a)?.id, id, a);
  for (const a of ['upside down', 'upside down cake recipe', 'what is zalgo text', 'bubble']) assert.equal(textToolByName(a), null, a);
});

import groups, { groupsOf, namesOf, teams, santa } from '../void-live-deploy/skills/groups.js';
test('random teams and secret santa: the ask names the names; teams are even, and nobody draws themselves', () => {
  assert.deepEqual(groupsOf('random team generator'), { kind: 'teams', count: 2, names: [] });
  assert.deepEqual(groupsOf('split Alice, Bob, Carol and Dave into 2 teams'), { kind: 'teams', count: 2, names: ['Alice', 'Bob', 'Carol', 'Dave'] });
  assert.deepEqual(groupsOf('make 3 groups from: a, b, c, d, e, f').count, 3);
  assert.deepEqual(groupsOf('secret santa draw'), { kind: 'santa', names: [] });
  assert.deepEqual(groupsOf('secret santa: ann, ben, cal').names, ['ann', 'ben', 'cal']);
  for (const a of groups.nearMisses) assert.equal(groupsOf(a), null, a);
  assert.deepEqual(namesOf('ann\nben\n\nann\n- cal'), ['ann', 'ben', 'cal']);
  let seed = 7; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const names = 'a b c d e f g h i j k'.split(' ');
  for (let i = 0; i < 200; i++) {
    const ts = teams(names, 3, rng), sizes = ts.map((t) => t.length);
    assert.equal(ts.flat().sort().join(), names.join());
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, JSON.stringify(sizes));
  }
  const seen = {};
  for (let i = 0; i < 4000; i++) {
    const p = santa(['a', 'b', 'c', 'd'], rng);
    assert.ok(p.every(([g, r]) => g !== r));
    assert.equal(new Set(p.map(([, r]) => r)).size, 4, 'each name is drawn once');
    const k = p.map(([, r]) => r).join(''); seen[k] = (seen[k] || 0) + 1;
  }
  // 4 names have 9 draws where nobody gets themselves; each should come up about 4000 / 9 = 444 times
  assert.equal(Object.keys(seen).length, 9);
  assert.ok(Object.values(seen).every((n) => n > 350 && n < 540), JSON.stringify(seen));
  assert.equal(santa(['solo']), null);
});

test('the teams card deals the names it was given; the santa card hides each pairing until it is pressed', () => {
  const card = (text) => {
    const parts = {}, part = (sel) => { const k = sel.replace(/^[.#]/, ''); return (parts[k] = parts[k] || { value: '', innerHTML: '', textContent: '', style: {}, dataset: {}, on: {}, focus() {}, querySelector: () => null, querySelectorAll: () => [], addEventListener(ev, f) { this.on[ev] = f; } }); };
    const el = { innerHTML: '', querySelector: part };
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const said = groups.run(text, { showPage: (f) => { f(el); return el; }, esc });
    const box = /<textarea class="gr-names"[^>]*>([^<]*)<\/textarea>/.exec(el.innerHTML);
    parts['gr-names'].value = box ? box[1].replace(/&lt;/g, '<').replace(/&amp;/g, '&') : ''; // what the browser hands back as the box's value
    if (parts['gr-count']) parts['gr-count'].value = (/class="gr-count"[^>]*value="(\d+)"/.exec(el.innerHTML) || [])[1] || '';
    parts['gr-go'].on.click();
    return { said, h: el.innerHTML, out: parts['gr-out'].innerHTML, say: parts['gr-say'].textContent };
  };
  const t = card('split ann, ben, <cal>, dee into 2 teams');
  assert.equal(t.said, 'groups');
  assert.match(t.say, /^4 names in 2 teams\.$/);
  assert.equal((t.out.match(/Team \d/g) || []).length, 2);
  assert.ok(t.out.includes('&lt;cal>') && !t.out.includes('<cal>'), 'names are escaped');
  const s = card('secret santa: ann, ben, cal');
  assert.match(s.say, /^3 names drawn\./);
  assert.equal((s.out.match(/gives to <button/g) || []).length, 3, 'no receiver is on the page until its button is pressed');
  assert.ok(!/gives to <strong>/.test(s.out));
});

import { readFileSync } from 'node:fs';
test('remove duplicate lines: a text tool named alone is not a batch removal of the stage\'s drawn lines', () => {
  const src = readFileSync(new URL('../void.html', import.meta.url), 'utf8').match(/\n    function isBatchRemoveAsk\(lower\) \{[\s\S]*?\n    \}\n/);
  assert.ok(src, 'isBatchRemoveAsk is in void.html');
  const isBatchRemoveAsk = new Function('return ' + src[0].trim())();
  for (const a of ['remove duplicate lines', 'remove blank lines', 'remove empty lines', 'remove repeated lines', 'remove blank lines: a ⏎ ⏎ b']) assert.equal(isBatchRemoveAsk(a), false, a);
  for (const a of ['remove all the notes', 'clear the timers', 'remove the lines', 'delete all lines', 'remove every circle']) assert.equal(isBatchRemoveAsk(a), true, a);
});
