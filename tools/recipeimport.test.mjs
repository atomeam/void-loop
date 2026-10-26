// Importing a recipe: lib/recipeimport.js (a page's recipe data, pasted or photographed text) and functions/api/recipeimport.js (the route, fake fetch and fake model). Run: node --test tools/recipeimport.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../void-live-deploy/lib/recipeimport.js';
import * as route from '../void-live-deploy/functions/api/recipeimport.js';
import { resetGuard } from '../void-live-deploy/lib/guard.js';

const mem = new Map(); globalThis.caches = { default: { match: async (q) => (mem.has(q.url) ? new Response(mem.get(q.url)) : undefined), put: async (q, r) => { mem.set(q.url, await r.text()); } } };
const page = (j) => '<html><head><script type="application/ld+json">' + JSON.stringify(j) + '</script></head><body>secret words</body></html>';
const PANCAKES = { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite' }, { '@type': ['Recipe', 'NewsArticle'], name: 'Best &amp; Easiest Pancakes', recipeYield: ['8', '8 pancakes'], totalTime: 'PT30M', image: ['https://img.example/a.jpg'], author: { '@type': 'Person', name: 'Sam' }, recipeIngredient: ['1 cup flour', '2 eggs &amp; a yolk', '1 cup milk'], recipeInstructions: [{ '@type': 'HowToSection', name: 'Batter', itemListElement: [{ '@type': 'HowToStep', text: 'Whisk everything.' }, { '@type': 'HowToStep', text: 'Rest 10 minutes.' }] }, { '@type': 'HowToStep', text: 'Fry in butter.' }] }] };

test('durations, yields, entities', () => {
  assert.deepEqual(['PT1H30M', 'P0DT45M', 'PT90S', 'x', ''].map(M.minutesOf), [90, 45, 0, 0, 0]); assert.deepEqual(['Makes 12 cookies', 4, ['4', '4 servings'], 'a few', 9999].map(M.yieldOf), [12, 4, 4, 0, 0]);
  assert.equal(M.decode('Fish &amp; chips &#8217;n&#x27; &frac12; &bogus;'), 'Fish & chips ’n\' ½ &bogus;'); assert.equal(M.plain('<b>Hi</b>\n  there &lt;script&gt;'), 'Hi there <script>');
});
test('a page: the recipe in a @graph, sections of steps, entities decoded, an https picture and source kept, the shape the recipes page uses', () => {
  const r = M.parseRecipePage(page(PANCAKES), 'https://food.example.com/pancakes');
  assert.equal(r.name, 'Best & Easiest Pancakes'); assert.equal(r.servings, 8); assert.equal(r.time, 30); assert.deepEqual(r.ingredients, ['1 cup flour', '2 eggs & a yolk', '1 cup milk']); assert.deepEqual(r.steps, ['Whisk everything.', 'Rest 10 minutes.', 'Fry in butter.']);
  assert.equal(r.image, 'https://img.example/a.jpg'); assert.equal(r.source, 'https://food.example.com/pancakes'); assert.equal(r.from, 'food.example.com'); assert.equal(r.id, 'mine-best-easiest-pancakes'); assert.deepEqual(r.tags, ['mine', 'imported']); assert.deepEqual(r.aliases, ['best & easiest pancakes']);
  const s = M.parseRecipePage(page({ '@type': 'Recipe', name: 'Soup', prepTime: 'PT15M', cookTime: 'PT1H', image: 'http://insecure.example/x.jpg', recipeIngredient: ['1 onion'], recipeInstructions: '1. Chop.\n2. Boil for 1 hour.<br>3. Serve.' }), 'http://x.example/soup');
  assert.equal(s.time, 75); assert.equal(s.servings, 4); assert.equal(s.servingsGuessed, true); assert.deepEqual(s.steps, ['Chop.', 'Boil for 1 hour.', 'Serve.']); assert.equal(s.image, '', 'no insecure picture'); assert.equal(s.source, '', 'no insecure source');
  for (const none of ['<html>no data</html>', page({ '@type': 'Recipe', name: 'No ingredients' }), '<script type="application/ld+json">{broken</script>', page({ '@type': 'Article', name: 'x' })]) assert.equal(M.parseRecipePage(none), null);
});
test('sizes are cut, markup never survives, a script in a name is text', () => {
  const r = M.parseRecipePage(page({ '@type': 'Recipe', name: '<img src=x onerror=alert(1)>Cake'.repeat(30), recipeIngredient: Array.from({ length: 200 }, (_, i) => 'x'.repeat(500) + i), recipeInstructions: Array.from({ length: 200 }, () => 'y'.repeat(900)) }), 'https://a.example/');
  assert.ok(r.name.length <= 120 && !/[<>]/.test(r.name)); assert.equal(r.ingredients.length, 80); assert.ok(r.ingredients.every((x) => x.length <= 200)); assert.equal(r.steps.length, 60); assert.ok(r.steps.every((x) => x.length <= 600));
});
test('pasted or photographed text: title, servings, time, English and German headings, no headings, a missing title', () => {
  const a = M.parseRecipeText('Grandma\'s Lemon Cake\nServes 8\nTotal time: 1 hr 15 min\n\nIngredients\n- 200 g flour\n- 3 eggs\n• 100 g sugar\n½ cup butter\n\nMethod\n1. Mix everything.\n2) Bake for 40 minutes at 180°C.\n3. Cool.');
  assert.equal(a.name, 'Grandma\'s Lemon Cake'); assert.equal(a.servings, 8); assert.equal(a.time, 75); assert.deepEqual(a.ingredients, ['200 g flour', '3 eggs', '100 g sugar', '½ cup butter']); assert.deepEqual(a.steps, ['Mix everything.', 'Bake for 40 minutes at 180°C.', 'Cool.']);
  const d = M.parseRecipeText('Pfannkuchen\nPortionen: 4\nZutaten:\n250 g Mehl\n2 Eier\n500 ml Milch\nZubereitung:\nAlles verrühren.\nIn der Pfanne ausbacken.'); assert.equal(d.name, 'Pfannkuchen'); assert.equal(d.servings, 4); assert.equal(d.ingredients.length, 3); assert.equal(d.steps.length, 2);
  const g = M.parseRecipeText('Quick Guac\n3 ripe avocados\n1 lime, juiced\nsalt\nMash the avocados and mix in the lime juice and salt. Serve at once.'); assert.deepEqual(g.ingredients, ['3 ripe avocados', '1 lime, juiced', 'salt']); assert.equal(g.steps.length, 1);
  assert.equal(M.parseRecipeText('Method\nStir it.\nIngredients\n2 cups rice\nWater').name, 'Imported recipe'); assert.equal(M.parseRecipeText('Just some words about nothing at all'), null); assert.equal(M.parseRecipeText(''), null);
});
const env = { SALT: 'test-salt' }; // secret-scan: ok (a made-up salt for the test)
const get = (url, fetchFn, e = env) => { mem.clear(); resetGuard(); return route.onRequestGet({ env: e, fetchFn, request: new Request('https://verse.test/api/recipeimport?url=' + encodeURIComponent(url), { headers: { 'cf-connecting-ip': '203.0.113.9' } }) }).then(async (r) => ({ status: r.status, j: await r.json() })); };
test('the route (link): the recipe out, never the page; a page with no recipe, a private address, a bad redirect, too big, too slow, off without the salt', async () => {
  const ok = await get('https://food.example.com/pancakes', async () => new Response(page(PANCAKES))); assert.equal(ok.status, 200); assert.equal(ok.j.recipe.name, 'Best & Easiest Pancakes'); assert.ok(!JSON.stringify(ok.j).includes('secret words'));
  const none = await get('https://news.example.org/', async () => new Response('<html>secret words</html>')); assert.equal(none.status, 422); assert.ok(!JSON.stringify(none.j).includes('secret words'));
  for (const u of ['https://10.0.0.1/x', 'http://localhost/x', 'https://a-to-mind.com/x', 'ftp://x.example.com/', '']) assert.equal((await get(u, async () => new Response(page(PANCAKES)))).status, 400, u);
  const hop = (to) => async (u) => (u.includes('start') ? new Response('', { status: 302, headers: { location: to } }) : new Response(page(PANCAKES)));
  assert.equal((await get('https://a.example.co.uk/start', hop('https://b.example.co.uk/r'))).status, 200); assert.equal((await get('https://a.example.co.uk/start', hop('http://127.0.0.1/admin'))).status, 422);
  assert.equal((await get('https://a.example.co.uk/big', async () => new Response('x'.repeat(route.MAX_HTML + 10)))).status, 413); assert.equal((await get('https://a.example.co.uk/slow', async () => { throw new DOMException('t', 'TimeoutError'); })).status, 504);
  assert.equal((await get('https://a.example.co.uk/x', async () => new Response(page(PANCAKES)), {})).status, 503);
  mem.clear(); resetGuard(); let last; for (let i = 0; i < route.PER_MINUTE + 1; i++) last = await route.onRequestGet({ env, fetchFn: async () => new Response(page(PANCAKES)), request: new Request('https://verse.test/api/recipeimport?url=' + encodeURIComponent('https://a.example.co.uk/' + i), { headers: { 'cf-connecting-ip': '198.51.100.3' } }) }); assert.equal(last.status, 429);
});
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const post = (body, e) => { mem.clear(); resetGuard(); return route.onRequestPost({ env: e, request: new Request('https://verse.test/api/recipeimport', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7' }, body: JSON.stringify(body) }) }).then(async (r) => ({ status: r.status, j: await r.json() })); };
test('the route (photo): the text a model read, line breaks kept; nothing else; refused without a picture, without the model, with nothing readable, or when the model fails', async () => {
  const seen = []; const AI = { run: async (m, a) => { seen.push(a); return { choices: [{ message: { content: 'Lemon Cake\nServes 8\n\nIngredients\n200 g flour\n' } }] }; } };
  const r = await post({ image: PNG }, { AI }); assert.equal(r.status, 200); assert.equal(r.j.text, 'Lemon Cake\nServes 8\n\nIngredients\n200 g flour'); assert.equal(seen[0].max_tokens, 1200); assert.match(seen[0].messages[0].content[0].text, /Transcribe exactly the text of this recipe/); assert.equal(seen[0].messages[0].content[1].image_url.url, PNG);
  assert.equal((await post({ image: 'data:text/html;base64,AAAA' }, { AI })).status, 400); assert.equal((await post({}, { AI })).status, 400); assert.equal((await post({ image: PNG }, {})).status, 503);
  assert.equal((await post({ image: PNG }, { AI: { run: async () => ({ response: 'NONE' }) } })).status, 422); assert.equal((await post({ image: PNG }, { AI: { run: async () => { throw new Error('down'); } } })).status, 502);
  mem.clear(); resetGuard(); let last; for (let i = 0; i < route.PHOTOS_PER_MINUTE + 1; i++) last = await route.onRequestPost({ env: { AI }, request: new Request('https://verse.test/api/recipeimport', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.8' }, body: JSON.stringify({ image: PNG }) }) }); assert.equal(last.status, 429);
});
