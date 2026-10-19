import test from 'node:test';
import assert from 'node:assert/strict';
import { run, parse, timeWords, complete, step, modelLines, loopOf, skillsOf, findSkill, COMMANDS, MODEL_MARK } from '../void-live-deploy/lib/terminal.js';
import { terminalAsk, suite } from '../void-live-deploy/skills/terminal.js';

const guide = { pages: [
  { kind: 'skill', name: 'timer', title: 'Timer', line: 'a countdown on the stage', examples: ['set a timer for 5 minutes', 'timer'], tier: 'proven', why: 'a self-test, 6 real asks' },
  { kind: 'skill', name: 'notepad', title: 'Notepad', line: 'a pad to write in', examples: ['open a notepad'], tier: 'tested', why: '' },
  { kind: 'chapter', name: 'make', title: 'Make' },
] };
const texts = (r) => r.lines.map((l) => l.t).join('\n');

test('a typed line splits into a command word and the rest', () => {
  assert.deepEqual(parse('  Ask   what is a tree '), { cmd: 'ask', rest: 'what is a tree', args: ['what', 'is', 'a', 'tree'] });
  assert.deepEqual(parse(''), { cmd: '', rest: '', args: [] });
  assert.equal(run('').lines.length, 0);
});

test('the command list is closed: an unknown word prints an error, suggests names, and sends nothing anywhere', () => {
  for (const bad of ['rm -rf /', 'curl http://x.test', 'sudo ask hi', 'eval 1+1', 'ask']) {
    const r = run(bad);
    assert.equal(r.route, null, bad); assert.equal(r.model, null, bad);
    assert.ok(r.lines.some((l) => l.k === 'err'), bad);
  }
  assert.match(texts(run('skils')), /did you mean: skills/);
  assert.match(texts(run('help nonsense')), /unknown command/);
});

test('help lists every command, and help <command> says what one does', () => {
  const all = texts(run('help'));
  for (const c of COMMANDS) assert.ok(all.includes(c.name), c.name);
  assert.match(texts(run('help timer')), /usage: timer|timer <time>/);
});

test('ask routes through the skills, and only ask --model reaches the model', () => {
  const r = run('ask what is the weather in sofia');
  assert.deepEqual(r.route, { ask: 'what is the weather in sofia' }); assert.equal(r.model, null);
  const m = run('ask --model draft a haiku about rain');
  assert.deepEqual(m.model, { ask: 'draft a haiku about rain' }); assert.equal(m.route, null);
  assert.match(texts(m), /\[model\]/);
  assert.ok(run('ask --model').lines[0].k === 'err' && !run('ask --model').model);
  for (const c of COMMANDS.filter((x) => x.name !== 'ask')) assert.equal(run(c.name + ' hi', { guide }).model, null, c.name + ' never reaches the model');
});

test('every line a model drafts is marked, so it is never mistaken for a rule', () => {
  const ls = modelLines('first line\n\nsecond line');
  assert.equal(ls.length, 2); for (const l of ls) { assert.ok(l.t.startsWith(MODEL_MARK)); assert.equal(l.k, 'model'); }
  assert.equal(modelLines('')[0].t, MODEL_MARK + '(no answer)');
  assert.equal(modelLines(null)[0].k, 'model');
});

test('status, note and timer hand the page an ask for its own skills', () => {
  assert.equal(run('status').route.ask, 'verse status');
  assert.equal(run('note buy bread').route.ask, 'note: buy bread');
  assert.equal(run('timer 5m').route.ask, 'set a timer for 5 minutes');
  assert.equal(run('timer 1h').route.ask, 'set a timer for 1 hour');
  assert.equal(run('timer 90s').route.ask, 'set a timer for 90 seconds');
  assert.equal(run('timer 5 minutes').route.ask, 'set a timer for 5 minutes');
  for (const bad of ['timer', 'timer soon', 'timer 0m', 'timer -5m', 'timer 5y']) assert.equal(run(bad).route, null, bad);
  assert.equal(run('note').route, null);
  assert.equal(timeWords('1 minute'), '1 minute');
});

