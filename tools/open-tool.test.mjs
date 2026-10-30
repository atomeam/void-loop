// open-tool: a tool page asked for by its name opens as a card linking to that page; a one-word name is left to topics and other skills.
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { toolAsk } from '../void-live-deploy/skills/open-tool.js';

test('a tool name of two words, an alias, or open + any tool name', () => {
  assert.deepEqual(toolAsk('word counter'), { href: '/word-count/', label: 'Word counter' });
  assert.deepEqual(toolAsk('Base converter?'), { href: '/base-converter/', label: 'Base converter' });
  assert.equal(toolAsk('character counter').href, '/word-count/'); assert.equal(toolAsk('online timer').href, '/stopwatch/');
  assert.equal(toolAsk('open the piano').href, '/piano/'); assert.equal(toolAsk('go to the metronome').href, '/metronome/'); assert.equal(toolAsk('open my calendar').href, '/calendar/');
  assert.equal(toolAsk('kanban board tool').href, '/kanban/');
});
test('not a tool: one word alone, the stage keeps, other asks', () => {
  for (const s of ['gradient', 'piano', 'calculator', 'timer', 'open a bank account', 'show me the news', 'word counter for my essay hello world', 'open a calculator', 'wheel of names', 'open the team chat', '']) assert.equal(toolAsk(s), null, s);
});
test('the card links to the tool page', () => {
  const el = { innerHTML: '', dataset: {} };
  const out = skill.run('word counter', { esc: (s) => String(s), showPage: (fn) => { fn(el); return el; } });
  assert.equal(out, 'open-tool'); assert.equal(el.dataset.page, '/word-count/'); assert.match(el.innerHTML, /<a href="\/word-count\/">Open the Word counter page<\/a>/);
});
