// lib/toolkit.js: the tools that go together, one accent colour for all of them, and text that reads on it
import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, RELATED, relatedOf, hexOf, inkOn, accent, setAccent, ACCENT_KEY, routeAsk } from '../void-live-deploy/lib/toolkit.js';
import fs from 'node:fs';

test('every tool page is linked to at least one other, only to tools that exist, never to itself, and the page carries the row', () => {
  for (const [p, rel] of Object.entries(RELATED)) {
    assert.ok(TOOLS[p], p); assert.ok(rel.length >= 1, p); assert.ok(!rel.includes(p), p);
    for (const r of rel) assert.ok(TOOLS[r], p + ' -> ' + r);
    let html = fs.readFileSync(new URL('../void-live-deploy' + p + 'index.html', import.meta.url), 'utf8');
    // a page whose code is in files of its own: a module script, an import() after load, or a plain script file (an external start file, no inline script, so the page needs no content-security rule) that imports the page's code; followed two files deep
    const seen = new Set(); let scan = html; for (let depth = 0; depth < 2; depth++) { let more = ''; for (const m of scan.matchAll(/<script (?:type="module" )?src="(\/[^"]+)"|\bimport\('(\/[a-z0-9-]+\/[a-z0-9-]+\.js)'\)|\bimport '(\/[a-z0-9-]+\/[a-z0-9-]+\.js)'/g)) { const f = m[1] || m[2] || m[3]; if (seen.has(f)) continue; seen.add(f); more += fs.readFileSync(new URL('../void-live-deploy' + f, import.meta.url), 'utf8'); } html += more; scan = more; }
    assert.match(html, /<nav id="related"/, p); assert.match(html, /mountRelated\([^,]+, '(?:\/[a-z0-9-]+)+\/'/, p);
  }
  for (const p of Object.keys(TOOLS)) assert.ok(RELATED[p], p + ' has related tools');
  assert.deepEqual(relatedOf('/random-user/')[0], { href: '/wheel/', label: 'Wheel of names' }); assert.deepEqual(relatedOf('/nope/'), []);
});
test('colours: hex in any short form, and the text that reads on it', () => {
  assert.equal(hexOf('#F53'), '#ff5533'); assert.equal(hexOf('6d4aff'), '#6d4aff'); assert.equal(hexOf('red'), null); assert.equal(hexOf('#12345'), null);
  assert.equal(inkOn('#ffff00'), '#111111'); assert.equal(inkOn('#1a1a40'), '#ffffff'); assert.equal(inkOn('#6d4aff'), '#ffffff');
});
test('the accent is kept on this device and put on the page; a bad colour is refused; null takes it away', () => {
  const mem = new Map(); globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const props = new Map(), root = { style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) } };
  assert.equal(accent(root), null); assert.equal(setAccent('nope', root), false);
  assert.equal(setAccent('#ff0', root), true); assert.equal(mem.get(ACCENT_KEY), '#ffff00'); assert.equal(props.get('--accent'), '#ffff00'); assert.equal(props.get('--on-accent'), '#111111');
  assert.equal(accent(root), '#ffff00'); assert.equal(setAccent(null, root), true); assert.equal(accent(root), null); assert.equal(props.has('--accent'), false);
  delete globalThis.localStorage;
});

test('the ask bar routes an ask to the tool that does it, with the ask in the link, and anything else to the stage', () => {
  const to = (a) => routeAsk(a);
  assert.equal(to('100 c to f'), '/convert/?q=100%20c%20to%20f'); assert.equal(to('flip a coin'), '/flip/'); assert.equal(to('weather in boston'), '/weather/?q=boston');
  assert.equal(to('time in tokyo'), '/time/?q=tokyo'); assert.equal(to('is it christmas?'), '/is-it/christmas'); assert.equal(to('a password of 20'), '/password/?len=20');
  assert.equal(to('how strong is Tr0ub4dor&3'), '/password-strength/', 'the typed password stays out of the address'); assert.equal(to('decode aGVsbG8='), '/base64/?mode=decode&t=aGVsbG8%3D'); assert.equal(to('encode hello'), '/base64/?t=hello');
  assert.equal(to('255 in hex'), '/base-converter/?v=255&b=16'); assert.equal(to('#ff5733'), '/color/?c=ff5733'); assert.equal(to('17% of 240'), '/calculator/?q=17%25%20of%20240');
  assert.equal(to('5 min timer'), '/stopwatch/?t=5%20min'); assert.equal(to('3 fake people'), '/random-user/?n=3'); assert.equal(to('count the words in a b c'), '/word-count/?t=a%20b%20c');
  assert.equal(to('who is the mayor of boston'), '/?q=who%20is%20the%20mayor%20of%20boston'); assert.equal(to('  '), '');
});

test('every tool page links to its own card on the stage, and every page has a card that links back (owner, 2026-10-25: "and vice versa")', async () => {
  const { CARD_ASK, cardLinkOf } = await import('../void-live-deploy/lib/toolkit.js');
  const { PAGE_PATHS, pageOfCard } = await import('../void-live-deploy/lib/card-frame.js');
  for (const p of Object.keys(TOOLS)) {
    assert.ok(CARD_ASK[p], p + ' has a stage ask'); assert.equal(cardLinkOf(p), '/?q=' + encodeURIComponent(CARD_ASK[p]));
    assert.ok(PAGE_PATHS[p], p + ' is linked from a card (PAGE_OF)');
  }
  assert.equal(cardLinkOf('/nope/'), '');
  assert.deepEqual(pageOfCard('', '/color/'), ['/color/', 'Colour codes']);
  assert.equal(pageOfCard('', 'https://evil.example/'), null, 'only a known page is linked');
  assert.deepEqual(pageOfCard('calendar', ''), ['/calendar/', 'Calendar']);
  // the row puts the card link first
  const { mountRelated } = await import('../void-live-deploy/lib/toolkit.js');
  const made = []; const mk = (tag) => { const n = { tag, children: [], className: '', href: '', textContent: '', style: {}, append(...c) { this.children.push(...c); }, prepend(...c) { this.children.unshift(...c); }, setAttribute() {}, addEventListener() {}, replaceChildren(...c) { this.children = c; } }; made.push(n); return n; };
  const host = mk('nav'); host.ownerDocument = { createElement: mk, defaultView: {} };
  mountRelated(host, '/flip/');
  const row = host.children.find((c) => c.className === 'tk-row'), links = row.children.filter((c) => c.tag === 'a');
  assert.equal(links[0].className, 'tk-card'); assert.equal(links[0].href, '/?q=flip%20a%20coin');
});

