// The lab's usefulness gate (owner, 2026-11-06: "the lab experiments all seem pointless can you make them all more useful and meaningful
// and make grok build better and more useful things"). One plain test for every draft the lab repo makes: does it do a real job a person
// would come back for (a tool, a calculator, a converter, a checker, a maker that gives back something to keep), or is it a toy?
//
// A draft is a TOOL when its code shows both halves of a job, and its words say what the job is:
//   1. it takes the person's own data: a text, number, date or file box, a pasted or typed text the page works on, or a sound or picture
//      it measures (a microphone read for pitch, a camera read for a code). A box that only carries WebRTC connection codes is not data.
//   2. it gives back something to keep: a download, a copy button, a share link that carries the work, or the work saved on the device.
//   3. its SPEC names the job in plain words (a "Job:" or "Plain name:" line, or "for regular visitors"), unless the page is plainly a tool
//      already (a file or a microphone measured AND something to keep).
// Everything else is a TOY: a field, swarm, lattice or "mind" to watch and poke, however clever the maths. The verdict and its reasons are
// kept so a draft can be fixed, never so it can be argued past.
//
// The good idea inside a toy is often a real tool waiting (tilt sensing is a spirit level, a SHA-256 seal is a file checksum, a
// reaction-diffusion field is a seamless pattern maker). IDEAS maps each technique to the one tool it becomes, so 40 drafts on one idea merge
// into one page instead of 40 more toys.
//   node tools/lab-grade.mjs --drafts <a clone's drafts folder>            counts, the tools, and the ideas each cluster becomes
//   node tools/lab-grade.mjs --drafts <dir> --write                        also writes void-live-deploy/lab/grades.json (the gallery lists only tools)
//   node tools/lab-grade.mjs --file <dir>/index.html [--spec <dir>/SPEC.md] one draft's verdict as JSON (the lab repo's own check runs this)
// Pure parts are tested in tools/lab-grade.test.mjs. docs/playbooks/lab.md has the whole story.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GRADES = path.join(root, 'void-live-deploy', 'lab', 'grades.json');

const strip = (html) => String(html || '').replace(/<!--[\s\S]*?-->/g, '');
const countOf = (re, s) => (String(s).match(re) || []).length;

