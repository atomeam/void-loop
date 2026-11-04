// The /agent/ gate: send a real task to the live agent and wait for a real result on the Made shelf.
//   node tools/agent-probe.mjs [https://a-to-mind.com]   exits 0 only when the task is done with a non-empty result
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const base = process.argv[2] || 'https://a-to-mind.com';
const newThread = () => 'probe' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
let thread = newThread();
const h = { 'content-type': 'application/json', origin: base };
// A dropped connection is the network, not the agent (Verse engineer on main, 2026-11-04: "fetch failed · other side closed" on one poll
// a minute after a deploy, while the same probe passed on the next try). A transport error or a gateway 502/503/504 is tried again up to
// 4 times with a short backoff and each retry is printed; any other answer, and a fifth failure, still decides the probe.
export async function getJson(url, opt, { tries = 5, pause = 1500, fetcher = fetch, say = console.log } = {}) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetcher(url, opt);
      if (![502, 503, 504].includes(res.status) || i >= tries) return await res.json();
      say('probe: ' + res.status + ' from ' + url + ', try ' + i + ' of ' + tries);
    } catch (e) {
      if (i >= tries || !(e instanceof TypeError)) throw e;
      say('probe: ' + (e.cause && e.cause.message || e.message) + ' on ' + url + ', try ' + i + ' of ' + tries);
    }
    await new Promise((s) => setTimeout(s, pause * i));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
async function main() {
// the task is sent once per thread: when its connection drops, it is sent again on a new thread, so a task that did arrive is never doubled
let r;
for (let i = 1; ; i++) {
  try { r = await getJson(base + '/api/agent', { method: 'POST', headers: h, body: JSON.stringify({ thread, ask: 'List three free things to do in Savannah, Georgia.' }) }, { tries: 1 }); break; }
  catch (e) { if (i >= 3 || !(e instanceof TypeError)) throw e; console.log('probe: sending the task failed (' + (e.cause && e.cause.message || e.message) + '), again on a new thread'); thread = newThread(); await new Promise((s) => setTimeout(s, 2000 * i)); }
}
if (!r.ok) { console.error('probe: task refused', r); process.exit(1); }
for (let i = 0; i < 45; i++) {
  await new Promise((s) => setTimeout(s, 2000));
  const j = await getJson(base + '/api/agent?thread=' + thread);
  const t = j.tasks && j.tasks[0];
  if (t && (t.status === 'done' || t.status === 'failed')) {
    const ok = t.status === 'done' && String(t.result || '').length > 40 && j.made.length === 1;
    console.log((ok ? 'PASS' : 'FAIL') + ' ' + t.status + ' by ' + t.bot + ' on ' + t.tier + ' tier, ' + t.steps.length + ' steps\n' + t.steps.map((s) => '  - ' + s.line).join('\n') + '\n' + String(t.result || '').slice(0, 300));
    process.exit(ok ? 0 : 1);
  }
}
console.error('FAIL timed out'); process.exit(1);
}