test('the colour page\'s card opens on the colour open there, not the example, and follows it as it changes', async () => {
  const { mountRelated, cardLinkOf } = await import('../void-live-deploy/lib/toolkit.js');
  const mk = (tag) => { const on = {}; return { tag, on, children: [], className: '', href: '', textContent: '', style: {}, append(...c) { this.children.push(...c); }, prepend(...c) { this.children.unshift(...c); }, setAttribute() {}, addEventListener(ev, fn) { (on[ev] ||= []).push(fn); }, replaceChildren(...c) { this.children = c; } }; };
  const cardOf = (card) => { const host = mk('nav'); host.ownerDocument = { createElement: mk, defaultView: {} }; mountRelated(host, '/color/', [], { card }); return host.children.find((c) => c.className === 'tk-row').children.find((c) => c.className === 'tk-card'); };
  let hex = 'f5be3d'; const x = cardOf(() => 'color #' + hex);
  assert.equal(x.href, '/?q=color%20%23f5be3d', 'the colour open now');
  hex = '3d6bf5'; for (const fn of x.on.pointerdown) fn(); assert.equal(x.href, '/?q=color%20%233d6bf5', 'worked out again when pressed');
  hex = '00ff88'; for (const fn of x.on.click) fn(); assert.equal(x.href, '/?q=color%20%2300ff88', 'and on click (keyboard)');
  assert.equal(cardOf(() => '').href, cardLinkOf('/color/'), 'nothing open: the example');
  assert.equal(cardOf(() => { throw new Error('broken'); }).href, cardLinkOf('/color/'), 'a broken page: the example');
  const src = fs.readFileSync(new URL('../void-live-deploy/color/index.html', import.meta.url), 'utf8');
  assert.match(src, /card:\s*\(\)\s*=>\s*'color #'\s*\+\s*curHex\(\)/, 'the colour page gives its card the colour open on it');
});

// the stage link on a page with a card follows the page live, so a hover already shows the card for what is open (owner via the team, 2026-10-29)
const fakeRow = (path, card) => {
  const docOn = {}, winOn = {}, mk = (tag) => { const on = {}; return { tag, on, children: [], className: '', href: '', textContent: '', style: {}, append(...c) { this.children.push(...c); }, prepend(...c) { this.children.unshift(...c); }, setAttribute() {}, addEventListener(ev, fn) { (on[ev] ||= []).push(fn); }, replaceChildren(...c) { this.children = c; } }; };
  const host = mk('nav'); host.ownerDocument = { createElement: mk, addEventListener: (ev, fn) => (docOn[ev] ||= []).push(fn), defaultView: { addEventListener: (ev, fn) => (winOn[ev] ||= []).push(fn) } };
  return import('../void-live-deploy/lib/toolkit.js').then(({ mountRelated }) => { mountRelated(host, path, [], { card }); const x = host.children.find((c) => c.className === 'tk-row').children.find((c) => c.className === 'tk-card'); return { x, fire: (ev) => (docOn[ev] || []).forEach((f) => f()), win: (ev) => (winOn[ev] || []).forEach((f) => f()) }; });
};
test('the stage link follows the page as it changes, with no press: after a click, an input, a key, a drag, a new address, and when pointed at', async () => {
  let hex = 'f5be3d'; const { x, fire, win } = await fakeRow('/color/', () => 'color #' + hex);
  for (const [ev, h, how] of [['click', '7b5f1f', fire], ['input', '3d6bf5', fire], ['keyup', '00ff88', fire], ['pointerup', '112233', fire], ['hashchange', 'abcdef', win]]) {
    hex = h; how(ev); assert.equal(x.href, '/?q=color%20%23' + h, 'after ' + ev + ' on the page');
  }
  hex = '445566'; for (const fn of x.on.pointerenter) fn(); assert.equal(x.href, '/?q=color%20%23445566', 'pointed at: a hover shows the colour open now');
  hex = '778899'; fire('tk:card'); assert.equal(x.href, '/?q=color%20%23778899', 'a page that changes with no event of its own says so with tk:card');
});

// a hand-off link carries the page's value in its href from the start, not "#" until a press, so a hover, a long press or a copied link goes there
const fakeHands = (handoffs) => {
  const docOn = {}, mk = (tag) => { const on = {}, attr = {}; return { tag, on, attr, children: [], className: '', href: '', textContent: '', style: {}, append(...c) { this.children.push(...c); }, prepend(...c) { this.children.unshift(...c); }, setAttribute(k, v) { attr[k] = v; }, addEventListener(ev, fn) { (on[ev] ||= []).push(fn); }, replaceChildren(...c) { this.children = c; } }; };
  const host = mk('nav'); host.ownerDocument = { createElement: mk, addEventListener: (ev, fn) => (docOn[ev] ||= []).push(fn), defaultView: { addEventListener() {} } };
  return import('../void-live-deploy/lib/toolkit.js').then(({ mountRelated }) => { mountRelated(host, '/weather/', handoffs); const xs = host.children.find((c) => c.className === 'tk-row').children.filter((c) => c.className === 'tk-hand'); return { xs, fire: (ev) => (docOn[ev] || []).forEach((f) => f()) }; });
};
test('a hand-off link reads its place before any press, follows the page as it changes, and reads as off while there is nothing to carry', async () => {
  let place = null; const { xs: [x], fire } = await fakeHands([{ label: 'The time in this place', href: () => (place ? '/time/?c=' + encodeURIComponent(place) : null) }]);
  assert.equal(x.href, '#'); assert.equal(x.attr['aria-disabled'], 'true', 'nothing shown yet: off, not a link to nowhere');
  let stopped = false; x.on.click[0]({ preventDefault() { stopped = true; } }); assert.ok(stopped, 'a press with nothing to carry goes nowhere');
  place = 'Paris'; fire('tk:card'); assert.equal(x.href, '/time/?c=Paris', 'the forecast came back: the link reads Paris with no press'); assert.equal(x.attr['aria-disabled'], 'false');
  place = 'Oslo'; fire('input'); assert.equal(x.href, '/time/?c=Oslo', 'after an input on the page');
  place = 'Rome'; for (const fn of x.on.pointerenter) fn(); assert.equal(x.href, '/time/?c=Rome', 'pointed at');
});
test('a hand-off that writes something (the wheel\'s palette) writes it on a press only, never on a hover or a page change, and no page writes in href', async () => {
  let wrote = 0, ok = true; const { xs: [x], fire } = await fakeHands([{ label: 'Paint the wheel', href: () => '/wheel/', go: () => { wrote++; return ok; } }]);
  for (const fn of x.on.pointerenter) fn(); fire('input'); fire('click'); assert.equal(wrote, 0, 'aimed three times, nothing written');
  let stopped = false; x.on.click[0]({ preventDefault() { stopped = true; } }); assert.equal(wrote, 1); assert.equal(stopped, false, 'written, then the link is followed');
  ok = false; stopped = false; x.on.click[0]({ preventDefault() { stopped = true; } }); assert.ok(stopped, 'a write that fails keeps the person here');
  for (const f of fs.readdirSync(new URL('../void-live-deploy/', import.meta.url))) {
    const u = new URL('../void-live-deploy/' + f + '/index.html', import.meta.url); if (!fs.existsSync(u)) continue;
    assert.doesNotMatch(fs.readFileSync(u, 'utf8'), /href: \(\) => (?:(?!, go:)[^}\n])*setPalette\(/, f + ': href is read on every hover and page change, so a write goes in go');
  }
});

