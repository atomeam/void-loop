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
  assert.equal(to('how strong is Tr0ub4dor&3'), '/password-strength/#p=Tr0ub4dor%263'); assert.equal(to('decode aGVsbG8='), '/base64/?mode=decode&t=aGVsbG8%3D'); assert.equal(to('encode hello'), '/base64/?t=hello');
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
