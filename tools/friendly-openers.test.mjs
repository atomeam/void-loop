// The friendly openers and closers (void.html / index.html shortForms, lists run 7; the site tester's teach items): "yo ...",
// "can we play ...", "...? pls" read as the ask inside them, the same on both pages. Run: node --test tools/friendly-openers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lineOf = (f) => {
  const src = readFileSync(new URL('../void-live-deploy/' + f, import.meta.url), 'utf8');
  const m = src.match(/\n\s*(t = t\.replace\(\/\^yo\+.*;)\n/);
  assert.ok(m, 'the openers line is in ' + f);
  return m[1];
};
test('both pages carry the same openers line', () => assert.equal(lineOf('void.html'), lineOf('index.html')));
test('the ask inside the opener is what routes', () => {
  const strip = new Function('t', lineOf('void.html') + ' return t;');
  const cases = {
    'yo what does ephemeral mean': 'what does ephemeral mean', 'yo play despacito': 'play despacito', 'yo watch the apollo 11 landing': 'watch the apollo 11 landing',
    'yo, summarize this transcript: a b c': 'summarize this transcript: a b c', 'can we play despacito': 'play despacito', 'could we watch the moon landing?': 'watch the moon landing',
    'what did this video teach? pls': 'what did this video teach?',
    // left as they are
    'yoga poses': 'yoga poses', 'yo': 'yo', 'can we play a game': 'can we play a game', 'can we play chess or checkers': 'play chess or checkers',
    'yo-yo tricks': 'yo-yo tricks', 'play despacito': 'play despacito',
  };
  for (const [a, want] of Object.entries(cases)) assert.equal(strip(a), want, a);
});
