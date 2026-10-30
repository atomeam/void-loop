// The week's stories about a topic (lib/news-week.js): the one Hacker News search that the stage's "news about <topic>" card (skills/news.js)
// and the News page share when its headlines miss a search. Made-up hits; no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { weekUrl, weekItems } from '../void-live-deploy/lib/news-week.js';

test('weekUrl: stories of the past 7 days, the topic encoded', () => {
  const now = 1_800_000_000_000, u = new URL(weekUrl('  space x ', now));
  assert.equal(u.origin + u.pathname, 'https://hn.algolia.com/api/v1/search');
  assert.equal(u.searchParams.get('tags'), 'story');
  assert.equal(u.searchParams.get('query'), 'space x');
  assert.equal(u.searchParams.get('numericFilters'), 'created_at_i>' + (1_800_000_000 - 7 * 86400));
});

test('weekItems: titles only, at most 10, https links or the story page', () => {
  const hits = [{ title: ' A ', url: 'https://a.example/x', points: 5, objectID: '1' }, { title: 'B', url: 'http://b.example', objectID: '2' },
    { title: 'C', url: 'javascript:alert(1)', objectID: '3' }, { title: '', url: 'https://d.example' }, null, { url: 'https://e.example' }];
  const got = weekItems({ hits: hits.concat(Array.from({ length: 20 }, (_, i) => ({ title: 'T' + i, url: 'https://t.example/' + i }))) });
  assert.equal(got.length, 10);
  assert.deepEqual(got[0], { title: 'A', url: 'https://a.example/x', points: 5 });
  assert.equal(got[1].url, 'https://news.ycombinator.com/item?id=2');
  assert.equal(got[2].url, 'https://news.ycombinator.com/item?id=3');
  assert.equal(got[1].points, 0);
  assert.deepEqual(weekItems(null), []); assert.deepEqual(weekItems({ hits: 'x' }), []);
});

test('weekItems: a story posted twice shows once, by link or by title', () => {
  const got = weekItems({ hits: [
    { title: 'Lander lands', url: 'https://ex.example/lander', points: 9, objectID: '1' },
    { title: 'Lander lands safely', url: 'https://www.ex.example/lander/?utm=x', points: 3, objectID: '2' },
    { title: 'lander  LANDS', url: 'https://other.example/y', objectID: '3' },
    { title: 'Ask HN: lander?', objectID: '4' }, { title: 'Ask HN: other?', objectID: '5' },
    { title: 'Rocket', url: 'https://r.example', objectID: '6' }] });
  assert.deepEqual(got.map((d) => d.title), ['Lander lands', 'Ask HN: lander?', 'Ask HN: other?', 'Rocket']);
  assert.equal(new URL(weekUrl('x')).searchParams.get('hitsPerPage'), '20', 'asks for 20, so 10 remain after reposts go');
});

test('the stage card and the News page both use it', () => {
  const skill = fs.readFileSync(new URL('../void-live-deploy/skills/news.js', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../void-live-deploy/news/index.html', import.meta.url), 'utf8');
  assert.match(skill, /from '\.\.\/lib\/news-week\.js'/); assert.match(skill, /weekUrl\(topic\)/);
  assert.match(page, /import\('\/lib\/news-week\.js'\)/); assert.match(page, /id="week" hidden/);
  assert.doesNotMatch(page, /innerHTML[^;]*weekHits/);
});

test('the News page script parses: a misplaced line once stopped every headline from loading', () => {
  const html = fs.readFileSync(new URL('../void-live-deploy/news/index.html', import.meta.url), 'utf8');
  const mods = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(mods.length, 'the page has its module');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'news-page-'));
  try {
    mods.forEach((src, i) => {
      const f = path.join(dir, i + '.mjs'); fs.writeFileSync(f, src);
      const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
      assert.equal(r.status, 0, 'news/index.html module ' + i + ' does not parse:\n' + r.stderr);
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