// skills/index.json order, first match wins, as on the stage
async function firstSkill(ask) {
  const names = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8')), mods = [];
  for (const n of names) { const u = new URL('../void-live-deploy/skills/' + n + '.js', import.meta.url), sk = (await import(u.href)).default; mods.push(...(sk.family ? sk.members : [sk])); }
  const k = mods.find((s) => s.match(ask.toLowerCase(), ask)); return k ? k.name : null;
}

test('the gradient page\'s card opens on the gradient open there: every stop, its opacity and place, the angle and the type, not red to blue', async () => {
  const G = await import('../void-live-deploy/lib/gradient.js');
  const many = [G.normal({ type: 'linear', angle: 135, stops: [{ color: '#ff5f6d', pos: 0 }, { color: 'rgba(10, 20, 30, 0.5)', pos: 40 }, { color: '#ffc371', pos: 100 }] }),
    G.normal({ type: 'radial', shape: 'circle', stops: [{ color: '#6d4aff', pos: 10 }, { color: '#000', pos: 90 }] }), G.normal({ type: 'conic', angle: 45, stops: [{ color: 'red', pos: 0 }, { color: 'lime', pos: 50 }, { color: 'blue', pos: 100 }] }), ...G.PRESETS.map((p) => G.normal(p.g))];
  for (const g of many) { const ask = 'css gradient ' + G.css(g), back = G.askGradient(ask); assert.ok(back, ask); assert.equal(G.css(back.g), G.css(g), 'the card draws the same gradient: ' + ask); }
  const ask = 'css gradient ' + G.css(many[0]); assert.equal(await firstSkill(ask), 'gradient', 'the stage gives it to the gradient skill');
  assert.equal(G.askGradient('gradient descent'), null); assert.ok(G.askGradient('gradient from red to blue'), 'the old asks still work');
  const src = fs.readFileSync(new URL('../void-live-deploy/gradient/index.html', import.meta.url), 'utf8');
  assert.match(src, /card:\s*\(\)\s*=>\s*'css gradient '\s*\+\s*css\(g\)/, 'the gradient page gives its card the gradient open on it');
});

