// node --test tools/launch-fixes.test.mjs: the four live bugs the launch audit found (2026-10-15), each kept fixed.
//   1. "play voidquest" / "play solar quest" open VoidQuest (skills/monopoly.js, its own board on the property-game rules)
//   2. a model's markdown (a comic's **Title:** and *name*) renders, never shows raw asterisks (lib/md.js via void.html fixHtml)
//   3. "what are you?" leads with Verse's self-answer and the canon's motto, word for word (void.html SELF_LEAD)
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
  await mono.ready(); // the property-game rules load with the first board (lib/load-later.js); spaceName and themeText read them
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

test('3. "what are you?" answers as Verse with the canon\'s motto', () => {
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
  // its height is the game panel's now (2026-10-18, game panels fit): the side card is the one box, sized by lib/panel-fit.js to stop above the ask bar
  assert.match(read('void-live-deploy/skills/side-card.js'), /fitPanel\(/, 'the panel is fitted above the ask bar');
});

test('5. the real game\'s name finds the Verse version (owner, 2026-10-15)', async () => {
  const skill = async (n) => (await import('../void-live-deploy/skills/' + n + '.js')).default;
  const routes = {
    monopoly: ['solarquest', 'solar quest', 'play solarquest', 'solar quest board game', 'play monopoly', 'monopoly board game'],
    fireworks: ['hanabi', 'play hanabi', 'hanabi card game'],
    sorry: ['play sorry', 'sorry board game'], battleship: ['play battleship'], connect4: ['play connect four'], othello: ['play reversi'],
  };
  for (const [n, asks] of Object.entries(routes)) { const s = await skill(n); for (const a of asks) assert.ok(s.match(a.toLowerCase(), a), a + ' -> ' + n); }
  const mono = await import('../void-live-deploy/skills/monopoly.js');
  for (const a of routes.monopoly.slice(0, 4)) assert.equal(mono.monopolyOf(a).theme, 'voidquest', a);
  assert.match(mono.THEMES.voidquest.sub, /our version of SolarQuest/);
  assert.match(read('void-live-deploy/skills/monopoly.js'), /VoidQuest, our version of SolarQuest/);
  assert.match(read('void-live-deploy/skills/fireworks.js'), /Fireworks, our version of Hanabi/);
});

test('a numbered list split by blank lines is one list, numbered 1, 2, 3 (owner, 2026-10-18: "it is failing to increment the <ol> index")', async () => {
  const { mdBlock } = await import('../void-live-deploy/lib/md.js'), e = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  assert.equal(mdBlock('1. **Hover** - a\n\n1. **Pressed** - b\n\n1. **Growth** - c\n\nwritten by Verse', e),
    '<ol><li><b>Hover</b> - a</li><li><b>Pressed</b> - b</li><li><b>Growth</b> - c</li></ol><p>written by Verse</p>');
  assert.equal(mdBlock('3. c\n4. d', e), '<ol start="3"><li>c</li><li>d</li></ol>');
  assert.equal(mdBlock('1. a\n   more of a\n2. b', e), '<ol><li>a<br>more of a</li><li>b</li></ol>');
  assert.equal(mdBlock('- a\n- b\n\npara', e), '<ul><li>a</li><li>b</li></ul><p>para</p>');
  assert.equal(mdBlock('- a\n\n1. b', e), '<ul><li>a</li></ul><ol><li>b</li></ol>');
  assert.equal(mdBlock('1. a\n\n## Next\n\n1. b', e), '<ol><li>a</li></ol><h4>Next</h4><ol><li>b</li></ol>');
});
