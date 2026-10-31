// A cited sentence says only what its page says, and a stated quantity is converted exactly (coordinator, 2026-10-30: "5 m c" was answered
// "5 m/s (Mach): ... "5 m c" is an unconventional notation for Mach 5 [2]" and "the 3 mile run" was answered "the exact distance of three
// miles can vary depending on the surface ... [1]"). Run: node --test tools/cited-claims.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dropUnbackedClaims, unbacked, citesUnbacked, titledReadings, supportedOnly, INVENT_RULE } from '../void-live-deploy/lib/answer-honesty.js';
import { measureOf, measureRule, withMeasure, shown } from '../void-live-deploy/lib/measure-ask.js';
import { isNoAnswer } from '../void-live-deploy/lib/no-answer.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
// the pages the live answers cited (Wikipedia summaries, cut as functions/api/answer.js cuts them)
const FIVE_K = { title: '5000 metres', text: 'The 5000 metres or 5000-metre run is a common long-distance running event in track and field, approximately equivalent to 3 miles 188 yards or 16,404 feet 2 inches. It is one of the track events in the Olympic Games and the World Championships in Athletics.' };
const MACH = { title: 'Mach number', text: 'The Mach number (M or Ma), often only Mach, is a dimensionless quantity in fluid dynamics representing the ratio of flow velocity past a boundary to the local speed of sound.' };
const METHYL = { title: '5-Methylcytosine', text: '5-Methylcytosine is a methylated form of the DNA base cytosine (C) that regulates gene transcription.' };
const GALAXY = { title: 'Lockheed C-5 Galaxy', text: 'The Lockheed C-5 Galaxy is a large military transport aircraft designed and built by Lockheed.' };
// the two answers as the live stage gave them on 2026-10-30
const MILE_ANSWER = 'A 3-mile run is a middle-to-long distance foot race. While the exact distance of three miles can vary depending on the surface, a 5000-meter run is approximately equivalent to 3 miles and 188 yards, or 16,404 feet and 2 inches [1]. In many contexts, running three miles is a common benchmark.';
const MC_ANSWER = 'The ask is unclear. It could mean:\n5mC (5-Methylcytosine): A methylated form of the DNA base cytosine [1].\n5 m/s (Mach): A measurement of speed relative to the speed of sound, though "5 m c" is an unconventional notation for Mach 5 [2].\nC-5 Galaxy: A military transport aircraft [3].';

test('the 3 mile run: the invented "can vary depending on the surface" clause is cut, the rest of the sentence stays', () => {
  const out = dropUnbackedClaims(MILE_ANSWER, [FIVE_K]);
  assert.doesNotMatch(out, /vary|depending/i);
  assert.match(out, /A 5000-meter run is approximately equivalent to 3 miles and 188 yards, or 16,404 feet and 2 inches \[1\]\./);
  assert.match(out, /^A 3-mile run is a middle-to-long distance foot race\./, 'a sentence that cites nothing is the model\'s own and stays');
});

test('5 m c: the invented notation clause is cut, and the reading is named by its page, not "5 m/s (Mach)"', () => {
  const out = titledReadings(dropUnbackedClaims(MC_ANSWER, [METHYL, MACH, GALAXY]), [METHYL, MACH, GALAXY]);
  assert.doesNotMatch(out, /notation|m\/s/);
  assert.match(out, /^Mach number: A measurement of speed relative to the speed of sound \[2\]\.$/m);
  assert.match(out, /^C-5 Galaxy: A military transport aircraft \[3\]\.$/m, 'a label the page holds stays');
  assert.match(out, /^5-Methylcytosine: /m, 'a label with a word the page lacks takes the page title');
});

test('one line with a colon is a sentence, not a list of readings: its words stay (main red on the router checks, 2026-10-30)', () => {
  assert.equal(titledReadings('In short: a dimensionless quantity in fluid dynamics [1].', [MACH]), 'In short: a dimensionless quantity in fluid dynamics [1].');
  assert.equal(titledReadings('Gemma: a short answer [1].', [{ title: 'Topic', text: 'A sourced extract: a short answer.' }]), 'Gemma: a short answer [1].');
  assert.match(titledReadings('5 m/s (Mach): speed [1].\nIn short: speed [1].', [MACH]), /^Mach number: speed \[1\]\.\nMach number: speed \[1\]\.$/, 'two readings are relabelled');
});

test('a caveat or a notation the cited page makes stays', () => {
  const tide = { title: 'Tide', text: 'The height of the tide varies with the phase of the Moon and depends on the shape of the coastline.' };
  assert.equal(dropUnbackedClaims('The height of a tide can vary depending on the Moon [1].', [tide]), 'The height of a tide can vary depending on the Moon [1].');
  const nasa = { title: 'NASA', text: 'The National Aeronautics and Space Administration (NASA) is an independent agency of the US federal government.' };
  assert.equal(unbacked('NASA stands for National Aeronautics and Space Administration [1].', nasa.text), false);
  assert.equal(unbacked('"5 m c" is a notation for Mach 5 [1].', nasa.text), true, 'a quoted phrase the page lacks is still unbacked');
});

