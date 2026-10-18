// The live appraiser, checked from outside (.github/workflows/appraise-live.yml, manual): POST one small test image to
// /api/appraise on the live site and read what came back: the status, the kind Verse saw, whether the text is Verse's own
// valuation line, and whether the vision model answered at all (a 503 means the deploy has no vision model bound, a 502 that
// the model did not answer). Prints a Markdown table for the job summary: status, kind and yes/no only; never the image, never a
// visitor's photo (this one is a tiny test picture made here). Exit 1 when the route did not value it, 3 when the site cannot be reached.
//   node tools/appraise-live.mjs [--site https://a-to-mind.com]
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';

/** a small RGB PNG drawn here (a colour gradient): big enough for a vision model's image reader, which a 1x1 picture is not
 * (2026-10-16: the 1x1 test image came back 502 from both vision models). Pure. */
export function gradientPng(w = 64, h = 64) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { const o = y * (w * 3 + 1); for (let x = 0; x < w; x++) { raw[o + 1 + x * 3] = (x * 255 / (w - 1)) | 0; raw[o + 2 + x * 3] = (y * 255 / (h - 1)) | 0; raw[o + 3 + x * 3] = 128; } }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td) >>> 0); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// enough to prove the route, the model binding and the valuation path; the model's words about it are not judged
export const TEST_PNG = 'data:image/png;base64,' + gradientPng().toString('base64');

export async function checkAppraise(site, post = (u, o) => fetch(u, o)) {
  const base = site.replace(/\/+$/, ''), rows = [], row = (what, ok, saw) => rows.push({ what, ok, saw });
  const skill = await post(base + '/skills/appraise.js', { method: 'GET' });
  row('the appraise skill is deployed', skill.status === 200, 'HTTP ' + skill.status);
  const r = await post(base + '/api/appraise', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: TEST_PNG, note: 'a live check from the repo' }) });
  const j = await r.json().catch(() => null);
  row('/api/appraise answers', r.status === 200, 'HTTP ' + r.status + (j && j.error ? ': ' + j.error : ''));
  row('the vision model is bound and answered', r.status !== 503 && r.status !== 502, r.status === 503 ? 'no vision model on this deploy' : r.status === 502 ? 'the model did not answer' + (j && j.reason ? ' (' + String(j.reason).replace(/\s+/g, ' ').slice(0, 120) + ')' : '') : 'answered');
  const v = j && j.value;
  row('Verse valued what it saw', !!v && (v.person ? !!j.text : /^(?:Verse|V01D) values this at \$/.test(String(j.text || ''))), v ? (v.person ? 'a person: complimented, no number' : 'kind ' + v.kind + ', one number') : 'no value');
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
