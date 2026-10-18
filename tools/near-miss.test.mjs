// lib/near-miss.js: a near miss becomes a visible proposal (asked by Verse twice, 2026-10-14). The router's nearest skill,
// when it scored near its bar, gives the card "Did you mean <that skill's first example>?" as a data-ask link.
import assert from 'node:assert/strict';
import { nearOf, proposalOf, proposalHtml, CLOSE } from '../void-live-deploy/lib/near-miss.js';
import { SKILLS, CLOSE as ROUTER_CLOSE, TUNING } from '../void-live-deploy/lib/router.js';

assert.equal(CLOSE, ROUTER_CLOSE, 'the same closeness the route bench uses');
const skills = { weather: { examples: ['weather in Tokyo', 'will it rain tomorrow'] }, timer: { examples: [] }, odd: { examples: [42] } };

// a simple or hard route whose nearest skill scored within CLOSE of the bar: that skill, its first example
assert.deepEqual(nearOf({ kind: 'simple', score: 0.1, nearest: { skill: 'weather', score: 0.64, bar: 0.7, held: 'below-bar' } }, skills),
  { skill: 'weather', score: 0.64, bar: 0.7, example: 'weather in Tokyo' });
assert.equal(nearOf({ kind: 'simple', nearest: { skill: 'weather', score: 0.59, bar: 0.7 } }, skills), null, 'too far under the bar');
assert.equal(nearOf({ kind: 'simple', nearest: { skill: 'weather', score: 0.6, bar: 0.7 } }, skills).skill, 'weather', 'exactly CLOSE under the bar counts');
assert.equal(nearOf({ kind: 'hard', nearest: { skill: 'weather', score: 0.69, bar: 0.7, held: 'too-close-to-non-skill' } }, skills).skill, 'weather');
// a 'skill' route (the page's parsers missed a phrasing the router knew): that skill, whatever the score
assert.equal(nearOf({ kind: 'skill', skill: 'weather', score: 0.8 }, skills).example, 'weather in Tokyo');
// nothing to propose: no nearest, a fallback, a skill with no examples, an unknown or unsafe name, a bad score
assert.equal(nearOf({ kind: 'simple' }, skills), null);
assert.equal(nearOf({ kind: 'fallback', why: 'timeout' }, skills), null);
assert.equal(nearOf({ kind: 'simple', nearest: { skill: 'timer', score: 0.7, bar: 0.7 } }, skills), null, 'no example to offer');
assert.equal(nearOf({ kind: 'simple', nearest: { skill: 'odd', score: 0.7, bar: 0.7 } }, skills), null, 'an example that is not a string');
assert.equal(nearOf({ kind: 'simple', nearest: { skill: 'nope', score: 0.7, bar: 0.7 } }, skills), null);
assert.equal(nearOf({ kind: 'simple', nearest: { skill: '<b>x</b>', score: 0.7, bar: 0.7 } }, skills), null);
assert.equal(nearOf({ kind: 'simple', nearest: { skill: 'weather', score: 'high', bar: 0.7 } }, skills), null);
assert.equal(nearOf(null, skills), null); assert.equal(nearOf({ kind: 'skill', skill: 'weather' }, null), null);
// the real router table: every skill it names has a first example to offer
for (const [k, v] of Object.entries(SKILLS)) assert.equal(nearOf({ kind: 'simple', nearest: { skill: k, score: TUNING.skillMin, bar: TUNING.skillMin } }, SKILLS).example, v.examples[0], k);

// the page's side: what /api/answer sent -> the line and the link
const near = nearOf({ kind: 'simple', nearest: { skill: 'weather', score: 0.64, bar: 0.7 } }, skills);
assert.deepEqual(proposalOf(near), { skill: 'weather', ask: 'weather in Tokyo', line: 'Did you mean “weather in Tokyo”?' });
assert.equal(proposalOf(null), null); assert.equal(proposalOf({}), null); assert.equal(proposalOf('weather'), null);
assert.equal(proposalOf({ skill: 'weather', example: 'x'.repeat(121) }), null, 'too long for a link');
assert.equal(proposalOf({ skill: 'weather', example: '<img src=x>' }), null, 'markup never becomes an ask');
assert.equal(proposalOf({ skill: 'we ather', example: 'weather' }), null, 'a name with a space is not a skill');
assert.equal(proposalOf({ skill: 'weather', example: '  weather   in  Tokyo ' }).ask, 'weather in Tokyo', 'spacing tidied');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
assert.equal(proposalHtml(esc, near), '<div class="src near-miss">Did you mean <a href="#" data-ask="weather in Tokyo" data-skill="weather">weather in Tokyo</a>?</div>');
assert.equal(proposalHtml(esc, proposalOf(near)), proposalHtml(esc, near), 'a proposal or the raw near: the same line');
assert.equal(proposalHtml(esc, null), ''); assert.equal(proposalHtml(esc, { skill: 'weather', example: '' }), '');
assert.ok(proposalHtml(esc, { skill: 'weather', example: 'say "hi" & go' }).includes('data-ask="say &quot;hi&quot; &amp; go"'), 'escaped for the attribute');
console.log('near-miss: ok');
