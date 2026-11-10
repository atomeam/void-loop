// The shared show pipeline: facts, a script, timings, captions, and the two voices.
// The podcast, the Shorts, and /studio/ all use this. Pure. No network.
// What a stranger could do with this: nothing. It only checks and shapes text.

export const CTA = 'Ask Verse for anything\na-to-mind.com';
export const CTA_SAY = 'Ask Verse for anything at a to mind dot com.';
// codes, queue ids, paths, and the internal names a listener should never hear
export const BANNED = /\b(?:LANE_[A-Z0-9_]+|Queue job|exam score|void\.voice|helper\/[\w.-]+|(?:tools|void-live-deploy)\/[\w./-]+\.(?:mjs|js|yml|json)|[0-9a-f]{9,})\b/i;

/** ffmpeg filters. Verse sits a little higher, with a light chorus and a short room. The Critic sits lower, drier, and a touch slower. */
/** Kokoro voice files, not names. Verse uses af_sky. Critic uses bm_george. The character's name is Critic. */
export const VOICES = Object.freeze({
  Verse: { id: 'af_sky', lang: 'en-us', speed: 0.94 },
  Critic: { id: 'bm_george', lang: 'en-gb', speed: 0.86 },
});
export const VOICE_AF = Object.freeze({
  Verse: 'asetrate=24720,aresample=24000,atempo=0.971,chorus=0.45:0.65:50:0.25:0.18:1.2,aecho=0.8:0.72:20:0.1,highpass=f=140,lowpass=f=9500',
  Critic: 'asetrate=22560,aresample=24000,atempo=1.064,equalizer=f=280:t=q:w=1:g=2.5,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=80',
});

const clean = (s) => String(s || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/\s+/g, ' ').trim();

