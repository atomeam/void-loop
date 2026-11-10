import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import skill, { isClientIntake, ideaOf, intakeOf, intakeHtml, catalogOf } from '../void-live-deploy/skills/client-intake.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const catalog = {
  tools: [
    { name: 'business-clarify', description: 'clarify a business idea into a system plan', examples: ['client onboarding that runs itself'] },
    { name: 'delivery-pack', description: 'a handoff package', examples: ['invoice reminders that run themselves'] },
    { name: 'clock', description: 'a clock on the stage', examples: ['make a clock'] },
    { name: '<script>', description: 'not a real name, used to prove escaping', examples: ['onboarding widget'] },
  ],
};

test('client intake is its own ask', () => {
  assert.equal(isClientIntake('intake this idea: automate client onboarding'), true);
  assert.equal(isClientIntake('client intake for invoice reminders'), true);
  assert.equal(isClientIntake('capture and own the lead qualification process'), true);
  assert.equal(ideaOf('intake this idea: automate client onboarding'), 'automate client onboarding');
  assert.equal(ideaOf('client intake for invoice reminders'), 'invoice reminders');
  assert.equal(ideaOf('capture and own the lead qualification process'), 'lead qualification process');
  assert.equal(isClientIntake('what is intake'), false);
  assert.equal(isClientIntake('intake form'), false);
  assert.equal(isClientIntake('clarify the weather'), false);
  assert.equal(isClientIntake('clarify this business idea: a tool that turns customer emails into running automations'), false);
  assert.equal(isClientIntake('package this idea: automate client onboarding'), false);
  for (const ex of skill.examples) assert.equal(skill.match(ex.toLowerCase(), ex), true, ex);
  for (const near of skill.nearMisses) assert.equal(skill.match(near.toLowerCase(), near), false, near);
});

test('the card names only tools the catalog returned, and a source that did not answer', () => {
  const live = intakeOf({
    idea: 'automate client onboarding',
    toolsBody: catalog,
    buildBody: { state: 'plan', line: 'A plan: builds start by themselves for the ideas Verse learns from TV and radio' },
  });
  const names = live.covered.map((t) => t.name);
  assert.ok(names.includes('business-clarify'));
  assert.ok(names.includes('<script>'));
  assert.ok(!names.includes('clock'));
  assert.ok(!names.includes('email intake and routing'));
  for (const n of names) assert.ok(catalogOf(catalog).some((t) => t.name === n), n);
  const html = intakeHtml(esc, live);
  assert.match(html, /Client intake: automate client onboarding/);
  assert.match(html, /business-clarify/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /GET \/tools\.json/);
  assert.match(html, /GET \/api\/blueprint/);
  assert.match(html, /A plan: builds start/);
  assert.doesNotMatch(html, /email intake/);
  assert.doesNotMatch(html, /Last check/);

  const missing = intakeOf({
    idea: 'automate client onboarding',
    toolsError: 'the tool catalog did not answer',
    buildError: 'the build state answered HTTP 502',
  });
  const gap = intakeHtml(esc, missing);
  assert.match(gap, /the tool catalog did not answer/);
  assert.match(gap, /the build state answered HTTP 502/);
  assert.equal(missing.covered.length, 0);
  assert.doesNotMatch(gap, /business-clarify/);
});

test('text from the ask and the catalog is escaped', () => {
  const view = intakeOf({
    idea: '<img src=x onerror=alert(1)>',
    toolsBody: { tools: [{ name: 'photo-scrub', description: 'cuts <b>metadata</b>', examples: ['onerror handler'] }] },
    buildBody: { state: 'plan', line: 'line <i>ok</i>', page: '/fix/' },
  });
  const html = intakeHtml(esc, view);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;b&gt;metadata&lt;\/b&gt;/);
  assert.match(html, /&lt;i&gt;ok&lt;\/i&gt;/);
  assert.doesNotMatch(html, /<b>metadata<\/b>/);
});

test('run reads /tools.json and /api/blueprint and does not invent a system', async () => {
  let html = '';
  const seen = [];
  const ret = await skill.run('client intake for invoice reminders', {
    esc,
    showPage: (fn) => { const el = { set innerHTML(v) { html = v; } }; fn(el); return el; },
    fetch: async (url) => {
      seen.push(url);
      if (url === '/tools.json') return { ok: true, json: async () => catalog };
      if (String(url).startsWith('/api/blueprint?idea=')) return { ok: false, status: 503, json: async () => ({}) };
      throw new Error('unexpected ' + url);
    },
  });
  assert.equal(ret, 'client-intake');
  assert.deepEqual(seen, ['/tools.json', '/api/blueprint?idea=' + encodeURIComponent('invoice reminders')]);
  assert.match(html, /delivery-pack/);
  assert.match(html, /the build state answered HTTP 503/);
  assert.doesNotMatch(html, /clock/);
  assert.doesNotMatch(html, /Raw ask/);
  assert.doesNotMatch(html, /email intake/);
});

test('the skill file does not hardcode a system list', () => {
  const src = readFileSync(new URL('../void-live-deploy/skills/client-intake.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /email intake/);
  assert.doesNotMatch(src, /Raw ask/);
  assert.doesNotMatch(src, /Last check/);
  assert.match(src, /innerHTML = intakeHtml\(esc,/);
  assert.match(src, /\/tools\.json/);
  assert.match(src, /\/api\/blueprint/);
});
