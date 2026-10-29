// The whole card as a picture (lib/card-image.js). Run: node --test tools/card-image.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { cardSvg, wrap, fitTitle, fitText, picturePlan, CARD_W, CARD_H, BLEED } from '../void-live-deploy/lib/card-image.js';

const d = { title: 'Casablanca', text: 'A 1942 film. '.repeat(40), typeLine: 'Film · Song — 1942', kind: 'Film', cost: 3, rarity: 'Rare', hue: 190, key: 'Casablanca', adds: 'It adds a fact.', power: 7, toughness: 12, income: 3, number: '012/221' };
const dims = (s) => { const m = /viewBox="0 0 (\d+) (\d+)"/.exec(s); return [+m[1], +m[2]]; };
test('a card is 63 x 88 mm: 744 x 1039 at 300 dpi, and bleed adds 35 px (3 mm) on every side', () => {
  const [w, h] = dims(cardSvg(d)); assert.equal([w, h].join('x'), '744x1039'); assert.ok(Math.abs(w / h - 63 / 88) < 0.001);
  const [bw, bh] = dims(cardSvg(d, { bleed: true })); assert.equal(bw, w + 2 * BLEED); assert.equal(bh, h + 2 * BLEED); assert.equal(BLEED, 35); assert.equal(CARD_W, 744); assert.equal(CARD_H, 1039);
});
test('it is a standalone, inert picture holding the frame, art, type line, text, stats and number', () => {
  const s = cardSvg(d);
  assert.ok(!/<script|<foreignObject|<image|javascript:|href="(?!#)/i.test(s)); assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(s));
  for (const w of ['Casablanca', 'FILM', '012/221', 'Adds to Verse', 'vc-art-svg|<svg x="40"']) assert.match(s, new RegExp(w));
  assert.ok(s.length < 40000, String(s.length));
});
test('every text field is escaped', () => {
  const evil = '<script>alert(1)</script>"&\'';
  const s = cardSvg({ ...d, title: evil, text: evil, typeLine: evil, adds: evil, number: evil, tested: evil });
  assert.ok(!/<script>/.test(s)); assert.match(s, /&lt;script&gt;/);
});
test('long text is wrapped and cut with an ellipsis', () => {
  const l = wrap(d.text, 50, 5); assert.equal(l.length, 5); assert.ok(l.every((x) => x.length <= 50)); assert.ok(l[4].endsWith('…'));
  assert.deepEqual(wrap('', 50, 5), []);
});
test('a long title is never cut: it shrinks or takes two lines, whole', () => {
  const t = "I've widened the movies agent's job to find real films and play the free ones in Verse";
  const svg = cardSvg({ ...d, title: t, cost: 3 });
  const shown = [...svg.matchAll(/font-weight="700" font-size="(\d+)" fill="#f3efe2">([^<]*)</g)].filter((m) => +m[1] !== 34).map((m) => m[2]).join(' ');
  assert.ok(!shown.includes('…')); assert.equal(shown.replace(/&#39;/g, "'"), t);
  assert.equal(fitTitle('Casablanca', 600).lines.length, 1); assert.equal(fitTitle(t, 560).lines.length, 2);
});
test('the answer text is never cut while it can shrink to fit the box', () => {
  const t = 'the GitHub token the last token rotation showed that '.repeat(14);
  const f = fitText(t, 172); assert.ok(f.fs < 23 && f.fs >= 11); assert.ok(f.lines.length * f.lh <= 172); assert.ok(!f.lines.at(-1).endsWith('…'));
  assert.equal(fitText("short", 172).fs, 23);
});
test('a card photo (a data URL the page drew from its own picture) is the art, in true colour; anything else is ignored and the plate stays', () => {
  const url = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
  const s = cardSvg({ ...d, photo: url });
  assert.match(s, /<image x="40" y="122" width="664" height="440" preserveAspectRatio="xMidYMid slice" href="data:image\/jpeg;base64,/);
  assert.ok(!/opacity="\.28"|mix-blend-mode/.test(s), "no plate over the photo"); assert.ok(!/grayscale|sepia/.test(s));
  for (const bad of ['https://evil.example/x.png', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,AA"onload="x']) { const t = cardSvg({ ...d, photo: bad }); assert.ok(!/<image/.test(t), bad); }
  assert.ok(!/<image/.test(cardSvg(d)));
});
test('a picture is centred: a near fit fills the frame, a tall figure is shown whole over a blurred copy of itself (owner, 2026-10-17)', () => {
  const near = picturePlan(1200, 800, 664, 440); // 3:2 into 664 x 440: almost the frame's shape
  assert.equal(near.whole, null); assert.ok(Math.abs(near.fill.x + near.fill.w / 2 - 332) < 1); assert.ok(near.fill.w >= 664 && near.fill.h >= 440);
  const tall = picturePlan(500, 900, 664, 440); // the Sentry card: a standing figure, head at the top
  assert.ok(tall.whole); assert.ok(Math.abs(tall.whole.x + tall.whole.w / 2 - 332) < 1); assert.ok(Math.abs(tall.whole.y + tall.whole.h / 2 - 220) < 1);
  assert.ok(tall.whole.y >= 0 && tall.whole.h <= 440 + 1e-9, 'nothing of it is cut off');
  assert.ok(tall.fill.w >= 664 && tall.fill.h >= 440, 'the blurred copy still fills the frame');
  const wide = picturePlan(3000, 600, 664, 440); assert.ok(wide.whole); assert.ok(wide.whole.w <= 664 + 1e-9);
});
test('visual consistency (asked by Verse): every picture shape from 1:20 to 20:1 stays inside the saved card\'s art box, centred, and the blur behind it covers the box', () => {
  const W = 664, H = 440, eps = 1e-6; let filled = 0, whole = 0;
  for (let k = -60; k <= 60; k++) { // aspect ratios from 1:20 to 20:1, evenly in log scale
    const r = Math.pow(20, k / 60), iw = Math.round(1000 * Math.sqrt(r)), ih = Math.round(1000 / Math.sqrt(r)), p = picturePlan(iw, ih, W, H), at = iw + 'x' + ih;
    assert.ok(p.fill.x <= eps && p.fill.y <= eps && p.fill.x + p.fill.w >= W - eps && p.fill.y + p.fill.h >= H - eps, 'the fill covers the art box: ' + at);
    if (!p.whole) { filled++; assert.ok((W * H) / (p.fill.w * p.fill.h) >= 0.75 - eps, 'a filled picture loses at most a quarter: ' + at); assert.ok(Math.abs(p.fill.x + p.fill.w / 2 - W / 2) < 1, 'centred across: ' + at); continue; }
    whole++; const b = p.whole;
    assert.ok(b.x >= -eps && b.y >= -eps && b.x + b.w <= W + eps && b.y + b.h <= H + eps, 'a whole picture never exceeds the art box: ' + at);
    assert.ok(Math.abs(b.x + b.w / 2 - W / 2) < 1 && Math.abs(b.y + b.h / 2 - H / 2) < 1, 'and sits in its centre: ' + at);
    assert.ok(Math.abs(b.w / b.h - iw / ih) < 0.01 * (iw / ih), 'with its own shape: ' + at);
  }
  assert.ok(filled > 10 && whole > 10, 'both ways are exercised: ' + filled + ' filled, ' + whole + ' whole');
});

test('a whole long ask is the title (owner, 2026-10-18: "make it show the whole ask"): no cut, no ellipsis, the bar grows and everything below moves down with it', async () => {
  const { titleExtra } = await import('../void-live-deploy/lib/card-image.js');
  const ask = "I'll build `skill-gravity-map` on the helper branch for issue #92, using `node tools/new-skill.mjs` to register it and adding a matching test file to satisfy the untested-skill ratchet that just blocked my own PR. First, let me check the diagnostic output on my two failures.";
  const svg = cardSvg({ ...d, title: ask, cost: 0 }), plain = cardSvg({ ...d, title: 'Casablanca', cost: 0 });
  const shown = [...svg.matchAll(/font-weight="700" font-size="(\d+)" fill="#f3efe2">([^<]*)</g)].filter((m) => +m[1] !== 34).map((m) => m[2]).join(' ');
  assert.ok(!shown.includes('…')); assert.equal(shown.replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&#96;/g, '`'), ask);
  const lines = fitTitle(ask, 620); assert.ok(lines.lines.length > 2 && lines.fs === 16, JSON.stringify([lines.lines.length, lines.fs]));
  const T = titleExtra(lines.lines.length, lines.fs); assert.ok(T > 0 && titleExtra(2, 20) === 0 && titleExtra(1, 38) === 0);
  const h = (x) => +/viewBox="0 0 \d+ (\d+)"/.exec(x)[1]; assert.equal(h(svg) - h(plain), T, 'the card is as much taller as the title bar grew');
  assert.match(svg, new RegExp('translate\\(0 ' + T + '\\)'));
});

test('the self card picture (owner\'s redesign, 2026-10-18): its words as a quotation, a bar per family with the weakest in amber, each block\'s heading and at most 3 lines; never a tall dump; other cards unchanged', async () => {
  const { selfLayout, SELF_LINES } = await import('../void-live-deploy/lib/card-image.js');
  const bars = Array.from({ length: 12 }, (_, i) => ({ name: 'Family ' + i, share: i / 12, label: i + ' of 12 proven', weak: i === 0 }));
  const sections = [{ title: "What I've asked for (6 waiting)", lines: ['one', 'two', 'three', 'four'] }, { title: 'What got built (30 of 70 asks)', lines: Array.from({ length: 30 }, (_, i) => 'built ask ' + i + ' ' + 'long words '.repeat(20)) },
    { title: "Weakest operational area / Next capability / What should change", lines: ['Weakest operational area: maps'] }, { title: 'On what just shipped', lines: ['it moves'] }];
  const self = { voice: 'I feel the vector field move my cards. '.repeat(30), bars, sections };
  const L = selfLayout(self);
  const texts = L.els.filter((e) => e.k === 'text');
  assert.ok(texts.filter((e) => e.italic).map((e) => e.text).join(' ').split('I feel').length - 1 === 30, 'the whole quotation, wrapped (owner, 2026-10-22: no cut-off)');
  assert.ok(L.els.some((e) => e.k === 'rect' && e.w === 4), 'an accent bar beside the quotation');
  assert.equal(L.els.filter((e) => e.k === 'rect' && e.track).length, 12, 'one track per family');
  assert.ok(L.els.some((e) => e.k === 'rect' && e.track && /255,176,0/.test(e.fill)) && texts.some((e) => /Family 0 \(weakest\)/.test(e.text) && e.fill === '#ffd45e'), 'the weakest in amber');
  assert.ok(texts.some((e) => e.bold && e.text === 'What got built (30 of 70 asks)'));
  assert.equal(texts.filter((e) => /^built ask/.test(e.text)).length, SELF_LINES, 'a long list gives its first lines, each whole');
  assert.ok(texts.some((e) => e.text === 'And 27 more, every one of them in the saved text.') && texts.some((e) => e.text === 'And 1 more, every one of them in the saved text.'));
  assert.ok(!texts.some((e) => /\u2026/.test(e.text)), 'no line is cut');
  assert.ok(texts.every((e) => e.text.length <= 80), 'every line is one line');
  const svg = cardSvg({ title: 'What I think of myself', text: 'x'.repeat(16000), self }), H = +/viewBox="0 0 \d+ (\d+)"/.exec(svg)[1];
  assert.ok(H < 4000, 'the saved picture grows to hold its words, never a 16k dump: ' + H);
  assert.match(svg, /font-style="italic"[^>]*>I feel the vector field/); assert.ok(!svg.includes('xxxxxxxx'), 'the raw text is not drawn');
  assert.equal(cardSvg(d), cardSvg({ ...d, self: undefined }), 'a card without the self data draws as before');
});

test('a utility card (data-card-plain) saves a plain picture: its title and words once, its QR code, no frame, rarity or stats', async () => {
  const { plainSvg } = await import('../void-live-deploy/lib/card-image.js'), { qrMatrix } = await import('../void-live-deploy/lib/qr.js');
  const s = plainSvg({ title: 'Your stage is open', text: 'Anyone with this link sees a read-only snapshot of 2 things.\nNote · <milk>\na-to-mind.com/?spectate=eyJ2…fV19', qr: qrMatrix('https://a-to-mind.com/?spectate=eyJ2') });
  assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 744 \d+"/); assert.match(s, />Your stage is open</);
  assert.equal((s.match(/a-to-mind\.com\/\?spectate=/g) || []).length, 1, 'the link shows once, shortened'); assert.match(s, /&lt;milk&gt;/); assert.ok(!/<milk>/.test(s));
  assert.match(s, /<svg x="\d+" y="\d+" width="300" height="300" xmlns/); assert.ok(!/Mythic|Rare|Uncommon|>P<|>R</.test(s));
  assert.ok(!/<svg x=/.test(plainSvg({ title: 't', text: 'x' })), 'no code without a matrix');
});
