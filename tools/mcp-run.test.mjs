// lib/mcp-run.js: a proven skill run on the server for its MCP tool. The skill's own run() gets a headless page, and the last card
// it drew is read back as plain text with the links it cites. Run: node --test tools/mcp-run.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textOf, linksOf, namedFetch, runSkill, serverYou, UA } from '../void-live-deploy/lib/mcp-run.js';

test('mcp-run: textOf turns a card into plain lines: headings, list items as "- ", named and numbered entities decoded, an unknown one kept, buttons and scripts dropped', () => {
  const html = '<h2>serendipity</h2><div class="sub">Noun</div><ol><li>A &ldquo;lucky&rdquo; find &amp; more</li><li>Two&#39;s &#x2014; dash</li></ol>'
    + '<button>Copy</button><script>x()</script><p>Line one<br>line two</p><input value="x"><p>&bogus; stays</p>';
  assert.equal(textOf(html), 'serendipity\nNoun\n- A \u201clucky\u201d find & more\n- Two\'s — dash\nLine one\nline two\n&bogus; stays');
  assert.equal(textOf(''), ''); assert.equal(textOf(null), '');
});

test('mcp-run: linksOf keeps the https sources a card cites, once each, and never the in-page asks', () => {
  const html = '<a href="https://en.wiktionary.org/wiki/x" target="_blank">Wiktionary</a> <a href="#" data-ask="more">more</a>'
    + '<a href="https://en.wiktionary.org/wiki/x">Wiktionary again</a><a href="http://plain.example/">plain</a><a href="https://a.example/?a=1&amp;b=2"><b>Bold</b> source</a>';
  assert.deepEqual(linksOf(html), [{ title: 'Wiktionary', url: 'https://en.wiktionary.org/wiki/x' }, { title: 'Bold source', url: 'https://a.example/?a=1&b=2' }]);
});

test('mcp-run: namedFetch names Verse in the user-agent, and keeps one the caller set', async () => {
  const seen = [];
  const f = namedFetch(async (u, o) => { seen.push(new Headers(o.headers).get('user-agent')); return new Response('ok'); });
  await f('https://a.example/'); await f('https://a.example/', { headers: { 'User-Agent': 'mine' } });
  assert.deepEqual(seen, [UA, 'mine']);
});

const skill = (run, match = () => true) => ({ name: 't', match, run });

test('mcp-run: runSkill reads back the last card the skill drew, with its sources and the name it returned', async () => {
  const mod = skill(async (text, api) => {
    const el = api.showPage((p) => { p.innerHTML = '<h2>…</h2>'; });
    await Promise.resolve();
    if (!api._pageStill(el)) return 't';
    el.innerHTML = '<h2>' + api.esc(text) + '</h2><p>The answer.</p><div class="src">Source: <a href="https://src.example/a">Src</a></div>';
    return 't';
  });
  const r = await runSkill(mod, '  a <b> ask  ');
  assert.deepEqual(r, { ok: true, src: 't', text: 'a <b> ask\nThe answer.\nSource: Src', html: r.html, links: [{ title: 'Src', url: 'https://src.example/a' }] });
});

test('mcp-run: runSkill refuses what the skill does not take, and says why it had no answer', async () => {
  assert.deepEqual(await runSkill(skill(() => 't'), 'x'), { ok: false, why: 'short', text: '' });
  assert.deepEqual(await runSkill(skill(() => 't', () => false), 'not mine'), { ok: false, why: 'not-this-skill', text: '' });
  assert.deepEqual(await runSkill(skill(() => 't', () => { throw new Error('bad'); }), 'a match that throws'), { ok: false, why: 'not-this-skill', text: '' });
  const none = await runSkill(skill((t, api) => { api.showPage((p) => { p.innerHTML = '<p>No such word.</p>'; }); return 'none'; }), 'define qqq');
  assert.deepEqual(none, { ok: false, why: 'none', text: 'No such word.' });
  assert.equal((await runSkill(skill(() => { throw new Error('boom'); }), 'it throws')).why, 'error');
  assert.equal((await runSkill(skill(() => 't'), 'no card drawn')).why, 'none', 'a skill that drew nothing has no answer');
  assert.equal((await runSkill(skill(() => new Promise(() => {})), 'never ends', { ms: 20 })).why, 'timeout');
});

test('mcp-run: the skill fetches through the caller\'s fetch, named as Verse', async () => {
  const seen = [];
  const fetchImpl = async (u, o) => { seen.push([u, new Headers(o.headers).get('user-agent')]); return Response.json({ v: 42 }); };
  const r = await runSkill(skill(async (t, api) => { const j = await (await api.fetch('https://data.example/v')).json(); api.showPage((p) => { p.innerHTML = '<p>' + j.v + '</p>'; }); return 't'; }), 'the value', { fetchImpl });
  assert.equal(r.text, '42'); assert.deepEqual(seen, [['https://data.example/v', UA]]);
});

test('mcp-run: a time "ahead of you" on a card is ahead of UTC on the server, the clock the MCP answer was worked out on', async () => {
  assert.equal(serverYou('4:30 AM Sat in Canberra, UTC+11:00 (11 h ahead of you)'), '4:30 AM Sat in Canberra, UTC+11:00 (11 h ahead of UTC)');
  assert.equal(serverYou('(3.5 h behind you) and (same time as you)'), '(3.5 h behind UTC) and (same time as UTC)');
  assert.equal(serverYou('what you asked for'), 'what you asked for');
  const r = await runSkill(skill((t, api) => { api.showPage((p) => { p.innerHTML = '<p>Tokyo (9 h ahead of you)</p>'; }); return 't'; }), 'time in tokyo');
  assert.equal(r.text, 'Tokyo (9 h ahead of UTC)');
});
