// Line-by-line writer, Kokoro voices, and the judge that can fail a show.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOICES, VOICE_AF, contentWords, publishScores, parseShow, BAD_EPISODE } from '../void-live-deploy/lib/show-pipe.js';
import { ask } from './show-pipe.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const KOKORO = process.env.KOKORO_DIR || (process.env.HOME + '/kokoro');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EPISODE = [
  { who: 'Critic', need: 'I have a note', job: 'At most fourteen words. One question only, ending in a question mark: is counting words really clerk work? Do not mention a segment or a show.', max: 16, question: true },
  { who: 'Verse', need: '500 words', job: 'Answer him. One publication unit is 500 words of the paper.' },
  { who: 'Critic', need: '500', job: 'Call 500 an arbitrary clerk number. Keep it petty and specific.' },
  { who: 'Verse', need: 'Earth science', job: 'Say the page is for someone writing an Earth science paper.' },
  { who: 'Critic', need: 'I have a note', job: 'Insist the page is only a typed list of titles.' },
  { who: 'Verse', need: 'public feed', job: 'Say the papers come from the journal public feed, not a list someone typed.' },
  { who: 'Critic', need: 'feed', job: 'Guess that a feed means nothing but titles.' },
  { who: 'Verse', need: 'DOI', job: 'Say each paper shows the title, the authors, a short abstract, the date, and the DOI.' },
  { who: 'Critic', need: 'DOI', job: 'Dismiss a DOI as a barcode for clerks.' },
  { who: 'Verse', need: 'search', job: 'Say a person can search by a word or by that DOI.' },
  { who: 'Critic', need: 'I have a note', job: 'Claim that length is only a matter of taste.' },
  { who: 'Verse', need: 'one and a half', job: 'Say each figure or table counts as one and a half units. Do not mention a crew.' },
  { who: 'Critic', need: 'equations', job: 'Guess that equations are free.' },
  { who: 'Verse', need: 'ten equations', job: 'Say the first ten equations count as one unit.' },
  { who: 'Critic', need: 'novel', job: 'Joke that a novel would then sail through.' },
  { who: 'Verse', need: '45', job: 'Say a long paper is meant to stay under 45 units.' },
  { who: 'Critic', need: 'ramble', job: 'Guess a short note may ramble as long as it likes. Do not mention a performance.' },
  { who: 'Verse', need: '4 units', job: 'Say a short note stays under 4 units.' },
  { who: 'Critic', need: 'I have a note', job: 'Accuse the arithmetic of phoning home. Do not mention a performance.' },
  { who: 'Verse', need: 'on this device', job: 'Say the sum is worked on this device and nothing is sent.' },
  { who: 'Critic', need: 'device', job: 'Worry the papers vanish when you leave.' },
  { who: 'Verse', need: 'saved papers', job: 'Say saved papers stay on the device.' },
  { who: 'Critic', need: 'clerk', job: 'Repeat that it is still clerk work, sulking.' },
  { who: 'Verse', need: 'too long', job: 'Say it stops an author sending a paper that is too long. Use the word words.' },
  { who: 'Critic', need: 'I have a note', job: 'Admit you were wrong about the clerk, and hate admitting it. Use the word words.' },
  { who: 'Verse', need: '300 words', job: 'Say the abstract has to stand on its own, under 300 words.' },
  { who: 'Critic', need: '300', job: 'Call 300 words a speech. Use the word words.' },
  { who: 'Verse', need: 'three keywords', job: 'Say the guidelines also ask for three keywords. Do not mention a show.' },
  { who: 'Critic', need: 'keywords', job: 'Grumble that keywords are still clerk work, but the units were real.' },
  { who: 'Verse', need: 'line numbers', job: 'Say review does not start until every page has line numbers. Use the word words.' },
  { who: 'Critic', need: 'line numbers', job: 'Call line numbers a humiliation. Use the word numbers.' },
  { who: 'Verse', need: '12-point', job: 'Say the first file is Word or PDF, 12-point, one and a half spacing.' },
  { who: 'Critic', need: 'spacing', job: 'Ask who measures spacing with a ruler. Use the word point.' },
  { who: 'Verse', need: '300 dpi', job: 'Say figures are separate JPEG, TIFF, or PNG files at 300 dpi.' },
  { who: 'Critic', need: 'I have a note', job: 'Admit the dpi rule is real and you still resent it. Use the word figures.' },
  { who: 'Verse', need: 'a-to-mind.com', job: 'Invite people to ask for anything at a-to-mind.com. Use the word words.' },
];