test('a whole sentence that is the unbacked claim goes; an uncited caveat (the model\'s own) stays', () => {
  assert.equal(dropUnbackedClaims('The 5000 metres is a track event [1]. Its length varies by stadium [1].', [FIVE_K]), 'The 5000 metres is a track event [1].');
  assert.equal(dropUnbackedClaims('It depends on your pace.', [FIVE_K]), 'It depends on your pace.');
  assert.equal(dropUnbackedClaims('Code [1]. ```js\nx.varies depending on y [1].\n```', [FIVE_K]), 'Code [1]. ```js\nx.varies depending on y [1].\n```', 'a code block is left as it is');
});

test('an answer with no sources is not checked: there is nothing to check it against', () => {
  assert.equal(dropUnbackedClaims('The time can vary depending on traffic [1].', []), 'The time can vary depending on traffic [1].');
});

test('word overlap alone kept both bad markers: the new check is what cuts them', () => {
  // supportedOnly (word overlap) passes the Mach line; the cited-claim check is the step that catches it
  assert.match(supportedOnly(MC_ANSWER, [METHYL, MACH, GALAXY]).answer, /notation for Mach 5 \[2\]/);
  assert.doesNotMatch(supportedOnly(dropUnbackedClaims(MC_ANSWER, [METHYL, MACH, GALAXY]), [METHYL, MACH, GALAXY]).answer, /notation/);
});

test('a cached answer that cites a caveat or a notation is answered again, not served', () => {
  assert.equal(citesUnbacked(MILE_ANSWER), true);
  assert.equal(citesUnbacked(MC_ANSWER), true);
  assert.equal(citesUnbacked('Marie Curie won two Nobel Prizes [1]. It depends on how you count.'), false, 'an uncited caveat does not count');
});

test('a stated quantity is converted exactly: a 3 mile run is 4.83 km', () => {
  const m = measureOf('the 3 mile run');
  assert.equal(m.sentence, '3 miles is 4.83 km (4,828 m).');
  assert.equal(measureOf('5k run').out, '3.11 miles');
  assert.equal(measureOf('a 10 km walk').out, '6.21 miles');
  assert.equal(measureOf('half a mile').out, '805 metres');
  assert.equal(measureOf('60 mph').out, '96.6 km/h');
  assert.equal(measureOf('3 miles per hour').out, '4.83 km/h', 'a speed is not read as a distance');
  assert.equal(measureOf('4,000 miles').out, '6,437 km', 'a thousands comma is not a decimal point');
  assert.equal(measureOf('2 lbs of flour').out, '0.907 kg');
  assert.equal(shown(4828.032), '4,828');
});

test('an ask with no clear quantity is not converted', () => {
  for (const a of ['5 m c', '5 g', 'marathon', 'the 3 musketeers', 'top 5 movies', 'c-5 galaxy', '5k']) assert.equal(measureOf(a), null, a);
});

test('the conversion leads the answer only when the model left it out', () => {
  const m = measureOf('the 3 mile run');
  assert.equal(withMeasure('A 3-mile run is a common race [1].', m), '3 miles is 4.83 km (4,828 m). A 3-mile run is a common race [1].');
  assert.equal(withMeasure('A 3 mile run is 4.83 km [1].', m), 'A 3 mile run is 4.83 km [1].');
  assert.match(measureRule(m), /never say it varies/);
});

test('a refusal on a stated quantity becomes the conversion, not Not found', () => {
  // live, 2026-10-30 06:12Z after #1759: the model refused from the Mile run and 5000 metres pages, the conversion led the refusal, and the card said Not found
  const m = measureOf('the 3 mile run');
  for (const refusal of ['I do not have information about "the 3 mile run" in the provided sources.', 'I could not find any information regarding the 3 mile run. The sources describe the mile run and the 5000 metres [1][2].']) {
    assert.equal(isNoAnswer(refusal), true, refusal);
    const out = withMeasure(isNoAnswer(refusal) ? '' : refusal, m);
    assert.equal(out, '3 miles is 4.83 km (4,828 m).');
    assert.equal(isNoAnswer(out), false);
  }
  assert.equal(withMeasure('', m), '3 miles is 4.83 km (4,828 m).');
  assert.equal(withMeasure('', null), '');
});

test('the answer engine runs the checks on every sourced answer and gives the model both rules', () => {
  const src = read('../void-live-deploy/functions/api/answer.js');
  assert.match(src, /dropUnbackedClaims\(answer, src\)/);
  assert.match(src, /if \(guess\) answer = titledReadings\(answer, src\)/);
  assert.match(src, /if \(measure\) answer = withMeasure\(isNoAnswer\(answer\) \? '' : answer, measure\)/, 'a refusal does not hide the computed conversion');
  // the conversion is put in before the refusal check, so a stated quantity never ends as Not found
  assert.ok(src.indexOf('withMeasure(isNoAnswer(answer)') < src.indexOf('if (!self && !told && isNoAnswer(answer)) return'));
  assert.match(src, /INVENT_RULE/); assert.match(src, /measureRule\(measure\)/);
  assert.match(src, /!citesUnbacked\(hit\.answer\)/, 'the D1 cache does not serve an answer written before the check');
  // the checks run before supportedOnly renumbers the markers, while [n] is still src[n - 1]
  assert.ok(src.indexOf('dropUnbackedClaims(answer, src)') < src.indexOf('supportedOnly(answer, src, pub)'));
  assert.match(INVENT_RULE, /a speed in m\/s is not a Mach number/);
});
