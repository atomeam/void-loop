// The proposal (void-live-deploy/lib/proposal.js, skills/proposal.js, /api/answer mode 'proposal', the confirm line's
// proposal.send): a pasted customer request becomes an editable proposal; the price stays the owner's; a send is a stub.
// Run: node --test tools/proposal.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { proposalOf, prepareProposal, parseProposal, ruleProposal, toMarkdown, toPlain, mailBody, fileNameOf, addressIn, proposalPrompt, PROPOSAL_SYSTEM, FIELDS, PRICE_BLANK } from '../void-live-deploy/lib/proposal.js';
import skill from '../void-live-deploy/skills/proposal.js';
import { redact } from '../void-live-deploy/lib/automation-fix.js';
import { GATED, confirmLine, parseGatedAsk, fingerprint } from '../void-live-deploy/lib/approval-core.js';
import * as answerApi from '../void-live-deploy/functions/api/answer.js';
import * as approvalApi from '../void-live-deploy/functions/api/approval.js';

// the owner's own details: a request as a customer would send it to A-to-Mind
const REQUEST = `Hi Adam,

We run a small bakery in Portland and our online orders come in through Shopify. We need the Zapier zap that copies each order into our Google Sheet fixed: since last week every order shows up twice and the morning bake list is wrong. We would also like someone to check the whole flow once a month so it does not break again before the holidays.

Can you tell us what you would do and when you could start?

Thanks,
Maria
maria@sunrisebakery.example`;

test('the ways people ask for a proposal open it, and the paste is kept; look-alikes stay out', () => {
  for (const a of ['turn this into a proposal', 'Make a proposal from this', 'write a proposal for this request', 'draft a proposal', 'can you turn this email into a proposal?', 'prepare a proposal based on the following'])
    assert.ok(proposalOf(a), a);
  assert.equal(proposalOf('turn this into a proposal:\n' + REQUEST).request, REQUEST);
  assert.equal(proposalOf('turn this email into a proposal: we need our order flow fixed by June').request, 'we need our order flow fixed by June');
  assert.equal(proposalOf('write a proposal for this\n' + REQUEST).request, REQUEST);
  // pasted into the page's one-line ask box: the line breaks arrive as ' ⏎ ' (blank lines fold) and the whole request is kept, not just its first line
  assert.equal(proposalOf('turn this into a proposal: ' + REQUEST.replace(/\s*\r?\n\s*/g, ' ⏎ ')).request, REQUEST.replace(/\n{2,}/g, '\n'));
  for (const a of ['what is a proposal', 'propose a toast', 'marriage proposal ideas', 'research proposal format', 'proposal writing tips', 'how do I write a proposal', 'proposal', ''])
    assert.equal(proposalOf(a), null, a);
  for (const e of skill.examples) assert.ok(skill.match(e.toLowerCase(), e), e);
  for (const e of skill.nearMisses) assert.ok(!skill.match(e.toLowerCase(), e), e);
});

test('the paste is checked, cut and masked, and the customer\'s address and domain are read from it', () => {
  const p = prepareProposal({ request: REQUEST, note: 'we are busy until June' }, redact);
  assert.equal(p.error, undefined); assert.equal(p.to, 'maria@sunrisebakery.example'); assert.equal(p.host, 'sunrisebakery.example'); assert.equal(p.cut, false); assert.equal(p.masked, false);
  assert.match(proposalPrompt(p), /Note from the owner: we are busy until June/); assert.match(proposalPrompt(p), /quoted material/);
  assert.match(PROPOSAL_SYSTEM, /Never write a price/);
  const masked = prepareProposal({ request: REQUEST + '\nour api_key=sk_live_1234567890abcdef please keep it' }, redact);
  assert.equal(masked.masked, true); assert.ok(!/sk_live_1234567890/.test(masked.request));
  assert.equal(prepareProposal({ request: 'hi' }).status, 400);
  assert.equal(prepareProposal({ request: 'x'.repeat(9000) }).cut, true);
  assert.deepEqual(addressIn('mail me at bob@x.co.uk.'), { to: 'bob@x.co.uk', host: 'x.co.uk' });
});

