// Before Verse ships its own change: a free model reads the diff against the stated goals and answers
// one question. Green checks are not enough. A no is sent back; the loop fixes it once and asks again.
//   node tools/judgment.mjs --base origin/main
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FREE_MODEL } from '../void-live-deploy/lib/models.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const QUESTION = 'Would a normal person see this as real and useful, with no invented jargon, fake numbers or filler?';

/** the stated goals, from the canon and the rules, clipped. Missing files are left out. Pure. */
export function goalsFrom(canon = '', rules = '') {
  const motto = ((String(canon).match(/## Motto\n+([^\n#]+)/) || [])[1] || '').trim();
  const block = (String(canon).split('## How Verse is different')[1] || '').split(/\n## /)[0];
  const different = block.split('\n').map((l) => l.replace(/^- \*\*[^*]+\*\*: /, '').trim()).filter((l) => l.length > 40).slice(0, 6);
  const lines = String(rules).split('\n').filter((l) => /keep secrets|free model|on the device|function first/i.test(l)).slice(0, 3).map((l) => l.replace(/^[-*] /, '').slice(0, 240));
  return ['Motto: ' + (motto || '(none written)'), ...different, ...lines].join('\n').slice(0, 1800);
}

export function goalsAt(dir = root) {
  const read = (p) => { try { return readFileSync(resolve(dir, p), 'utf8'); } catch (_) { return ''; } };
  return goalsFrom(read('domains/void.canon.md'), read('docs/RULES.md'));
}

/** the question the model is asked. Pure. */
export function promptOf(diff, goals, task = '') {
  const body = String(diff || '').slice(0, 6000);
  return 'You are judging one change to Verse before it ships. The goals below are the ones written in the repo. ' + QUESTION + '\n'
    + 'Pass only when the change is something a person could use, and it does not invent jargon, fake numbers, or filler. Green tests are not a reason to pass.\n'
    + 'Reply with JSON only: {"pass":true,"why":"one sentence"} or {"pass":false,"why":"one sentence"}.\n\nGoals:\n' + goals
    + (task ? '\n\nWhat this lap set out to do:\n' + String(task).slice(0, 400) : '') + '\n\nChange:\n' + (body || '(empty)');
}

/** the model's reply. Anything that is not a clear yes or no is a no. Pure. */
export function readJudgment(raw) {
  let o = null; const s = String(raw || ''), m = s.match(/\{[\s\S]*\}/);
  try { o = JSON.parse(m ? m[0] : s); } catch (_) { return { pass: false, why: 'the judgment was not a clear answer' }; }
  const why = String(o && o.why || '').replace(/\s+/g, ' ').trim();
  if (!o || typeof o.pass !== 'boolean' || why.length < 12) return { pass: false, why: 'the judgment was not a clear answer' };
  return { pass: o.pass === true, why };
}

const textOf = (j) => (j && (j.response || (j.result && j.result.response))) || '';

/** one call to the free model. No other model is asked. Returns the reply text, or '' when none is configured. */
export async function askFree(prompt, { env = process.env, fetchFn = fetch } = {}) {
  const token = env.CLOUDFLARE_AI_TOKEN || env.CLOUDFLARE_API_TOKEN, account = env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) return '';
  const url = 'https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(account) + '/ai/run/' + FREE_MODEL;
  let r;
  try {
    r = await fetchFn(url, { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], max_tokens: 200 }) });
  } catch (_) { return ''; }
  if (!r || !r.ok) return '';
  try { return String(textOf(await r.json()) || ''); } catch (_) { return ''; }
}

/** judge a diff. No free model means it does not ship. */
export async function judgeDiff(diff, { env = process.env, fetchFn = fetch, cwd = root, task = '' } = {}) {
  if (!String(diff || '').trim()) return { pass: false, why: 'there is no change to judge' };
  const prompt = promptOf(diff, goalsAt(cwd), task);
  const raw = await askFree(prompt, { env, fetchFn });
  if (!raw) return { pass: false, why: 'no free model was there to judge it, so it is not shipped' };
  return readJudgment(raw);
}

if (process.argv[1] && process.argv[1].endsWith('judgment.mjs')) {
  const i = process.argv.indexOf('--base');
  const base = i >= 0 ? process.argv[i + 1] : 'origin/main';
  const d = spawnSync('git', ['diff', base + '...HEAD'], { cwd: root, encoding: 'utf8', maxBuffer: 20 << 20 });
  const j = await judgeDiff(d.stdout || '', { cwd: root });
  console.log(j.why);
  process.exit(j.pass ? 0 : 1);
}
