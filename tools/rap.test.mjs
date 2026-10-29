// Verse raps (/rap/, skills/rap.js, lib/rap.js; owner, 2026-10-29: "Verse should learn to rap for those who hear the name and think thats what it is"):
// which asks reach the rap card, how a written rap is read back and checked, its rhyme scheme and counts, the beat and timing, and a rap carried in a link
import test from 'node:test';
import assert from 'node:assert/strict';
import { rapAskOf, settingsOf, rapMessages, parseRap, rapText, schemeOf, rhymeKeyOf, syllablesOf, statsOf, beatFor, timingOf, lengthOf, linkOf, fromLink, cleanRap, cacheKeyOf, STYLES, MOODS, FLOWS, RAP_MAX } from '../void-live-deploy/lib/rap.js';
import { PROBES, RAP_LINK } from './tower-probes.mjs';
import { LANE_PAGES, LANE_EXTRAS } from '../void-live-deploy/lib/tower.js';
import { JOURNEYS } from '../void-live-deploy/lib/tower-journeys.js';
import rap from '../void-live-deploy/skills/rap.js';

const SAMPLE = fromLink(RAP_LINK.split('?')[1]).rap;

test('asks for a rap reach the card, with the topic, style and mood read from them', () => {
  for (const [ask, topic] of [['write me a rap about pizza', 'pizza'], ['rap about my dog', 'my dog'], ['spit some bars about mondays', 'mondays'], ['drop a verse about coffee', 'coffee'], ['freestyle about the moon', 'the moon'], ['can you rap', ''], ['make a rap song about summer', 'summer']]) {
    const a = rapAskOf(ask); assert.ok(a, ask); assert.equal(a.topic, topic, ask); assert.ok(rap.match(ask.toLowerCase(), ask), ask);
  }
  assert.equal(rapAskOf('a trap rap about rainy days').style, 'trap');
  for (const ask of rap.nearMisses) assert.equal(rapAskOf(ask), null, ask);
  for (const ask of ['what is rap', 'i hate rap', 'make me a song', 'make a beat', 'gift wrap this']) assert.equal(rapAskOf(ask), null, ask);
});

test('settings are clamped to the known styles, moods, flows and views, and the topic and words are cut to length', () => {
  const s = settingsOf({ topic: 'x'.repeat(500), style: 'polka', mood: 'sleepy', flow: 'warp', view: 'fourth', words: 'y'.repeat(500), seed: -4 });
  assert.equal(s.topic.length, 160); assert.equal(s.words.length, 160); assert.ok(STYLES[s.style]); assert.ok(MOODS[s.mood]); assert.ok(FLOWS[s.flow]); assert.equal(s.view, 'first'); assert.equal(s.seed, 0);
  assert.equal(cacheKeyOf(settingsOf({ topic: 'Pizza' })), cacheKeyOf(settingsOf({ topic: 'pizza ' })), 'the same settings, the same rap for a week');
  assert.notEqual(cacheKeyOf(settingsOf({ topic: 'pizza' })), cacheKeyOf(settingsOf({ topic: 'pizza', seed: 1 })), 'another take is another rap');
});

test('the model is told the settings, and asks about real people or hate are refused before any call', () => {
  const m = rapMessages({ topic: 'my cat', style: 'trap', mood: 'funny', words: 'meow' });
  assert.ok(m.messages); const user = m.messages[m.messages.length - 1].content;
  for (const w of ['my cat', 'trap', 'funny', 'meow']) assert.ok(user.toLowerCase().includes(w), w);
  assert.match(m.messages[0].content, /\[Hook\]/);
  const bad = rapMessages({ topic: 'a sex scene' }); assert.ok(bad.error && bad.refused, 'refused');
});

test('a rap is read back from the model\'s text: its title, two verses and a hook; too little is no rap', () => {
  assert.equal(SAMPLE.title, 'Slice of the Night');
  assert.deepEqual(SAMPLE.sections.map((s) => [s.name, s.bars.length]), [['Verse 1', 8], ['Hook', 4], ['Verse 2', 8]]);
  assert.equal(parseRap('Title: Short\n[Verse 1]\nonly one bar'), null);
  assert.deepEqual(parseRap(rapText(SAMPLE)), SAMPLE, 'the text of a rap reads back as the same rap');
});

