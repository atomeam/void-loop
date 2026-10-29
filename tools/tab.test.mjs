// tab (skills/tab.js): the extension side panel's card for the tab you point Verse at. A stage kind, not an ask matcher (every ask refused).
// The card as drawn for a tab (title, address with a lock for https, selection, the context check's one suggestion, where the draft goes),
// and what its controls do on a stub bridge: the draft box, "put in the page", "draft for me" (what is sent, what comes back, what the card
// says), and a proposed step. The stub DOM keeps the card's HTML as text and reads the draft buttons from it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/tab.js';

class El {
  constructor(tag) { this.tagName = tag; this.kids = []; this.on = {}; this.dataset = {}; this.style = { cssText: '' }; this.className = ''; this.textContent = ''; this.value = ''; this.isConnected = true; this.q = {}; }
  set innerHTML(v) { this._html = v; } get innerHTML() { return this._html || ''; }
  addEventListener(t, f) { (this.on[t] ||= []).push(f); } fire(t, e = {}) { return Promise.all((this.on[t] || []).map((f) => f(e))); }
  appendChild(c) { this.kids.push(c); return c; }
  querySelector(s) { if (!/^\.[\w-]+$/.test(s) || !this.innerHTML.includes('class="' + s.slice(1))) return null; return (this.q[s] ||= Object.assign(new El('x'), { className: s.slice(1) })); }
  querySelectorAll(s) { if (s !== '.tab-ask button') return []; return (this.q[s] ||= [...this.innerHTML.matchAll(/<button type="button" class="tab-ask-(\w+) vcopy" data-intent="\w+"( disabled)?/g)].map(([, k, d]) => Object.assign(new El('button'), { dataset: { intent: k }, disabled: !!d }))); }
}
globalThis.document = { createElement: (t) => new El(t) };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function cardOf(tab, ext0 = {}, sel = null) {
  const calls = { drafts: [], proposed: [], fromTab: [] }, shown = [];
  const ext = { tab, draft: '', sent: '', ...ext0 };
  const bridge = { state: ext, esc, draft: async (v) => { calls.drafts.push(v); return 'ok'; }, draftSaid: (r) => 'put: ' + r, stepsOf: (v) => calls.steps(v), propose: (x) => { calls.proposed.push(x); return calls.panel !== false; },
    ACT_WHY: { 'bad-step': 'not a step', 'too-many': 'three at most' }, DRAFT_WHY: { 'no-panel': 'open the panel first' }, boxName: (f) => 'box ' + f.name, proposalFromTab: (...a) => calls.fromTab.push(a) };
  const drags = [], th = { id: 't1', x: 7, y: 9 };
  sk.stageKinds.tab.mount(th, { ext: bridge, selected: () => sel, bindDrag: (el, t) => drags.push([el, t]), stage: { appendChild: (el) => shown.push(el) } });
  const el = shown[0], body = el.kids[1], q = (s) => body.querySelector(s);
  return { el, head: el.kids[0], body, html: body.innerHTML, q, ext, calls, drags, th, said: q('.tab-said'), foot: q('.tab-foot'), ta: q('.tab-draft'), asks: body.querySelectorAll('.tab-ask button') };
}

