// The reply section on every card (owner, 2026-10-29). node --test tools/card-reply.test.mjs
// The page part (the section at the end of each card, the owner's thread, a stranger's reply kept on the device) is checked in a real
// browser by tools/test_void.mjs ("talk back: the owner replies to Verse").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPLY, LINES, aboutCard, threadOf, sendReply } from '../void-live-deploy/lib/card-reply.js';
import { CORRECTIONS, readCorrections } from '../void-live-deploy/lib/corrections.js';

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

test('the card it is about: ask, title and words, clipped; the title stands in for an unknown ask; a bad skill name is dropped', () => {
  const a = aboutCard({ ask: '  5 miles   in km ', title: 'Converted', said: 'x'.repeat(2000), routed: { skill: 'skill:units' } });
  assert.deepEqual({ ...a, said: a.said.length }, { ask: '5 miles in km', title: 'Converted', said: REPLY.saidMax, routed: { skill: 'units' } });
  assert.equal(aboutCard({ title: 'The tower' }).ask, 'The tower');
  assert.equal(aboutCard({ ask: 'x', routed: { skill: '<b>' } }).routed, undefined);
  assert.equal(aboutCard({}), null);
});

test('the thread on a card: only replies about this ask, oldest first, at most six', () => {
  const r = (i, ask) => ({ at: String(i), about: ask ? { ask } : undefined, to: ask ? null : 'x', text: 't' + i, answer: 'a' + i });
  const all = [r(9, 'b'), r(8, 'a'), r(7), ...[6, 5, 4, 3, 2, 1, 0].map((i) => r(i, 'a'))]; // newest first, as the route gives them
  const t = threadOf(all, 'a');
  assert.equal(t.length, REPLY.thread);
  assert.deepEqual(t.map((x) => x.text), ['t2', 't3', 't4', 't5', 't6', 't8'], 'the six newest on this ask, the newest last');
  assert.deepEqual(threadOf(null, 'a'), []);
});

test('the owner: the reply goes to /api/voice-reply with the key and the card, and Verse\'s answer comes back', async () => {
  const calls = [];
  const fetchFn = async (u, o) => { calls.push({ u, o }); return { ok: true, status: 200, json: async () => ({ text: 'Two decimals.', answer: 'Heard.', misroute: { skill: 'units' } }) }; };
  const about = aboutCard({ ask: '5 miles in km', title: 'Converted', said: '8.05 km' });
  const r = await sendReply(about, '  Two decimals. ', { owner: 'k1', fetchFn, storage: mem() });
  assert.equal(r.ok, true); assert.equal(r.kind, 'owner');
  assert.match(r.line, /^Heard\. I have queued a fix so my units skill/);
  assert.equal(calls[0].u, '/api/voice-reply'); assert.equal(calls[0].o.headers.authorization, 'Bearer k1');
  assert.deepEqual(JSON.parse(calls[0].o.body), { about, text: 'Two decimals.' });
});

test('the owner: a refused key, a failed route and a dropped connection each say so; nothing is kept on the device', async () => {
  const st = mem(), about = aboutCard({ ask: 'q' });
  assert.equal((await sendReply(about, 'x', { owner: 'k', storage: st, fetchFn: async () => ({ ok: false, status: 401 }) })).line, LINES.owner401);
  assert.equal((await sendReply(about, 'x', { owner: 'k', storage: st, fetchFn: async () => ({ ok: false, status: 503 }) })).line, LINES.lost);
  assert.equal((await sendReply(about, 'x', { owner: 'k', storage: st, fetchFn: async () => { throw new Error('offline'); } })).line, LINES.lost);
  assert.deepEqual(readCorrections(st), []);
});

test('anyone else: the reply is kept on the device in the self card\'s correction log, and nothing is sent', async () => {
  const st = mem(); let sent = 0;
  const r = await sendReply(aboutCard({ ask: '5 miles in km', routed: { skill: 'units' } }), 'Kilometres, not km.', { owner: '', storage: st, fetchFn: async () => { sent++; return { ok: true }; } });
  assert.deepEqual([r.ok, r.kind, r.line, sent], [true, 'device', LINES.kept, 0]);
  const kept = readCorrections(st);
  assert.deepEqual(kept.map((c) => [c.ask, c.skill, c.text]), [['5 miles in km', 'units', 'Kilometres, not km.']]);
  assert.ok(st.getItem(CORRECTIONS.key));
});

test('an empty reply sends and keeps nothing', async () => {
  const st = mem(); let sent = 0; const fetchFn = async () => { sent++; return { ok: true }; };
  for (const owner of ['', 'k']) assert.equal((await sendReply(aboutCard({ ask: 'q' }), '   ', { owner, storage: st, fetchFn })).line, LINES.empty);
  assert.equal(sent, 0); assert.deepEqual(readCorrections(st), []);
});