/** plain feats a person can follow, newest first. Skips codes, prices, and leftover internal words. Pure. */
export function featsFrom(growth, n = 6) {
  const out = [];
  for (const e of [...(growth || [])].reverse()) {
    if (!e || !['build', 'grow'].includes(e.kind) || !e.show) continue;
    let t = clean(e.show).replace(/[`$#]/g, '');
    if (t.length < 24 || t.length > 140 || /\d/.test(t)) continue;
    if (BANNED.test(t) || /\b(api|gate|ledger|phrasebook|skill|workflow)\b/i.test(t)) continue;
    if (!/[.!?]$/.test(t)) t += '.';
    t = t[0].toUpperCase() + t.slice(1);
    if (out.some((x) => x.toLowerCase() === t.toLowerCase())) continue;
    out.push(t);
  }
  const human = (t) => /you|your|movie|film|paper|page|picture|song|clock|paint|draw|brain/i.test(t) ? 0 : 1;
  return out.sort((a, b) => human(a) - human(b)).slice(0, n);
}

/** dialogue lines from a model's reply. A title line is kept aside. Pure. */
export function parseShow(text) {
  let title = '';
  const lines = [];
  for (const row of String(text || '').split(/\n+/)) {
    const s = row.replace(/^[\s>*\-–\d.)]+/, '').trim();
    const titleHit = s.match(/^(?:title|episode)\s*:\s*(.+)$/i);
    if (titleHit && !lines.length) { title = clean(titleHit[1]).replace(/[.!?]$/, ''); continue; }
    const m = s.match(/^(Verse|Critic)\s*:\s*(.+)$/i);
    if (!m) { if (!title && !lines.length && s.length > 2 && s.length < 60) title = clean(s).replace(/[.!?]$/, ''); continue; }
    const who = /^c/i.test(m[1]) ? 'Critic' : 'Verse';
    let say = clean(m[2]).replace(/^["“]|["”]$/g, '');
    if (!say) continue;
    if (!/[.!?]$/.test(say)) say += '.';
    lines.push({ who, text: say });
  }
  return { title, lines };
}

/** why a script cannot air. Empty when it can. Pure. */
export function scriptIssues(show, { min = 4, max = 16 } = {}) {
  const bad = [];
  const lines = (show && show.lines) || [];
  if (lines.length < min) bad.push('too short');
  if (lines.length > max) bad.push('too long');
  const blob = [show && show.hook, show && show.title, ...lines.map((l) => l.text)].join(' ');
  if (BANNED.test(blob)) bad.push('jargon');
  if (/\.\.\.|…/.test(blob)) bad.push('cut off');
  if (/\b(blood|bleed|idiot|stupid|hate you|waste of|you are a mistake|suffering)\b/i.test(blob)) bad.push('cruel');
  if (/\b(microphone|audio level|oxygen|this podcast)\b/i.test(blob)) bad.push('about the recording');
  if (!lines.some((l) => l.who === 'Critic') || !lines.some((l) => l.who === 'Verse')) bad.push('needs both voices');
  for (const l of lines) {
    if (!l || (l.who !== 'Verse' && l.who !== 'Critic')) bad.push('speaker');
    if (!l.text || l.text.length > 180 || !/[.!?]$/.test(l.text)) bad.push('not a sentence');
  }
  return [...new Set(bad)];
}

/** true when the shown lines are the same words as the source, only broken on spaces. Pure. */
export function sameWords(raw, shown) {
  const flat = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  return flat(raw) === flat(String(shown || '').replace(/\n/g, ' '));
}

/** two time ranges overlap. Pure. */
export function timeOverlap(a, b, pad = 0.02) {
  if (!a || !b || a.from == null || b.from == null) return false;
  return a.from < b.to - pad && b.from < a.to - pad;
}

/** two boxes overlap. Pure. */
export function boxOverlap(a, b) {
  const w = (r) => r.w || 0, h = (r) => r.h || 0;
  if (!w(a) || !w(b) || !h(a) || !h(b)) return false;
  return a.x < b.x + w(b) && b.x < a.x + w(a) && a.y < b.y + h(b) && b.y < a.y + h(a);
}

/** place each piece after the one before it. dur is the real audio length. Pure. */
export function sequence(parts, gap = 0.35) {
  let t = 0;
  return (parts || []).map((p) => {
    const dur = Math.max(0.4, Number(p.dur) || 0);
    const from = +t.toFixed(3), to = +(t + dur).toFixed(3);
    t = to + gap;
    return { ...p, from, to };
  });
}

const num = (text, name) => {
  const m = String(text || '').match(new RegExp(name + '\\D{0,16}(10|[1-9])\\b', 'i'));
  return m ? +m[1] : 0;
};
/** scores from a judge's note. Passes when each mark is at least 6 and the average is at least 7. Pure. */
export function parseScores(text) {
  const scores = {
    clarity: num(text, 'clarity'),
    originality: num(text, 'original'),
    entertainment: num(text, 'entertain'),
    impressive: num(text, 'impress'),
  };
  const note = (String(text || '').match(/notes?\s*[:\-]\s*(.+)$/im) || ['', ''])[1].replace(/\s+/g, ' ').trim().slice(0, 280);
  const vals = Object.values(scores);
  const avg = vals.reduce((a, b) => a + b, 0) / 4;
  return { ...scores, avg: +avg.toFixed(2), notes: note || 'No note.', pass: vals.every((n) => n >= 6) && avg >= 7 };
}

/** one line a later writer can read: the last few notes and whether the marks rose. Pure. */
export function trendLine(rows) {
  const last = (rows || []).slice(-5);
  if (!last.length) return '';
  const marks = last.map((r) => r.avg).filter((n) => n > 0);
  const way = marks.length > 1 ? (marks[marks.length - 1] > marks[0] ? 'up' : marks[marks.length - 1] < marks[0] ? 'down' : 'flat') : 'new';
  const notes = last.map((r) => r.notes).filter(Boolean).slice(-2).join(' ');
  return 'Recent marks are ' + way + (marks.length ? ' (' + marks.join(', ') + ').' : '.') + (notes ? ' Notes: ' + notes : '');
}

const STOP = new Set('the a an and or but to of in on for is it this that you i we they was be at with as from by its his her not just have has had are were your my our fundamentally basically simply clearly actually really literally'.split(' '));
/** words that can tie one line to the next. Pure. */
export function contentWords(s) {
  return new Set(String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)));
}
/** the next line shares a content word with the previous line, or it is a direct yes or no. Pure. */
export function follows(prev, next) {
  const b = contentWords(next);
  for (const w of b) if (contentWords(prev).has(w)) return true;
  return /^(no|yes|wrong|exactly|wait)\b/i.test(String(next || '').trim());
}
const wordsOf = (lines) => (lines || []).reduce((n, l) => n + String(l.text || '').split(/\s+/).filter(Boolean).length, 0);
/**
 * Hard half of the judge. An episode must be long enough to be a show, lines must follow, and the critic needs his running bit.
 * A short must be a 30 to 60 second telling. Pure.
 */
export function hardShow(show, { kind = 'episode' } = {}) {
  const bad = [];
  const lines = (show && show.lines) || [];
  const blob = lines.map((l) => l.text).join(' ');
  const n = wordsOf(lines);
  if (kind === 'episode') {
    if (n < 560 || n > 1300) bad.push('length');
    if (lines.length < 24) bad.push('length');
  } else if (n < 70 || n > 160) bad.push('length');
  if (BANNED.test(blob) || /\b(ledger|workflow|helper\/|LANE_)\b/i.test(blob)) bad.push('jargon');
  let breaks = 0;
  for (let i = 1; i < lines.length; i++) if (!follows(lines[i - 1].text, lines[i].text)) breaks++;
  if (lines.length > 2 && breaks > Math.floor(lines.length * 0.15)) bad.push('does not follow');
  if (kind === 'episode') {
    const bit = lines.filter((l) => l.who === 'Critic' && /i have a note/i.test(l.text)).length;
    if (bit < 2) bad.push('no running bit');
  }
  for (const phrase of (show && show.must) || []) if (!blob.toLowerCase().includes(String(phrase).toLowerCase())) bad.push('missing ' + phrase);
  if (/\bthe critic\b|\bverse speaks\b/i.test(blob)) bad.push('not a conversation');
  const pad = paddingWord(lines);
  if (pad) bad.push('padding');
  return [...new Set(bad)];
}
/** A long word in too many lines is a model tic, not a callback. Topic words may repeat. Pure. */
export function paddingWord(lines) {
  const allow = new Set('words paper units note notes device figures figure abstract equations equation keywords science journal publication counting clerk barcode number numbers minutes search saved'.split(' '));
  const counts = {};
  for (const line of lines || []) {
    const seen = new Set(String(line.text || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 8));
    for (const w of seen) if (!allow.has(w)) counts[w] = (counts[w] || 0) + 1;
  }
  const worst = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (worst && worst[1] >= Math.max(4, Math.ceil((lines || []).length * 0.25))) return worst[0];
  return '';
}
/** The model may be generous. Lines that do not follow cap clarity. A short show caps entertainment. Pure. */
export function settle(scores, issues) {
  const s = { clarity: scores.clarity || 0, originality: scores.originality || 0, entertainment: scores.entertainment || 0, impressive: scores.impressive || 0, notes: scores.notes || '' };
  if ((issues || []).includes('does not follow')) s.clarity = Math.min(s.clarity || 9, 3);
  if ((issues || []).includes('length')) s.entertainment = Math.min(s.entertainment || 9, 3);
  if ((issues || []).includes('jargon')) s.impressive = Math.min(s.impressive || 9, 2);
  if ((issues || []).includes('no running bit')) s.entertainment = Math.min(s.entertainment || 9, 4);
  if ((issues || []).includes('padding') || (issues || []).includes('not a conversation')) s.clarity = Math.min(s.clarity || 9, 3);
  const vals = [s.clarity, s.originality, s.entertainment, s.impressive];
  s.avg = +(vals.reduce((a, b) => a + b, 0) / 4).toFixed(2);
  s.pass = !(issues || []).length && vals.every((n) => n >= 7) && s.avg >= 7.5;
  return s;
}
/**
 * Craft score against human two-host shows and human Shorts, 0 to 10.
 * 6 is the line: a hook, a real number, lines that answer each other, a joke on the fact, and a callback.
 * Under 6 is clearly worse than those shows and does not publish. Pure.
 */
export function humanScale(show, { kind = 'episode' } = {}) {
  const lines = (show && show.lines) || [];
  const blob = lines.map((l) => l.text).join(' ');
  const issues = hardShow(show, { kind });
  let score = 0;
  const marks = [];
  const first = (lines[0] && lines[0].text) || '';
  const nw = first.split(/\s+/).filter(Boolean).length;
  if (/\?/.test(first) && nw <= (kind === 'short' ? 10 : 22)) { score += 2; marks.push('hook'); }
  else marks.push('no hook');
  if (/\d/.test(blob)) { score += 2; marks.push('number'); }
  else marks.push('no number');
  let alt = 0;
  for (let i = 1; i < lines.length; i++) if (lines[i].who !== lines[i - 1].who) alt++;
  if (lines.length > 3 && alt >= (lines.length - 1) * 0.85) { score += 1; marks.push('turns'); }
  else marks.push('pileup');
  if (!issues.includes('does not follow')) { score += 2; marks.push('follows'); }
  else marks.push('breaks');
  const openW = contentWords(first);
  let back = false;
  for (const w of contentWords(lines.slice(-3).map((l) => l.text).join(' '))) if (openW.has(w)) back = true;
  if (back) { score += 1; marks.push('callback'); }
  else marks.push('no callback');
  const jabs = lines.filter((l) => l.who === 'Critic' && /\b(note|clerk|barcode|guess|dreary|manners|poster|taste|chatter|invent)\b/i.test(l.text)).length;
  if (jabs >= (kind === 'episode' ? 3 : 1)) { score += 2; marks.push('jokes'); }
  else marks.push('flat');
  if (issues.includes('does not follow') || issues.includes('length') || issues.includes('jargon') || issues.includes('padding') || issues.includes('not a conversation')) score = Math.min(score, 3);
  return { score: Math.min(10, score), marks, comparable: score >= 6 && !issues.length };
}
/** Model marks, then the hard checks and the human-hit scale. Clearly worse than the reference shows does not publish. Pure. */
export function publishScores(model, show, kind) {
  const issues = hardShow(show, { kind });
  const human = humanScale(show, { kind });
  const refs = againstReferences(show, kind);
  const settled = settle(model || {}, issues);
  const modelHuman = model && Number.isFinite(model.human) ? model.human : 10;
  settled.human = Math.min(human.score, modelHuman, ...refs.map((r) => r.score));
  settled.humanMarks = human.marks;
  settled.references = refs;
  settled.issues = issues;
  if (settled.human < 6 || !human.comparable) settled.pass = false;
  return settled;
}

/** The shows a Verse episode or Short is held against. Scores are craft, not fame. Pure data. */
export const REFERENCES = Object.freeze([
  { id: 'reply-all', kind: 'podcast', name: 'Reply All, Yes Yes No', need: ['hook', 'follows', 'number'] },
  { id: 'hard-fork', kind: 'podcast', name: 'Hard Fork', need: ['hook', 'number', 'turns'] },
  { id: 'fish', kind: 'podcast', name: 'No Such Thing As A Fish', need: ['jokes', 'follows', 'callback'] },
  { id: 'veritasium', kind: 'short', name: 'Veritasium', need: ['hook', 'follows'] },
  { id: 'rober', kind: 'short', name: 'Mark Rober', need: ['hook', 'number'] },
  { id: 'tom-scott', kind: 'short', name: 'Tom Scott', need: ['hook', 'callback'] },
  { id: 'hai', kind: 'short', name: 'Half as Interesting', need: ['number', 'jokes', 'follows'] },
  { id: 'vox', kind: 'short', name: 'Vox', need: ['hook', 'number'] },
]);
/** Side-by-side marks. A missing craft move that the reference is built on scores 3. Pure. */
export function againstReferences(show, kind) {
  const human = humanScale(show, { kind });
  const has = new Set(human.marks);
  const want = kind === 'episode' ? 'podcast' : 'short';
  return REFERENCES.filter((r) => r.kind === want).map((r) => {
    const miss = r.need.filter((n) => !has.has(n));
    const score = miss.length ? Math.min(3, 5 - miss.length) : Math.min(8, human.score);
    return { id: r.id, name: r.name, score, miss };
  });
}
/** Episode 8, the one that aired as a 9 for clarity and said nothing. The judge must fail it. */
export const BAD_EPISODE = `Critic: This idea is simply too silly to be real.
Verse: The journal opens its cover and begins to read its own pages aloud.
Critic: A book that speaks its own contents is quite absurd.
Verse: It measures the length of every page as it speaks.
Verse: The Brain page greets you before the story starts.
Critic: The First Chapter of the Living Book.
Critic: I must admit that I was completely wrong about this.
Verse: You may ask for any story at a-to-mind.com.`;
