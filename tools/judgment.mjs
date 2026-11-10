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

const textOf = (j) => {
  if (!j || typeof j !== 'object') return '';
  const choice = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  const nested = j.result && (typeof j.result === 'string' ? j.result : j.result.response);
  const t = j.response || nested || choice || '';
  return typeof t === 'string' ? t.trim() : '';
};

/** one call to the free model. Verse's own binding first (the deploy token cannot run Workers AI). Returns the reply, or ''. */
export async function askFree(prompt, { env = process.env, fetchFn = fetch } = {}) {
  const tries = [];
  if (env.VOID_OWNER_TOKEN) tries.push(['verse', String(env.VOID_SITE || 'https://a-to-mind.com').replace(/\/+$/, '') + '/api/coder', env.VOID_OWNER_TOKEN]);
  const token = env.CLOUDFLARE_AI_TOKEN || env.CLOUDFLARE_API_TOKEN;
  if (token && env.CLOUDFLARE_ACCOUNT_ID) tries.push(['workers', 'https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID) + '/ai/run/' + FREE_MODEL, token]);
  const notes = [];
  for (const [name, url, key] of tries) {
    try {
      const r = await fetchFn(url, { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], max_tokens: 200, temperature: 0, chat_template_kwargs: { enable_thinking: false } }) });
      let j = {}; try { j = await r.json(); } catch (_) { /* status is enough */ }
      const text = textOf(j);
      if (r && r.ok && text) return text;
      notes.push(name + ' ' + ((r && r.status) || 'empty'));
    } catch (_) { notes.push(name + ' down'); }
  }
  askFree.note = notes.join(', ') || 'no key';
  return '';
}

/** judge a diff. No free model means it does not ship. */
export async function judgeDiff(diff, { env = process.env, fetchFn = fetch, cwd = root, task = '' } = {}) {
  if (!String(diff || '').trim()) return { pass: false, why: 'there is no change to judge' };
  const prompt = promptOf(diff, goalsAt(cwd), task);
  const raw = await askFree(prompt, { env, fetchFn });
  if (!raw) return { pass: false, why: 'no free model was there to judge it, so it is not shipped' + (askFree.note ? ' (' + askFree.note + ')' : '') };
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
