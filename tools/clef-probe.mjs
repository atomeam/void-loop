// Frontier #9 (Clef routes every ask), before any call is written to it: what the site's own Workers AI binding knows about
// Clef and Clef-flash (POST /api/bench { probe: true }, owner only), printed as Markdown for the job summary, so the router's
// Clef call is written to the real input shape. Model metadata only; nothing is run and nothing is spent.
//   READ_TOKEN=… node tools/clef-probe.mjs [--site https://a-to-mind.com]
// Exit 3 when the site cannot be asked (no key, rejected, not deployed).
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function clefReport(clef) {
  if (!clef || !clef.length) return '### Clef on Workers AI\n\nThe binding lists no Clef model (or has no `models()`): nothing to route with yet.\n';
  return '### Clef on Workers AI\n\n' + clef.map((m) => '**' + m.id + '** · ' + (m.task || 'task not given') + '\n\n' + (m.description || '(no description)')
    + '\n\n' + (m.properties.length ? m.properties.map((p) => '- `' + p.property_id + '`: ' + JSON.stringify(p.value).slice(0, 1500)).join('\n') : '- (no properties)')).join('\n\n') + '\n';
}

export async function probe(site, key, get = fetch) {
  if (!key) return { ok: false, why: 'READ_TOKEN is empty (the repository secret VOID_OWNER_TOKEN is the Pages READ_TOKEN)' };
  const r = await get(site.replace(/\/+$/, '') + '/api/bench', { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify({ probe: true }) });
  if (r.status === 401 || r.status === 403) return { ok: false, why: 'the site rejected READ_TOKEN (owner only)' };
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.ok) return { ok: false, why: 'HTTP ' + r.status };
  if (!Array.isArray(j.clef)) return { ok: false, why: 'this deployment\'s /api/bench does not report Clef yet' };
  return { ok: true, clef: j.clef };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), i = args.indexOf('--site'), site = i >= 0 ? args[i + 1] : 'https://a-to-mind.com';
  let p;
  try { p = await probe(site, process.env.READ_TOKEN || process.env.VOID_OWNER_TOKEN || ''); } catch (e) { p = { ok: false, why: site + ' could not be reached: ' + (e.message || e) }; }
  if (!p.ok) { console.error('clef probe: ' + p.why); process.exit(3); }
  process.stdout.write(clefReport(p.clef));
}
