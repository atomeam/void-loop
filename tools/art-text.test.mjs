// Card art must never show readable writing (image models garble and misspell it).
// Rules live in lib/art-rules.js; the route drops a painting the vision gate flags; tools/art-text-scan.mjs OCRs the live cache.
// Run: node --test tools/art-text.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as route from '../void-live-deploy/functions/api/card-art.js';
import { models } from '../void-live-deploy/lib/models.js';
import {
  FRAMING, RARITY_STYLE, DIRECTOR_SYSTEM, artPrompt, directedPrompt, sceneOf, directorPrompt, directorTake,
  writingScene, readableTextOf, textGateYes, TEXT_GATE_ASK,
} from '../void-live-deploy/lib/art-rules.js';

const JPEG = '/9j/4AAQSkZJRgABAQ' + 'A'.repeat(9000);

test('every prompt forbids writing; rarity light never asks for glyphs or runes', () => {
  assert.match(FRAMING, /no text, no letters, no words, no watermark, no frame, no border/);
  assert.match(FRAMING, /no writing of any kind|no carved inscriptions|blank pages/);
  assert.match(DIRECTOR_SYSTEM, /Never put words|inscriptions|stone tablets/i);
  for (const k of Object.keys(RARITY_STYLE)) {
    assert.doesNotMatch(RARITY_STYLE[k], /\b(?:glyphs?|runes?|sigils?)\b/i, k);
  }
  for (const p of [artPrompt('proverb', 'skill', 'mythic'), directedPrompt('An ancient stone arch under starlight', 'mythic')]) {
    assert.match(p, /no text, no letters, no words/);
    assert.match(p, /no writing of any kind|blank pages/);
  }
});

test('a director scene that asks for writing is dropped; a clean scene stays', () => {
  assert.equal(writingScene('a stone tablet carved with a motto'), true);
  assert.equal(sceneOf('A weathered stone tablet engraved with an ancient motto under moonlight'), '');
  assert.equal(sceneOf('An open book with pages of text floating in a void'), '');
  assert.ok(sceneOf('A glowing leather tome closed on a stone pedestal in a dark void').length > 10);
  assert.equal(writingScene('A glowing leather tome closed on a stone pedestal in a dark void'), false);
});

test('a skill card never sends Verse take to the Director; a writing take is dropped for answers too', () => {
  assert.equal(directorTake('skill', 'Fortune favors the bold'), '');
  assert.equal(directorTake('answer', 'carve the motto on a stone tablet'), '');
  assert.equal(directorTake('answer', 'a red fox in snow'), 'a red fox in snow');
  assert.equal(directorPrompt('proverb', 'skill', 'Words and the world', 'Fortune favors the bold').includes('What Verse says'), false);
  assert.match(directorPrompt('fox', 'answer', '', 'a red fox in snow'), /What Verse says about it.*a red fox in snow/);
});

test('readableTextOf and textGateYes are exact about writing', () => {
  assert.deepEqual(readableTextOf(['Fortune', 'favaors', 'the bold']), ['Fortune', 'favaors', 'the', 'bold']);
  assert.deepEqual(readableTextOf(['', 'A', 'ok']), ['ok']);
  assert.equal(textGateYes('YES'), true);
  assert.equal(textGateYes('no'), false);
  assert.equal(textGateYes('The answer is YES there is text'), true);
  assert.equal(textGateYes(''), false);
  assert.match(TEXT_GATE_ASK, /YES or NO/);
});

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null });
  return { prepare: (sql) => stmt(sql), raw: db };
}

test('a painting the vision gate flags is not kept; a clean retry is', async () => {
  route.resetReady();
  let paints = 0, visions = 0;
  const env = {
    DB: d1(), SALT: 'test-salt', ART_POLLINATIONS: '0',
    AI: {
      run: async (model, o) => {
        if (model === models('merge') || model === models('answer')) {
          // vision uses the same free model; tell YES on the first look and NO on the retry
          const parts = o && o.messages && o.messages[0] && o.messages[0].content;
          const ask = Array.isArray(parts) ? String((parts.find((p) => p.type === 'text') || {}).text || '') : '';
          if (ask.includes('readable words')) {
            visions++;
            return { response: visions === 1 ? 'YES' : 'NO' };
          }
          return { response: '' }; // no director scene
        }
        paints++;
        return { image: JPEG };
      },
    },
  };
  const r = await route.onRequestPost({
    env,
    request: new Request('https://x/api/card-art', { method: 'POST', headers: { 'cf-connecting-ip': '9.9.9.9' }, body: JSON.stringify({ subject: 'proverb', kind: 'skill', rarity: 'mythic' }) }),
  });
  const j = await r.json();
  assert.equal(j.state, 'art');
  assert.equal(j.cached, false);
  assert.equal(paints, 2, 'one rejected paint, one clean retry');
  assert.equal(visions, 2);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM void_art').get().n, 1);
});

test('a painting that keeps showing writing becomes a plate and is never stored', async () => {
  route.resetReady();
  const env = {
    DB: d1(), SALT: 'test-salt', ART_POLLINATIONS: '0',
    AI: {
      run: async (model, o) => {
        if (model === models('merge') || model === models('answer')) {
          const parts = o && o.messages && o.messages[0] && o.messages[0].content;
          const ask = Array.isArray(parts) ? String((parts.find((p) => p.type === 'text') || {}).text || '') : '';
          if (ask.includes('readable words')) return { response: 'YES' };
          return { response: '' };
        }
        return { image: JPEG };
      },
    },
  };
  const j = await (await route.onRequestPost({
    env,
    request: new Request('https://x/api/card-art', { method: 'POST', headers: { 'cf-connecting-ip': '8.8.8.8' }, body: JSON.stringify({ subject: 'quote', kind: 'skill' }) }),
  })).json();
  assert.equal(j.state, 'plate');
  assert.equal(j.why, 'text');
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM void_art').get().n, 0);
});