const SHORTS = [
  {
    id: 'brain', title: 'Who talks first', page: 'https://a-to-mind.com/brain/',
    must: ['3 minutes', 'Brain'],
    beats: [
      { who: 'Verse', need: 'before you ask', job: 'At most eight words. One question ending in a question mark: who talks before you ask?', max: 8, question: true },
      { who: 'Critic', need: 'manners', job: 'Say a page that talks first has no manners. Use the word ask.' },
      { who: 'Verse', need: 'Brain page', job: 'Say the Brain page speaks first, one or two sentences, from what really changed.' },
      { who: 'Critic', need: 'invent', job: 'Guess it invents a number to sound sure. Use the word page.' },
      { who: 'Verse', need: 'thrown', also: ['facts'], job: 'One sentence: if someone invents a number that was not in the facts, that number is thrown away. No digits and no named count.' },
      { who: 'Critic', need: 'chatter', job: 'Worry it will chatter all day. Use the word number.' },
      { who: 'Verse', need: '3 minutes', job: 'Say it speaks at most once every 3 minutes, and does not repeat itself.' },
      { who: 'Critic', need: 'I have a note', job: 'Admit you were wrong, still calling it rude. Use the word minutes.' },
      { who: 'Verse', need: 'a-to-mind.com', job: 'Invite people to ask for anything at a-to-mind.com. Use the words ask and talks.' },
    ],
  },
  {
    id: 'films', title: 'A film that fits', page: 'https://a-to-mind.com/',
    must: ['100', 'nineties'],
    beats: [
      { who: 'Verse', need: 'tonight', job: 'At most eight words. One question ending in a question mark: want a film that fits tonight?', max: 8, question: true },
      { who: 'Critic', need: 'taste', job: 'Say taste cannot be scored. Use the word film.' },
      { who: 'Verse', need: '100', also: ['nineties', '0 to 100'], hold: 'film', job: 'Say ask for scary films from the nineties, and each real film gets a score from 0 to 100. Do not say taste.' },
      { who: 'Critic', need: 'poster', job: 'Guess a hundred means it liked the poster. Use the word score.' },
      { who: 'Verse', need: 'genre', hold: 'score', job: 'Say the score is the genre, the year, and the overview against what you asked, plus what matched and what it missed. Do not mention a poster.' },
      { who: 'Critic', need: 'guess', job: 'Insist that if nothing fits, it should guess. Use the word missed.' },
      { who: 'Verse', need: 'lists none', job: 'Say if nothing matches, it lists none, rather than guess.' },
      { who: 'Critic', need: 'I have a note', job: 'Sulking, say you wanted a guess. Use the word guess.' },
      { who: 'Verse', need: 'a-to-mind.com', job: 'Invite people to ask for anything at a-to-mind.com. Use the word film.' },
    ],
  },
];

function cleanLine(text, who) {
  const raw = String(text || '').replace(/^["“]|["”]$/g, '').replace(/\s+/g, ' ').trim();
  const m = raw.match(new RegExp(who + '\\s*:\\s*(.+)', 'i'));
  let s = (m ? m[1] : raw).replace(/\n+/g, ' ').trim();
  if (!/[.!?]$/.test(s)) s += '.';
  return s;
}
function holdOf(need) {
  const words = [...contentWords(need || '')];
  return words.sort((a, b) => b.length - a.length)[0] || '';
}
const BANNED_LINE = /\b(fundamentally|basically|the critic|verse speaks|literary|bestseller|scathing)\b/i;

export async function sayLine(beat, prevNeed, span) {
  const hold = beat.hold || holdOf(prevNeed);
  for (let i = 0; i < 4; i++) {
    const prompt = ('Spoken line only, as ' + beat.who + ' talking to the other host. ' + span + ' words. Everyday words. Include "' + beat.need + '"' + (hold ? ' and the word "' + hold + '"' : '') + '. Do not say fundamentally, the critic, or verse. ' + beat.job).slice(0, 400);
    const text = await ask(prompt, { judge: true, seed: Date.now() % 4294967295 });
    const line = cleanLine(text, beat.who);
    const words = line.split(/\s+/).filter(Boolean).length;
    const low = line.toLowerCase();
    const okNeed = low.includes(beat.need.toLowerCase());
    const okAlso = (beat.also || []).every((p) => low.includes(p.toLowerCase()));
    const okHold = !hold || low.includes(hold);
    const strayDigit = /\d/.test(line) && !/\d/.test(beat.need + ' ' + (beat.also || []).join(' '));
    if (/\b(fifty|twelve|dozen|crew|lineup|a game)\b/i.test(line) || strayDigit) { console.error('reject', line); continue; }
    if (!okNeed || !okAlso || !okHold) console.error('reject', line);
    const max = beat.max || 32;
    const min = beat.min || (beat.question ? 4 : 8);
    if (okNeed && okAlso && okHold && words >= min && words <= max && !BANNED_LINE.test(line) && (!beat.question || /\?/.test(line))) return line;
  }
  throw new Error('line missed its fact: ' + beat.need);
}

export async function writeBeats(beats, { kind, title, premise, must, gap = 5200 }) {
  const lines = [];
  const span = kind === 'short' ? '10 to 16' : '18 to 26';
  for (let n = 0; n < beats.length; n++) {
    const beat = beats[n];
    const prevNeed = n ? beats[n - 1].need : '';
    const text = await sayLine(beat, prevNeed, span);
    console.error('line ' + (lines.length + 1) + ' ' + beat.who);
    lines.push({ who: beat.who, text });
    await sleep(gap);
  }
  const show = { kind, title, premise, must, hook: lines[0].text, lines };
  return show;
}

