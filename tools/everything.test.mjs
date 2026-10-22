// The everything-app first slice (docs/everything-app.md): markets, rides, social, dating and the provider adapters.
// Pure parts only; the cards themselves are checked live in headless Chrome. node tools/everything.test.mjs
import assert from 'node:assert/strict';
import { marketsAsk, sparkPath, BTC_ADDR } from '../void-live-deploy/skills/markets.js';
import { cleanIds, slim } from '../void-live-deploy/functions/api/markets.js';
import { ridesAsk } from '../void-live-deploy/skills/rides.js';
import { PROVIDERS, ofKind, waymoWhere } from '../void-live-deploy/skills/providers.js';
import { socialAsk, strip } from '../void-live-deploy/skills/social.js';
import { datingAsk, icebreakers, bio } from '../void-live-deploy/skills/dating.js';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
// markets
for (const a of ['crypto prices', 'crypto board', 'crypto card', 'top coins', 'show me crypto prices']) ok(marketsAsk(a)?.board, a);
for (const a of ['bitcoin price', 'stock market', 'what is crypto', 'price of ethereum in euros']) ok(!marketsAsk(a), 'not: ' + a);
ok(marketsAsk('bitcoin wallet bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh')?.addr, 'btc address');
ok(!BTC_ADDR.test('0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae'), 'eth is not btc');
ok(marketsAsk('here is my seed phrase')?.refuse, 'seed refused');
ok(sparkPath([1, 2, 3]).startsWith('M0.0 31.0') && sparkPath([5]) === '', 'spark');
ok(cleanIds('Bitcoin, ETH;drop,../x') === 'bitcoin' && cleanIds('').includes('ethereum'), 'ids');
ok(slim({ id: 'bitcoin', symbol: 'btc', sparkline_in_7d: { price: Array.from({ length: 168 }, (_, i) => i) } }).spark.length <= 56, 'slim');
// rides + adapters
ok(ridesAsk('where does waymo run')?.waymo === '', 'waymo where');
ok(ridesAsk('is waymo in austin')?.waymo === 'austin' && waymoWhere('austin').rides === 'uber', 'austin via uber');
ok(waymoWhere('phoenix').rides === 'waymo' && /DoorDash/.test(waymoWhere('phoenix').text), 'phoenix doordash');
ok(waymoWhere('boston').rides === 'no', 'boston no');
ok(ridesAsk('order pizza to 1 main st phoenix')?.food === 'pizza' && ridesAsk('tacos delivery to 2 elm st')?.food === 'tacos', 'food order');
ok(ridesAsk('get me a ride to the airport')?.address === 'the airport', 'ride');
for (const a of ['how far is the airport', 'pizza recipe', 'calories in pizza', 'uber stock price']) ok(!ridesAsk(a), 'not: ' + a);
for (const p of Object.values(PROVIDERS)) ok(p.order === null && /^https:/.test(p.web({ food: 'pho', address: '1 Main St' })), 'adapter ' + p.id);
ok(ofKind('food').length === 2 && ofKind('ride').length === 3, 'kinds');
// social
ok(socialAsk('https://x.com/XDevelopers/status/1861111969639481848')?.net === 'x', 'x');
ok(socialAsk('https://bsky.app/profile/bsky.app/post/3l6oveex3ii2l')?.rkey === '3l6oveex3ii2l', 'bsky post');
ok(socialAsk('@Mastodon@mastodon.social')?.server === 'mastodon.social', 'masto');
ok(socialAsk('bluesky feed of jay.bsky.team')?.actor === 'jay.bsky.team', 'bsky handle');
for (const a of ['what is bluesky', 'social security', 'my email', 'twitter stock']) ok(!socialAsk(a), 'not: ' + a);
ok(strip('<p>a &amp; b</p>') === 'a & b', 'strip');
// dating
ok(datingAsk('dating profile')?.open && datingAsk('icebreaker coach')?.open, 'dating open');
ok(datingAsk('icebreakers about hiking')?.icebreaker === 'hiking', 'ice');
for (const a of ['date today', 'what is the date', 'carbon dating', 'update my profile']) ok(!datingAsk(a), 'not: ' + a);
ok(icebreakers('hiking, jazz').length === 3 && bio({ name: 'Sam', interests: 'hiking, jazz' }) === 'Sam. Happiest when hiking or jazz is involved.', 'coach');
import { slimRow } from '../void-live-deploy/skills/markets.js';
ok(slimRow({ id: 'x', symbol: 'x', sparkline_in_7d: { price: Array.from({ length: 168 }, (_, i) => i) } }).spark.length <= 56, 'client slim');
import { keptText } from '../void-live-deploy/skills/social.js';
ok(keptText('Sam', 'hi  there', 'https://x/1') === 'Sam: hi there\nhttps://x/1', 'kept text');
console.log('everything: ' + n + ' checks pass');
// the wishlist goes into self.json, free paths first
import { readFileSync } from 'node:fs';
import { readWishlist } from './self-context.mjs';
import { wishlistFacts } from '../void-live-deploy/lib/self-context.js';
const wl = readWishlist(readFileSync(new URL('../docs/wishlist.md', import.meta.url), 'utf8'));
assert.ok(wl.length >= 8 && wl.every((x, i) => x.rank === i + 1 && x.free && x.cost), 'wishlist rows ranked, each with a free path and a cost');
assert.ok(wl.some((x) => /Workers Paid/.test(x.item)) && /wishlist/.test(wishlistFacts({ wishlist: wl })), 'wishlist facts');
console.log('wishlist: ' + wl.length + ' items');