/** what the page takes from the person, read off its markup and script: ['text', 'number', 'file', 'mic-measure', ...]. Pure. */
export function inputsOf(html) {
  const h = strip(html), out = new Set();
  const rtc = /RTCPeerConnection/.test(h);
  const boxes = countOf(/<textarea\b/gi, h) + countOf(/<input\b[^>]*type\s*=\s*["']?(?:text|search|url|email)\b/gi, h)
    + countOf(/<input\b(?![^>]*type\s*=)[^>]*>/gi, h) + countOf(/contenteditable\s*=\s*["']?(?:true|plaintext-only|)["'\s>]/gi, h);
  // a WebRTC page's text boxes carry the offer and answer codes between two tabs, not the person's data
  const signalling = rtc && /(?:offer|answer|sdp|signal|paste (?:the|their|this) code)/i.test(h);
  if (boxes && !(signalling && boxes <= 3)) out.add('text');
  if (/<input\b[^>]*type\s*=\s*["']?(?:number|date|time|datetime-local|month|week)\b/i.test(h)) out.add('number');
  if (/<input\b[^>]*type\s*=\s*["']?file\b/i.test(h) || /showOpenFilePicker|ondrop\s*=|addEventListener\(\s*['"]drop['"]/.test(h)) out.add('file');
  if (/getUserMedia/.test(h) && /\b(?:pitch|frequency|tuner|yin|autocorrelat|decibel|dB\b|note name|midi note)/i.test(h)) out.add('mic-measure');
  if (/getUserMedia/.test(h) && /BarcodeDetector|jsQR|qr code/i.test(h)) out.add('camera-measure');
  return [...out];
}
/** what the page gives back to keep: ['download', 'copy', 'share-link', 'saved']. Pure. */
export function keepsOf(html) {
  const h = strip(html), out = new Set();
  if (/\bdownload\s*=|\.download\s*=|showSaveFilePicker/.test(h)) out.add('download');
  if (/clipboard\.writeText|execCommand\(\s*['"]copy/.test(h)) out.add('copy');
  if (/location\.hash\s*=|history\.(?:replace|push)State\([^)]*#|[?#][a-z]=['"]?\s*\+\s*(?:encodeURIComponent|btoa)/i.test(h)) out.add('share-link');
  if (/localStorage\.setItem/.test(h)) out.add('saved'); // IndexedDB "seals" of a genome are the toy's own state, not the person's work
  return [...out];
}
/** the job the SPEC names in plain words, or ''. Pure. */
export function jobOf(spec) {
  const s = String(spec || '');
  const line = /^\s*(?:\*\*)?(?:job|plain name|who it is for|for whom)(?:\*\*)?\s*:?\s*(?:\*\*)?\s*:?\s*(.+)$/im.exec(s);
  if (line && line[1].trim().length > 2) return line[1].replace(/\*\*/g, '').trim().slice(0, 140);
  const m = /\b(?:for regular visitors|people (?:actually )?(?:use|make|share|send|come back)|a tool (?:that|to|for))\b[^.\n]*/i.exec(s);
  if (m) return m[0].trim().slice(0, 140);
  // a SPEC that opens by telling the person what to do ("Write a short scene in plain text.", "Paste any text and ...") names its job
  const first = s.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !/^(#|\*\*|```|\||---|-)/.test(l));
  return first && /^(?:write|paste|type|hum|drop|upload|pick|choose|enter|record|scan|measure|check|convert|make|build|draw|plan|track|compare)\b/i.test(first) ? first.slice(0, 140) : '';
}
// words that name a toy's substrate, not a job (the hourly engine's favourites: 227 of 454 drafts end in "mind")
const TOY_WORDS = /\b(?:mind|minds|mindscape|lattice|swarm|genome|arena|nca|orbs?|portals?|sealed|morph|manifold|substrate|reservoir|hebbian|kernel|attested|automaton|automata|cellular|softbody|boids?|spiking|competition|agents?|thought)\b|-not-/i;
/** the slug's and title's words: 'F609-webxr-gaze-sdf-raymarch-manifold-mind' -> 'webxr gaze sdf raymarch manifold mind'. Pure. */
const wordsOf = (dir, spec) => (String(dir).replace(/^f?-?\d+-?/i, '').replace(/[-_]+/g, ' ') + ' ' + ((/^#\s+(.+)$/m.exec(String(spec || '')) || [, ''])[1])).toLowerCase();

/** one draft's verdict: { grade: 'tool'|'toy', job, inputs, keeps, why }. Pure. */
export function grade({ dir = '', html = '', spec = '' }) {
  const inputs = inputsOf(html), keeps = keepsOf(html), job = jobOf(spec), toyish = TOY_WORDS.test(wordsOf(dir, spec));
  const measured = inputs.includes('file') || inputs.includes('mic-measure') || inputs.includes('camera-measure');
  const realKeep = keeps.some((k) => k !== 'saved') || (keeps.includes('saved') && inputs.includes('text'));
  const why = [];
  if (!inputs.length && !(job && (keeps.includes('download') || keeps.includes('share-link')))) why.push('takes nothing of the person\'s own (no text, number, file or measured sound to work on)');
  if (!realKeep) why.push('gives nothing back to keep (no download, copy, share link or saved work)');
  if (!job && !(measured && realKeep)) why.push('its SPEC names no job in plain words (no "Job:" or "Plain name:" line)');
  if (toyish && !job) why.push('its name is a substrate (mind, lattice, swarm, genome, orb...), not a job');
  // a maker's input is the work the person makes on it (a strip, a loop): it counts when the work leaves with them (a download or a share link)
  const made = !!job && (keeps.includes('download') || keeps.includes('share-link'));
  const tool = (inputs.length > 0 || made) && realKeep && (job || measured) && !(toyish && !job);
  return { grade: tool ? 'tool' : 'toy', job, inputs, keeps, why: tool ? [] : why };
}

// the one real tool each toy technique becomes (merge, not multiply): the first IDEAS row whose pattern the draft's name and SPEC match.
// `page` is where the tool lives once built; `exists` names a Verse page that already does that job (the toy merges into it, no new page).
export const IDEAS = Object.freeze([
  { key: 'checksum', re: /\b(?:sha-?256|sealed?|seal|hash|attested|attest)\b/i, nameOnly: true, tool: 'File checksum checker', page: '/lab/checksum/', why: 'the drafts seal their state with SHA-256; a person needs that to check a download is the file it says it is' },
  { key: 'level', re: /\b(?:orientation|deviceorientation|tilt|gyro|accelerometer|gravity)\b/i, tool: 'Spirit level', page: '/lab/level/', why: 'the drafts read the phone\'s tilt to steer particles; the same reading levels a shelf or a picture frame' },
  { key: 'pitch', re: /\b(?:pitch|tuner|hum|yin|spectral|spectrum|acoustic|audio|sound|resonan\w*|voice)\b/i, tool: 'Tuner', page: '/tuner/', exists: '/tuner/', why: 'the drafts analyse microphone sound; Verse\'s tuner already turns that into a note and cents' },
  { key: 'dictation', re: /\b(?:speech|spoken|dictat\w*|transcri\w*)\b/i, tool: 'Dictation pad', page: '/lab/dictation/', why: 'the drafts turn speech into orbs; a person wants the words, as text they can copy' },
  { key: 'palette', re: /\b(?:k-?means|som|self-?organi[sz]ing|cluster\w*|quantiz\w*|vector quantiz\w*)\b/i, tool: 'Photo palette', page: '/lab/photo-palette/', why: 'the drafts cluster points; clustering a photo\'s pixels gives the colours a person can use' },
  { key: 'pattern', re: /\b(?:reaction[- ]diffusion|gray-?scott|rd|turing|nca|lattice|cellular|automat\w*|dla|wfc|wave[- ]function|l-?system|growth|coral|morphogen\w*|field)\b/i, tool: 'Seamless pattern maker', page: '/lab/pattern/', why: 'the drafts grow patterns on a grid that wraps; that is a tileable texture a person can download' },
  { key: 'mindmap', re: /\b(?:graph|force-?directed|concept|co-?occurrence|association\w*|knowledge)\b/i, tool: 'Mind map', page: '/lab/mind-map/', why: 'the drafts lay concepts out as a force graph; typed ideas laid out that way are a mind map to save' },
  { key: 'webrtc', re: /\bwebrtc\b/i, tool: 'Send to another device', page: null, why: 'the drafts link two tabs over WebRTC; the useful form sends a note or file between a person\'s own devices' },
]);
/** the IDEAS row a toy belongs to, or null (a pure toy with no tool in it). Pure. */
export function ideaOf({ dir = '', spec = '' }) {
  // the draft's own name decides first; the SPEC only when the name names no technique (nearly every SPEC says "sealed to IndexedDB with SHA-256")
  const name = wordsOf(dir, spec), body = String(spec || '').slice(0, 600);
  return IDEAS.find((i) => i.re.test(name)) || IDEAS.find((i) => !i.nameOnly && i.re.test(body)) || null;
}

/** what the catalog keeps for a draft: { grade, idea? } (the sync adds it to each entry; the gallery lists tools, the sitemap skips toys). Pure. */
export function verdictOf(d) { const g = grade(d), i = g.grade === 'toy' ? ideaOf(d) : null; return { grade: g.grade, ...(i ? { idea: i.key } : {}) }; }
/** the tools the toys' ideas became, as the gallery lists them: [{ key, tool, page, why }] (an idea with no page yet is left out). */
export const LAB_TOOLS = Object.freeze(IDEAS.filter((i) => i.page).map(({ key, tool, page, why }) => Object.freeze({ key, tool, page, why })));
/** every draft graded: [{ slug, dir, grade, job, inputs, keeps, why, idea }], by name. slugOf is lab-import's. Pure. */
export function gradeAll(drafts, slugOf) {
  return drafts.map((d) => { const g = grade(d), i = g.grade === 'toy' ? ideaOf(d) : null; return { slug: slugOf(d.dir), dir: d.dir, ...g, idea: i ? i.key : null }; });
}
/** the counts a report needs: { total, tool, toy, ideas: { key: n }, pure } . Pure. */
export function countsOf(rows) {
  const ideas = {}; let pure = 0;
  for (const r of rows) if (r.grade === 'toy') { if (r.idea) ideas[r.idea] = (ideas[r.idea] || 0) + 1; else pure++; }
  return { total: rows.length, tool: rows.filter((r) => r.grade === 'tool').length, toy: rows.filter((r) => r.grade === 'toy').length, ideas, pure };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  if (arg('--file')) {
    const f = arg('--file'), s = arg('--spec', path.join(path.dirname(f), 'SPEC.md'));
    const d = { dir: path.basename(path.dirname(path.resolve(f))), html: fs.readFileSync(f, 'utf8'), spec: fs.existsSync(s) ? fs.readFileSync(s, 'utf8') : '' };
    const g = grade(d), i = g.grade === 'toy' ? ideaOf(d) : null;
    console.log(JSON.stringify({ ...g, idea: i ? { tool: i.tool, page: i.page, why: i.why } : null }, null, 1));
    process.exit(argv.includes('--strict') && g.grade !== 'tool' ? 1 : 0);
  }
  const drafts = arg('--drafts'); if (!drafts) { console.error('usage: node tools/lab-grade.mjs --drafts <drafts dir> [--write] | --file <index.html>'); process.exit(2); }
  // not awaited at the top: lab-import imports this file, so it can only load once this one has finished
  import('./lab-import.mjs').then(({ readDrafts, slugOf }) => {
  const rows = gradeAll(readDrafts(path.resolve(drafts)), slugOf), c = countsOf(rows);
  console.log('lab-grade: ' + c.total + ' drafts: ' + c.tool + ' tools, ' + c.toy + ' toys (' + (c.toy - c.pure) + ' carry an idea for a real tool, ' + c.pure + ' pure toys)');
  console.log('  ideas: ' + JSON.stringify(c.ideas));
  for (const r of rows.filter((x) => x.grade === 'tool')) console.log('  tool ' + r.slug + ': ' + (r.job || '(measured)') + ' [' + r.inputs.join(',') + ' -> ' + r.keeps.join(',') + ']');
  if (argv.includes('--write')) {
    const out = Object.fromEntries(rows.map((r) => [r.slug, { grade: r.grade, ...(r.job ? { job: r.job } : {}), ...(r.idea ? { idea: r.idea } : {}), ...(r.why.length ? { why: r.why } : {}) }]));
    fs.writeFileSync(GRADES, JSON.stringify(out, null, 1) + '\n');
    console.log('  wrote ' + path.relative(process.cwd(), GRADES));
  }
  });
}
