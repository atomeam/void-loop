// node --test tools/appraise-photo.test.mjs: Verse values anything from a photo (frontier #30). The valuation from a description
// (lib/appraise-photo.js), the route (functions/api/appraise.js, the vision model stubbed) and the asks the skill takes
// (skills/appraise.js). People are never priced, in the photo or in the ask.
import test from 'node:test';
import assert from 'node:assert/strict';
import { valueFrom, appraisalText, isPersonAsk, personIn, complimentFor, KINDS, usd, makeableIn, subjectOf, bullionOf, BULLION } from '../void-live-deploy/lib/appraise-photo.js';
import { THINGS } from '../void-live-deploy/skills/forge-rules.js';
import forge from '../void-live-deploy/skills/forge.js';
import { imageBytes, onRequestPost, MAX_IMAGE_CHARS } from '../void-live-deploy/functions/api/appraise.js';
import { appraiseOf } from '../void-live-deploy/skills/appraise.js';
import { models, PATHS, VISION_FALLBACK } from '../void-live-deploy/lib/models.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

test('appraise: one value, the reasons, and an expert line when the kind calls for one; never a range', () => {
  const coin = valueFrom('A worn silver coin with scratches on the face.');
  assert.equal(coin.kind, 'coin'); assert.ok(coin.cents > 0); assert.match(coin.text, /^\$/); assert.ok(coin.expert, 'silver: an expert in hand');
  assert.ok(coin.says.some((s) => /wear or damage/.test(s)) && coin.says.some((s) => /silver/.test(s)));
  const t = appraisalText(coin);
  assert.match(t, /^Verse values this at \$/); assert.ok(!/range|between|to \$/.test(t), t); assert.match(t, /not a certified appraisal/); assert.match(t, /looked at in hand/);
  const chair = valueFrom('A modern plastic chair in excellent condition.');
  assert.equal(chair.kind, 'furniture'); assert.ok(!chair.expert); assert.ok(!/looked at in hand/.test(appraisalText(chair)));
  const mint = valueFrom('A sealed first edition holographic Pokémon trading card.'), worn = valueFrom('A faded Pokémon trading card with torn corners.');
  assert.ok(mint.cents > worn.cents, 'condition moves the value');
  assert.equal(valueFrom('').unknown, true); assert.match(appraisalText(valueFrom('')), /could not make out/);
  assert.equal(usd(123456), '$1,234.56'); assert.equal(usd(50000), '$500');
  for (const k of KINDS) assert.ok(k.base >= 100, k.kind);
});

test('appraise: people and pets are never priced, in the photo or in the ask', () => {
  for (const d of ['A smiling woman standing in a kitchen holding a mug.', 'A young boy wearing a red cap.', 'A selfie of a man with glasses.'])
    { const v = valueFrom(d); assert.equal(v.person, true, d); assert.equal(v.text, ''); assert.ok(!/\$/.test(appraisalText(v)), d); }
  const pet = valueFrom('A golden retriever puppy on a rug.'); assert.equal(pet.person, true); assert.match(appraisalText(pet), /family/);
  assert.equal(valueFrom('A porcelain doll in a Victorian dress.').person, false, 'a doll is a thing');
  assert.equal(valueFrom('An action figure of a man in armour, boxed.').person, false);
  for (const a of ['what am I worth', 'how much is my friend worth', 'value me', 'how much is a person worth']) assert.ok(isPersonAsk(a), a);
  assert.ok(!isPersonAsk('how much is my watch worth'));
  assert.ok(!/\$|\d/.test(complimentFor('a smiling woman', 3)));
  assert.ok(personIn('a crowd of people at a concert') && !personIn('a wooden table'));
});

