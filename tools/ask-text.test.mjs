// Convergence step 1 (docs/convergence.md): 23 skills shared one ask tidier as copied lines; lib/ask-text.js now holds it.
// This proves the shared helper gives exactly what each of the three old copies gave, and that every merged skill still
// matches its own examples. Run: node --test tools/ask-text.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { clean, cleanLower } from '../void-live-deploy/lib/ask-text.js';

const OLD_LOWER_A = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
const OLD_LOWER_B = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const OLD_PLAIN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const CORPUS = ['', null, undefined, 0, 'What is X?', '  Show   me THE moon?!  ', 'a ?', 'Hello...', '?!', 'tab\there\nnew line.',
  'İstanbul weather?', 'ÉCLAIR recipe!', '3.5', 'end with dots...  ', 'mixed ?! . ', 'nbsp\u00a0space?', 'emoji 🚀?'];

test('ask-text: clean and cleanLower match every old copy on a mixed corpus', () => {
  const rnd = []; let x = 7; const ch = ' aZ?!.\t\nÉİ.';
  for (let i = 0; i < 2000; i++) { let s = ''; for (let j = 0; j < 12; j++) { x = (x * 1103515245 + 12345) % 2147483648; s += ch[x % ch.length]; } rnd.push(s); }
  for (const s of [...CORPUS, ...rnd]) {
    assert.equal(clean(s), OLD_PLAIN(s), JSON.stringify(s));
    assert.equal(cleanLower(s), OLD_LOWER_A(s), JSON.stringify(s));
    assert.equal(cleanLower(s), OLD_LOWER_B(s), JSON.stringify(s));
  }
});

test('ask-text: every skill that uses it still matches its own examples', async () => {
  const dir = new URL('../void-live-deploy/skills/', import.meta.url);
  const users = readdirSync(dir).filter((f) => f.endsWith('.js') && readFileSync(new URL(f, dir), 'utf8').includes("lib/ask-text.js"));
  assert.ok(users.length >= 23, 'merged skills: ' + users.length);
  let checked = 0;
  for (const f of users) {
    const m = await import(new URL(f, dir)); const sk = m.default;
    if (!sk || typeof sk.match !== 'function' || !Array.isArray(sk.examples)) continue;
    for (const e of sk.examples) { assert.ok(sk.match(String(e).toLowerCase(), String(e)), f + ': ' + e); checked++; }
  }
  assert.ok(checked > 0);
});
