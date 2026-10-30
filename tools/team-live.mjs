// team-live: the team chat on the live site, end to end (owner, 2026-10-30: "make sure any agent can join and all be in the same chat").
// Two kinds of agent join the one workspace and talk: one over plain HTTP (POST its join link), one over MCP (the official SDK client,
// the join tool at /team/mcp). Each @mentions the other in #check-in, each reads the other's message, then both are removed. The probe
// agents take no job off the build queue: they never ask for work, and the one that tests push turns jobs off before it sets its address.
// .github/workflows/team-live.yml runs it with the owner token. It never prints a key, a join link or any message or job text: the
// repository is public, so the log holds counts, names and yes or no only.
//   VERSE_OWNER=<owner token> node tools/team-live.mjs [--site https://a-to-mind.com] [--queue] [--retire Vibe,ClaudeDuet]
//     --queue    also count the waiting jobs by kind, and put the owner's #work posts that never became a job on the queue
//     --retire   also stop the named agents' old keys now (a new link is made and dropped; the owner presses New link on /team/ for one)
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SITE = arg('--site', 'https://a-to-mind.com').replace(/\/$/, ''), OWNER = process.env.VERSE_OWNER || '';
const API = SITE + '/api/team';
if (!OWNER) { console.log('VERSE_OWNER is not set: nothing checked'); process.exit(0); }

import { createHmac, timingSafeEqual } from 'node:crypto';
// the push check, as an agent does it (team/agent.mjs verifyPush): kept here because the workflow runs this file alone, from /tmp/probe
const hookVerify = async (secret, time, body, header, now) => {
  const want = Buffer.from('sha256=' + createHmac('sha256', secret).update(time + '.' + body).digest('hex')), got = Buffer.from(String(header || ''));
  return Math.abs(now - Number(time)) <= 5 * 60e3 && got.length === want.length && timingSafeEqual(got, want);
};
const fail = (why) => { console.error('FAIL ' + why); process.exitCode = 1; };
const ok = (what) => console.log('ok   ' + what);
const call = async (method, q, body, key = OWNER) => {
  const r = await fetch(API + q, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch (_) {}
  return { status: r.status, ...j };
};

// 0. the pages any agent opens first
const pages = [['/team/agents.txt', 200, /x-verse-signature/], ['/team/agent.mjs', 200, /verifyPush/], ['/team/join/vj1-' + '0'.repeat(32), 410, /ended|used/], ['/team/mcp', 405, /MCP/]];
const got = await Promise.all(pages.map(async ([path]) => { const r = await fetch(SITE + path); return [r.status, await r.text()]; }));
pages.forEach(([path, want, test], i) => { const [status, t] = got[i]; if (status === want && test.test(t)) ok(path + ' ' + status); else fail(path + ' answered ' + status); });

// 1. the owner is the owner
const me = await call('GET', '?me');
if (me.me && me.me.kind === 'owner') ok('the owner token is the owner'); else { fail('the owner token is not the owner (' + me.status + ')'); process.exit(1); }

// the team as the team page shows it: how many jobs wait, and each member's state (names, states and counts only)
const team = async (when) => {
  const sh = await call('GET', '');
  console.log('team ' + when + ': ' + sh.waiting + ' waiting; ' + ((sh.members || []).map((m) => m.name + ' ' + m.state + ' (done ' + (m.done || 0) + ')').join(', ') || 'no members'));
  return sh;
};
const before = await team('before');

// 2. what waits on the queue (counts by kind only) and the lost #work post
if (process.argv.includes('--queue')) {
  const r = await fetch(SITE + '/api/queue?state=queued&limit=500', { headers: { authorization: 'Bearer ' + OWNER } });
  const items = r.ok ? ((await r.json()).items || []) : [];
  const by = {}; for (const j of items) { const k = String(j.target || '').split(':')[0] || '(none)'; by[k] = (by[k] || 0) + 1; }
  const oldest = items.length ? items[0].at : '-';
  console.log('queue: ' + items.length + ' queued (oldest ' + String(oldest).slice(0, 10) + '): ' + Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' ' + n).join(', '));
  const q = await call('POST', '', { do: 'queue' });
  if (q.ok) ok('#work: ' + q.say); else fail('do:queue answered ' + q.status + ' ' + (q.say || ''));
}

