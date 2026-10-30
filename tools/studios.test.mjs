// skills/studios.js: every studio page's own "See it on the stage" ask, its floor ask and its label open a card for that studio; look-alikes do not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import skill, { STUDIOS, studios, studioOf } from '../void-live-deploy/skills/studios.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('each studio page\'s own stage link opens that studio', () => {
  for (const s of STUDIOS) {
    const html = readFileSync(resolve(root, 'void-live-deploy' + s.page + 'index.html'), 'utf8');
    const asks = [...html.matchAll(/href="\/\?ask=([^"]+)"/g)].map((m) => decodeURIComponent(m[1]));
    assert.ok(asks.length, s.page + ' has a stage link');
    for (const a of asks) assert.equal(studioOf(a) && studioOf(a).page, s.page, s.page + ': "' + a + '"');
  }
});

test('floor asks and labels open the studio; look-alikes do not', () => {
  for (const s of studios()) { assert.ok(s.label && s.label !== s.page, s.page + ' has a label'); for (const a of s.asks) assert.equal(studioOf(a).page, s.page, a); }
  for (const a of ['open the cpan testers studio', 'show me verse bookshelf', 'Paint by numbers?', 'Hosting & Domain Studio']) assert.ok(studioOf(a), a);
  for (const a of skill.nearMisses) assert.equal(studioOf(a), null, a);
  // 2026-10-30, on a-to-mind.com: these gave a web article, not the studio
  for (const [a, page] of [['paint by numbers studio', '/paint/'], ['cpan testers results', '/cpan/'], ['score my tournament', '/tournaments/'], ['the obituaries page', '/obituaries/']]) assert.equal(studioOf(a) && studioOf(a).page, page, a);
  for (const a of ['paint studio', 'tournament', 'my page', 'studio']) assert.equal(studioOf(a), null, a);
  for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
});

test('the card escapes, links the studio and says nothing it cannot back', () => {
  let html = '', page = '';
  const el = { dataset: {}, set innerHTML(v) { html = v; } };
  const name = skill.run('cpan testers', { showPage: (b) => { b(el); page = el.dataset.page; }, esc: (s) => String(s).replace(/[<>&"]/g, '') });
  assert.equal(name, 'studios'); assert.equal(page, '/cpan/');
  assert.match(html, /href="\/cpan\/"/); assert.match(html, /cpantesters\.org/);
  assert.doesNotMatch(html, /\bfight|\bbeat|\bbetter than\b|V01D/i);
});
