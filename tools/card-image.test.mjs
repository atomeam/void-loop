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
  for (const w of ['Casablanca', 'FILM', '012/221', 'Adds to V01D', 'vc-art-svg|<svg x="40"']) assert.match(s, new RegExp(w));
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
  const t = "I've widened the movies agent's job to find real films and play the free ones in V01D";
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
  assert.match(s, /opacity="\.28" style="mix-blend-mode:overlay"/); assert.ok(!/grayscale|sepia/.test(s));
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
test('visual consistency (asked by Void): every picture shape from 1:20 to 20:1 stays inside the saved card\'s art box, centred, and the blur behind it covers the box', () => {
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