test('not an ask matcher: every ask refused, run answers none, one stage kind', async () => {
  assert.deepEqual(sk.examples, []); assert.deepEqual(sk.nearMisses, []);
  for (const a of ['tab', 'this tab', 'open a new tab', 'draft a reply']) assert.equal(sk.match(a.toLowerCase(), a), false, a);
  assert.equal(await sk.run('tab', {}), 'none'); assert.deepEqual(Object.keys(sk.stageKinds), ['tab']);
});
test('no tab yet: just the header, placed and draggable, outlined when selected', () => {
  const c = cardOf(null, {}, 't1');
  assert.equal(c.head.textContent, 'this tab · stays in this browser'); assert.equal(c.html, ''); assert.equal(c.el.className, 'thing tab-card'); assert.equal(c.el.dataset.id, 't1');
  assert.match(c.el.style.cssText, /left:7px;top:9px;width:320px/); assert.equal(c.el.style.outline, '1px solid rgba(255,255,255,0.25)'); assert.deepEqual(c.drags, [[c.el, c.th]]);
  assert.equal(cardOf(null).el.style.outline, undefined);
});
test('a readable https page with a selection and a box: escaped title, host with a lock, the selection, a summary suggestion', () => {
  const c = cardOf({ title: 'A <b> page', url: 'https://example.com/x?y=1', selection: 'quoted & sel', readable: true, field: { name: 'Reply', tag: 'textarea' }, content: { text: 5000 } }, { draft: 'kept draft' });
  assert.ok(c.html.startsWith('<div class="tab-title">A &lt;b&gt; page</div><div class="tab-host"><svg class="tab-lock"'));
  assert.ok(c.html.includes('</svg>example.com</div>')); assert.ok(c.html.includes('<blockquote class="tab-sel"><mark>quoted &amp; sel</mark></blockquote>'));
  assert.ok(!c.html.includes('nothing selected')); assert.ok(!c.html.includes('Chrome keeps extensions out'));
  assert.ok(c.html.includes('mostly text · try <a href="#" class="tab-suggest" data-intent="summary">draft for me: summary</a>'));
  assert.deepEqual(c.asks.map((b) => [b.dataset.intent, b.disabled]), [['reply', false], ['summary', false], ['notes', false], ['rewrite', false], ['proposal', false]]);
  assert.ok(c.html.includes('goes into: Reply')); assert.equal(c.ta.value, 'kept draft'); assert.equal(c.foot.textContent, 'Not saved, not sent anywhere. You press send on the page yourself.');
});
test('an unreadable http page with nothing selected: no lock, says so, rewrite waits for a selection, a table suggestion', () => {
  const c = cardOf({ title: '', url: 'http://plain.test/', selection: '', readable: false, content: { text: 600, rows: 12, cells: 40 } }, { sent: 'The title went out.' });
  assert.ok(c.html.startsWith('<div class="tab-title">plain.test</div><div class="tab-host">plain.test</div>'), 'the host stands in for a missing title');
  assert.ok(c.html.includes('nothing selected')); assert.ok(c.html.includes('Chrome keeps extensions out of this page: only its title and address came through.'));
  assert.ok(c.html.includes('mostly a table · try <a href="#" data-ask="make a list">make a list to check off</a>'));
  assert.ok(c.html.includes('data-intent="rewrite" disabled title="select the text to rewrite first"')); assert.equal(c.asks.find((b) => b.dataset.intent === 'rewrite').disabled, true);
  assert.ok(c.html.includes('goes into the box you click on the page')); assert.equal(c.foot.textContent, 'Not saved. The title went out. You press send on the page yourself.');
  const odd = cardOf({ title: '', url: 'not a url', readable: true }); assert.ok(odd.html.startsWith('<div class="tab-title">not a url</div><div class="tab-host"></div>')); assert.ok(!odd.html.includes('tab-context'));
});
test('the draft box and "put in the page"', async () => {
  const c = cardOf({ title: 't', url: 'https://a.test/', readable: true }), put = c.q('.tab-put');
  c.ta.value = 'hello'; await c.ta.fire('input'); assert.equal(c.ext.draft, 'hello', 'typing keeps the draft across redraws');
  c.ta.value = '   '; await put.fire('click'); assert.equal(c.said.textContent, 'write the draft first'); assert.deepEqual(c.calls.drafts, []);
  c.ta.value = 'Dear team'; await put.fire('click'); assert.deepEqual(c.calls.drafts, ['Dear team']); assert.equal(c.said.textContent, 'put: ok');
});
test('draft for me: what goes to Verse, the draft that comes back, and the reply for a box becomes a proposed fill', async () => {
  const sent = []; let answer = { status: 200, j: { draft: 'Hi\nthere\nall', model: 'rules', masked: true, cut: true } };
  globalThis.fetch = async (url, o) => { sent.push([url, o.method, JSON.parse(o.body)]); return { ok: answer.status < 300, status: answer.status, json: async () => answer.j }; };
  const tab = { title: 'Mail', url: 'https://mail.test/1', selection: 'their note', readable: true, field: { name: 'Reply', tag: 'textarea' } }, c = cardOf(tab), reply = c.asks[0];
  c.ta.value = '  ' + 'n'.repeat(400) + '  '; await reply.fire('click');
  assert.deepEqual(sent[0], ['/api/answer', 'POST', { mode: 'draft', intent: 'reply', title: 'Mail', url: 'https://mail.test/1', selection: 'their note', note: 'n'.repeat(300) }]);
  assert.equal(c.ta.value, 'Hi\nthere\nall'); assert.equal(c.ext.draft, 'Hi\nthere\nall'); assert.equal(c.ta.rows, 4);
  assert.equal(c.said.textContent, 'reply from Verse (by rule, no model just now; keys in the text were masked; the selection was cut) · put it in the page, or copy it');
  assert.equal(c.ext.sent, 'The title, address and selection were sent to a-to-mind.com for a reply draft · not kept there.'); assert.equal(c.foot.textContent, 'Not saved. ' + c.ext.sent + ' You press send on the page yourself.');
  assert.deepEqual(c.calls.proposed, [{ action: 'fill', label: 'box Reply', box: 'mine', text: 'Hi\nthere\nall', auto: true }]);
  answer = { status: 200, j: { draft: 'Short.' } }; await c.asks[1].fire('click'); assert.equal(c.said.textContent, 'summary from Verse · put it in the page, or copy it'); assert.equal(c.ta.rows, 3); assert.equal(c.calls.proposed.length, 1, 'only a reply is proposed');
  answer = { status: 429, j: { note: 'Too many drafts this hour.' } }; await c.asks[2].fire('click'); assert.equal(c.said.textContent, 'Too many drafts this hour.'); assert.equal(c.ta.value, 'Short.');
  answer = { status: 500, j: null }; await c.asks[2].fire('click'); assert.equal(c.said.textContent, 'Verse couldn’t draft just now. Try again in a moment.');
  const n = sent.length; await c.asks[4].fire('click'); assert.equal(sent.length, n, 'a proposal is not sent from here'); assert.equal(c.calls.fromTab.length, 1); assert.equal(c.calls.fromTab[0][0], tab); assert.equal(c.calls.fromTab[0][1], c.said);
});
test('a step for Verse: kept while typed, refused with the reason, or asked in the panel', async () => {
  const c = cardOf({ title: 't', url: 'https://a.test/', readable: true }, { stepText: 'click Save' }), step = c.q('.tab-step'), go = c.q('.tab-propose'), says = c.q('.tab-act-said');
  assert.equal(step.value, 'click Save'); step.value = 'fill Reply with hi; click Send'; await step.fire('input'); assert.equal(c.ext.stepText, 'fill Reply with hi; click Send');
  c.calls.steps = () => 'too-many'; await go.fire('click'); assert.equal(says.textContent, 'three at most');
  c.calls.steps = () => null; await go.fire('click'); assert.equal(says.textContent, 'not a step');
  c.calls.steps = (v) => [{ action: 'click', label: v }]; await go.fire('click'); assert.equal(says.textContent, 'asking you in the panel…'); assert.deepEqual(c.calls.proposed, [[{ action: 'click', label: 'fill Reply with hi; click Send' }]]);
  c.calls.panel = false; await go.fire('click'); assert.equal(says.textContent, 'open the panel first');
  let stopped = 0; const ev = (hit) => ({ target: { closest: () => hit }, stopPropagation: () => { stopped++; } });
  await c.body.fire('pointerdown', ev({})); await c.body.fire('pointerdown', ev(null)); assert.equal(stopped, 1, 'only presses in the controls stay off the drag');
});
