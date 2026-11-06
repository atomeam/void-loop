// docs/GAPS.md batch 6 (2026-11-06): a typing speed test, text to speech, and keyboard, mouse, dead pixel and battery checks.
//   node --test tools/gaps-batch6.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import speed, { testOf, typingScore, PASSAGES } from '../void-live-deploy/skills/speed-tests.js';
import device, { deviceAsk, speechOf, keyLabel, KEY_ROWS, mouseButtonName, batteryLine, PIXEL_COLOURS } from '../void-live-deploy/skills/my-device.js';

// a card whose parts run() wires up: querySelector hands out one stub per class
const card = () => {
  const parts = {}, part = (sel) => { const k = sel.replace(/^[.#]/, ''); return (parts[k] = parts[k] || { value: '', innerHTML: '', textContent: '', style: {}, dataset: {}, on: {}, focus() {}, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [], addEventListener(ev, f) { this.on[ev] = f; } }); };
  const el = { innerHTML: '', querySelector: part, querySelectorAll: () => [] };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return { parts, el, api: { showPage: (f) => { f(el); return el; }, esc } };
};

test('typing speed test: the ask opens a passage to type for 30 or 60 seconds; words per minute count correct characters, five to a word', () => {
  for (const [a, s] of [['typing speed test', 60], ['typing test', 60], ['wpm test', 60], ['take a typing test', 60], ['1 minute typing test', 60], ['30 second typing test', 30], ['typing speed test 30 seconds', 30]]) assert.deepEqual(testOf(a), { kind: 'typing', seconds: s }, a);
  for (const a of ['what is a good typing speed', 'average typing speed', 'how to type faster', 'typing', 'typing speed test for kids definition']) assert.equal(testOf(a), null, a);
  assert.deepEqual(typingScore('hello world', 'hello world', 6000), { chars: 11, correct: 11, errors: 0, wpm: 22, accuracy: 100 });
  assert.deepEqual(typingScore('hello world', 'hellp world', 60000), { chars: 11, correct: 10, errors: 1, wpm: 2, accuracy: 91 });
  assert.deepEqual(typingScore('abc', '', 0), { chars: 0, correct: 0, errors: 0, wpm: 0, accuracy: 0 });
  assert.ok(PASSAGES.length >= 3 && PASSAGES.every((p) => p.length > 150 && /^[\x20-\x7e]+$/.test(p)), 'passages a keyboard can type');
  for (const a of speed.examples) assert.ok(speed.match(a, a), a);
  for (const a of speed.nearMisses) assert.ok(!speed.match(a, a), a);
  const realNow = performance.now, realInterval = globalThis.setInterval;
  let t = 1000; performance.now = () => t;
  globalThis.setInterval = () => 1;
  try {
    const c = card();
    assert.equal(speed.run('typing speed test', c.api), 'speed-tests');
    assert.match(c.el.innerHTML, /Typing speed test/);
    assert.ok(c.parts['ty-text'].innerHTML.length > 150, 'the passage is on the card');
    const passage = PASSAGES.find((p) => c.parts['ty-text'].innerHTML.startsWith('<span style="border-bottom:2px solid #9ad">' + p[0] + '</span>' + p.slice(1, 20)));
    assert.ok(passage, 'the first character is marked as the next to type');
    c.parts['ty-in'].value = passage.slice(0, 50); c.parts['ty-in'].on.input();
    t += 30000;
    c.parts['ty-in'].value = passage; c.parts['ty-in'].on.input(); // the whole passage typed ends the test
    assert.match(c.parts['ty-out'].textContent, /^\d+ words per minute · 100% accuracy · 0 wrong of \d+ characters$/, c.parts['ty-out'].textContent);
    assert.equal(c.parts['ty-in'].readOnly, true);
  } finally { performance.now = realNow; globalThis.setInterval = realInterval; }
});

test('text to speech hello world: the words after the ask are read aloud; a code or definition ask is not', () => {
  assert.deepEqual(speechOf('text to speech hello world'), { text: 'hello world' });
  assert.deepEqual(speechOf('tts: good morning'), { text: 'good morning' });
  assert.deepEqual(speechOf('read aloud: the words'), { text: 'the words' });
  assert.deepEqual(speechOf('text to speech'), { text: '' });
  for (const a of ['text to speech api', 'what is text to speech', 'text to speech in python', 'read aloud', 'best text to speech']) assert.equal(speechOf(a), null, a);
  assert.equal(deviceAsk('text to speech hello world'), 'voice');
  const said = [], realSynth = globalThis.speechSynthesis, realU = globalThis.SpeechSynthesisUtterance, realTimeout = globalThis.setTimeout;
  globalThis.speechSynthesis = { getVoices: () => [{ name: 'Test voice', lang: 'en-US', default: true }], cancel() {}, speak: (u) => said.push(u), addEventListener() {} };
  globalThis.SpeechSynthesisUtterance = function (text) { this.text = text; };
  globalThis.setTimeout = (f) => { f(); return 1; };
  try {
    const c = card();
    device.run('text to speech <b>hello</b> world', c.api);
    assert.match(c.el.innerHTML, /Text to speech/);
    assert.ok(c.el.innerHTML.includes('&lt;b>hello&lt;/b> world') && !c.el.innerHTML.includes('<b>hello'), 'the words are escaped');
    assert.match(c.parts['ts-voice'].innerHTML, /Test voice \(en-US\)/);
    c.parts['ts-text'].value = 'hello world';
    c.parts['ts-go'].on.click();
    assert.equal(said.at(-1).text, 'hello world');
    assert.equal(said.at(-1).rate, 1);
  } finally { globalThis.speechSynthesis = realSynth; globalThis.SpeechSynthesisUtterance = realU; globalThis.setTimeout = realTimeout; }
});

test('keyboard tester: a keyboard drawn by key code; each key press lights its key and shows its code', () => {
  for (const a of ['keyboard tester', 'keyboard test', 'test my keyboard', 'key code finder', 'online keyboard tester']) assert.equal(deviceAsk(a), 'keys', a);
  for (const a of ['keyboard shortcuts', 'best keyboard', 'keyboard']) assert.equal(deviceAsk(a), '', a);
  assert.deepEqual(['KeyA', 'Digit7', 'Space', 'ArrowUp', 'Backslash', 'F5'].map(keyLabel), ['A', '7', 'Space', '↑', '\\', 'F5']);
  assert.ok(KEY_ROWS.flat().includes('KeyQ') && KEY_ROWS.flat().length > 70);
  const c = card(), lit = { dataset: { c: 'KeyQ' }, style: {} };
  c.el.querySelectorAll = (s) => (s === '.kt-k' ? [lit] : []);
  device.run('keyboard tester', c.api);
  assert.equal((c.el.innerHTML.match(/class="kt-k"/g) || []).length, KEY_ROWS.flat().length);
  c.parts['kt-pad'].on.keydown({ code: 'KeyQ', key: 'q', location: 0, preventDefault() {} });
  assert.equal(c.parts['kt-out'].textContent, 'key "q" · code KeyQ');
  assert.equal(lit.style.background, '#3d6bd8');
  c.parts['kt-pad'].on.keyup({ code: 'KeyQ', preventDefault() {} });
  assert.equal(lit.style.background, '#1f5a36', 'a key that worked stays marked');
  assert.match(c.parts['kt-n'].textContent, /^1 different keys pressed/);
});

test('mouse tester: each button, the wheel and double clicks counted as they happen', () => {
  for (const a of ['mouse tester', 'mouse test', 'test my mouse', 'scroll wheel test', 'double click test']) assert.equal(deviceAsk(a), 'mouse', a);
  for (const a of ['best gaming mouse', 'mouse click test', 'mouse']) assert.equal(deviceAsk(a), '', a);
  assert.deepEqual([0, 1, 2, 3, 4, 7].map(mouseButtonName), ['Left', 'Middle', 'Right', 'Back', 'Forward', 'Button 7']);
  assert.equal(testOf('mouse click test').kind, 'clicks', 'a mouse click test is the click speed test');
  const c = card(), right = { dataset: { b: '2' }, style: {}, textContent: '' };
  c.el.querySelectorAll = (s) => (s === '.mt-b' ? [right] : []);
  device.run('mouse tester', c.api);
  c.parts['mt-pad'].on.pointerdown({ button: 2, preventDefault() {} });
  assert.equal(right.textContent, 'Right 1');
  assert.equal(c.parts['mt-out'].textContent, 'Right button down');
  c.parts['mt-pad'].on.wheel({ deltaY: -40, preventDefault() {} });
  c.parts['mt-pad'].on.wheel({ deltaY: 40, preventDefault() {} });
  c.parts['mt-pad'].on.wheel({ deltaY: 40, preventDefault() {} });
  assert.equal(c.parts['mt-w'].textContent, 'Wheel up 1 · down 2');
  c.parts['mt-pad'].on.dblclick();
  assert.equal(c.parts['mt-d'].textContent, 'Double clicks 1');
});

test('dead pixel test: full screen colours stepped through with a click, said to be a visual check', () => {
  for (const a of ['dead pixel test', 'stuck pixel checker', 'test my screen for dead pixels', 'monitor colour test']) assert.equal(deviceAsk(a), 'pixels', a);
  for (const a of ['dead pixel', 'what is a dead pixel', 'how to fix a dead pixel']) assert.equal(deviceAsk(a), '', a);
  assert.deepEqual(PIXEL_COLOURS.map(([, n]) => n), ['black', 'white', 'red', 'green', 'blue', 'grey']);
  const realDoc = globalThis.document, added = [];
  const overlay = { style: {}, on: {}, setAttribute() {}, focus() {}, remove() { overlay.gone = true; }, addEventListener(ev, f) { this.on[ev] = f; } };
  globalThis.document = { createElement: () => overlay, body: { appendChild: (o) => added.push(o) }, addEventListener() {}, removeEventListener() {} };
  try {
    const c = card();
    device.run('dead pixel test', c.api);
    assert.match(c.el.innerHTML, /it does not repair one/);
    c.parts['dp-go'].on.click();
    assert.equal(added.length, 1);
    assert.match(overlay.style.cssText, /position:fixed;inset:0.*background:#000000/);
    for (const [hex] of PIXEL_COLOURS.slice(1)) { overlay.on.click(); assert.equal(overlay.style.background, hex); }
    overlay.on.click();
    assert.ok(overlay.gone, 'after the last colour the screen is back');
    assert.equal(c.parts['dp-out'].textContent, 'Done: 6 colours shown.');
  } finally { globalThis.document = realDoc; }
});

test('battery status: the level and charging state where the browser gives them, and says so where it does not', async () => {
  for (const a of ['battery status', 'battery level', "what's my battery percentage", 'is my laptop charging', 'how much battery do i have left']) assert.equal(deviceAsk(a), 'battery', a);
  for (const a of ['battery', 'best phone battery', 'grid battery storage']) assert.equal(deviceAsk(a), '', a);
  assert.equal(batteryLine({ level: 0.85, charging: true, chargingTime: 2400 }), '85% · charging, full in about 40 min');
  assert.equal(batteryLine({ level: 1, charging: true, chargingTime: 0 }), '100% · charging, full');
  assert.equal(batteryLine({ level: 0.42, charging: false, dischargingTime: 9000 }), '42% · on battery, about 2 h 30 min left');
  assert.equal(batteryLine({ level: 0.42, charging: false, dischargingTime: Infinity }), '42% · on battery');
  assert.match(batteryLine(null), /^This browser does not give the battery level to web pages/);
  const realNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const setNav = (v) => Object.defineProperty(globalThis, 'navigator', { value: v, configurable: true, writable: true });
  try {
    setNav({ getBattery: async () => ({ level: 0.5, charging: false, dischargingTime: 3600, addEventListener() {} }) });
    let c = card();
    assert.equal(await device.run('battery status', c.api), 'my-device');
    assert.equal(c.parts['bt-out'].textContent, '50% · on battery, about 1 h left');
    setNav({});
    c = card();
    await device.run('battery status', c.api);
    assert.match(c.parts['bt-out'].textContent, /does not give the battery level/);
  } finally { if (realNav) Object.defineProperty(globalThis, 'navigator', realNav); else delete globalThis.navigator; }
});

test('the device checks are examples of my-device, and its near misses stay out', () => {
  for (const a of device.examples) assert.ok(device.match(a, a), a);
  for (const a of device.nearMisses) assert.ok(!device.match(a, a), a);
});
