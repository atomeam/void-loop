import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTION, goalsFrom, promptOf, readJudgment, askFree, judgeDiff } from './judgment.mjs';
import { FREE_MODEL } from '../void-live-deploy/lib/models.js';

const CANON = '## Motto\nYou name it, Verse learns it and does it better.\n\n## How Verse is different\n- **Skills, not one-off answers**: Other canvas tools call a model on every click; when Verse misses an ask, its builders compile a permanent, tested skill.\n';

test('the goals are the motto and the written differences, and the question is plain', () => {
  const g = goalsFrom(CANON, 'keep secrets in the environment');
  assert.match(g, /You name it, Verse learns it and does it better/);
  assert.match(g, /permanent, tested skill/);
  assert.match(QUESTION, /real and useful/);
  assert.match(QUESTION, /no invented jargon, fake numbers or filler/);
  const p = promptOf('+ a page that rotates letters\n', g, 'finish rot13.com');
  assert.match(p, /Goals:/); assert.match(p, /Would a normal person see this as real and useful/); assert.match(p, /rotates letters/); assert.match(p, /Green tests are not a reason to pass/);
});

test('a clear no is a no, and a vague yes is a no', () => {
  assert.equal(readJudgment('{"pass":false,"why":"It is a tally nobody can use."}').pass, false);
  assert.equal(readJudgment('{"pass":true,"why":"short"}').pass, false);
  assert.match(readJudgment('not json').why, /not a clear answer/);
  assert.equal(readJudgment('{"pass":true,"why":"A person can rotate letters on the page."}').pass, true);
});

test('only the free model is asked, and no model means it does not ship', async () => {
  let url = '';
  const fetchFn = async (u) => { url = u; return { ok: true, json: async () => ({ result: { response: '{"pass":true,"why":"A person can use the page."}' } }) }; };
  const env = { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acc' };
  const j = await judgeDiff('+ hello\n', { env, fetchFn, cwd: '/none', task: 'a page' });
  assert.equal(j.pass, true);
  assert.ok(url.includes(FREE_MODEL), url);
  assert.equal(url.includes('gpt-oss') || url.includes('kimi'), false);
  assert.equal((await judgeDiff('+ hello\n', { env: {}, fetchFn, cwd: '/none' })).pass, false);
  assert.equal((await askFree('x', { env: {}, fetchFn })).length, 0);
});
