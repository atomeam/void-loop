// gh-file (skills/gh-file.js): which GitHub links it takes, the raw address it reads (fetch stubbed, nothing leaves the machine), the window of lines it shows with the linked ones lit, and each error card.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/gh-file.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
class Txt { constructor(t) { this.textContent = t; } }
class El {
  constructor(doc, tag) { this.ownerDocument = doc; this.tagName = tag; this.children = []; this.className = ''; this.dataset = {}; this._t = ''; this.scrollTop = 0; this.clientHeight = 100; this.offsetTop = 400; }
  appendChild(c) { this.children.push(c); return c; } append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  get textContent() { return this.children.length ? this.children.map((c) => c.textContent).join('') : this._t; } set textContent(v) { this.children = []; this._t = String(v); }
  all(cls) { const out = []; const walk = (n) => { for (const c of n.children || []) { if (c instanceof El) { if (c.className.split(' ').includes(cls)) out.push(c); walk(c); } } }; walk(this); return out; }
  querySelectorAll(s) { return this.all(s.slice(1)); } querySelector(s) { return this.all(s.slice(1))[0] || null; } remove() { this.removed = true; }
}
const doc = { createElement: (t) => new El(doc, t), createTextNode: (t) => new Txt(t) };
async function card(text, answer) {
  const asked = [], real = globalThis.fetch, el = new El(doc, 'div'), sub = new El(doc, 'div'), box = new El(doc, 'div'); let shown = 0;
  el.querySelector = (s) => (s === '.sub' ? sub : s === '.ghf-box' ? box : null);
  globalThis.fetch = async (u, o) => { asked.push([String(u), o && o.redirect]); if (answer instanceof Error) throw answer; return answer; };
  try { const r = await sk.run(text, { showPage: (fn) => { shown++; fn(el); return el; }, esc }); return { r, asked, html: el.innerHTML, sub, box, shown }; } finally { globalThis.fetch = real; }
}
const js = Array.from({ length: 100 }, (_, i) => 'const x' + (i + 1) + ' = ' + (i + 1) + '; // line ' + (i + 1)).join('\n') + '\n';

test('the asks: its examples and hand-written ones on both sides', () => {
  for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), e);
  for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), n);
  for (const t of ['github.com/a/b/blob/main/x.py', 'see https://raw.githubusercontent.com/a/b/v1.2/src/c.ts#L5', 'https://www.github.com/a/b/blob/abc123/docs/README.md?plain=1#L3-L1']) assert.ok(sk.match(t.toLowerCase(), t), t);
  for (const t of ['https://gist.github.com/a/b/blob/main/x', 'https://github.com/a/b/blob/main/../secret', 'https://github.com/a/b/tree/main/src', 'https://github.com/a/b/blob/main']) assert.ok(!sk.match(t.toLowerCase(), t), t);
});
test('a linked range: the raw address read, lines 20 to 99 shown and numbered, 30 to 32 lit, the box scrolled to them', async () => {
  const { r, asked, html, sub, box } = await card('https://github.com/o/r/blob/main/src/a.js#L30-L32', new Response(js));
  assert.equal(r, 'gh-file'); assert.deepEqual(asked, [['https://raw.githubusercontent.com/o/r/main/src/a.js', 'follow']]);
  assert.ok(html.includes('<h2>a.js</h2><div class="sub">o/r · reading it from GitHub…</div><div class="ghf-box"></div>'));
  assert.ok(html.includes('<a class="ghf-full" href="/g/?gh=o%2Fr%2Fmain%2Fsrc%2Fa.js&amp;L=30-32" target="_blank" rel="noopener">Open the whole file</a>'));
  assert.ok(html.includes('<a href="https://github.com/o/r/blob/main/src/a.js" target="_blank" rel="noopener">On GitHub</a>'));
  assert.equal(sub.textContent, 'o/r · 100 lines · showing 20–99');
  assert.equal(box.querySelector('.ln').textContent, Array.from({ length: 80 }, (_, i) => 20 + i).join('\n'));
  const lit = box.querySelectorAll('.lit');
  assert.deepEqual(lit.map((x) => x.dataset.line), ['11', '12', '13']);
  assert.deepEqual(lit.map((x) => x.textContent), ['const x30 = 30; // line 30', 'const x31 = 31; // line 31', 'const x32 = 32; // line 32']);
  assert.equal(lit[0].children[0].className, 'k'); assert.equal(lit[0].children[0].textContent, 'const');
  assert.ok(lit[0].children.some((c) => c.className === 'c' && c.textContent === '// line 30'));
  const code = box.children[0].children[1], rows = code.children.filter((c) => c instanceof El);
  assert.equal(box.children[0].className, 'gist-pre'); assert.equal(rows.length, 80);
  assert.equal(rows[0].textContent, 'const x20 = 20; // line 20'); assert.equal(rows[79].textContent, 'const x99 = 99; // line 99');
  assert.equal(box.scrollTop, 350);
});
test('a raw link with no range: the top of a short file, every line, nothing lit; one line is "1 line"', async () => {
  let c = await card('https://raw.githubusercontent.com/o/r/main/README.md', new Response('# Hi\nsecond\nthird\n'));
  assert.equal(c.asked[0][0], 'https://raw.githubusercontent.com/o/r/main/README.md');
  assert.equal(c.sub.textContent, 'o/r · 3 lines'); assert.equal(c.box.querySelector('.ln').textContent, '1\n2\n3');
  assert.equal(c.box.querySelectorAll('.lit').length, 0); assert.equal(c.box.scrollTop, 0);
  assert.ok(c.html.includes('href="/g/?gh=o%2Fr%2Fmain%2FREADME.md"'));
  c = await card('https://github.com/o/r/blob/main/one.txt', new Response('only'));
  assert.equal(c.sub.textContent, 'o/r · 1 line');
});
test('the error cards: not there, not sent, unreachable, not text; the box goes', async () => {
  const cases = [[new Response('', { status: 404 }), 'GitHub has no public file there (a private repo, a wrong branch or a wrong path).'],
    [new Response('', { status: 503 }), 'GitHub did not send the file just now (503).'],
    [new Error('offline'), 'GitHub could not be reached just now.'],
    [new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 1])), 'That is not a text file (an image or a program): open it on GitHub.'],
    [new Response('x'.repeat(400001)), 'That file is over 400 KB: open it on GitHub.']];
  for (const [answer, words] of cases) {
    const c = await card('https://github.com/o/r/blob/main/logo.png', answer);
    assert.equal(c.r, 'gh-file'); assert.equal(c.sub.textContent, words); assert.equal(c.box.removed, true, words); assert.equal(c.box.children.length, 0);
  }
});
test('not a file link: nothing shown, nothing fetched; a page that shows nothing stops before the fetch', async () => {
  let c = await card('https://github.com/atomeam/void-loop', new Response('x'));
  assert.equal(c.r, 'none'); assert.equal(c.shown, 0); assert.deepEqual(c.asked, []);
  const real = globalThis.fetch; let fetched = 0; globalThis.fetch = async () => { fetched++; return new Response('x'); };
  try { assert.equal(await sk.run('https://github.com/o/r/blob/main/a.js', { showPage: () => null, esc }), 'gh-file'); } finally { globalThis.fetch = real; }
  assert.equal(fetched, 0);
});
