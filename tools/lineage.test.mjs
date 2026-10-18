// Name lineage (asked by Verse, twice): the self family quietly remembers V01D and Void. node --test tools/lineage.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { lineageOf, isSelf } from '../void-live-deploy/lib/lineage.js';
import { chromeHtml } from '../void-live-deploy/lib/card-frame.js';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const card = (chapter) => ({ chapter, typeLine: 'Skill — ' + chapter, adds: 'a thing', rarity: null, hue: 200, power: null, name: 'x', key: 'x' });
test('only the self family has a lineage, and it says V01D then Void', () => {
  assert.equal(lineageOf('Verse itself'), 'Verse, formerly V01D (and before that Void)'); assert.equal(lineageOf('self'), lineageOf('Verse itself'));
  assert.equal(lineageOf('Games'), ''); assert.equal(lineageOf(''), ''); assert.equal(lineageOf(null), ''); assert.ok(isSelf(' VERSE ITSELF '));
});
test('a self-family card carries the hover and data trace on its type bar and adds line, any other card does not', () => {
  const parts = chromeHtml(card('Verse itself'), esc), h = parts.type + parts.adds;
  assert.match(h, /<div class="vc-type" title="Verse, formerly V01D \(and before that Void\)" data-lineage=/); assert.match(h, /<b title="Verse, formerly V01D/);
  const og = chromeHtml(card('Games'), esc), o = og.type + og.adds; assert.ok(!o.includes('data-lineage') && !o.includes('formerly'));
  assert.ok(!h.replace(/<[^>]*>/g, '').includes('formerly'), 'never visible text, only a hover');
});
test('families.json says the self family was V01D and Void', () => {
  const f = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/families.json', import.meta.url), 'utf8')).families.find((x) => x.id === 'self');
  assert.deepEqual(f.formerly, ['V01D', 'Void']); assert.equal(f.name, 'Verse itself');
});
