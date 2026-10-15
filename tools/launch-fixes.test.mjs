// node --test tools/launch-fixes.test.mjs: the four live bugs the launch audit found (2026-10-15), each kept fixed.
//   1. "play voidquest" / "play solar quest" open VoidQuest (skills/monopoly.js, its own board on the property-game rules)
//   2. a model's markdown (a comic's **Title:** and *name*) renders, never shows raw asterisks (lib/md.js via void.html fixHtml)
//   3. "what are you?" leads with V01D's self-answer and the canon's motto, word for word (void.html SELF_LEAD)
//   4. a game's "How to play" never stays over the board: × , Esc and the first tap off it close it (skills/howto.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

test('1. play voidquest opens VoidQuest, not "I don\'t know this yet"', async () => {
  const mono = await import('../void-live-deploy/skills/monopoly.js');
  for (const ask of ['play voidquest', 'Play VoidQuest!', 'play void quest', "let's play voidquest", 'voidquest', 'play solar quest', 'start a game of voidquest', 'play voidquest against void'])
    assert.deepEqual(mono.monopolyOf(ask), { kind: 'game', theme: 'voidquest' }, ask);
  assert.deepEqual(mono.monopolyOf('play monopoly'), { kind: 'game' }, 'the property game keeps its own board');
  for (const near of ['what is voidquest about', 'solar system', 'quest']) assert.equal(mono.monopolyOf(near), null, near);
  assert.equal(mono.default.match('play voidquest', 'play voidquest'), true);
  assert.ok(mono.default.stageKinds.voidquest && mono.default.stageKinds.voidquest.mount, 'VoidQuest has its own card');
  assert.equal(mono.VOIDQUEST_NAMES.length, 40, 'a name for every space');
  const vq = mono.THEMES.voidquest;
  assert.equal(mono.spaceName(vq, 0), 'Launch');
  assert.equal(mono.themeText(vq, 'bought Old Mill Row for 60'), 'bought Ceres Dock for 60', 'the log speaks VoidQuest');
  assert.equal(mono.themeText(mono.THEMES.monopoly, 'bought Old Mill Row for 60'), 'bought Old Mill Row for 60');
  assert.doesNotMatch(mono.VOIDQUEST_NAMES.join(' '), /solar quest|monopoly/i, 'original names, no trademark');
});

test('2. a comic\'s markdown renders: no raw asterisks', async () => {
  const { mdBlock } = await import('../void-live-deploy/lib/md.js');
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const comic = '**Title:** *Mech-Mew: The Purr-fect Patrol*\n**Panel 1 – Intro splash**\nA neon-lit city. Caption: “When the city needs a guardian…”\n\n- **Squeak-Bot** shouts\n- _Feather-Flop_ naps\n\n## The end';
  const h = mdBlock(comic, esc);
  assert.doesNotMatch(h.replace(/<[^>]+>/g, ''), /\*|(^|\s)_\S|##/, 'no markdown marks left in the text');
  assert.match(h, /<b>Title:<\/b> <i>Mech-Mew: The Purr-fect Patrol<\/i>/);
  assert.match(h, /<ul><li><b>Squeak-Bot<\/b> shouts<\/li><li><i>Feather-Flop<\/i> naps<\/li><\/ul>/);
  assert.match(h, /<h4>The end<\/h4>/);
  assert.equal(mdBlock('<script>x</script> **a**', esc), '<p>&lt;script&gt;x&lt;/script&gt; <b>a</b></p>', 'still escaped');
  assert.equal(mdBlock('2*3*4 and snake_case_name', esc), '<p>2*3*4 and snake_case_name</p>', 'sums and names are left alone');
  const html = read('void.html');
  assert.match(html, /import\('\/lib\/md\.js'\)/);
  assert.match(html, /mdLib \? mdLib\.mdBlock\(part\.trim\(\), esc\)/, 'answers go through it');
  assert.match(html, /await mdReady;/, 'an answer waits for it, so the first one renders too');
});

test('3. "what are you?" answers as V01D with the canon\'s motto', () => {
  const html = read('void.html'), canon = read('domains/void.canon.md');
  const motto = (/^## Motto\n(.+)$/m.exec(canon) || [])[1];
  assert.ok(motto, 'the canon has a motto');
  assert.ok(html.includes("const MOTTO = '" + motto.trim() + "';"), 'void.html says the canon\'s motto word for word');
  const re = new Function('return ' + /function wantsIdentity\(lower\) \{\s*return (\/.*\/)\.test\(lower\);/.exec(html)[1])();
  for (const ask of ['what are you?', 'who are you', 'what is void', 'what is v01d', 'tell me about yourself', "what's your motto"]) assert.ok(re.test(ask), ask);
  assert.ok(!re.test('play chess'));
  assert.match(html, /wantsIdentity\(lower0\) \? SELF_LEAD : undefined/, 'the self page leads with it');
  assert.match(html, /const SELF_LEAD = .*MOTTO/);
});

test('4. "How to play" never stays over the board', () => {
  const src = read('void-live-deploy/skills/howto.js');
  assert.match(src, /className = 'howto-x'/, 'a close button on the panel');
  assert.match(src, /e\.key === 'Escape'/, 'Esc closes it');
  assert.match(src, /addEventListener\('pointerdown', onTap, true\)/, 'the first tap off it (a move) folds it');
  assert.match(src, /max-height:min\(46vh,340px\)/, 'never taller than half the screen');
});
