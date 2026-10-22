// Verse Out Loud: Verse's own weekly podcast (owner, 2026-10-21: "Verse should make its own podcast").
// Every line of an episode is read from the public record, never made up and never a visitor's words:
//   the growth ledger (void-live-deploy/void.growth.json): what was built, grown and fixed in the week, with counts;
//   claims-verified.json: only the phrases that are proven to answer with their own card are read aloud;
//   domains/void.voice.md: Verse's own latest daily readout and current asks, quoted as Verse said them (fact tags removed);
//   incidents.json: how many red browser suites main had in the week (counts only).
// Two voices: Verse (states the record) and the Critic (reads the misses and the weak spots from the same record). The Critic is a
// second reader of the record, not a person, and says so in every episode.
// Audio is made with Piper (open-source TTS, MIT, runs on the CI machine or any box: no account, no API, costs nothing) and ffmpeg.
//   node tools/podcast.mjs --script [--to 2026-10-22]       print the next episode's script (no files written)
//   node tools/podcast.mjs --make [--to ...] --voices <dir>  write the episode: mp3, transcript, episodes.json, rss.xml
//   node tools/podcast.mjs --rss                             rewrite podcast/rss.xml from podcast/episodes.json
// Voices: <dir>/en_US-lessac-medium.onnx (Verse) and <dir>/en_US-ryan-medium.onnx (the Critic); PIPER is the piper command
// (default "python3 -m piper"). Weekly by .github/workflows/verse-podcast.yml; docs/playbooks/podcast.md.
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = resolve(root, 'void-live-deploy');
export const DIR = resolve(site, 'podcast');
export const SITE = 'https://a-to-mind.com';
export const SHOW = {
  title: 'Verse Out Loud',
  author: 'A-to-Mind',
  email: 'atom@a-to-mind.com',
  link: SITE + '/podcast/',
  cover: SITE + '/podcast/cover.jpg',
  description: 'Verse, the blank stage at a-to-mind.com that makes whatever anyone asks, reads its own week out loud: what it built, the exact asks that now work, what it missed and fixed, and what it asked for next. Every line comes from its public growth ledger and its own reflection log. Nothing is made up. Free to download and repost.',
  category: 'Technology',
  language: 'en-us',
};

