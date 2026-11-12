// Convergence step 2, second half (lists run 21): urlOf (image, link) and the seven variants of the ask tidier (worldtime, calendar,
// releasenotes, growth, showcase, different, feelings) are one copy each in lib/ask-text.js. The old copies are kept here verbatim and
// compared on hand-picked and generated strings, so the move changed nothing a visitor sees.
// Run: node --test tools/ask-text-step2b.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { urlOf, cleanEnd, squash, cleanSaid, cleanFelt } from '../void-live-deploy/lib/ask-text.js';
import { urlOf as imageUrlOf } from '../void-live-deploy/skills/image.js';
import { urlOf as linkUrlOf } from '../void-live-deploy/skills/link.js';

const old = {
  urlOf(text) { const m = String(text || '').match(/https?:\/\/[^\s]+/i); return m ? m[0].replace(/[),.!]+$/, '') : null; },
  worldtime: (s) => s.replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim(),
  calendar: (s) => String(s || '').replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim(),
  releasenotes: (s) => String(s || '').trim().replace(/\s+/g, ' '),
  growth: (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/[’]/g, "'").replace(/\s+/g, ' '),
  showcase: (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' '),
  different: (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' '),
  feelings: (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.,\s]+$/, '').replace(/\s+/g, ' '),
};
const NOW = { worldtime: cleanEnd, calendar: cleanEnd, releasenotes: squash, growth: cleanSaid, showcase: cleanSaid, different: cleanSaid, feelings: cleanFelt };

const HAND = ['', ' ', 'What time is it in Paris?', 'time in paris? ', '  Show   me X?! ', 'what’s new this week…', "WHAT'S NEW.", 'how are you , ', 'do you love me?? ',
  'line one\nline two', '\t tabs\tand  spaces\t', 'İstanbul time?', 'a.b.c...', '?!.', 'see https://a.org/x.png).', 'go to https://a.org/x!', 'no link', 'HTTPS://A.ORG/Y,'];
const ALPHA = ['a', 'B', ' ', '  ', '\t', '\n', '?', '!', '.', ',', '’', "'", 'é', 'İ', 'h', 'ttps://', 'http://x.io/', ')', 'z'];
function* generated(n = 4000) { let x = 2463534242; const r = () => (x ^= x << 13, x ^= x >>> 17, x ^= x << 5, (x >>> 0) % ALPHA.length);
  for (let i = 0; i < n; i++) { let s = ''; const len = 1 + (i % 14); for (let j = 0; j < len; j++) s += ALPHA[r()]; yield s; } }

test('urlOf finds the same url as the two old copies, and image and link still export it', () => {
  for (const s of [...HAND, ...generated()]) { assert.equal(urlOf(s), old.urlOf(s), JSON.stringify(s)); assert.equal(imageUrlOf(s), old.urlOf(s)); assert.equal(linkUrlOf(s), old.urlOf(s)); }
  for (const s of [null, undefined]) assert.equal(urlOf(s), null);
});
test('each of the seven files tidies every string exactly as its old copy did', () => {
  for (const [file, fn] of Object.entries(NOW)) for (const s of [...HAND, ...generated()]) assert.equal(fn(s), old[file](s), file + ' ' + JSON.stringify(s));
  for (const file of ['calendar', 'releasenotes', 'growth', 'showcase', 'different', 'feelings']) for (const s of [null, undefined]) assert.equal(NOW[file](s), old[file](s), file);
});
test('no copy is left in the files that had one', () => {
  for (const f of ['image', 'link']) assert.doesNotMatch(readFileSync(new URL('../void-live-deploy/skills/' + f + '.js', import.meta.url), 'utf8'), /function urlOf\(/, f);
  for (const f of Object.keys(NOW)) assert.match(readFileSync(new URL('../void-live-deploy/skills/' + f + '.js', import.meta.url), 'utf8'), /const CLEAN = (cleanEnd|squash|cleanSaid|cleanFelt);/, f);
});