test('rhymes are found from the words: the scheme, the counts, and syllables', () => {
  assert.equal(rhymeKeyOf('low'), rhymeKeyOf('snow')); assert.equal(rhymeKeyOf('night'), rhymeKeyOf('light')); assert.notEqual(rhymeKeyOf('hand'), rhymeKeyOf('sky'));
  assert.equal(syllablesOf('pepperoni'), 4); assert.equal(syllablesOf('cheese'), 1);
  const bars = SAMPLE.sections.flatMap((s) => s.bars), sc = schemeOf(bars);
  assert.equal(sc.letters.filter(Boolean).length, 18); assert.equal(sc.letters[0], sc.letters[1]);
  assert.deepEqual(statsOf(SAMPLE), { bars: 20, sections: 3, rhymed: 18, avgSyllables: 11.8 });
});

test('each style has its own beat, and the bars are timed one a measure after a count-in', () => {
  for (const [name, st] of Object.entries(STYLES)) { const b = beatFor(settingsOf({ topic: 'x', style: name })); assert.ok(b.bpm >= st.bpm[0] && b.bpm <= st.bpm[1], name + ' ' + b.bpm); }
  assert.equal(beatFor(settingsOf({ topic: 'pizza' })).bpm, 90);
  const beat = beatFor(settingsOf({ topic: 'pizza' })), t = timingOf(SAMPLE, beat, 'steady');
  assert.equal(t.length, 20); const bar = 4 * 60 / beat.bpm;
  assert.ok(Math.abs(t[0].at - bar) < 1e-9, 'one measure to count in'); assert.ok(Math.abs(t[1].at - t[0].at - bar) < 1e-9, 'a bar a measure');
  for (const b of t) assert.ok(b.rate >= 0.75 && b.rate <= 2, 'a voice rate a browser can say');
  assert.ok(lengthOf(t, beat) > t[t.length - 1].at);
});

test('a rap travels whole in its link and opens exactly as written; a link with a topic alone asks for one', () => {
  const s = settingsOf({ topic: 'pizza', style: 'drill', mood: 'gritty', words: 'extra cheese', seed: 2 });
  const back = fromLink(linkOf(s, SAMPLE).split('?')[1]);
  assert.deepEqual(back.settings, s); assert.deepEqual(back.rap, SAMPLE); assert.equal(back.asked, true);
  assert.ok(RAP_LINK.length < RAP_MAX * 3);
  assert.equal(fromLink('').rap, null); assert.equal(fromLink('').asked, false);
});

test('a bar with a word the model was told never to write is taken out; a rap left too short is none', () => {
  const r = { title: 'x', sections: [{ name: 'Verse 1', bars: [...SAMPLE.sections[0].bars.slice(0, 7), 'grab the glock and go'] }] };
  assert.equal(cleanRap(r), null, '7 clean bars is too short');
  assert.equal(cleanRap(SAMPLE).sections.flatMap((s) => s.bars).length, 20);
});

test('/rap/ is on Versus\' music lane against neuralframes.com, with a probe for every aspect and a journey script for each journey', async () => {
  assert.equal(LANE_PAGES['music: neuralframes.com'], '/rap/');
  const p = PROBES['music: neuralframes.com']; assert.equal(p.verse, '/rap/'); assert.equal(p.ask.verse, RAP_LINK);
  for (const a of LANE_EXTRAS['music: neuralframes.com']) assert.ok(p.askParts[a], a);
  const { SCRIPTS } = await import('./tower-journeys.mjs');
  for (const j of JOURNEYS['music: neuralframes.com']) assert.equal(typeof SCRIPTS['music: neuralframes.com'][j], 'function', j);
});

test('the stage: the meta line is counted from the rap, English voices come first, and a browser with no Web Audio is told so', async () => {
  const { metaLine, voicesOf, performer } = await import('../void-live-deploy/lib/rap-stage.js');
  const s = settingsOf({ topic: 'pizza' });
  assert.equal(metaLine(SAMPLE, s, beatFor(s)), 'Boom bap · confident · 90 BPM · 20 bars in 3 parts · 18 of 20 bars end on a rhyme · about 11.8 syllables a bar');
  const synth = { getVoices: () => [{ name: 'Fr', lang: 'fr-FR', localService: true }, { name: 'Net', lang: 'en-US', localService: false }, { name: 'Local', lang: 'en-GB', localService: true }] };
  assert.deepEqual(voicesOf(synth).map((v) => v.name), ['Local', 'Net']); assert.deepEqual(voicesOf(null), []);
  const said = []; const p = performer(SAMPLE, s, { win: {}, onSay: (t) => said.push(t) });
  assert.equal(p.play('voice'), false); assert.match(said[0], /no Web Audio/); assert.equal(p.playing, false);
  assert.ok(p.total > 20 * 4 * 60 / 90, 'the whole rap fits: 20 bars and the count-in');
});
