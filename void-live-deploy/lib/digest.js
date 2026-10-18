// Verse reads a video's words (owner, 2026-10-15: "Verse was already supposed to be learning from YouTube videos anyway"):
// a transcript someone pastes, or the open captions of a PeerTube or Internet Archive video, become a short summary and
// answers to "what did this teach?". Pure helpers, no network. Nothing here is stored: transcripts are the creator's words
// and never enter the repo or KV (.claude/skills/learn-from-video). YouTube captions are not fetched (YouTube only gives
// them to a video's owner, and scraping them is against its terms): paste them instead.
export const MAX_TEXT = 60000; // characters of transcript read at most
export const MODEL_CHARS = 6000; // the most the model ever sees (free-tier neurons)

/** WebVTT or SRT -> plain text: cue numbers, timings, tags and repeated rolling lines removed. */
export function captionText(raw) {
  const out = [];
  for (let line of String(raw || '').replace(/\r/g, '').split('\n')) {
    line = line.trim();
    if (!line || /^WEBVTT/.test(line) || /^\d+$/.test(line) || /-->/.test(line) || /^(NOTE|STYLE|REGION)\b/.test(line) || /^(Kind|Language):/.test(line)) continue;
    line = line.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/\s+/g, ' ').trim();
    if (line && line !== out[out.length - 1]) out.push(line);
  }
  return out.join(' ').slice(0, MAX_TEXT);
}

const STOP = new Set('the a an and or but of to in on at for with is are was were be been it this that these those i you we they he she so just like um uh yeah okay ok gonna going get got have has had do does did not no yes can will would could should then than there here what when where which who how why your our my me us them their its as by from if into about up out over also very really one all some any more most'.split(' '));
const words = (s) => (String(s).toLowerCase().match(/[a-z0-9']+/g) || []).filter((w) => w.length > 2 && !STOP.has(w));
export function sentences(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  let s = t.match(/[^.!?]+[.!?]+/g) || [];
  if (s.join('').length < t.length * 0.5) { const w = t.split(' '); s = []; for (let i = 0; i < w.length; i += 22) s.push(w.slice(i, i + 22).join(' ')); } // auto-captions often have no full stops
  const chunk = (x) => { if (x.length < 400) return [x]; const w = x.split(' '), o = []; for (let i = 0; i < w.length; i += 22) o.push(w.slice(i, i + 22).join(' ')); return o; };
  return s.flatMap((x) => chunk(x.trim())).filter((x) => x.length > 25 && x.length < 400);
}
/** the n most central sentences, in their original order (no model). */
export function keyPoints(text, n = 5) {
  const ss = sentences(text), tf = new Map();
  for (const s of ss) for (const w of new Set(words(s))) tf.set(w, (tf.get(w) || 0) + 1);
  const scored = ss.map((s, i) => { const ws = words(s); return { i, s, v: ws.length ? ws.reduce((a, w) => a + Math.log(1 + (tf.get(w) || 0)), 0) / Math.sqrt(ws.length) : 0 }; });
  return scored.sort((a, b) => b.v - a.v).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s);
}
/** the sentences that best answer a question (no model). */
export function answerFrom(text, ask, n = 3) {
  const q = new Set(words(ask).filter((w) => !/^(video|teach|taught|learn|tell|say|said|talk|talks)$/.test(w)));
  if (!q.size) return keyPoints(text, n);
  const ss = sentences(text).map((s, i) => ({ i, s, v: words(s).filter((w) => q.has(w)).length }));
  const best = ss.filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s);
  return best.length ? best : keyPoints(text, n);
}
/** the part the model sees: the key points plus the start, capped at MODEL_CHARS. */
export function modelInput(text) { return (keyPoints(text, 12).join(' ') + ' … ' + String(text).slice(0, 2000)).slice(0, MODEL_CHARS); }

// Editing tricks a tutorial teaches: words that name a technique, for the video-tricks learner (tools/learn-tricks.mjs).
export const TRICK_WORDS = /\b(transition|keyframe|j[- ]cut|l[- ]cut|match cut|jump cut|speed ramp|slow motion|zoom in|zoom out|punch[- ]in|mask|masking|overlay|lower third|caption|subtitle|color grad\w*|lut|chroma key|green screen|motion blur|stabiliz\w*|crossfade|fade|blend mode|parallax|tracking|title card|b-roll|whip pan|glitch|split screen|time ?lapse|seamless loop|ken burns|adjustment layer|nested sequence)\b/i;
const HOW = /\b(timeline|clip|effect|drag|apply|applied|click|add|keyframes?|layer|track|footage|edit|editing|render|export|frame)\b/i;
export function trickLines(text, n = 4) {
  return sentences(text).filter((s) => TRICK_WORDS.test(s) && HOW.test(s.replace(TRICK_WORDS, '')) && s.length < 220).slice(0, n);
}

/** a PeerTube or Internet Archive page -> where its open captions live, or null. Pure. */
export function captionSource(url) {
  let u; try { u = new URL(String(url)); } catch (_) { return null; }
  if (u.protocol !== 'https:') return null;
  let m = u.pathname.match(/^\/(?:details|embed)\/([A-Za-z0-9._-]+)/);
  if (u.hostname === 'archive.org' && m) return { platform: 'archive', id: m[1], meta: 'https://archive.org/metadata/' + m[1] };
  m = u.pathname.match(/^\/(?:w|videos\/watch|videos\/embed)\/([A-Za-z0-9-]{8,40})/);
  if (m && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)) return { platform: 'peertube', host: u.hostname, id: m[1], meta: 'https://' + u.hostname + '/api/v1/videos/' + m[1] + '/captions' };
  return null;
}