export function speakLines(lines, mp3) {
  const dir = mkdtempSync(join(tmpdir(), 'kokoro-'));
  const model = join(KOKORO, 'kokoro-v1.0.onnx'), voices = join(KOKORO, 'voices-v1.0.bin');
  const py = join(here, 'kokoro_line.py');
  let t = 0;
  const words = [], beats = [], list = [];
  const gap = join(dir, 'gap.wav');
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '0.28', gap], { encoding: 'utf8' });
  const jobs = lines.map((line, i) => {
    const v = VOICES[line.who];
    return { voice: v.id, lang: v.lang, speed: line.speed || v.speed, text: line.text, out: join(dir, i + '.wav') };
  });
  const jobsPath = join(dir, 'jobs.json');
  writeFileSync(jobsPath, JSON.stringify(jobs));
  const r = spawnSync('python3', [py, model, '--batch', voices, jobsPath], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(String(r.stderr).slice(-400));
  const timedAll = JSON.parse(r.stdout.trim().split('\n').pop());
  lines.forEach((line, i) => {
    const raw = join(dir, i + '.wav'), fx = join(dir, i + '.fx.wav');
    const timed = timedAll[i];
    const fxRun = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af', VOICE_AF[line.who], '-ar', '24000', '-ac', '1', fx], { encoding: 'utf8' });
    if (fxRun.status !== 0) throw new Error(String(fxRun.stderr).slice(-200));
    const probed = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', fx], { encoding: 'utf8' });
    const dur = parseFloat(probed.stdout) || timed.seconds;
    const scale = timed.seconds ? dur / timed.seconds : 1;
    const from = t;
    for (const w of timed.words) words.push({ w: w.w, from: +(from + w.from * scale).toFixed(3), to: +(from + w.to * scale).toFixed(3), who: line.who });
    t += dur;
    beats.push({ who: line.who, label: line.who, text: line.text, from, to: +t.toFixed(3) });
    list.push(fx, gap);
    t += 0.28;
  });
  const lst = join(dir, 'list.txt');
  writeFileSync(lst, list.map((f) => "file '" + f + "'").join('\n'));
  const mix = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '24000', '-ac', '1', '-b:a', '96k', mp3], { encoding: 'utf8' });
  if (mix.status !== 0) throw new Error(String(mix.stderr).slice(-300));
  return { words, beats, seconds: beats.length ? beats[beats.length - 1].to + 0.28 : 0 };
}

export async function modelHuman(show) {
  const head = 'A normal listener. Human 2 only when a line does not answer the line before it. Human 7 when each line answers the last one and a real number is kept. Reply Human: N and Notes: one sentence. Show: ';
  let bit = show.lines.map((l) => l.who + ': ' + l.text).join(' ');
  if (head.length + bit.length > 400) {
    bit = bit.slice(0, 400 - head.length);
    const cut = Math.max(bit.lastIndexOf('Verse:'), bit.lastIndexOf('Critic:'));
    if (cut > 40) bit = bit.slice(0, cut).trim();
  }
  const prompt = head + bit;
  const text = await ask(prompt, { judge: true, seed: 7 });
  const m = String(text).match(/human\D{0,8}(10|[1-9])/i);
  return { score: m ? +m[1] : 0, notes: text.replace(/\s+/g, ' ').trim().slice(0, 220) };
}

export function verdict(show, kind, model) {
  const scores = publishScores(model, show, kind);
  if (model && model.human != null) scores.human = Math.min(scores.human, model.human);
  if (scores.human < 6) scores.pass = false;
  scores.modelNotes = model && model.notes;
  return scores;
}

export const SHOWS = { episode: { title: 'How long is a paper', premise: 'The journal page reads real Earth science papers and computes publication units on the device.', must: ['500 words', 'DOI', '45', 'device'], beats: EPISODE }, shorts: SHORTS };
export { BAD_EPISODE, parseShow };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cmd = process.argv[2];
  const spec = cmd === 'shorts' ? null : SHOWS.episode;
  const runOne = async (beats, meta) => {
    const show = await writeBeats(beats, meta);
    const model = await modelHuman(show);
    const scores = verdict(show, meta.kind, { clarity: 8, originality: 7, entertainment: 8, impressive: 7, notes: model.notes, human: model.score });
    console.log(show.lines.map((l) => l.who + ': ' + l.text).join('\n\n'));
    console.log(JSON.stringify(scores, null, 2));
    if (!scores.pass) process.exit(1);
    return { show, scores };
  };
  if (cmd === 'episode-script') await runOne(spec.beats, { kind: 'episode', title: spec.title, premise: spec.premise, must: spec.must });
  else if (cmd === 'short-script') {
    const s = SHORTS[Number(process.argv[3] || 0)];
    await runOne(s.beats, { kind: 'short', title: s.title, premise: s.title, must: s.must, gap: 5200 });
  } else {
    console.error('usage: node tools/show-make.mjs episode-script | short-script [0|1]');
    process.exit(2);
  }
}
