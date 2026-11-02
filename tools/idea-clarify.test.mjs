// idea-clarify: captures a rough business idea and structures it into systems for design/build/monitor/handoff.
import test from 'node:test';
import assert from 'node:assert/strict';
import skill from '../void-live-deploy/skills/idea-clarify.js';

test('idea-clarify matches clarifying asks and rejects near misses', () => {
  assert.equal(skill.match('clarify my business idea: online tutoring platform for high school math'), true);
  assert.equal(skill.match('help me structure this idea into systems we can build'), true);
  assert.equal(skill.match('break down the idea of a local bakery delivery service'), true);
  assert.equal(skill.match('canvas for a B2B SaaS that automates invoice chasing'), true);
  assert.equal(skill.match('what\'s the weather'), false);
  assert.equal(skill.match('calculate 2+2'), false);
  assert.equal(skill.match('tell me a joke'), false);
});

test('run returns the skill name', () => {
  let html = '';
  const api = {
    showPage: (fn) => { const el = { innerHTML: '' }; fn(el); html = el.innerHTML; },
    esc: (s) => String(s).replace(/[&<>"']/g, c => ({ '&':'&','<':'<','>':'>','"':'"',"'":'&#39;' }[c]))
  };
  assert.equal(skill.run('clarify my business idea: tutoring', api), 'idea-clarify');
  assert.match(html, /Clarified idea/);
  assert.match(html, /tutoring/);
  assert.match(html, /Systems to own the heavy lifting/);
});
