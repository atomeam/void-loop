// Waits until a-to-mind.com serves every page a tower-self decision built (its headline on the live page), so the gate measures the new page and
// not a 404 or the previous deploy (.github/workflows/tower-self.yml). Exits 0 when all are live, 1 when the time runs out (the gate then measures
// what is there and the run says so).
//   node tools/tower-self-live.mjs decision.json [seconds]
import fs from 'node:fs';
const [file, secs = '900'] = process.argv.slice(2), d = JSON.parse(fs.readFileSync(file, 'utf8')), until = Date.now() + Number(secs) * 1000;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let left = (d.rows || []).slice();
while (left.length && Date.now() < until) {
  const next = [];
  for (const r of left) { let ok = false; try { const res = await fetch('https://a-to-mind.com' + r.path, { headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(15000) }); ok = res.ok && (await res.text()).includes('>' + esc(r.h1) + '</h1>'); } catch (_) {} if (!ok) next.push(r); else console.log('live: ' + r.path); }
  left = next; if (left.length) await new Promise((res) => setTimeout(res, 15000));
}
if (left.length) { console.log('::warning::not live yet: ' + left.map((r) => r.path).join(', ')); process.exit(1); }