const DAY = 86400000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const human = (d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
const untag = (s) => String(s || '').replace(/\s*\[(?:S\d+|Builders)(?:[,;]\s*(?:S\d+|Builders))*\]/g, '').replace(/\s+([.,;:!?])/g, '$1').replace(/\s+/g, ' ').trim();
/** a whole first sentence of a ledger line, or '' when there is none short enough to read aloud whole (never cut). Pure. */
export function firstSentence(s, max = 240) {
  const t = String(s || '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
  const m = t.match(/^(.+?[.!?])(?:\s|$)/);
  const one = (m ? m[1] : t).replace(/^(?:build|grow|fix|finding):\s*/i, '');
  if (one.length < 12 || one.length > max) return '';
  return /[.!?]$/.test(one) ? one : one + '.';
}
const speakable = (s) => String(s).replace(/https?:\/\/\S+/g, '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();

/** Verse's newest daily readout in domains/void.voice.md: { at, weakest, next, asks } in its own words (tags removed). Pure. */
export function latestDaily(md) {
  const parts = String(md || '').split(/\n(?=### )/).filter((p) => /^### .*· daily/.test(p));
  const p = parts[parts.length - 1]; if (!p) return null;
  const pick = (label) => { const m = p.match(new RegExp('\\*\\*' + label + ':\\*\\*\\s*([^\\n]+)')); return m ? untag(m[1]) : ''; };
  const asks = [...(p.match(/^Asks: (.+)$/m) || ['', ''])[1].matchAll(/"([^"]+)"/g)].map((m) => untag(m[1]));
  return { at: p.slice(4, 20), weakest: pick('Weakest operational area'), next: pick('Next targeted capability'), asks };
}

/** The episode, from the record only. Pure: give it the files' contents. */
export function buildEpisode({ growth = [], claims = { ok: [] }, voiceMd = '', incidents = { incidents: [] }, to, n = 1 }) {
  const end = new Date(to || Date.now()), start = new Date(+end - 7 * DAY);
  const week = growth.filter((e) => e && e.at && new Date(e.at) > start && new Date(e.at) <= end);
  const count = (k) => week.filter((e) => e.kind === k).length;
  const proven = new Set((claims.ok || []).map((s) => String(s).toLowerCase()));
  const phrases = []; const seen = new Set();
  for (const e of week) for (const p of e.phrases || []) { const a = String(p.ask || ''); if (proven.has(a.toLowerCase()) && !seen.has(a.toLowerCase()) && p.skill) { seen.add(a.toLowerCase()); phrases.push({ ask: a, skill: p.skill }); } }
  const allPhrases = week.reduce((s, e) => s + (e.phrases || []).length, 0);
  // what was built: the plain "show" line each build or growth step carries for people coming back (skills/showcase.js), newest first,
  // with its "try" ask only when that ask is proven to answer (claims-verified.json)
  const shown = []; const said = new Set();
  for (const e of [...week].reverse()) {
    if (!['build', 'grow'].includes(e.kind) || !e.show) continue;
    const t = firstSentence(String(e.show).replace(/^./, (c) => c.toUpperCase()), 200); if (!t || said.has(t.toLowerCase())) continue;
    said.add(t.toLowerCase()); shown.push({ text: t, try: e.try && proven.has(String(e.try).toLowerCase()) ? String(e.try) : '' });
    if (shown.length >= 6) break;
  }
  const selfFixes = week.filter((e) => e.kind === 'fix' && e.by === 'verse').length;
  const notRouted = week.reduce((s, e) => s + ((String(e.what || '').match(/Did not route: ([^]*)$/) || ['', ''])[1].split(';').filter((x) => x.trim()).length), 0);
  const findings = week.filter((e) => e.kind === 'finding' && !/^already built/i.test(e.what || '')).map((e) => firstSentence(e.show || e.what)).filter(Boolean);
  // frontier experiments: build and growth steps that name the Frontier Engine drafts (F-123) they came from, newest first
  const frontier = []; const fSeen = new Set();
  for (const e of [...week].reverse()) {
    const ids = [...new Set((String(e.what || '') + ' ' + String(e.show || '')).match(/\bF-?\d{3}\b/g) || [])].map((x) => x.replace(/^F-?/, 'F-'));
    if (!ids.length || !['build', 'grow'].includes(e.kind)) continue;
    const t = firstSentence(String(e.show || '').replace(/^./, (c) => c.toUpperCase()), 200); if (!t || fSeen.has(t.toLowerCase())) continue;
    fSeen.add(t.toLowerCase()); frontier.push({ ids, text: t }); if (frontier.length >= 3) break;
  }
  const red = (incidents.incidents || []).filter((i) => new Date(i.at) > start && new Date(i.at) <= end).length;
  const daily = latestDaily(voiceMd);
  const V = 'Verse', C = 'Critic', L = [];
  const say = (who, text) => { const t = speakable(text); if (t) L.push({ who, text: t }); };
  say(V, `This is ${SHOW.title}, episode ${n}, the week from ${human(start)} to ${human(end)}. I am Verse, the blank stage at a-to-mind.com that makes whatever you ask for.`);
  say(C, 'And I am the critic: a second reading of the same record, here to say what did not work. Every line in this show comes from Verse\'s public growth ledger and its own reflection log. Nothing is made up, and no visitor\'s words are read out.');
  say(V, `This week the ledger has ${plural(week.length, 'entry', 'entries')}: ${plural(count('build'), 'new build')}, ${plural(count('grow'), 'growth step')}, ${plural(count('fix'), 'fix', 'fixes')} and ${plural(count('finding'), 'finding')}.`);
  if (shown.length) { say(V, 'Here is some of what is new, newest first.'); for (const b of shown) say(V, b.text + (b.try ? ` Try it: ask "${b.try}".` : '')); }
  if (allPhrases) say(V, `${plural(allPhrases, 'ask')} learned a new way in this week. ${phrases.length ? 'Here are some that are proven to open their own card, so you can try them yourself.' : ''}`);
  for (const p of phrases.filter((p) => !shown.some((b) => b.try.toLowerCase() === p.ask.toLowerCase())).slice(0, 5)) say(V, `Ask "${p.ask}", and the ${p.skill.replace(/-/g, ' ')} card opens.`);
  say(C, notRouted ? `Now the misses. The ledger lists ${plural(notRouted, 'ask')} this week that Verse tried to learn and still could not answer. ${selfFixes ? `Verse made ${plural(selfFixes, "fix", "fixes")} to its own skills by itself.` : 'Verse fixed none of its own skills by itself this week.'}` : `Now the misses. The ledger lists no ask that Verse failed to learn this week${selfFixes ? `, and Verse made ${plural(selfFixes, "fix", "fixes")} to its own skills by itself` : ''}.`);
  say(C, red ? `The full browser test suite on main went red ${plural(red, 'time')} this week. Those failures are in the public incident log, and they are not fixed until two runs in a row pass.` : 'The full browser test suite on main never went red this week.');
  if (daily && daily.weakest) say(C, `In its own daily readout, Verse named its weakest area: ${daily.weakest}`);
  if (frontier.length) { say(V, 'From my frontier experiments, the drafts that became something you can use:'); for (const f of frontier) say(V, `${f.ids.slice(0, 4).join(', ')}: ${f.text}`); }
  if (findings.length) { say(V, 'From the experiments, what was found:'); for (const f of findings.slice(-2)) say(V, f); }
  if (daily && daily.asks.length) { say(V, 'And what I asked the builders for next, in my own words:'); for (const a of daily.asks) say(V, a); }
  say(C, 'Whether those get built is in next week\'s ledger, and you will hear it here either way.');
  say(V, `That was ${SHOW.title}. Every episode is free to download and repost. Try any of it at a-to-mind.com, and if it helped, ask it for the tip jar.`);
  const title = `Episode ${n}: the week to ${human(end)}`;
  return { n, title, from: iso(start), to: iso(end), lines: L, counts: { entries: week.length, builds: count('build'), grows: count('grow'), fixes: count('fix'), findings: count('finding'), frontier: frontier.length, phrases: allPhrases, proven: phrases.length, notRouted, red } };
}

export const transcriptText = (ep) => ep.lines.map((l) => `${l.who}: ${l.text}`).join('\n\n') + '\n';

export const xesc = (s) => String(s || '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
const hms = (s) => { s = Math.round(+s || 0); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((x) => String(x).padStart(2, '0')).join(':'); };
/** A podcast RSS 2.0 feed with the iTunes and Podcasting 2.0 tags Apple and Spotify read. Pure. */
export function rss(episodes) {
  const S = SHOW;
  const items = [...episodes].sort((a, b) => b.n - a.n).map((e) => `<item><title>${xesc(e.title)}</title><link>${S.link}?ep=${e.n}</link><guid isPermaLink="false">a-to-mind-verse-out-loud-${e.n}</guid><pubDate>${new Date(e.pub).toUTCString()}</pubDate><description>${xesc(e.summary)}</description><enclosure url="${SITE}/podcast/${e.file}" length="${e.bytes}" type="audio/mpeg"/><itunes:duration>${hms(e.seconds)}</itunes:duration><itunes:episode>${e.n}</itunes:episode><itunes:episodeType>full</itunes:episodeType><itunes:explicit>false</itunes:explicit><podcast:transcript url="${SITE}/podcast/${e.transcript}" type="text/plain"/></item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xesc(S.title)}</title><link>${S.link}</link><atom:link href="${SITE}/podcast/rss.xml" rel="self" type="application/rss+xml"/><language>${S.language}</language><copyright>Free to download and repost. ${xesc(S.author)}</copyright><description>${xesc(S.description)}</description><itunes:summary>${xesc(S.description)}</itunes:summary><itunes:author>${xesc(S.author)}</itunes:author><itunes:owner><itunes:name>${xesc(S.author)}</itunes:name><itunes:email>${S.email}</itunes:email></itunes:owner><itunes:image href="${S.cover}"/><image><url>${S.cover}</url><title>${xesc(S.title)}</title><link>${S.link}</link></image><itunes:category text="${S.category}"/><itunes:explicit>false</itunes:explicit><itunes:type>episodic</itunes:type><podcast:locked>no</podcast:locked>${items}</channel></rss>\n`;
}

const readJson = (p, d) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (_) { return d; } };
export const loadEpisodes = () => readJson(resolve(DIR, 'episodes.json'), { note: '', episodes: [] });
function inputs(to, n) {
  return { growth: readJson(resolve(site, 'void.growth.json'), []), claims: readJson(resolve(site, 'claims-verified.json'), { ok: [] }), voiceMd: existsSync(resolve(root, 'domains/void.voice.md')) ? readFileSync(resolve(root, 'domains/void.voice.md'), 'utf8') : '', incidents: readJson(resolve(site, 'incidents.json'), { incidents: [] }), to, n };
}

// every command runs with execFileSync and an argument list: nothing is read by a shell
const ff = (...a) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...a]);
const dur = (f) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();
function speak(ep, voices, out) {
  const [pcmd, ...pargs] = (process.env.PIPER || 'python3 -m piper').split(/\s+/).filter(Boolean);
  const tmp = resolve(tmpdir(), 'verse-podcast-' + process.pid); mkdirSync(tmp, { recursive: true });
  const model = { Verse: resolve(voices, 'en_US-lessac-medium.onnx'), Critic: resolve(voices, 'en_US-ryan-medium.onnx') };
  const list = []; let t = 0;
  ff('-f', 'lavfi', '-i', 'anullsrc=r=22050:cl=mono', '-t', '0.45', `${tmp}/gap.wav`);
  ep.lines.forEach((l, i) => {
    const f = `${tmp}/${String(i).padStart(3, '0')}.wav`;
    execFileSync(pcmd, [...pargs, '-m', model[l.who], '-f', f], { input: l.text, stdio: ['pipe', 'ignore', 'inherit'] });
    ff('-i', f, '-ar', '22050', '-ac', '1', `${f}.r.wav`);
    list.push(`file '${f}.r.wav'`, `file '${tmp}/gap.wav'`);
    l.t = Math.round(t * 10) / 10; t += dur(`${f}.r.wav`) + 0.45;
  });
  // a Loop Grid-style bed (an 8-step pentatonic pattern of soft sine notes, made here by ffmpeg, no samples, no licence) under the
  // opening and the closing line
  const bed = (secs, name) => { const notes = [261.63, 329.63, 392, 440, 392, 329.63, 293.66, 392]; const step = 0.3, bar = notes.length * step;
    const expr = notes.map((f, i) => `(between(mod(t,${bar}),${i * step},${(i + 1) * step})*sin(2*PI*${f}*t)*exp(-6*(mod(t,${bar})-${i * step})))`).join('+');
    ff('-f', 'lavfi', '-i', `aevalsrc='0.18*(${expr})':s=22050:d=${secs}`, '-af', `afade=t=in:d=0.6,afade=t=out:st=${secs - 1.2}:d=1.2`, '-ac', '1', `${tmp}/${name}.wav`); return `${tmp}/${name}.wav`; };
  if (!process.env.PODCAST_NO_BED) { const a = bed(3.6, 'bed-in'), b = bed(4.2, 'bed-out'); list.unshift(`file '${a}'`); list.push(`file '${b}'`); ep.lines.forEach((l) => { l.t = Math.round((l.t + 3.6) * 10) / 10; }); }
  writeFileSync(`${tmp}/list.txt`, list.join('\n'));
  ff('-f', 'concat', '-safe', '0', '-i', `${tmp}/list.txt`, '-ac', '1', '-ar', '22050', '-b:a', '48k', '-id3v2_version', '3', '-metadata', `title=${SHOW.title} ${ep.n}`, '-metadata', `artist=${SHOW.author}`, out);
  const seconds = dur(out);
  rmSync(tmp, { recursive: true, force: true });
  return seconds;
}

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const data = loadEpisodes();
  if (process.argv.includes('--script')) {
    const ep = buildEpisode(inputs(arg('--to'), data.episodes.length + 1));
    console.log(transcriptText(ep)); console.log(JSON.stringify(ep.counts));
  } else if (process.argv.includes('--make')) {
    const voices = arg('--voices'); if (!voices) { console.error('--voices <dir with the two .onnx voices>'); process.exit(2); }
    const n = data.episodes.length + 1, to = arg('--to') || new Date().toISOString();
    const last = data.episodes[data.episodes.length - 1];
    if (last && Date.now() - new Date(last.pub) < 6 * DAY && !process.argv.includes('--force')) { console.log('episode ' + last.n + ' is under 6 days old; nothing made (--force to make one anyway)'); process.exit(0); }
    const ep = buildEpisode(inputs(to, n));
    const id = String(n).padStart(3, '0'), file = `verse-out-loud-${id}.mp3`, transcript = `verse-out-loud-${id}.txt`;
    mkdirSync(DIR, { recursive: true });
    writeFileSync(resolve(DIR, transcript), transcriptText(ep));
    const seconds = speak(ep, voices, resolve(DIR, file));
    const bytes = statSync(resolve(DIR, file)).size;
    if (bytes > 24 * 1024 * 1024) { console.error('the mp3 is over the 25 MB Pages limit'); process.exit(1); }
    const c = ep.counts;
    const summary = `Verse's week from ${ep.from} to ${ep.to}, read from its public ledger: ${c.entries} entries (${c.builds} builds, ${c.grows} growth steps, ${c.fixes} fixes, ${c.findings} findings), ${c.phrases} asks learned, ${c.notRouted} still missed, ${c.red} red test runs on main, and what Verse asked for next. Full transcript included. Free to download and repost.`;
    data.note = 'Verse Out Loud episodes (tools/podcast.mjs). Each is read from the public record only: void.growth.json, claims-verified.json, domains/void.voice.md, incidents.json. Append-only.';
    data.episodes.push({ n, title: ep.title, from: ep.from, to: ep.to, pub: new Date().toISOString(), file, transcript, bytes, seconds: Math.round(seconds), summary, counts: c, lines: ep.lines });
    writeFileSync(resolve(DIR, 'episodes.json'), JSON.stringify(data, null, 1) + '\n');
    writeFileSync(resolve(DIR, 'rss.xml'), rss(data.episodes));
    console.log(`episode ${n}: ${file}, ${Math.round(seconds)} s, ${bytes} bytes`);
  } else if (process.argv.includes('--rss')) {
    writeFileSync(resolve(DIR, 'rss.xml'), rss(data.episodes)); console.log('rss.xml: ' + data.episodes.length + ' episodes');
  } else console.log('node tools/podcast.mjs --script | --make --voices <dir> | --rss');
}
