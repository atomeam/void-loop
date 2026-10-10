// The commercial chain rehearsed on the deployed site (operator, 2026-10-10): job -> buyer's reply -> claim -> draft,
// against a-to-mind.com itself, with the owner token. Run from .github/workflows/rehearsal.yml (workflow_dispatch),
// which holds READ_TOKEN; the handoff row standing in for the buyer's reply is seeded first (its id is the input),
// because HANDOFF_TOKEN is not a repo secret. Two steps of the chain this cannot exercise, said plainly in the output:
// the Gumroad ping handler (needs GUMROAD_PING_KEY: a real test purchase, or the key as a repo secret) and the
// /api/handoff POST (needs HANDOFF_TOKEN). Everything here is marked rehearsal and the job is closed at the end.
// Usage: READ_TOKEN=… node tools/rehearsal.mjs <handoff-id-32hex> [site]
import { readFileSync } from 'node:fs';

const [, , HID, SITE = 'https://a-to-mind.com'] = process.argv;
const TOKEN = process.env.READ_TOKEN || '';
if (!/^(?:[a-f0-9]{32}|rehearsal-[a-f0-9]{22})$/.test(HID || '') || !TOKEN) { console.error('usage: READ_TOKEN=… node tools/rehearsal.mjs <handoff-id> [site]'); process.exit(2); }

const runId = (process.env.GITHUB_RUN_ID || Date.now().toString(36)).toString();
const target = 'sale:rehearsal-' + runId;
const auth = { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' };
const say = (n, what) => console.log(n + '. ' + what);
let failed = false;
const expect = (ok, what) => { if (!ok) { failed = true; console.log('   FAILED: ' + what); } };
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch (_) { return { raw: t.slice(0, 200), status: r.status }; } };

// 1. the deployed SHA: the site must serve this checkout's skills/index.json byte for byte (deploy.yml's own proof)
const sha = process.env.GITHUB_SHA || 'unknown';
const live = await (await fetch(SITE + '/skills/index.json?v=' + sha)).text();
const ours = readFileSync('void-live-deploy/skills/index.json', 'utf8');
say(1, 'deployed SHA ' + sha + ': /skills/index.json ' + (live === ours ? 'matches this checkout byte for byte' : 'DIFFERS from this checkout — the site serves another deploy; records below still name what actually ran'));

// 2. the seeded reply is live (public by its unguessable id, as a builder would open it)
const h = await fetch(SITE + '/api/handoff?id=' + HID + '&raw=1');
const hBody = await h.text();
say(2, 'the seeded buyer reply (handoff ' + HID.slice(0, 8) + '…): HTTP ' + h.status + ', ' + hBody.length + ' bytes');
expect(h.status === 200 && hBody.length > 20, 'the handoff row is not live; seed it first');

// 3. the serve job (standing in for the Gumroad ping -> sale-to-job hook, which needs GUMROAD_PING_KEY to exercise)
const ask = 'serve One-Time Fix for rehearsal.example: wait for their reply to the receipt · reply received: ' + SITE + '/api/handoff?id=' + HID + '&raw=1';
const qr = await j(await fetch(SITE + '/api/queue', { method: 'POST', headers: auth, body: JSON.stringify({ ask, target }) }));
const jobId = qr.item && qr.item.id;
say(3, 'job queued on the live board: ' + (jobId ? jobId + ' (target ' + target + ')' : JSON.stringify(qr)));
say(3.5, 'NOT exercised here: the Gumroad ping (/api/gumroad needs GUMROAD_PING_KEY) and the reply POST (/api/handoff needs HANDOFF_TOKEN) — neither is a repo secret; both are covered by tests and by a real Gumroad test purchase when Adam makes one');
expect(!!jobId, 'queueing the job');

// 4. the claim drafts the proposal (lib/job-draft.js on the deployed site)
const claim = await j(await fetch(SITE + '/api/queue', { method: 'PATCH', headers: auth, body: JSON.stringify({ target, state: 'building', from: 'queued', by: 'rehearsal run ' + runId }) }));
say(4, 'claimed; the claim reply says: ' + JSON.stringify(claim.draft || claim.error || claim));
expect(/^draft proposal on job/.test(String(claim.draft || '')), 'the claim did not draft');

// 5. the draft on the job row, and the second claim reusing it
const board = await j(await fetch(SITE + '/api/queue', { headers: auth }));
const row = ((board.items || []).find((x) => x.target === target)) || {};
const draft = String(row.draft || '');
say(5, 'the draft on the job: ' + (draft ? draft.split('\n')[0] + ' … (' + draft.length + ' chars, To: ' + (/^To: (.*)$/m.exec(draft) || [])[1] + ')' : 'MISSING'));
expect(draft.startsWith('# Proposal') && draft.includes('[price: left for the owner to fill in]'), 'draft shape');
const again = await j(await fetch(SITE + '/api/queue', { method: 'PATCH', headers: auth, body: JSON.stringify({ target, state: 'building', from: 'building', by: 'rehearsal again' }) }));
say(6, 'a second claim: ' + JSON.stringify(again.draft || again.error || again.held || ''));
expect(String(again.draft || '') === 'draft already on the job', 'idempotency on the live site');

// 6. the execution records as the actions card shows them
const acts = await j(await fetch(SITE + '/api/actions', { headers: auth }));
const mine = (acts.actions || []).filter((r) => String(r.ref || '').includes(target));
for (const r of mine) say(7, 'record: ' + ({ done: '✓', failed: '✗', stubbed: '○', running: '…' }[r.state] || '?') + ' ' + r.kind + ' · ' + r.ref + ' · ' + (r.result || r.error || ''));
expect(mine.some((r) => r.kind === 'proposal.draft' && r.state === 'done'), 'the proposal.draft record');

// 7. close the rehearsal job so the board stays clean (the records stay: they are the evidence)
const close = await j(await fetch(SITE + '/api/queue', { method: 'PATCH', headers: auth, body: JSON.stringify({ id: jobId, state: 'done', note: 'rehearsal ' + runId + ' complete' }) }));
say(8, 'job closed: ' + ((close.items || []).find((x) => x.id === jobId) || {}).state);

console.log(failed ? '\nREHEARSAL FAILED: see the lines above' : '\nREHEARSAL GREEN: sale job -> reply -> claim -> draft ran end to end on the deployed site');
process.exit(failed ? 1 : 0);
