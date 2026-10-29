// Verse reads a video's words (lib/digest.js, functions/api/digest.js, skills/digest.js, tools/learn-tricks.mjs). Run: node --test tools/digest.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { captionText, captionSource, keyPoints, answerFrom, trickLines, modelInput, MODEL_CHARS } from '../void-live-deploy/lib/digest.js';
import { digestAsk } from '../void-live-deploy/skills/digest.js';
import { addLearned, excerpt } from './learn-tricks.mjs';

const VTT = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\n<c>Black holes form when massive stars collapse.</c>\n\n2\n00:00:03.000 --> 00:00:05.000\nBlack holes form when massive stars collapse.\n\n3\n00:00:05.000 --> 00:00:09.000\nNothing escapes past the event horizon, not even light from the star.\n\n4\n00:00:09.000 --> 00:00:12.000\nIn the editor, drag a crossfade onto the clip on the timeline to soften the cut.';
test('digest: captions become clean text with no timings, tags or repeats', () => {
  const t = captionText(VTT);
  assert.doesNotMatch(t, /-->|WEBVTT|<c>/); assert.equal(t.match(/collapse/g).length, 1);
});
test('digest: key points, answers and tricks come from the words themselves', () => {
  const t = captionText(VTT);
  assert.ok(keyPoints(t, 2).length >= 1);
  assert.match(answerFrom(t, 'what did it teach about the event horizon')[0], /event horizon/);
  assert.match(trickLines(t)[0], /crossfade/);
  assert.ok(modelInput('word '.repeat(5000)).length <= MODEL_CHARS);
});
test('digest: only PeerTube and Archive pages are read; YouTube is pasted', () => {
  assert.equal(captionSource('https://tilvids.com/w/c3c07e95-5a0a-4997-9a14-6d8979e03e9f').platform, 'peertube');
  assert.equal(captionSource('https://archive.org/details/Getting_Started_With_iMovie').platform, 'archive');
  for (const bad of ['http://archive.org/details/x', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'javascript:alert(1)']) assert.equal(captionSource(bad), null);
});
test('digest: the skill routes pastes, links and follow-ups, and nothing else', () => {
  assert.equal(digestAsk('summarize this transcript: ' + 'words '.repeat(60)).kind, 'text');
  assert.equal(digestAsk('summarize https://archive.org/details/Getting_Started_With_iMovie').kind, 'url');
  assert.equal(digestAsk('what did this video teach about black holes?').kind, 'ask');
  for (const no of ['what did you learn today', 'find a youtube video about black holes', 'summarize https://www.youtube.com/watch?v=aqz-KE-bpKQ']) assert.equal(digestAsk(no), null, no);
});
test('digest: the route stores nothing and uses only the free model path', () => {
  const src = readFileSync(new URL('../void-live-deploy/functions/api/digest.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /env\.\w*KV|env\.DB|gpt-oss|PAID_MODEL/); assert.match(src, /models\('digest'\)/);
  assert.match(readFileSync(new URL('../void-live-deploy/lib/models.js', import.meta.url), 'utf8'), /digest: FREE_MODEL/);
});
test('learn-tricks: new techniques are added once with a short excerpt and the source', () => {
  const doc = '# x\n\n## Queue (not built yet)\nq\n', row = { trick: 'crossfade', quote: excerpt('a b c d e f g h i j k l m n o p q'), title: 'T', url: 'https://tilvids.com/w/x', at: '2026-10-15' };
  const once = addLearned(doc, [row]); assert.match(once, /## Learned from open videos[\s\S]*\*\*crossfade\*\*[\s\S]*## Queue/); assert.ok(row.quote.split(' ').length <= 15);
  assert.equal(addLearned(once, [row]), once);
});