test('the section stays out of a shared card and its picture, and the page and its two deploy copies carry it the same way', () => {
  const src = readFileSync(new URL('../void-live-deploy/lib/card-reply.js', import.meta.url), 'utf8');
  assert.match(src, /setAttribute\('data-share-skip', '1'\)/);
  assert.match(src, /className: 'vtell-box vreply'/, 'the frame, the forge and cardWords already leave .vtell-box out');
  assert.ok(!/\.innerHTML\b/.test(src), 'every word goes in as text');
  // void.html is the page; the deploy copies it over both files (AGENTS.md), so the section must be in void.html itself
  const a = readFileSync(new URL('../void.html', import.meta.url), 'utf8');
  for (const copy of ['../void-live-deploy/index.html', '../void-live-deploy/void.html']) assert.equal(readFileSync(new URL(copy, import.meta.url), 'utf8'), a, copy + ' is a copy of void.html');
  assert.match(a, /import\('\/lib\/card-reply\.js'\)/);
  assert.ok(!/tellV01D|a\.vtell'/.test(a), 'the old owner-only link is gone');
});

// A reply from a card no router skill answered counts on the heat map by the card's family (owner, 2026-10-29), and touches no fix path.
import { PAGE_FAMILY, familyOfNote } from '../void-live-deploy/lib/card-reply.js';
import { groupByFamily } from '../void-live-deploy/lib/corrections.js';
import { heatRows, hotEntry } from '../void-live-deploy/lib/correction-heat.js';
const FAMS = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/families.json', import.meta.url), 'utf8'));

test('a page note names a real family: calculator, article, time and Verse\'s own cards; anything else is no family', () => {
  const ids = new Set(FAMS.families.map((f) => f.id));
  for (const [note, id] of Object.entries(PAGE_FAMILY)) assert.ok(ids.has(id), note + ' -> ' + id + ' is a family in skills/families.json');
  assert.deepEqual(['calc', 'article', 'timenow', 'how-to clock', 'speaks fr', 'said', 'skill:clock', ''].map(familyOfNote), ['numbers', 'words', 'time', 'self', 'self', '', '', '']);
});

test('a guest reply on the Calculated card lands in Numbers and money on the heat map, and drafts no fix', async () => {
  const st = mem();
  const r = await sendReply(aboutCard({ ask: '5 miles in km', title: 'Calculated' }), 'Show two decimals please.', { owner: '', storage: st, fetchFn: async () => ({ ok: true }), family: familyOfNote('calc') });
  assert.equal(r.ok, true);
  const kept = readCorrections(st);
  assert.deepEqual(kept.map((c) => [c.skill, c.family]), [['', 'numbers']]);
  assert.deepEqual(groupByFamily(kept, FAMS).map((g) => g.id), ['numbers']);
  const h = heatRows(kept, FAMS);
  assert.deepEqual([h.rows.find((x) => x.id === 'numbers').errors, h.unplaced], [1, 0]);
  assert.equal(hotEntry(kept, FAMS, 'numbers'), null, 'a family alone names no skill, so the heat map drafts no fix for it');
});

test('a routed skill still decides the family; a family name not in the file stays unplaced', async () => {
  const st = mem();
  await sendReply(aboutCard({ ask: 'clock', routed: { skill: 'skill:clock' } }), 'x', { owner: '', storage: st, family: 'numbers' });
  await sendReply(aboutCard({ ask: 'q' }), 'y', { owner: '', storage: st, family: 'not-a-family' });
  const kept = readCorrections(st);
  assert.deepEqual(kept.map((c) => [c.skill, c.family]), [['clock', undefined], ['', 'not-a-family']]);
  assert.deepEqual(groupByFamily(kept, FAMS).map((g) => g.id).sort(), ['time', 'unplaced']);
});

test('the owner\'s reply is sent exactly as before: the family never reaches /api/voice-reply', async () => {
  const calls = [], fetchFn = async (u, o) => { calls.push(o); return { ok: true, status: 200, json: async () => ({ text: 't', answer: 'a' }) }; };
  const about = aboutCard({ ask: '5 miles in km', title: 'Calculated', said: '8.05 km' });
  await sendReply(about, 'Two decimals.', { owner: 'k', fetchFn, storage: mem(), family: 'numbers' });
  assert.deepEqual(JSON.parse(calls[0].body), { about, text: 'Two decimals.' });
});

test('the page reads the family on its own: routeOfCard, which feeds the misroute queue, is unchanged', () => {
  const a = readFileSync(new URL('../void.html', import.meta.url), 'utf8');
  assert.match(a, /family: replyLib\.familyOfNote\(noteOfCard\(el\)\)/);
  const route = a.slice(a.indexOf('    function routeOfCard(el) {'), a.indexOf('    function keepRead(el) {'));
  assert.equal(route, [
    '    function routeOfCard(el) {',
    "      let log = []; try { log = JSON.parse(localStorage.getItem(LOOP_KEY) || '[]'); } catch (_) {}",
    '      const since = (el._at || 0) - 3000, hit = log.filter((x) => x && Date.parse(x.t) >= since).pop();',
    '      if (!hit) return null;',
    "      if (hit.domain === 'void.fix') return { skill: 'automation-fix', via: 'void.fix' };",
    "      const m = /^skill:([a-z][a-z0-9-]{1,40})$/.exec(String(hit.note || ''));",
    "      return m ? { skill: m[1], via: 'skill' } : null;",
    '    }', ''].join('\n'));
});