test('the rules draft fills every field from the request, the price blank, the owner\'s decisions in brackets', () => {
  const f = ruleProposal(prepareProposal({ request: REQUEST }, redact));
  assert.deepEqual(Object.keys(f), FIELDS.map(([k]) => k));
  assert.equal(f.title, 'Proposal: the Zapier zap that copies each order into our Google Sheet');
  assert.match(f.asked, /^We need the Zapier zap that copies each order into our Google Sheet fixed/);
  assert.match(f.asked, /check the whole flow once a month/);
  assert.match(f.scope, /^- We need the Zapier zap[\s\S]*\n- We would also like someone to check the whole flow once a month[\s\S]*\n- \[anything not listed here is out of scope\]$/);
  assert.equal(f.price, PRICE_BLANK);
  assert.match(f.approach, /\[Adjust to what you would actually do\.\]$/);
  assert.match(f.timeline, /^\[/); assert.match(f.next, /Reply with a yes/);
  const md = toMarkdown(f, 'maria@sunrisebakery.example');
  assert.match(md, /^# Proposal: the Zapier zap[\s\S]*\nTo: maria@sunrisebakery.example\n\n## What they asked for\n/);
  assert.match(md, /## Price\n\n\[price: left for the owner to fill in\]/);
  assert.equal(fileNameOf(f), 'the-zapier-zap-that-copies-each-order-into-our-goo.md');
  assert.match(toMarkdown({ title: 'x', price: '' }), /## Price\n\n\[price/, 'the price line is never dropped');
});

test('what a model says is parsed to the same fields; a price it wrote anyway is bracketed; nonsense is null', () => {
  const said = 'Sure! {"title":"Fix the double orders","asked":"Stop every Shopify order landing twice in the sheet.","approach":"Trace the zap, fix the trigger, re-run last week.","scope":["the order zap","a monthly check"],"timeline":"Two days, then monthly.","next":"Say yes and pick a start date."}';
  const f = parseProposal(said);
  assert.equal(f.title, 'Fix the double orders'); assert.equal(f.scope, '- the order zap\n- a monthly check'); assert.equal(f.price, PRICE_BLANK);
  assert.equal(parseProposal('{"title":"x","asked":"y","approach":"it costs $400 up front","scope":"","timeline":"","next":""}').approach, 'it costs [price] up front');
  assert.equal(parseProposal('{"title":"x"}'), null); assert.equal(parseProposal('no json here'), null);
});

const TOKEN = 'owner-token-for-tests-1234567890';
const post = (env, body, auth = false) => answerApi.onRequestPost({ env, request: new Request('https://x/api/answer', { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer ' + TOKEN } : {}) }, body: JSON.stringify(body) }), waitUntil() {} });
const kvDB = () => { const db = new DatabaseSync(':memory:'); db.exec('CREATE TABLE void_kv (k TEXT PRIMARY KEY, v TEXT)'); db.exec('CREATE TABLE void_shortfalls (day TEXT NOT NULL, place TEXT NOT NULL, reason TEXT NOT NULL, n INTEGER NOT NULL, last TEXT NOT NULL, PRIMARY KEY (day, place, reason))');
  const st = (sql, a = []) => ({ bind: (...b) => st(sql, b), first: async (c) => { const r = db.prepare(sql).get(...a) ?? null; return c ? (r ? r[c] : null) : r; }, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => db.prepare(sql).run(...a) });
  return { db, prepare: (sql) => st(sql), batch: async (list) => Promise.all(list.map((s) => s.run())) }; };

test('/api/answer mode proposal: the model\'s fields when it answers, the rules when it is off or fails; nothing is stored', async () => {
  const calls = [];
  const ai = (reply) => ({ run: async (m, o) => { calls.push(o); if (reply instanceof Error) throw reply; return { response: reply }; } });
  const on = { DB: kvDB(), AI: ai('{"title":"Fix the double orders","asked":"a","approach":"b","scope":"- c","timeline":"d","next":"e"}') };
  const r1 = await (await post(on, { mode: 'proposal', request: REQUEST })).json();
  assert.equal(r1.model, 'gemma'); assert.equal(r1.fields.title, 'Fix the double orders'); assert.equal(r1.fields.price, PRICE_BLANK); assert.equal(r1.from.host, 'sunrisebakery.example');
  assert.match(calls[0].messages[0].content, /Never write a price/); assert.match(calls[0].messages[1].content, /maria@sunrisebakery\.example/);
  assert.equal(on.DB.db.prepare('SELECT COUNT(*) n FROM void_kv').get().n, 0, 'nothing stored');
  const off = { DB: kvDB(), AI: ai('x'), VOID_ANSWER_MODELS: 'off' };
  const r2 = await (await post(off, { mode: 'proposal', request: REQUEST })).json();
  assert.equal(r2.model, 'rules'); assert.match(r2.fields.title, /^Proposal: the Zapier zap/); assert.match(r2.note, /no model/);
  const busy = { DB: kvDB(), AI: ai(new Error('model busy')) };
  const r3 = await (await post(busy, { mode: 'proposal', request: REQUEST })).json();
  assert.equal(r3.model, 'rules'); assert.match(r3.note, /model busy/);
  assert.equal((await post(on, { mode: 'proposal', request: 'hi' })).status, 400);
});

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, all: async () => ({ results: db.prepare(sql).all(...a) }), first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  return { prepare: (sql) => stmt(sql), raw: db, batch: async (list) => Promise.all(list.map((s) => s.run())) };
}

test('the confirm line knows proposal.send: the ask, the line, and a stubbed execution record (kind proposal.send, ref the customer\'s domain) the moment it is asked', async () => {
  assert.equal(GATED['proposal.send'].kind, 'send');
  const ask = parseGatedAsk('send this proposal "Fix the double orders" to maria@sunrisebakery.example');
  assert.deepEqual(ask, { toolName: 'proposal.send', args: { to: 'maria@sunrisebakery.example', title: 'Fix the double orders' } });
  assert.deepEqual(parseGatedAsk('send the proposal to maria@sunrisebakery.example'), { toolName: 'proposal.send', args: { to: 'maria@sunrisebakery.example', title: '' } });
  assert.equal(confirmLine('proposal.send', ask.args), 'Send the proposal “Fix the double orders” to maria@sunrisebakery.example?');
  assert.equal(confirmLine('proposal.send', { to: 'x@y.z', title: '' }), 'Send the proposal to x@y.z?');
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  const call = (body) => approvalApi.onRequestPost({ env, request: new Request('https://x/api/approval', { method: 'POST', headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
  const req = await (await call({ type: 'a2m.approval.requested', toolName: 'proposal.send', args: ask.args, argsFingerprint: await fingerprint('proposal.send', ask.args) })).json();
  assert.equal(req.line, 'Send the proposal “Fix the double orders” to maria@sunrisebakery.example?');
  const rows = () => env.DB.raw.prepare('SELECT owner, kind, ref, state, result FROM void_actions ORDER BY started').all();
  assert.deepEqual(rows().map((r) => [r.owner, r.kind, r.ref, r.state]), [['owner', 'proposal.send', 'sunrisebakery.example', 'stubbed']]);
  assert.match(rows()[0].result, /Nothing goes out before the yes\.$/);
  // the send executor is connected (lib/email-send.js, #411), and the yes covers one exact draft: this ask carried no draft
  // text, so a yes sends nothing; it fails closed and the confirm record says so (the dry run and the real send with a
  // draft are tools/email-send.test.mjs)
  const d = await (await call({ type: 'a2m.approval.decision', approvalId: req.approvalId, decision: 'approve', actor: 'owner', argsFingerprint: req.argsFingerprint })).json();
  assert.equal(d.ran, false); assert.match(d.error, /no draft on the ask/);
  assert.deepEqual(rows().map((r) => [r.kind, r.state]), [['proposal.send', 'stubbed'], ['confirm.proposal.send', 'failed']]);
});

test('toPlain: the proposal as plain text for a reply box: title first, each field under its label, no Markdown marks, the price line never dropped', () => {
  const f = { title: 'Proposal: fix the order flow', asked: 'Fix the order flow by June.', approach: 'Look, fix, hand over.', scope: '- orders\n- emails', timeline: 'two weeks', next: 'Reply yes.' };
  const t = toPlain(f);
  assert.ok(t.startsWith('Proposal: fix the order flow\n\nWhat they asked for:\nFix the order flow by June.'), t);
  assert.ok(t.includes('Price:\n' + PRICE_BLANK) && t.includes('Next step:\nReply yes.'), t);
  assert.ok(!/^#/m.test(t), 'no Markdown headings');
});

test('a mail thread read off the page drafts from the message, not its headers: no subject, From line or mail-app words in the rule draft', () => {
  const thread = 'Order flow\nFrom: Dana Reyes <dana@acme.test>\nto me\nHi, we need our order flow fixed by June. Orders stop syncing to the sheet and the confirmation emails go out twice. Can you send us a proposal?\nReply\nForward';
  assert.equal(mailBody(thread), 'Hi, we need our order flow fixed by June. Orders stop syncing to the sheet and the confirmation emails go out twice. Can you send us a proposal?');
  const f = ruleProposal(prepareProposal({ request: thread }));
  assert.ok(!/From:|dana@|Order flow\b(?! fixed)|\bReply\b|Forward/.test(f.title + f.asked + f.scope), JSON.stringify(f));
  assert.match(f.title, /order flow fixed by June/i);
  assert.equal(addressIn(thread).to, 'dana@acme.test', 'the address still comes from the whole thread');
  assert.equal(mailBody('Fix our order flow\nWe need it by June.'), 'Fix our order flow\nWe need it by June.', 'a pasted request with no headers is left as it is');
});

test('one owner gate across Void: the confirm line takes the memory page\'s signed owner session, and refuses a forged one', async () => {
  const { mintOwnerSession } = await import('../void-live-deploy/lib/guard.js');
  const env = { READ_TOKEN: TOKEN, SALT: 'test-salt', DB: d1() };
  const session = (await mintOwnerSession(env, 'owner-credential-1')).token; // what passkey sign-in stores in a2m.void.owner.v1
  assert.ok(session.startsWith('vo1.'), 'an owner session, not the raw key');
  const call = (body, tok) => approvalApi.onRequestPost({ env, request: new Request('https://x/api/approval', { method: 'POST', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
  const args = { to: 'maria@sunrisebakery.example', title: 'Fix the double orders' };
  const req = await (await call({ type: 'a2m.approval.requested', toolName: 'proposal.send', args, argsFingerprint: await fingerprint('proposal.send', args) }, session)).json();
  assert.ok(req.approvalId, JSON.stringify(req));
  const d = await (await call({ type: 'a2m.approval.decision', approvalId: req.approvalId, decision: 'approve', actor: 'owner', argsFingerprint: req.argsFingerprint }, session)).json();
  assert.equal(d.ran, false); assert.match(d.error, /no draft on the ask/); // the owner's yes is taken; with no draft on the ask nothing is sent
  const forged = (await mintOwnerSession({ READ_TOKEN: 'some-other-key-0123456789', SALT: 'test-salt' }, 'owner-credential-1')).token;
  const no = await call({ type: 'a2m.approval.requested', toolName: 'proposal.send', args, argsFingerprint: await fingerprint('proposal.send', args) }, forged);
  assert.equal(no.status, 401);
});
