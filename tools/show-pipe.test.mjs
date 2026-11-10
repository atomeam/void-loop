import assert from 'node:assert/strict';
import { featsFrom, parseShow, scriptIssues, parseScores, trendLine, sameWords, sequence, timeOverlap, BANNED, VOICE_AF, VOICES, hardShow, settle, follows, humanScale, againstReferences, paddingWord, BAD_EPISODE } from '../void-live-deploy/lib/show-pipe.js';
import { shortScript } from './show-pipe.mjs';
import { speechCheck, plainCheck, captionCheck } from './video-gate.mjs';

const growth = [
  { kind: 'build', show: 'Verse talks to you first on its Brain page, from its real state' },
  { kind: 'grow', show: 'Queue job mw9xtnko (heal: helper-ownership-pack)' },
  { kind: 'build', show: 'a movie pick that says how closely each film matches your ask' },
];
const feats = featsFrom(growth);
assert.equal(feats[0], 'A movie pick that says how closely each film matches your ask.');
assert.ok(!feats.some((f) => /Queue job|mw9/.test(f)));

const reply = 'Title: The page that speaks\n\nCritic: A page does not talk.\nVerse: This one does, and it only says what is true.\nCritic: I checked. You are right, which I dislike.\nVerse: Ask for anything at a-to-mind.com.\n';
const parsed = parseShow(reply);
assert.equal(parsed.title, 'The page that speaks');
assert.equal(parsed.lines.length, 4);
assert.deepEqual(scriptIssues({ hook: 'x', lines: parsed.lines }, { min: 4, max: 8 }), []);
assert.ok(scriptIssues({ lines: [{ who: 'Verse', text: 'Queue job mw9xtnko is open.' }] }).includes('jargon'));
assert.ok(BANNED.test('see tools/podcast.mjs for the path'));

const bad = parseScores('Clarity 4, Originality 8, Entertainment 8, Impressive 8. Notes: too thin.');
assert.equal(bad.pass, false);
const good = parseScores('Clarity 8, Originality 8, Entertainment 9, Impressive 8. Notes: I followed it.');
assert.equal(good.pass, true);
assert.match(trendLine([{ avg: 6, notes: 'flat' }, { avg: 8, notes: 'sharper' }]), /up/);

assert.equal(sameWords('hello there', 'hello\nthere'), true);
assert.equal(sameWords('hello', 'hel\nlo'), false);
assert.equal(sequence([{ dur: 1.2 }, { dur: 1 }], 0.3)[1].from, 1.5);
assert.equal(timeOverlap({ from: 0, to: 1 }, { from: 1, to: 2 }), false);
assert.equal(timeOverlap({ from: 0, to: 1.2 }, { from: 1, to: 2 }), true);
assert.equal(speechCheck([{ from: 0, to: 1 }, { from: 1.2, to: 2 }]).ok, true);
assert.equal(speechCheck([{ from: 0, to: 1.2 }, { from: 1, to: 2 }]).ok, false);
assert.equal(plainCheck({ hook: 'Queue job abcdef123', title: '', description: '', captions: [] }).ok, false);
assert.equal(captionCheck([{ text: 'hel\nlo', raw: 'hello', size: 80, x: 80, y: 400, w: 400, h: 160, box: true, rect: true }]).ok, false);
assert.match(VOICE_AF.Verse, /chorus=/);
assert.match(VOICE_AF.Critic, /asetrate=22560/);
assert.equal(VOICES.Verse.id, 'af_sky');
assert.equal(VOICES.Critic.id, 'bm_george');
assert.ok(!/lessac|ryan/.test(VOICES.Verse.id + VOICES.Critic.id));
const badEp = parseShow(BAD_EPISODE);
badEp.premise = 'Earth science journal publication units';
badEp.must = ['500 words', 'DOI'];
const badIssues = hardShow(badEp, { kind: 'episode' });
assert.ok(badIssues.includes('does not follow'), badIssues.join(','));
assert.ok(badIssues.includes('length'));
const settled = settle({ clarity: 9, originality: 10, entertainment: 8, impressive: 7, notes: 'whimsical' }, badIssues);
assert.ok(settled.clarity <= 4, 'episode 8 cannot score as clear');
assert.equal(settled.pass, false);
const human = humanScale(badEp, { kind: 'episode' });
assert.ok(human.score <= 3, 'episode 8 is clearly worse than a human show: ' + human.score + ' ' + human.marks.join(','));
assert.equal(human.comparable, false);
const refs = againstReferences(badEp, 'episode');
assert.ok(refs.length === 3 && refs.every((r) => r.score <= 3), JSON.stringify(refs));
const stuffed = Array.from({ length: 8 }, (_, i) => ({ who: i % 2 ? 'Verse' : 'Critic', text: 'I have a note that this paper is fundamentally about words and units and the journal.' }));
assert.equal(paddingWord(stuffed), 'fundamentally');
assert.ok(hardShow({ lines: stuffed, must: [] }, { kind: 'short' }).includes('padding'));
const chain = [
  { who: 'Critic', text: 'I have a note. Counting words is clerk work.' },
  { who: 'Verse', text: 'One publication unit is 500 words of the paper.' },
  { who: 'Critic', text: 'I have a note. Five hundred words is a clerk invention.' },
  { who: 'Verse', text: 'The journal feed shows the title, the abstract, and the DOI of a real paper.' },
];
assert.equal(follows(chain[0].text, chain[1].text), true);
chain[3].text = 'The journal feed shows the DOI, and those words still count.';
assert.ok(!hardShow({ lines: chain, premise: 'journal', must: ['500 words'] }, { kind: 'short' }).includes('does not follow'));

const made = shortScript('Critic: Pages never speak first.\nVerse: This one does.\nCritic: Fine. It does.\n');
assert.equal(made.show.hook, 'What if you could ask for this today?');
assert.equal(made.issues.length, 0);
console.log('show-pipe: ok');
