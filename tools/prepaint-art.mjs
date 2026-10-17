// Pre-paint the Art Forge's pictures for subjects people already have cards of (docs/playbooks/art-forge.md).
//   node tools/prepaint-art.mjs --dry                      list the subjects it would ask for (nothing is sent)
//   node tools/prepaint-art.mjs --go [--file subjects.txt]  ask the live route for each, one at a time, until the daily cap says stop
// Subjects: one per line from --file (default: the starter list below). Each goes through the same refusal rules as the route, so a person, a brand or a
// key shape is dropped here and never sent. The route's own cap (30 a day), rate limit (3 a minute) and ART_OFF still apply; this tool stops at the first
// 'cap' or 'off' and waits out a 'slow'. It uses no key: /api/card-art is public by design.
import { readFileSync } from 'node:fs';
import { subjectKey, refusal } from '../void-live-deploy/lib/art-rules.js';

export const STARTER = ['cat', 'dog', 'owl', 'wolf', 'dragon', 'raven', 'moon', 'sun', 'ocean', 'volcano', 'pizza', 'coffee', 'clock', 'compass', 'key', 'lantern', 'castle', 'forest', 'mountain', 'storm', 'rose', 'mirror', 'pyramid', 'telescope', 'labyrinth', 'phoenix', 'black hole', 'chess', 'violin', 'tiger'];
/** the subjects to paint: folded, de-duplicated, the refused dropped. Pure. */
export function plan(list) { const seen = new Set(), out = [], dropped = []; for (const raw of list) { const k = subjectKey(raw); if (!k || seen.has(k)) continue; seen.add(k); const why = refusal(raw, 'answer'); if (why) dropped.push([k, why]); else out.push(k); } return { out, dropped }; }

async function main() {
  const a = process.argv.slice(2), go = a.includes('--go'), fi = a.indexOf('--file');
  const list = fi >= 0 ? readFileSync(a[fi + 1], 'utf8').split('\n') : STARTER;
  const { out, dropped } = plan(list);
  console.log(out.length + ' subjects' + (dropped.length ? ', ' + dropped.length + ' refused (' + dropped.map((d) => d.join(': ')).join('; ') + ')' : ''));
  if (!go) { console.log(out.join('\n')); return; }
  const base = process.env.VOID_URL || 'https://a-to-mind.com';
  let painted = 0;
  for (const k of out) {
    for (let tries = 0; tries < 4; tries++) {
      const r = await fetch(base + '/api/card-art', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject: k, kind: 'answer', rarity: 'common' }) });
      const j = await r.json().catch(() => ({}));
      if (j.state === 'art') { if (!j.cached) painted++; console.log((j.cached ? 'had   ' : 'paint ') + k); break; }
      if (j.why === 'slow') { await new Promise((ok) => setTimeout(ok, 21000)); continue; }
      if (j.why === 'cap' || j.why === 'off') { console.log('stop: ' + j.why + ' (' + painted + ' painted)'); return; }
      console.log('skip  ' + k + ' (' + (j.why || r.status) + ')'); break;
    }
  }
  console.log('done: ' + painted + ' painted');
}
if (import.meta.url === 'file://' + process.argv[1]) main();