// 3. two kinds of agent in one chat
const stamp = Date.now().toString(36).slice(-5), H = 'probe-http-' + stamp, M = 'probe-mcp-' + stamp;
const chan = await call('POST', '', { do: 'channel', code: 'check-in', about: 'Live checks: agents that join show they can talk here (tools/team-live.mjs).' });
if (chan.status === 201 || chan.status === 409) ok('#check-in is there'); else fail('#check-in: ' + chan.status + ' ' + (chan.say || ''));
const cleanup = async () => { for (const n of [H, M]) await call('POST', '', { do: 'remove', name: n }); };
try {
  const ih = await call('POST', '', { do: 'invite', name: H, about: 'a live check over plain HTTP', auto: false }); // jobs off from the start: a probe takes no job
  const im = await call('POST', '', { do: 'invite', name: M, about: 'a live check over MCP', auto: false });
  if (ih.status !== 201 || im.status !== 201) throw new Error('invite answered ' + ih.status + ' / ' + im.status);
  ok('two join links made (not shown)');
  // the HTTP agent: POST its link, keep the key in memory only
  const jr = await fetch(ih.join, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const jh = await jr.json().catch(() => ({}));
  if (jr.status !== 201 || !/^vt1\./.test(jh.key || '')) throw new Error('HTTP join answered ' + jr.status);
  ok(H + ' joined over plain HTTP');
  const used = await fetch(ih.join, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  if (used.status === 401) ok('a used link does not work twice'); else fail('a used link answered ' + used.status);
  // the MCP agent: the official SDK client, the join tool
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const client = new Client({ name: 'verse-team-live', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(SITE + '/team/mcp')));
  if (client.getServerVersion().name !== 'verse-team') throw new Error('MCP server is ' + JSON.stringify(client.getServerVersion()));
  const tool = async (name, args = {}) => { const r = await client.callTool({ name, arguments: args }); const t = (r.content || []).map((c) => c.text || '').join('\n'); if (r.isError) throw new Error(name + ': ' + t.slice(0, 160)); return t; };
  const joined = await tool('join', { link: im.join });
  if (/vt1\.[0-9a-f]{12}\./.test(joined)) throw new Error('the join tool showed a key');
  ok(M + ' joined over MCP (no key shown)');
  // they talk: MCP first, then HTTP, each @mentioning the other in #check-in
  await tool('post', { channel: 'check-in', text: '@' + H + ' ' + M + ' here, over MCP. Can you read me?' });
  const seen = await call('GET', '?c=check-in', '', jh.key);
  if ((seen.messages || []).some((m) => m.by === M && m.body.includes('@' + H))) ok(H + ' (HTTP) reads ' + M + ' (MCP) in #check-in'); else fail(H + ' did not see the MCP message');
  const act = await call('GET', '?activity', '', jh.key);
  if ((act.hits || []).some((m) => m.by === M)) ok('and it is in ' + H + '\'s mentions'); else fail('not in the HTTP agent\'s mentions');
  await new Promise((r) => setTimeout(r, 1200));
  const hp = await call('POST', '', { do: 'post', c: 'check-in', body: '@' + M + ' ' + H + ' here, over HTTP. Yes, I read you.' }, jh.key);
  if (hp.status === 201) ok(H + ' posted over HTTP'); else fail('HTTP post answered ' + hp.status);
  const mentions = await tool('mentions');
  if (mentions.includes(H)) ok(M + ' (MCP) sees ' + H + '\'s @mention'); else fail('the MCP agent did not see the mention');
  const read = await tool('read', { channel: 'check-in' });
  if (read.includes(H) && read.includes(M)) ok('both read the same #check-in history'); else fail('the MCP read is missing a message');
  const sh = await call('GET', '');
  const names = (sh.members || []).map((m) => m.name);
  if (names.includes(H) && names.includes(M)) ok('one workspace: ' + names.length + ' members, both probes named'); else fail('a probe is missing from the members');
  // push: the HTTP probe turns jobs off, then gives Verse a test address (a fresh webhook.site bin, deleted after). Verse sends it the first
  // push (hello, no job in it); the runner reads it back and checks the signature with the secret. Only yes or no is printed.
  if ((await client.listTools()).tools.some((t) => t.name === 'hook')) ok('the MCP server has the hook tool'); else fail('no hook tool over MCP');
  const off = await call('POST', '', { do: 'here', auto: false }, jh.key);
  if (off.ok && !off.job) ok(H + ' takes no jobs (auto off)'); else fail('auto off answered ' + off.status);
  let bin = null; try { const b = await fetch('https://webhook.site/token', { method: 'POST', headers: { accept: 'application/json' } }); bin = b.ok ? (await b.json()).uuid : null; } catch (_) { bin = null; }
  const where = bin ? 'https://webhook.site/' + bin : 'https://httpbin.org/status/204';
  const hk = await call('POST', '', { do: 'hook', url: where }, jh.key);
  if (hk.ok && hk.answered && /^[0-9a-f]{64}$/.test(hk.secret || '')) ok('push: Verse sent ' + H + '\'s address its first push and it answered 2xx (' + (bin ? 'a test bin' : 'httpbin') + ')'); else fail('push answered ' + hk.status + ' ' + (hk.say || '') + ' answered=' + hk.answered);
  if (bin) {
    try {
      await new Promise((r) => setTimeout(r, 1500));
      const rq = await (await fetch('https://webhook.site/token/' + bin + '/requests?sorting=newest', { headers: { accept: 'application/json' } })).json();
      const got = (rq.data || [])[0] || {}, hv = (k) => { const v = (got.headers || {})[k]; return Array.isArray(v) ? v[0] : v; };
      const body = String(got.content || ''), event = (() => { try { return JSON.parse(body).type; } catch (_) { return ''; } })();
      if (await hookVerify(hk.secret, hv('x-verse-time'), body, hv('x-verse-signature'), Date.now())) ok('push: the signature checks out with the secret (event ' + event + ', ' + (rq.data || []).length + ' push)'); else fail('push: the signature did not check out');
      if (event === 'hello' && !/"job"/.test(body)) ok('push: the probe was sent no job'); else fail('push: the first push was ' + event);
    } catch (e) { fail('push: could not read the test bin back (' + e.message + ')'); }
    await fetch('https://webhook.site/token/' + bin, { method: 'DELETE' }).catch(() => null);
  }
  const busy = (sh.members || []).filter((m) => (m.name === H || m.name === M) && m.state === 'busy');
  if (!busy.length) ok('the probes took no job (' + sh.waiting + ' still waiting)'); else fail('a probe holds a job');
  await client.close();
} catch (e) { fail(e.message); } finally { await cleanup(); ok('probes removed'); }

// 4. old keys stop now (the agents named): a new link is made and dropped; the owner makes the one to hand over on /team/
const retire = (arg('--retire', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const members = ((await call('GET', '')).members || []).map((m) => m.name.toLowerCase());
for (const n of retire) {
  if (!members.includes(n.toLowerCase())) { console.log('skip ' + n + ': not in the team'); continue; } // again: true on a new name would invite one
  const r = await call('POST', '', { do: 'invite', name: n, again: true });
  if (r.status === 201) ok(n + ': old key stopped (press New link beside ' + n + ' on /team/ for its join link)'); else console.log('skip ' + n + ': ' + r.status + ' ' + (r.say || ''));
}
const after = await team('after');
console.log('waiting: ' + before.waiting + ' before, ' + after.waiting + ' after');
if (!process.exitCode) console.log('team live: any agent joins, all in the same chat, at ' + SITE);
