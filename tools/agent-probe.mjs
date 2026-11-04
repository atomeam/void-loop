// The /agent/ gate: send a real task to the live agent and wait for a real result on the Made shelf.
//   node tools/agent-probe.mjs [https://a-to-mind.com]   exits 0 only when the task is done with a non-empty result
const base = process.argv[2] || 'https://a-to-mind.com';
const thread = 'probe' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const h = { 'content-type': 'application/json', origin: base };
const r = await (await fetch(base + '/api/agent', { method: 'POST', headers: h, body: JSON.stringify({ thread, ask: 'List three free things to do in Savannah, Georgia.' }) })).json();
if (!r.ok) { console.error('probe: task refused', r); process.exit(1); }
for (let i = 0; i < 45; i++) {
  await new Promise((s) => setTimeout(s, 2000));
  const j = await (await fetch(base + '/api/agent?thread=' + thread)).json();
  const t = j.tasks && j.tasks[0];
  if (t && (t.status === 'done' || t.status === 'failed')) {
    const ok = t.status === 'done' && String(t.result || '').length > 40 && j.made.length === 1;
    console.log((ok ? 'PASS' : 'FAIL') + ' ' + t.status + ' by ' + t.bot + ' on ' + t.tier + ' tier, ' + t.steps.length + ' steps\n' + t.steps.map((s) => '  - ' + s.line).join('\n') + '\n' + String(t.result || '').slice(0, 300));
    process.exit(ok ? 0 : 1);
  }
}
console.error('FAIL timed out'); process.exit(1);
