// tools/films-live.mjs against a pretend site: a stranger's view, the owner key, and what the report never prints.
// Run: node --test tools/films-live.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFilms, filmsReport } from './films-live.mjs';

const film = { id: 'f-1', title: 'secret words', src: '/api/films?id=f-1&exp=9999999999&sig=SIGNED', reviews: null };
function site({ films = [film], strangerOwner = false, reviews = null, keyOk = true, play = 206 } = {}) {
  return async (url, opts = {}) => {
    const auth = (opts.headers || {}).authorization || '';
    const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
    if (url.endsWith('/films/')) return new Response('<html><body>films</body></html>', { status: 200 });
    if (url.endsWith('/api/films')) {
      if (auth) return json({ films: films.map((f) => ({ ...f, reviews: [] })), owner: keyOk && auth === 'Bearer KEY', member: false });
      return json({ films: films.map((f) => ({ ...f, reviews })), owner: strangerOwner, member: false });
    }
    if (url.includes('/api/films?id=')) return new Response('x', { status: play, headers: { 'content-type': 'video/mp4' } });
    return new Response('', { status: 404 });
  };
}

test('films-live: a healthy site passes every row', async () => {
  const rows = await checkFilms('https://x.test', 'KEY', site());
  assert.equal(rows.length, 7);
  assert.ok(rows.every((r) => r.ok === true), JSON.stringify(rows));
});

test('films-live: each wrong stranger view fails its own row', async () => {
  const bad = async (o, what) => (await checkFilms('https://x.test', 'KEY', site(o))).find((r) => r.what === what).ok;
  assert.equal(await bad({ films: [] }, 'a stranger sees films'), false);
  assert.equal(await bad({ strangerOwner: true }, 'a stranger is not the owner'), false);
  assert.equal(await bad({ reviews: [{ by: 'x' }] }, 'a stranger sees no reviews'), false);
  assert.equal(await bad({ play: 403 }, 'the newest film plays (a range of it)'), false);
  assert.equal(await bad({ keyOk: false }, 'the owner key is let in as the owner'), false);
});

test('films-live: no key is reported as not checked, and the report never prints a key, a signature or a title', async () => {
  const rows = await checkFilms('https://x.test', '', site());
  assert.equal(rows.find((r) => r.what === 'the owner key is let in as the owner').ok, null);
  const md = filmsReport('https://x.test', await checkFilms('https://x.test', 'KEY', site()));
  assert.ok(!/KEY|SIGNED|secret words/.test(md), md);
  assert.match(md, /\| a stranger sees films \| ✅ \|/);
});