test('appraise: the route reads one small image, asks the vision model, and answers with Verse\'s value; no model = 503, a person = compliment', async () => {
  assert.ok(imageBytes(PNG) instanceof Uint8Array); assert.equal(imageBytes(PNG).length, 70);
  assert.equal(imageBytes('data:text/html;base64,PGI+'), null); assert.equal(imageBytes('https://example.org/x.png'), null);
  assert.equal(imageBytes('data:image/png;base64,' + 'A'.repeat(MAX_IMAGE_CHARS + 4)), null);
  const req = (body) => new Request('http://x/api/appraise', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let asked = null;
  const env = { AI: { run: async (model, input) => { asked = { model, input }; return { response: 'A vintage Omega wristwatch with a gold case, light scratches on the glass.' }; } } };
  const r = await onRequestPost({ request: req({ image: PNG, note: 'my grandfather\'s' }), env }); const j = await r.json();
  assert.equal(r.status, 200); assert.equal(asked.model, models('vision')); const parts = asked.input.messages[0].content; assert.match(parts[0].text, /Do not guess a price/); assert.equal(parts[1].image_url.url, PNG, 'the photo goes to the vision slot as a chat image');
  // the vision slot fails or says nothing: the beta image-to-text model gets the raw bytes
  const tried = []; const fb = await (await onRequestPost({ request: req({ image: PNG }), env: { AI: { run: async (model, input) => { tried.push(model); if (input.messages) throw new Error('no vision here'); assert.equal(input.image.length, 70); return { description: 'A silver coin, worn on the face.' }; } } } })).json();
  assert.deepEqual(tried, [models('vision'), VISION_FALLBACK]); assert.equal(fb.value.kind, 'coin');
  assert.equal(j.value.kind, 'watch'); assert.match(j.text, /^Verse values this at \$/); assert.match(j.seen, /Omega/);
  assert.equal((await onRequestPost({ request: req({ image: PNG }), env: {} })).status, 503);
  assert.equal((await onRequestPost({ request: req({ image: 'nope' }), env })).status, 400);
  const down = await onRequestPost({ request: req({ image: PNG }), env: { AI: { run: async () => { throw new Error('busy'); } } } }); assert.equal(down.status, 502); assert.equal((await down.json()).reason, 'vision: busy; fallback: busy', 'a 502 says why, for both models');
  const p = await (await onRequestPost({ request: req({ image: PNG, note: 'what am I worth' }), env })).json();
  assert.equal(p.value.person, true); assert.ok(!/\$/.test(p.text));
  const person = await (await onRequestPost({ request: req({ image: PNG }), env: { AI: { run: async () => ({ description: 'A woman smiling at the camera in a park.' }) } } })).json();
  assert.equal(person.value.person, true); assert.equal(person.seen, '', 'nothing about a person is echoed back');
  assert.ok(PATHS.includes('vision'));
});

test('appraise: the asks that open the card, and the money and abstraction asks that do not', () => {
  for (const a of ['what is this worth', 'value this', 'appraise this coin', 'how much is my watch worth', 'how much could I sell this for', 'is this valuable', 'appraisal', 'What\'s this card worth?', 'price my guitar'])
    assert.deepEqual(appraiseOf(a), { photo: true }, a);
  for (const a of ['what am I worth', 'how much is my friend worth']) assert.deepEqual(appraiseOf(a), { person: true }, a);
  for (const a of ['what is the dollar worth', 'is it worth it', 'how much is a stamp', 'value of pi', 'what is my time worth', 'gold price today', 'how much is my house worth', 'what is bitcoin worth'])
    assert.equal(appraiseOf(a), null, a);
});

test('appraise: a photo of something the forge can model links to its make recipe (asked by Verse, ask-20261015-2008-1)', () => {
  assert.deepEqual(makeableIn('A blue glass vase sitting on a wooden table. It has a narrow neck.', THINGS), { key: 'vase', label: 'Vase', ask: 'make me a vase' });
  assert.equal(makeableIn('A small white sailboat in a harbor.', THINGS).ask, 'make me a boat', 'a synonym makes its recipe');
  assert.equal(makeableIn('A brass kettle on a stove.', THINGS).key, 'teapot');
  assert.equal(subjectOf('A silver coin lying on a wooden table.'), 'a silver coin');
  for (const d of ['A silver coin lying on a wooden table.', 'A coin with a tree on it.', 'A woman holding a vase.', 'A trading card in a sleeve next to a bottle.', '', null])
    assert.equal(makeableIn(d, THINGS), null, String(d));
  assert.equal(makeableIn('A vase.', null), null, 'no recipes passed, no link');
  for (const k of Object.keys(THINGS)) assert.deepEqual(forge.forgeOf('make me a ' + k), { make: k }, 'the link\'s ask reaches the forge: ' + k);
});


test('appraise: a named bullion coin prices at the metal spot — a 1 oz Krugerrand is an ounce of gold, never a pocket-coin multiple (owner, 2026-10-26: "that \$20 estimate is way off")', () => {
  const gold = 265000; // \$2,650 per troy ounce, in cents
  const k = valueFrom('A coin; in mint or sealed condition; gold.', 'a Krugerrand coin', { gold, source: 'Stooq', at: '2026-10-26' });
  assert.equal(k.cents, 265000, 'the spot times one troy ounce'); assert.equal(k.text, '\$2,650');
  assert.ok(k.expert); assert.ok(k.bullion && k.bullion.metal === 'gold' && k.bullion.ozt === 1);
  assert.ok(k.says.some((x) => /one troy ounce of gold/.test(x)) && k.says.some((x) => /Stooq/.test(x)) && k.says.some((x) => /condition barely moves it/.test(x)));
  const t = appraisalText(k);
  assert.match(t, /^Verse values this at \$2,650\./); assert.ok(!/range|between/.test(t), t, 'one number, the reasons around it');
  assert.match(t, /looked at in hand/); assert.match(t, /not a certified appraisal/);
  assert.equal(valueFrom('a half krugerrand', '', { gold }).cents, 132500, 'a fractional names its size');
  assert.equal(valueFrom('an american silver eagle', '', { silver: 3150 }).cents, 3200, 'silver prices at silver');
  assert.equal(bullionOf('A worn silver coin, 1921 Morgan dollar, with scratches.').metal, 'silver');
  assert.equal(valueFrom('A worn silver coin, 1921 Morgan dollar, with scratches on the face.', '', { silver: 3150 }).cents, 2400, 'the melt value, not the heuristic: 0.7735 ozt at \$31.50 is about \$24');
  const quiet = valueFrom('a coin; gold.', 'a krugerrand coin', null);
  assert.equal(quiet.cents, 0); assert.equal(quiet.text, '', 'no live spot, no invented number');
  assert.match(appraisalText(quiet), /not inventing a number/); assert.match(appraisalText(quiet), /spot/);
  assert.equal(valueFrom('a 1 oz gold coin', '', { gold }).cents, 265000, 'a stated weight, no named coin');
  const q = valueFrom('A shiny quarter.'); assert.equal(q.kind, 'coin'); assert.ok(q.cents > 0 && q.cents < 50000, 'a pocket coin keeps the heuristic');
  assert.ok(BULLION.length >= 10);
});

test('appraise: a Krugerrand reads the metal spot once from Stooq and prices at it; nothing bullion-named never touches the feed', async () => {
  const realFetch = global.fetch; let stooqCalls = 0;
  const csv = { xauusd: 'Symbol,Date,Time,Open,High,Low,Close,Volume\nXAUUSD,2026-10-26,22:00:00,2648.1,2661.4,2640.0,2650.55,0', xagusd: 'Symbol,Date,Time,Open,High,Low,Close,Volume\nXAGUSD,2026-10-26,22:00:00,31.2,31.8,31.0,31.5,0', xptusd: 'Symbol,Date,Time,Open,High,Low,Close,Volume\nXPTUSD,2026-10-26,22:00:00,990.0,995.0,988.0,992.4,0' };
  global.fetch = async (u) => { if (String(u).includes('stooq.com')) { stooqCalls++; const sym = String(u).match(/s=([a-z]+)/i)[1].toLowerCase(); return { text: async () => csv[sym] || '' }; } return realFetch(u); };
  try {
    const req = (body) => new Request('http://x/api/appraise', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const env = { AI: { run: async () => ({ description: 'A coin; in mint or sealed condition; gold.' }) } };
    const r = await onRequestPost({ request: req({ image: PNG, note: 'a Krugerrand coin' }), env }); const j = await r.json();
    assert.equal(r.status, 200); assert.equal(j.value.cents, 265000, 'spot 2650.55 rounds to the nearest \$25: \$2,650');
    assert.match(j.text, /Verse values this at \$2,650\./); assert.match(j.text, /Stooq/);
    const calls = stooqCalls;
    const j2 = await (await onRequestPost({ request: req({ image: PNG, note: 'a krugerrand coin' }), env })).json();
    assert.equal(stooqCalls, calls, 'the ten-minute cache answers the second ask');
    assert.equal(j2.value.cents, 265000);
    const before = stooqCalls;
    await onRequestPost({ request: req({ image: PNG }), env: { AI: { run: async () => ({ description: 'A vintage Omega wristwatch with a gold case.' }) } } });
    assert.equal(stooqCalls, before, 'no bullion named, no spot fetch');
  } finally { global.fetch = realFetch; }
});
