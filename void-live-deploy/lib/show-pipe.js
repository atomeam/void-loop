// The shared show pipeline: facts, a script, timings, captions, and the two voices.
// The podcast, the Shorts, and /studio/ all use this. Pure. No network.
// What a stranger could do with this: nothing. It only checks and shapes text.

export const CTA = 'Ask Verse for anything\na-to-mind.com';
export const CTA_SAY = 'Ask Verse for anything at a to mind dot com.';
// codes, queue ids, paths, and the internal names a listener should never hear
export const BANNED = /\b(?:LANE_[A-Z0-9_]+|Queue job|exam score|void\.voice|helper\/[\w.-]+|(?:tools|void-live-deploy)\/[\w./-]+\.(?:mjs|js|yml|json)|[0-9a-f]{9,})\b/i;

/** ffmpeg filters. Verse sits a little higher, with a light chorus and a short room. The Critic sits lower, drier, and a touch slower. */
export const VOICE_AF = Object.freeze({
  Verse: 'asetrate=23594,aresample=22050,atempo=0.935,chorus=0.5:0.7:40:0.3:0.2:1.2,aecho=0.8:0.7:22:0.14,highpass=f=140,lowpass=f=8500',
  Critic: 'asetrate=19404,aresample=22050,atempo=1.136,tremolo=f=3:d=0.1,equalizer=f=320:t=q:w=1:g=3,lowpass=f=4800',
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