test('skills, skill and examples read the skills list', () => {
  assert.deepEqual(skillsOf(guide).map((s) => s.name), ['timer', 'notepad']);
  assert.match(texts(run('skills', { guide })), /2 skills/);
  assert.match(texts(run('skills pad', { guide })), /notepad/);
  assert.doesNotMatch(texts(run('skills pad', { guide })), /timer/);
  assert.match(texts(run('skills zzz', { guide })), /no skill matches/);
  const s = texts(run('skill timer', { guide }));
  assert.match(s, /Timer \(timer\)/); assert.match(s, /checked: proven/); assert.match(s, /try: "set a timer for 5 minutes"/);
  assert.equal(findSkill(skillsOf(guide), 'time').name, 'timer');
  assert.equal(findSkill(skillsOf(guide), 'zz'), null);
  assert.match(texts(run('examples notepad', { guide })), /open a notepad/);
  assert.match(texts(run('skill timr', { guide })), /did you mean: timer/);
  assert.match(texts(run('skills')), /has not loaded/);
});

test('families, growth, incidents and asks read their files, newest first, and say so when a file has not loaded', () => {
  const families = { families: [{ id: 'make', name: 'Making things', count: { proven: 11, tested: 12, checked: 10, experiment: 2 }, skills: [{}, {}, {}] }] };
  assert.match(texts(run('families', { families })), /Making things\s+3 skills · proven 11 · tested 12 · checked 10 · experiment 2/);
  const growth = [{ at: '2026-10-17T10:00:00Z', what: 'older' }, { at: '2026-10-19T02:09:06Z', what: 'newest line' }];
  assert.match(texts(run('growth', { growth })).split('\n')[0], /2026-10-19 02:09 {2}newest line/);
  assert.equal(run('growth 1', { growth }).lines.length, 1);
  assert.equal(run('growth 9999', { growth }).lines.length, 2);
  const incidents = { incidents: [{ at: '2026-10-18T08:00:00Z', sha: 'aaaaaaaa1111', checks: ['one'] }, { at: '2026-10-19T08:00:00Z', sha: 'bbbbbbbb2222', checks: ['two', 'three'] }] };
  assert.match(texts(run('incidents', { incidents })).split('\n')[0], /bbbbbbbb {2}two · three/);
  const loop = loopOf(JSON.stringify([{ ask: 'old', note: 'skill:a' }, { ask: 'new', note: 'skill:b' }, { nope: 1 }]));
  assert.match(texts(run('asks', { loop })).split('\n')[0], /new {3}← skill:b/);
  assert.deepEqual(loopOf('not json'), []);
  for (const c of ['families', 'growth']) assert.match(texts(run(c)), /has not loaded/);
});

test('history, clear, tab-complete and the arrow keys', () => {
  assert.match(texts(run('history', { history: ['help', 'skills'] })), /1 {2}help[\s\S]*2 {2}skills/);
  assert.equal(run('clear').clear, true);
  assert.deepEqual(complete('sk'), ['skills', 'skill']);
  assert.deepEqual(complete('ti'), ['timer']);
  assert.ok(complete('').length === COMMANDS.length);
  assert.ok(complete('skils').includes('skills'));
  const h = ['a', 'b', 'c'];
  assert.deepEqual(step(h, 3, -1), { index: 2, text: 'c' });
  assert.deepEqual(step(h, 0, -1), { index: 0, text: 'a' });
  assert.deepEqual(step(h, 2, 1), { index: 3, text: '' });
  assert.deepEqual(step([], 0, -1), { index: 0, text: '' });
});

test('the ask that opens the card is exact, and the skill checks itself', () => {
  for (const ok of ['terminal', 'Open the terminal', 'open a command line', 'verse cli', "verse's terminal", 'show me the terminal'.replace('me ', '')]) assert.equal(terminalAsk(ok), true, ok);
  for (const no of ['airport terminal map', 'terminal illness', 'terminal velocity', 'how do I use the command line in linux', 'bus terminal near me', 'cli tool for git']) assert.equal(terminalAsk(no), false, no);
  assert.equal(suite().ok, true, suite().got);
});
