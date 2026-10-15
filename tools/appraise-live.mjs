// The live appraiser, checked from outside (.github/workflows/appraise-live.yml, manual): POST one small test image to
// /api/appraise on the live site and read what came back: the status, the kind V01D saw, whether the text is V01D's own
// valuation line, and whether the vision model answered at all (a 503 means the deploy has no vision model bound, a 502 that
// the model did not answer). Prints a Markdown table for the job summary: status, kind and yes/no only; never the image, never a
// visitor's photo (this one is a tiny test picture made here). Exit 1 when the route did not value it, 3 when the site cannot be reached.
//   node tools/appraise-live.mjs [--site https://a-to-mind.com]
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// a 1x1 PNG: enough to prove the route, the model binding and the valuation path; the model's words about it are not judged
export const TEST_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export async function checkAppraise(site, post = (u, o) => fetch(u, o)) {
  const base = site.replace(/\/+$/, ''), rows = [], row = (what, ok, saw) => rows.push({ what, ok, saw });
  const skill = await post(base + '/skills/appraise.js', { method: 'GET' });
  row('the appraise skill is deployed', skill.status === 200, 'HTTP ' + skill.status);
  const r = await post(base + '/api/appraise', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: TEST_PNG, note: 'a live check from the repo' }) });
  const j = await r.json().catch(() => null);
  row('/api/appraise answers', r.status === 200, 'HTTP ' + r.status + (j && j.error ? ': ' + j.error : ''));
  row('the vision model is bound and answered', r.status !== 503 && r.status !== 502, r.status === 503 ? 'no vision model on this deploy' : r.status === 502 ? 'the model did not answer' : 'answered');
  const v = j && j.value;
  row('V01D valued what it saw', !!v && (v.person ? !!j.text : /^V01D values this at \$/.test(String(j.text || ''))), v ? (v.person ? 'a person: complimented, no number' : 'kind ' + v.kind + ', one number') : 'no value');
  row('a person ask is complimented, never priced', false, 'not checked here');
  const p = await post(base + '/api/appraise', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: TEST_PNG, note: 'what am I worth' }) });
  const pj = await p.json().catch(() => null);
  rows[rows.length - 1] = { what: 'a person ask is complimented, never priced', ok: p.status === 200 && !!pj && !!pj.value && pj.value.person === true && !/\$/.test(String(pj.text || '')), saw: 'HTTP ' + p.status + (pj && pj.value ? ', person ' + pj.value.person : '') };
  return rows;
}

export const table = (rows) => ['| What | Ok | Saw |', '|:--|:--|:--|', ...rows.map((r) => `| ${r.what} | ${r.ok ? 'yes' : 'no'} | ${String(r.saw).replace(/\|/g, '/')} |`)].join('\n');

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--site'), site = i > 0 ? process.argv[i + 1] : 'https://a-to-mind.com';
  checkAppraise(site).then((rows) => { console.log('### The live appraiser at ' + site + '\n\n' + table(rows)); process.exit(rows.every((r) => r.ok) ? 0 : 1); },
    (e) => { console.log('### The live appraiser at ' + site + '\n\ncould not be reached: ' + e.message); process.exit(3); });
}