test('the wheel page\'s card opens on the wheel open there: every entry and weight, in words when they read back, else in its link form', async () => {
  const W = await import('../void-live-deploy/lib/wheel.js');
  const plain = [{ label: 'pizza', weight: 1 }, { label: 'tacos', weight: 3 }, { label: 'sushi', weight: 1 }], hard = [{ label: 'salt and pepper', weight: 1 }, { label: 'a, b', weight: 2 }, { label: 'Zoë', weight: 1 }];
  assert.equal(W.askOf(plain), 'spin the wheel with pizza, tacos*3, sushi', 'in words');
  assert.match(W.askOf(hard), /^spin the wheel #[A-Za-z0-9_-]+$/, '"and" or a comma in a name: the link form');
  for (const e of [plain, hard]) { const back = W.askWheel(W.askOf(e)); assert.ok(back, W.askOf(e)); assert.equal(W.textOf(back.entries), W.textOf(e), 'the card spins the same entries'); assert.equal(await firstSkill(W.askOf(e)), 'wheel', 'the stage gives it to the wheel skill'); }
  assert.equal(W.askOf([{ label: 'one', weight: 1 }]), '', 'one entry: nothing to spin, the example');
  assert.equal(W.askWheel('wheel alignment near me'), null); assert.equal(W.askWheel('spin the wheel #!!'), null);
  const src = fs.readFileSync(new URL('../void-live-deploy/wheel/index.html', import.meta.url), 'utf8');
  assert.match(src, /card:\s*\(\)\s*=>\s*askOf\(entries\)/, 'the wheel page gives its card the entries open on it');
});

test('the translate page\'s card translates the text in the box, exactly as typed, between the page\'s own languages; no word in it sends it to another skill', async () => {
  const C = await import('../void-live-deploy/lib/translate-card.js'), T = (await import('../void-live-deploy/skills/translate.js')).default;
  const texts = ['hello', 'I hate rainy weather, will it rain tomorrow?', 'tip 20% on 50', 'is it christmas in french', 'line one\nline two', 'Zoë’s café 😀 日本', '"quoted" #tag', 'set a timer for 5 minutes', 'what is cat in german'];
  const pairs = [['auto', 'es', undefined, 'spanish'], ['en', 'fr', 'english', 'french'], ['de', 'zh', 'german', 'chinese'], ['auto', 'tl', undefined, 'filipino'], ['af', 'ja', undefined, 'japanese']];
  for (const t of texts) for (const [from, to, fromName, toName] of pairs) {
    const ask = C.cardAsk(t, from, to); assert.match(ask, /^translate #[A-Za-z0-9_-]+( from [a-z]+)? to [a-z]+$/, t);
    assert.equal(await firstSkill(ask), 'translate', 'the stage gives it to the translate skill: ' + t);
    const p = T.translateOf(ask); assert.equal(p.q, t.trim(), 'the card translates this text, as typed'); assert.equal(p.to, toName); assert.equal(p.from, fromName, 'from the page\'s language, or detected when the stage has no name for it');
  }
  assert.equal(C.cardAsk('', 'auto', 'es'), '', 'an empty box: the example'); assert.equal(C.cardAsk('  \n ', 'auto', 'es'), '');
  assert.equal(C.cardAsk('hello', 'auto', 'af'), '', 'a language the stage cannot ask for: the example');
  assert.equal(C.cardAsk('x'.repeat(1001), 'auto', 'es'), '', 'past 1000 characters: the example, so a long text does not go in a link');
  assert.equal(T.translateOf('translate #blessed to spanish').q, '#blessed', 'a typed tag is not a card code'); assert.equal(T.translateOf('translate hello to spanish').q, 'hello');
  const src = fs.readFileSync(new URL('../void-live-deploy/translate/index.html', import.meta.url), 'utf8');
  assert.match(src, /card:\s*\(\)\s*=>\s*C\.cardAsk\(\$\('in'\)\.value,\s*state\.from,\s*state\.to\)/, 'the page gives its card the text box and its two languages');
});

test('the random page\'s card draws from the range on the page, not 1 to 100, and the card\'s page link opens the page on that range', async () => {
  const R = await import('../void-live-deploy/lib/random-card.js'), { pageOfCard } = await import('../void-live-deploy/lib/card-frame.js');
  const src = fs.readFileSync(new URL('../void.html', import.meta.url), 'utf8');
  // the stage's own parser for "random number between a and b" (void.html chanceOf), read from the page so a change there is caught here
  const line = src.split('\n').find((l) => l.includes('think\\s+of') && l.includes('random\\s+number')), re = new RegExp(/m = l\.match\(\/(.+)\/\);/.exec(line)[1]);
  for (const [a, b, lo, hi] of [['1', '100', 1, 100], ['-5', '5', -5, 5], [' 9 ', '2', 2, 9], ['0', '0', 0, 0], ['-999999999', '999999999', -999999999, 999999999]]) {
    const ask = R.cardAsk(a, b, '0'), m = re.exec(ask.toLowerCase()); assert.ok(m, 'the stage reads it: ' + ask);
    assert.deepEqual([+(m[1] || m[3]), +(m[2] || m[4])], [lo, hi], 'the card draws from the same range: ' + ask);
    assert.equal(await firstSkill(ask), null, 'no skill takes it before the stage\'s own random number: ' + ask);
  }
  for (const [a, b, d] of [['1.5', '3', '0'], ['1', '100', '2'], ['', '5', '0'], ['1', '1e3', '0'], ['1', '1234567890', '0']]) assert.equal(R.cardAsk(a, b, d), '', 'no whole-number range keeps the example: ' + [a, b, d]);
  assert.deepEqual(pageOfCard('', '/random/?min=-5&max=5'), ['/random/?min=-5&max=5', 'Random number'], 'the card links back to the page on its range');
  assert.equal(pageOfCard('', '/random/?min="><b>'), null, 'only a plain query is linked'); assert.equal(pageOfCard('', 'https://evil.example/?a=1'), null, 'only a known page is linked');
  assert.ok(src.includes("p.dataset.page = '/random/?min=' + c.lo + '&max=' + c.hi"), 'the stage card names the page with its range');
  assert.ok(/card: \(\) => cardAsk\(/.test(fs.readFileSync(new URL('../void-live-deploy/random/index.html', import.meta.url), 'utf8')), 'the page gives the stage its range');
});

test('the password page\'s card makes a password of the length on the page, not 20, and no password ever goes into the stage link or the card\'s page link', async () => {
  const C = await import('../void-live-deploy/lib/password-card.js'), P = await import('../void-live-deploy/lib/password.js'), { utilOf } = await import('../void-live-deploy/skills/util.js'), { pageOfCard } = await import('../void-live-deploy/lib/card-frame.js');
  for (const n of [8, 16, 33, 128]) {
    const ask = C.cardAsk(String(n)); assert.equal(ask, 'generate a password with ' + n + ' characters');
    assert.equal(await firstSkill(ask), 'util', 'the stage gives it to the password card: ' + ask); assert.deepEqual(utilOf(ask), { kind: 'password', n }, 'the card makes that length');
  }
  for (const [len, mode] of [['4', 'pw'], ['7', 'pw'], ['129', 'pw'], ['', 'pw'], ['16', 'phrase'], ['1e2', 'pw']]) assert.equal(C.cardAsk(len, mode), '', 'the example ask stays: ' + len + ' ' + mode);
  // a password is never carried: not one the page made, not text in the length box
  for (const pw of [...P.generateMany({ length: 16 }, 20), 'hunter2hunter2', 'Tr0ub4dor&3']) {
    assert.equal(C.cardAsk(pw), '', 'text in the length box is never an ask');
    const link = '/?q=' + encodeURIComponent(C.cardAsk('16')); assert.ok(!link.includes(pw) && !link.includes(encodeURIComponent(pw)), 'the stage link has no password in it');
  }
  const page = fs.readFileSync(new URL('../void-live-deploy/password/index.html', import.meta.url), 'utf8'), util = fs.readFileSync(new URL('../void-live-deploy/skills/util.js', import.meta.url), 'utf8');
  assert.ok(page.includes("{ card: () => cardAsk($('lenN').value, mode) }"), 'the page gives the card the length and the mode, nothing else');
  assert.ok(util.includes("q.kind === 'password' ? page + '?len=' + q.n : page"), 'the stage card names the page with its length only');
  assert.deepEqual(pageOfCard('', '/password/?len=33'), ['/password/?len=33', 'Password generator'], 'the card links back to the page on its length');
});

test('a made or typed password is never in an address, a hash or history: the strength page gets it in memory from the page that opened it, once', async () => {
  const H = await import('../void-live-deploy/lib/pw-handover.js'), P = await import('../void-live-deploy/lib/password.js');
  const ORIGIN = 'https://a-to-mind.com', win = (origin) => { const ls = new Set(); return { location: { origin }, addEventListener: (_, f) => ls.add(f), removeEventListener: (_, f) => ls.delete(f), emit: (e) => { for (const f of [...ls]) f(e); }, heard: () => ls.size }; };
  const pair = () => {
    const a = win(ORIGIN), b = win(ORIGIN), sent = [];
    a.open = (url, target) => { b.url = url; b.target = target; b.opener = a; return b; };
    b.postMessage = (data, to) => { sent.push({ to: 'opened', data, target: to }); b.emit({ data, origin: ORIGIN, source: a }); };
    a.postMessage = (data, to) => { sent.push({ to: 'opener', data, target: to }); a.emit({ data, origin: ORIGIN, source: b }); };
    return { a, b, sent };
  };
  for (const pw of [...P.generateMany({ length: 24 }, 5), 'Tr0ub4dor&3', 'a b#p=c&d']) {
    const { a, b, sent } = pair(); let got = null;
    assert.equal(H.handOver(a, pw), true); assert.equal(b.url, '/password-strength/', 'the tab opens on the plain page'); assert.ok(!b.url.includes(pw) && !b.url.includes(encodeURIComponent(pw)) && !b.url.includes('#'), 'no password and no hash in the address it opens');
    assert.equal(H.receive(b, (v) => { got = v; }), true); assert.equal(got, pw, 'the strength page gets the password');
    assert.ok(sent.every((m) => m.target === ORIGIN), 'every message names this origin, never *');
    assert.equal(a.heard(), 0, 'the opener stops listening and drops it'); assert.equal(b.heard(), 0, 'the strength page stops listening');
    let again = null; H.receive(b, (v) => { again = v; }, 5); assert.equal(again, null, 'a second ask gets nothing');
    await new Promise((r) => setTimeout(r, 10));
  }
  // a tab that is not the one it opened, or another origin, gets nothing
  { const { a, b } = pair(); H.handOver(a, 'hunter2hunter2'); const stranger = win(ORIGIN); let leaked = false; stranger.postMessage = () => { leaked = true; };
    a.emit({ data: { kind: 'a2m-pw-handover', want: true }, origin: ORIGIN, source: stranger }); a.emit({ data: { kind: 'a2m-pw-handover', want: true }, origin: 'https://evil.example', source: b });
    assert.equal(leaked, false); let got = null; b.postMessage = () => { got = 'sent'; }; a.emit({ data: { kind: 'a2m-pw-handover', want: true }, origin: 'https://evil.example', source: b }); assert.equal(got, null, 'another origin gets nothing');
    H.receive(b, () => {}, 5); b.postMessage = (data) => b.emit({ data, origin: ORIGIN, source: a }); a.emit({ data: { kind: 'a2m-pw-handover', want: true }, origin: ORIGIN, source: b }); }
  { const a = win(ORIGIN); a.open = () => null; assert.equal(H.handOver(a, 'x1'), false, 'a blocked tab carries nothing'); assert.equal(a.heard(), 0); }
  // the ask bar sends a typed password to the plain page
  for (const ask of ['how strong is Tr0ub4dor&3', 'check password hunter2hunter2', 'how secure is a b c']) { const u = routeAsk(ask); assert.equal(u, '/password-strength/'); }
  // the pages: no link the password page builds carries a password, and the strength page reads none from the address
  const page = fs.readFileSync(new URL('../void-live-deploy/password/index.html', import.meta.url), 'utf8'), strength = fs.readFileSync(new URL('../void-live-deploy/password-strength/index.html', import.meta.url), 'utf8');
  assert.ok(!page.includes('#p=') && !/encodeURIComponent\((?:pw|made)/.test(page), 'the password page builds no address with a password in it');
  assert.ok(page.includes("handOver(window, pw)") && page.includes("go: () => !handOver(window, made[0])"), 'both checks hand it over in memory');
  assert.ok(!/pw\.value\s*=\s*decodeURIComponent/.test(strength) && !/(?:session|local)Storage/.test(strength) && !/sessionStorage/.test(page), 'the strength page reads nothing from the address and stores nothing');
  assert.ok([...page.matchAll(/localStorage\.setItem\(([^;]*)\)/g)].every((m) => !/\bmade\b|\bpw\b/.test(m[1])), 'the password page keeps its settings only, never a password');
  assert.ok(strength.includes('receive(window, (v) => { pw.value = v; draw(); })') && strength.includes("history.replaceState(null, '', location.pathname + location.search)"), 'it takes it in memory and wipes any old #p= unread');
});

test('the made-up people page\'s card shows the people on the page: its count, countries, gender and seed, not a fake name generator example', async () => {
  const C = await import('../void-live-deploy/lib/people-card.js'), F = await import('../void-live-deploy/lib/fakeuser.js'), S = (await import('../void-live-deploy/skills/fakeuser.js')).default, { pageOfCard } = await import('../void-live-deploy/lib/card-frame.js');
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => '&#' + c.charCodeAt(0) + ';');
  for (const [n, nats, g, seed] of [['12', ['us'], '', 'k3x9ab01'], ['1', ['de', 'jp'], 'female', 'Ab_9'], ['33', ['nz', 'gb'], '', 'q'], ['7', ['ua', 'us', 'fr'], 'male', 'zz-1'], ['250', ['br'], '', 'Verse']]) {
    const ask = C.cardAsk(n, nats, g, seed); assert.ok(ask, 'an ask for ' + [n, nats, g, seed].join(' '));
    assert.equal(await firstSkill(ask), 'fakeuser', 'the stage gives it to the made-up people card: ' + ask);
    assert.deepEqual(F.askFake(ask), { n: +n, nats, gender: g, seed }, 'the card reads back the page\'s settings: ' + ask);
    const el = { dataset: {}, innerHTML: '' }; assert.equal(S.run(ask, { showPage: (f) => f(el), esc }), 'fakeuser');
    for (const p of F.people({ seed, n: Math.min(+n, 3), nats, gender: g })) assert.ok(el.innerHTML.includes(esc(p.name)) && el.innerHTML.includes(esc(p.email)), 'the card shows the page\'s person ' + p.name);
    const want = '/random-user/?' + new URLSearchParams({ n, nat: nats.join(','), ...(g ? { g } : {}), seed });
    assert.equal(el.dataset.page, want, 'the card\'s page link opens these same people'); assert.deepEqual(pageOfCard('fakeuser', el.dataset.page), [want, 'Made-up people']);
  }
  // a seed the ask cannot carry still gives the count, countries and gender; settings it cannot say keep the example
  assert.deepEqual(F.askFake(C.cardAsk('33', ['nz', 'gb'], '', 'bad seed!')), { n: 33, nats: ['nz', 'gb'], gender: '' });
  for (const a of [['0'], [''], ['5001'], ['1e2'], ['abc'], ['5000', Object.keys(F.NATS), 'male', 'x']]) assert.equal(C.cardAsk(...a), '', 'the example ask stays: ' + a.join(' '));
  for (const nat of Object.keys(F.NATS)) assert.deepEqual(F.askFake(C.cardAsk('4', [nat])).nats, [nat], 'each country reads back as itself: ' + nat);
  // other asks keep what they did: no seed, and the countries in the order asked
  assert.deepEqual(F.askFake('generate 5 fake german women'), { n: 5, nats: ['de'], gender: 'female' }); assert.deepEqual(F.askFake('20 random users from japan and brazil').nats, ['jp', 'br']);
  const page = fs.readFileSync(new URL('../void-live-deploy/random-user/index.html', import.meta.url), 'utf8');
  assert.ok(page.includes("{ card: () => cardAsk($('n').value, [...natsOn], $('gender').value, $('seed').value) }"), 'the page gives the card its count, countries, gender and seed');
});

test('the recipes page\'s card shows the recipe open there, at its servings and units, not pancakes for 4; the visitor\'s own recipes stay on the device', async () => {
  const C = await import('../void-live-deploy/lib/recipe-card.js'), R = await import('../void-live-deploy/lib/recipes.js'), mod = await import('../void-live-deploy/skills/recipe.js'), S = mod.default, { pageOfCard } = await import('../void-live-deploy/lib/card-frame.js');
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => '&#' + c.charCodeAt(0) + ';');
  const show = async (ask) => { const el = { dataset: {}, innerHTML: '' }; const said = await S.run(ask, { showPage: (f) => { f(el); return el; }, esc, _pageStill: () => true }); return [said, el]; };
  // every built-in recipe, at its own servings and at others, in both units: the stage reads it back and shows the page's lines
  for (const r of R.BUILT_IN) for (const [n, units] of [[r.servings, 'us'], [r.servings * 2, 'metric'], [1, 'us']]) {
    const ask = C.cardAsk(r, n, units); assert.ok(ask, 'an ask for ' + r.name + ' ' + n + ' ' + units);
    assert.equal(await firstSkill(ask), 'recipe', 'the stage gives it to the recipe card: ' + ask);
    assert.deepEqual(mod.dishOf(ask), { dish: r.name.toLowerCase(), by: 'built', servings: n === r.servings ? 0 : n, units }, 'it reads back the page\'s recipe: ' + ask);
    const [said, el] = await show(ask); assert.equal(said, 'recipe', ask);
    const line = (x) => R.swapUnits(R.scale(x, n / r.servings), units);
    for (const x of r.ingredients) assert.ok(el.innerHTML.includes('<li>' + esc(line(x)) + '</li>'), 'the card shows the page\'s line ' + line(x) + ' for ' + ask);
    const want = '/recipes/?q=' + encodeURIComponent(r.id.replace(/-/g, ' ')) + (n !== r.servings ? '&servings=' + n : '') + '&units=' + units;
    assert.equal(el.dataset.page, want, 'the card\'s page link opens the same recipe'); assert.deepEqual(pageOfCard('recipe', el.dataset.page), [want, 'Recipes']);
  }
  // a TheMealDB recipe goes by its id, so the card looks up that one, not the first of the same name
  const meal = { idMeal: '52772', strMeal: 'Teriyaki Chicken Casserole', strArea: 'Japanese', strCategory: 'Chicken', strMealThumb: 'https://www.themealdb.com/images/media/meals/x.jpg', strInstructions: 'Preheat oven to 350° F.\nBake for 15 minutes.', strIngredient1: 'soy sauce', strMeasure1: '3/4 cup', strIngredient2: 'chicken', strMeasure2: '2 lb' };
  const r = R.fromMeal(meal), asked = [], was = globalThis.fetch;
  globalThis.fetch = async (u) => { asked.push(String(u)); return { json: async () => ({ meals: String(u).includes('lookup.php?i=52772') ? [meal] : null }) }; };
  try {
    const ask = C.cardAsk(r, 8, 'metric'); assert.equal(ask, 'recipe for teriyaki chicken casserole, themealdb 52772, 8 servings, metric');
    assert.equal(await firstSkill(ask), 'recipe');
    const [said, el] = await show(ask); assert.equal(said, 'recipe'); assert.deepEqual(asked, ['https://www.themealdb.com/api/json/v1/1/lookup.php?i=52772'], 'it looks up the id, nothing else');
    for (const x of r.ingredients) assert.ok(el.innerHTML.includes(esc(R.swapUnits(R.scale(x, 2), 'metric'))), 'doubled and in metric: ' + x);
    assert.ok(el.innerHTML.includes(esc(R.swapUnits('Preheat oven to 350° F.', 'metric'))), 'the steps in the page\'s units too');
    assert.equal(el.dataset.page, '/recipes/?id=52772&servings=8&units=metric'); assert.ok(pageOfCard('recipe', el.dataset.page));
  } finally { globalThis.fetch = was; }
  // what keeps the example: no recipe, the visitor's own (written or imported) recipe, a TheMealDB look-alike from elsewhere
  const mine = { id: 'my-gran-s-stew', name: 'My gran\'s stew', servings: 4, ingredients: ['a secret'], steps: ['stir'] };
  for (const a of [[null, 4, 'us'], [mine, 4, 'us'], [{ ...R.BUILT_IN[0], name: 'Pancakes my way' }, 4, 'us'], [{ ...r, from: '' }, 4, 'us'], [{ ...r, name: 'Chicken, leek and something' }, 4, 'us']]) assert.equal(C.cardAsk(...a), '', 'the example ask stays: ' + (a[0] && a[0].name));
  assert.equal(C.cardAsk(R.BUILT_IN[0], 999, 'us'), 'recipe for pancakes, built in, us units', 'servings past the page\'s limit: its own servings');
  // other asks keep what they did
  assert.deepEqual(mod.dishOf('recipe for pancakes'), { dish: 'pancakes', by: 'name' }); assert.deepEqual(mod.dishOf('recipes with chicken'), { dish: 'chicken', by: 'ingredient' });
  const page = fs.readFileSync(new URL('../void-live-deploy/recipes/index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('{ card: () => cardAsk(state.recipe, state.servings, state.units) }'), 'the page gives the card its recipe, servings and units');
});

test('the markets page\'s card shows the coin open there, not the board of top coins; its card opens Markets on that coin', async () => {
  const C = await import('../void-live-deploy/lib/markets-card.js'), M = await import('../void-live-deploy/lib/markets.js'), mod = await import('../void-live-deploy/skills/crypto.js'), S = mod.default, { pageOfCard } = await import('../void-live-deploy/lib/card-frame.js');
  const show = async (ask) => { const el = { dataset: {}, innerHTML: '' }, was = globalThis.fetch; globalThis.fetch = async () => ({ json: async () => ({}) }); try { await S.run(ask, { showPage: (f) => { f(el); return el; }, esc: String, _pageStill: () => true }); } finally { globalThis.fetch = was; } return el; };
  let priced = 0;
  for (const [sym, [id]] of Object.entries(M.COINS)) {
    const ask = C.cardAsk(sym); if (!ask) { assert.equal(mod.coinOf(id + ' price'), null, 'only a coin the stage cannot price keeps the example: ' + sym); continue; }
    priced++; assert.match(ask, /^[a-z]{2,10} price$/, ask);
    assert.equal(mod.coinOf(ask).id, id, 'the stage prices the same coin the page shows: ' + ask);
    assert.equal(await firstSkill(ask), 'crypto', 'the stage gives it to the crypto card: ' + ask);
    const el = await show(ask); assert.equal(el.dataset.page, '/markets/?s=' + sym, 'its card opens Markets on the same coin: ' + ask);
    assert.deepEqual(pageOfCard('crypto', el.dataset.page), ['/markets/?s=' + sym, 'Markets']);
    assert.equal(C.cardAsk(sym.toLowerCase()), ask, 'as the page resolves it: ' + sym);
  }
  assert.ok(priced >= 10, 'the coins the stage prices: ' + priced);
  assert.equal(C.cardAsk('BTC'), 'bitcoin price'); assert.equal(C.cardAsk('BNB'), 'bnb price', 'by its ticker where the stage does not know its id');
  for (const s of ['AAPL', 'SPX', 'EURUSD', 'TSLA', '', 'AVAX', 'not a symbol!']) assert.equal(C.cardAsk(s), '', 'the example ask stays: ' + s);
  assert.equal(mod.pageOfCoin('nothing-listed'), '', 'a coin Markets does not list: no page link');
  const page = fs.readFileSync(new URL('../void-live-deploy/markets/index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('{ card: () => cardAsk(state.sym) }'), 'the page gives the card the symbol open on it');
});

test('the weather page\'s card opens on the place looked up there, not Boston; where you are opens the weather here', async () => {
  const L = await import('../void-live-deploy/lib/weather.js'), S = await import('../void-live-deploy/skills/weather.js');
  for (const p of ['Paris', 'São Paulo', 'St. Louis', 'Saint Martin in the Fields', 'New York']) {
    const ask = L.weatherAsk(p); assert.equal(S.weatherPlace(ask), L.placeOf(p), 'the stage asks the geocoder for the same place: ' + ask);
    assert.equal(await firstSkill(ask), 'weather', 'the stage gives it to the weather skill: ' + ask);
  }
  assert.equal(L.weatherAsk(''), 'weather here'); assert.equal(S.weatherPlace('weather here'), '', 'here: the device, as on the page');
  const src = fs.readFileSync(new URL('../void-live-deploy/weather/index.html', import.meta.url), 'utf8');
  assert.match(src, /cardAsk = weatherAsk\(coords \? '' : place\); document\.dispatchEvent\(new Event\('tk:card'\)\)/, 'set when a forecast is drawn for the place looked up, and the link aimed again then: the forecast comes back after the page loads');
  assert.match(src, /\{ card: \(\) => cardAsk \}/, 'the weather page gives its card the place open on it');
});

test('the time page\'s card opens on the city asked for, else the clocks on the page, not Tokyo', async () => {
  const Z = await import('../void-live-deploy/lib/zones.js'), { parseWorldTime } = await import('../void-live-deploy/skills/worldtime.js'), all = Z.allZones();
  const paris = Z.findPlace('Paris', all), nyc = Z.findPlace('NYC', all), mumbai = Z.findPlace('Mumbai', all);
  assert.equal(Z.timeAsk(paris, [paris]), 'time in Paris'); assert.equal(Z.timeAsk(nyc, [nyc]), 'time in New York', 'a short form is said as its zone\'s city');
  assert.equal(Z.timeAsk(mumbai), 'time in Mumbai', 'a city keeps its own name, not its zone\'s (Kolkata)');
  const three = ['London', 'New York', 'Tokyo', 'Buenos Aires'].map((n) => Z.findPlace(n, all));
  const clock = Z.timeAsk(null, three); assert.equal(clock, 'world clock for London, New York, Tokyo, Buenos Aires');
  assert.deepEqual(parseWorldTime(clock), { kind: 'clock', places: ['London', 'New York', 'Tokyo', 'Buenos Aires'] }, 'the stage draws the same clocks');
  assert.equal(parseWorldTime(Z.timeAsk(paris)).place, 'Paris');
  assert.equal(Z.timeAsk(null, [Z.findPlace('UTC+9', all)]), 'world clock', 'an offset has no city: the default clock');
  for (const a of ['time in New York', clock]) assert.equal(await firstSkill(a), 'worldtime', 'the stage gives it to the time skill: ' + a);
  const src = fs.readFileSync(new URL('../void-live-deploy/time/index.html', import.meta.url), 'utf8');
  assert.match(src, /\{ card: \(\) => timeAsk\(main, places\) \}/, 'the time page gives its card the clocks open on it');
});

test('the base converter\'s card opens on the number typed there, in the base it was typed in, not 255', async () => {
  const B = await import('../void-live-deploy/lib/baseconv.js');
  const cases = [['ff', 16, 'ff hex to decimal'], ['1111 0000', 2, '11110000 binary to decimal'], ['777', 8, '777 octal to decimal'], ['4096', 10, '4096 decimal to binary'], ['0xBEEF', 16, 'beef hex to decimal']];
  for (const [t, base, want] of cases) {
    const ask = B.baseAsk(t, base); assert.equal(ask, want);
    const p = B.parseAsk(ask); assert.equal(B.convert(p.value, p.from, 10).out, B.convert(t, base, 10).out, 'the card shows the same number');
    assert.equal(await firstSkill(ask), 'baseconv', 'the stage gives it to the base skill: ' + ask);
  }
  assert.equal(B.baseAsk('12', 2), '', 'not a binary number: the example'); assert.equal(B.baseAsk('-5', 10), ''); assert.equal(B.baseAsk('', 16), '');
  assert.equal(B.baseAsk('0b101', 16), '', 'a prefix for another base');
  const src = fs.readFileSync(new URL('../void-live-deploy/base-converter/index.html', import.meta.url), 'utf8');
  assert.match(src, /card: \(\) => \(!typedIn \? '' : typedIn\.dataset\.base === 'any' \? baseAsk\(\$\('b10'\)\.value, 10\) : baseAsk\(typedIn\.value, \+typedIn\.dataset\.base\)\)/, 'the page gives its card the box typed in');
  assert.match(src, /const show = \(fromBox\) => \{\n\s+typedIn = fromBox;/, 'every show remembers the box');
});

test('the unit converter\'s card opens on the conversion shown there, as the card reads it back, not on a bare converter', async () => {
  const U = await import('../void-live-deploy/lib/units.js'), M = await import('../void-live-deploy/lib/convert-math.js'), N = (x) => +U.fmt(x, 15);
  const words = (u) => [u.sym, u.name].map((w) => String(w).toLowerCase());
  const askFor = (typed) => { const st = U.parseAsk(typed), v = U.parseNum(st.text); // as the page does it
    const answer = (b) => { const p = U.parseAsk('1 ' + st.from.sym + ' to ' + b); return p && p.from === st.from && p.to && (!st.to || p.to === st.to) ? N(U.convert(v, st.from, p.to)) : NaN; };
    return { st, v, ask: M.cardAsk(N(v), words(st.from), st.to ? words(st.to) : null, answer) }; };
  for (const typed of ['5 km to mi', '100 c to f', '-40 c to f', '180 lb to kg', '1 1/2 cups to ml', '100 mph to kmh', '1 acre in square metres', '2 hours to minutes', '3 ft']) {
    const { st, v, ask } = askFor(typed); assert.ok(ask, 'a card ask for ' + typed);
    assert.equal(await firstSkill(ask), 'convert', 'the stage gives it to the converter card: ' + ask);
    const q = M.askOf(ask), to = st.to || U.parseAsk('1 ' + st.from.sym + ' to ' + M.KINDS[q.kind].units[q.to][0].replace(/\s*\(.*\)$/, '')).to;
    assert.equal(q.value, N(v), 'the card holds the number shown: ' + ask);
    assert.ok(Math.abs(M.convert(q.kind, q.from, q.to, q.value) - N(U.convert(v, st.from, to))) <= 1e-9 * Math.max(1, Math.abs(N(U.convert(v, st.from, to)))), 'and works out what the page does: ' + ask);
  }
  assert.equal(askFor('1 MB to KB').ask, '', 'the card\'s KB is 1024 bytes and the page\'s is 1000: the example, not a wrong number');
  assert.equal(askFor('30 psi to bar').ask, '', 'a kind the card has not got: the example');
  const src = fs.readFileSync(new URL('../void-live-deploy/convert/index.html', import.meta.url), 'utf8');
  assert.match(src, /m\.mountRelated\(document\.getElementById\('related'\), '\/convert\/', \[\], \{ card: \(\) => \{/, 'the page gives its card the conversion shown');
  assert.match(src, /return cardAsk\(\+fmt\(v, 15\), words\(st\.from\), st\.to \? words\(st\.to\) : null, answer\);/);
});

test('the calculator\'s card works out the sum in the box (or the sum that gave the answer in it), and the stopwatch\'s card is a timer of the countdown\'s length', async () => {
  const C = await import('../void-live-deploy/lib/calculator.js'), K = await import('../void-live-deploy/skills/calc.js');
  for (const [sum, want] of [['2×(3+4)', 'calculator 2*(3+4)'], ['1000÷8−2', 'calculator 1000/8-2'], ['17% of 240', 'calculator 17% of 240'], ['(1.5+2.25)*4=', 'calculator (1.5+2.25)*4']]) {
    const ask = C.cardAsk(sum); assert.equal(ask, want);
    const e = K.evaluate(K.expressionOf(ask)); assert.ok(e.ok); assert.equal(e.value, C.calc(sum).value, 'the card shows the page\'s answer: ' + ask);
    assert.equal(await firstSkill(ask), null, 'no skill takes it before the stage calculator: ' + ask);
  }
  for (const sum of ['sin(30)', 'π*2', 'Ans+1', '5!', '', '2+']) assert.equal(C.cardAsk(sum), '', 'a sum the card cannot work out the same way: the example: ' + sum);
  const h = C.remember([], '(3+4)*5', 35);
  assert.equal(C.boxAsk('35', h, true), 'calculator (3+4)*5', 'just after =, the card takes the sum, not the bare answer');
  assert.equal(C.boxAsk('35', h, false), 'calculator 35', 'a number typed in the box stays that number');
  assert.equal(C.boxAsk('2+3', h, true), 'calculator 2+3', 'a new sum in the box is the card');
  assert.equal(C.boxAsk('36', C.remember([], 'Ans+1', 36), true, { ans: 36 }), 'calculator 36', 'a sum the card cannot work out the same way gives the answer');
  const S = await import('../void-live-deploy/lib/stopwatch.js'), T = await import('../void-live-deploy/skills/timer.js');
  for (const ms of [30000, 45000, 60000, 90000, 120000, 300000, 600000, 1500000, 3600000, 5400000, 86400000]) {
    const ask = S.timerAsk(ms); assert.equal(await firstSkill(ask), 'timer', 'the stage gives it to the timer: ' + ask); assert.equal(T.parseDuration(ask), ms, 'the same length: ' + ask);
  }
  for (const ms of [0, 500, 90500, 86401000, NaN]) assert.equal(S.timerAsk(ms), '');
  const calc = fs.readFileSync(new URL('../void-live-deploy/calculator/index.html', import.meta.url), 'utf8'), sw = fs.readFileSync(new URL('../void-live-deploy/stopwatch/index.html', import.meta.url), 'utf8');
  assert.match(calc, /mountRelated\(document\.getElementById\('related'\), '\/calculator\/', \[\], \{ card: \(\) => boxAsk\(ex\.value, hist, done, \{ deg, ans, mem \}\) \}\)/, 'the page gives its card the box and the sum that gave it');
  assert.match(sw, /mountRelated\(document\.getElementById\('related'\), '\/stopwatch\/', \[\], \{ card: \(\) => \(tab === 'cd' \? timerAsk\(cd\.total\) : ''\) \}\)/, 'the countdown gives its card its length');
});

test('the word counter\'s card counts the text in the box, exactly as typed, on the device, to the same words and characters as the page; no word in it sends it to another skill', async () => {
  const W = await import('../void-live-deploy/lib/wordcount.js'), { utilOf } = await import('../void-live-deploy/skills/util.js');
  const texts = ['Hello world. How are you today?', 'Mr. Smith paid $3.50 on Jan. 5, don\'t you know', 'line one\nline two\n\nline three  ', 'I hate rainy weather, will it rain tomorrow',
    'tip 20% on 50', 'Zoë’s café: 12 rock-solid ideas! 😀', '"quoted" text', 'word count of the selection', 'qr code for this stage view'];
  for (const t of texts) {
    const ask = W.cardAsk(t); assert.match(ask, /^count words #[A-Za-z0-9_-]+$/, t); assert.equal(await firstSkill(ask), 'util', 'the stage counts it on the device: ' + t);
    const q = utilOf(ask); assert.equal(q.kind, 'count'); assert.equal(q.s, t, 'the card counts this text, as typed');
    assert.equal((q.s.match(/[\p{L}\p{N}'’-]+/gu) || []).length, W.count(t).words, 'the same words as the page: ' + t); assert.equal(Array.from(q.s).length, W.count(t).characters);
  }
  assert.equal(W.cardAsk(''), '', 'an empty box: the example'); assert.equal(W.cardAsk('   \n '), '');
  assert.equal(W.cardAsk('word '.repeat(60)), '', 'past 200 characters: the example, so a long draft does not go in a link');
  assert.equal(W.cardAsk('a - b'), '', 'a lone dash the skill counts as a word: the example');
  assert.equal(utilOf('count words #blessed'), null, 'a typed tag is not a card code'); assert.equal(utilOf('count words in #blessed').s, '#blessed');
  const src = fs.readFileSync(new URL('../void-live-deploy/word-count/index.html', import.meta.url), 'utf8');
  assert.match(src, /card:\s*\(\)\s*=>\s*cardAsk\(box\.value\)/, 'the word counter gives its card the text in the box');
});

test('the Base64 page\'s card holds the text in the box, exactly as typed, and its Base64; no word in it sends it to another skill', async () => {
  const B = await import('../void-live-deploy/lib/base64.js'), D = await import('../void-live-deploy/lib/dev-tools.js');
  const texts = ['hello', ' leading space and trailing  ', 'line one\nline two\r\n', 'I hate rainy weather, will it rain tomorrow', 'tip 20% on 50', 'translate hello to spanish',
    'Zoë’s café 😀 日本', '"quoted" = a + b / c?', 'set a timer for 5 minutes', 'qr code for this stage view'];
  for (const t of texts) {
    const ask = B.cardAsk(t); assert.match(ask, /^base64 decode [A-Za-z0-9+/]+={0,2}$/, t);
    assert.equal(await firstSkill(ask), 'dev-tools', 'the stage opens the Base64 card: ' + t);
    const p = D.devOf(ask); assert.equal(p.mode, 'base64'); assert.equal(p.opts.dir, 'decode');
    assert.equal(D.b64Decode(p.input).out, t, 'the card shows this text, as typed'); assert.equal(p.input, D.b64Encode(t), 'and its UTF-8 Base64');
  }
  assert.equal(B.cardAsk(''), '', 'an empty box: the example'); assert.equal(B.cardAsk(' \n '), '');
  assert.equal(B.cardAsk('x'.repeat(1501)), '', 'past 1500 characters: the example, so a long paste does not go in a link');
  const src = fs.readFileSync(new URL('../void-live-deploy/base64/index.html', import.meta.url), 'utf8');
  assert.match(src, /card:\s*\(\)\s*=>\s*\(text\.classList\.contains\('stale'\)\s*\?\s*''\s*:\s*cardAsk\(text\.value\)\)/, 'the page gives its card the text box, unless the box is not the text of this Base64');
});
