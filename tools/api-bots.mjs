// Keeps one real call per free API bot (bots/api-bots.js): fetches each API's sample address as a-to-mind.com would (Origin header),
// keeps the date, address, status, CORS header and a trimmed reply in void-live-deploy/bots/api-fixtures.js, and writes the APIs into
// bots/credits.json for /credits/. The bots' checks read these kept calls, so a refused, moved or browser-blocked API fails and is not live.
//   node tools/api-bots.mjs            refresh every kept call (network)
//   node tools/api-bots.mjs --only id  refresh one
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APIS, apiCredits } from '../void-live-deploy/bots/api-bots.js';

const bots = resolve(dirname(fileURLToPath(import.meta.url)), '../void-live-deploy/bots');
/** trim a reply so the kept copy stays small but keeps its shape: arrays to 3 items, long text cut, only `keep` keys at the top. Pure. */
export function trim(v, keep, depth = 0) {
  if (Array.isArray(v)) return v.slice(0, 3).map((x) => trim(x, null, depth + 1));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => !keep || keep.includes(k)).slice(0, 200).map(([k, x]) => [k, trim(x, null, depth + 1)]));
  return typeof v === 'string' && v.length > 600 ? v.slice(0, 600) : v;
}
/** a browser follows a redirect only when every hop allows the page's origin: the CORS kept is the weakest hop's. Pure. */
export const corsOfHops = (hops) => (hops.every((h) => h === '*' || h === 'https://a-to-mind.com') ? hops[hops.length - 1] : hops.find((h) => h !== '*' && h !== 'https://a-to-mind.com') || null);
async function call(a) {
  const url = a.url(a.sample), at = new Date().toISOString(), hops = [];
  try {
    let r, u = url;
    for (let n = 0; n < 6; n++) { // redirects followed by hand, so a hop without CORS (which a browser refuses) is seen
      r = await fetch(u, { redirect: 'manual', headers: { origin: 'https://a-to-mind.com', 'user-agent': 'Verse bot factory (https://a-to-mind.com/bots/)' }, signal: AbortSignal.timeout(20000) });
      hops.push(r.headers.get('access-control-allow-origin'));
      if (!(r.status >= 300 && r.status < 400 && r.headers.get('location'))) break;
      u = new URL(r.headers.get('location'), u).href;
    }
    const t = await r.text(); let body = t.slice(0, 2000);
    if (!a.text) try { body = trim(JSON.parse(t), a.keep); } catch (_) { /* not JSON: kept as text, the check fails */ }
    return { at, url, ...(u !== url ? { moved: u } : {}), status: r.status, cors: corsOfHops(hops), body };
  } catch (e) { return { at, url, status: 0, cors: null, body: String(e.message || e).slice(0, 200) }; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
  let kept = {}; try { kept = (await import('../void-live-deploy/bots/api-fixtures.js')).default; } catch (_) { /* first run */ }
  const todo = APIS.filter((a) => !only || a.id === only);
  for (let i = 0; i < todo.length; i += 6) await Promise.all(todo.slice(i, i + 6).map(async (a) => { kept[a.id] = await call(a); console.log(a.id + ': ' + kept[a.id].status + ' cors=' + kept[a.id].cors + (kept[a.id].moved ? ' moved to ' + kept[a.id].moved : '')); }));
  const ids = APIS.map((a) => a.id).filter((id) => kept[id]);
  writeFileSync(resolve(bots, 'api-fixtures.js'), '// Real calls kept by tools/api-bots.mjs, one line per free API bot (bots/api-bots.js). Regenerate, do not edit.\nexport default {\n' + ids.map((id) => JSON.stringify(id) + ': ' + JSON.stringify(kept[id])).join(',\n') + ',\n};\n');
  const credits = JSON.parse(readFileSync(resolve(bots, 'credits.json'), 'utf8')).filter((c) => !c.api);
  const rows = [{ name: 'public-apis/public-apis', author: 'public-apis contributors', license: 'MIT', link: 'https://github.com/public-apis/public-apis', used: 'where Verse found most of its free API bots' }, ...apiCredits()].map((c) => ({ ...c, api: true }));
  writeFileSync(resolve(bots, 'credits.json'), '[\n' + [...credits, ...rows].map((c) => JSON.stringify(c)).join(',\n') + '\n]\n');
}
