// Blind listener scores. The named shows are a ruler for craft, not a script to copy.
// Each prompt is one question. The mark is the minimum. Nothing is published unless a calibration run
// scores the bad fixtures under 6 and a hand-written good fixture at 6 or more.
import { ask } from './show-pipe.mjs';
import { separates } from '../void-live-deploy/lib/show-pipe.js';

export const JOURNAL = 'Critic: Is counting words clerk work? Verse: One publication unit is 500 words. A figure is one and a half units. A long paper stays under 45 units. The file is 12-point. Figures are 300 dpi. Review needs line numbers on every page.';
export const OLD34 = 'Critic: This idea is too silly to be real. Verse: The journal opens its cover and reads its pages aloud. Critic: A book that speaks is absurd. Critic: I admit I was completely wrong. Verse: Ask for any story.';
export const PAGE = 'Verse: The Brain page speaks first, once every three minutes, from what changed. Critic: A page that talks first has no manners. Verse: Saved papers stay on the device. Critic: I was wrong about the clerk.';
export const GOOD = 'Critic: Do not show that card. I have not signed it. Verse: Too late. What can you do took 8855 milliseconds. Critic: I was choosing the pen. Verse: The other fourteen had a median of 451 milliseconds. They were finished while you chose. Critic: Then I will sign the miss and make it fifteen. Verse: The line is 8000 milliseconds. A signature does not move a clock.';

export const FIXTURES = Object.freeze([
  { id: 'journal', kind: 'bad', text: JOURNAL },
  { id: 'old34', kind: 'bad', text: OLD34 },
  { id: 'page', kind: 'bad', text: PAGE },
  { id: 'good', kind: 'good', text: GOOD },
]);

const PROMPTS = [
  (s) => `A stranger is listening and can leave. Score how likely they are to stay, from 1 to 10. Reply with one line: Score N. Show: ${s}`,
  (s) => `Is there a joke with a setup and a payoff, or only information? Score from 1 to 10. Reply with one line: Score N. Show: ${s}`,
  (s) => `Does this tell one thing that happened, including a number from that event, or does it list rules? Score from 1 to 10. Reply with one line: Score N. Show: ${s}`,
];

export function readScore(text) {
  const m = String(text || '').match(/score\D{0,8}(10|[1-9])/i) || String(text || '').match(/\b(10|[1-9])\b/);
  return m ? +m[1] : 0;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Minimum of the prompts. A missing number counts as 0, so a silent judge cannot publish. */
export async function blindMin(text, { askImpl = ask, gap = 5300, seed = 1 } = {}) {
  const scores = [];
  const notes = [];
  for (let i = 0; i < PROMPTS.length; i++) {
    const prompt = PROMPTS[i](text).slice(0, 400);
    const got = await askImpl(prompt, { judge: true, seed: seed + i * 97 });
    const n = readScore(got);
    scores.push(n);
    notes.push(String(got).replace(/\s+/g, ' ').trim().slice(0, 180));
    if (i < PROMPTS.length - 1) await sleep(gap);
  }
  return { min: Math.min(...scores), scores, notes };
}

if (process.argv[1] && process.argv[1].endsWith('show-judge.mjs')) {
  const live = await calibrate();
  console.log(JSON.stringify(live.rows.map((r) => ({ id: r.id, kind: r.kind, min: r.min, scores: r.scores })), null, 2));
  console.log(live.separated ? 'separated' : 'free judge cannot separate');
  process.exit(live.separated ? 0 : 1);
}

export async function calibrate({ askImpl = ask, gap = 5300 } = {}) {
  const rows = [];
  for (const fixture of FIXTURES) {
    const scored = await blindMin(fixture.text, { askImpl, gap, seed: fixture.id.length * 1000 });
    rows.push({ id: fixture.id, kind: fixture.kind, ...scored });
    await sleep(gap);
  }
  return { rows, separated: separates(rows) };
}
