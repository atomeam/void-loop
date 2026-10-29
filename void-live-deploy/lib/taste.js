// Verse's taste for "pick for me" (owner, 2026-10-17: Netflix's Max, "Verse will be way better than Max"). Built the other way round from Max: no long quiz,
// no character. A person may say a mood (a chip or a word) and give a thumb to a pick; both are optional and a pick never waits for them. Taste lives in
// this browser only (localStorage); the server is only ever told the one mood WORD, chosen from MOODS (a fixed list, so a typed word cannot become a prompt).
// Every pick says why in one line, built only from what was really used. Pure; the page side is skills/pick-for-me.js.
import { cleanTitle, normTitle } from './movies.js';
export const MOODS = {
  cozy: ['cozy', 'cozier', 'comforting', 'warm', 'gentle'], thrilling: ['thrilling', 'thriller', 'exciting', 'tense', 'scary'],
  funny: ['funny', 'funnier', 'lighter', 'comedy', 'a laugh'], curious: ['curious', 'thoughtful', 'weird', 'strange', 'mind-bending'], calm: ['calm', 'calmer', 'quiet', 'chill', 'relaxing'],
};
export const KEY = 'a2m.void.taste.v1';
export const SEEN_MAX = 200; // per kind: a pick is never repeated until 200 others have gone by
export const blank = () => ({ mood: '', likes: [], dislikes: [], seen: [], yt: {}, ytN: 0 });
const cap = (a, n) => a.slice(-n);
/** the taste read from a store (a localStorage-like), never throwing and never trusting its shape. Pure given the store. */
export function load(store) {
  try {
    const j = JSON.parse(store.getItem(KEY) || 'null'); if (!j || typeof j !== 'object') return blank();
    const items = (a) => (Array.isArray(a) ? a : []).map((x) => ({ kind: String(x && x.kind || '').slice(0, 10), title: cleanTitle(x && x.title), genre: cleanTitle(x && x.genre).slice(0, 30), words: cleanTitle(x && x.words).slice(0, 120) })).filter((x) => x.kind && x.title);
    return { mood: moodWord(j.mood), likes: cap(items(j.likes), 30), dislikes: cap(items(j.dislikes), 30), seen: (Array.isArray(j.seen) ? j.seen : []).map((s) => String(s).slice(0, 120)).slice(-SEEN_MAX * 3), yt: cleanTopics(j.yt), ytN: Math.max(0, Math.min(1e6, Math.floor(+j.ytN) || 0)) };
  } catch (_) { return blank(); }
}
export function save(store, t) { try { store.setItem(KEY, JSON.stringify(t)); return true; } catch (_) { return false; } }
export function forget(store) { try { store.removeItem(KEY); } catch (_) {} return blank(); }
/** the fixed mood word for any typed word ("funnier" -> "funny"), or '' */
export function moodWord(w) {
  const t = String(w || '').toLowerCase().trim();
  for (const [m, ws] of Object.entries(MOODS)) if (t === m || ws.includes(t)) return m;
  return '';
}
export const seenKey = (kind, title) => kind + ':' + normTitle(title);
/** record a thumb on a pick; the opposite thumb on the same title is replaced. Pure. */
export function rate(t, kind, title, up, extra = {}) {
  const k = normTitle(title), no = (x) => !(x.kind === kind && normTitle(x.title) === k), item = { kind, title: cleanTitle(title), genre: cleanTitle(extra.genre).slice(0, 30), words: cleanTitle(extra.words).slice(0, 120) };
  return { ...t, likes: up ? cap([...t.likes.filter(no), item], 30) : t.likes.filter(no), dislikes: up ? t.dislikes.filter(no) : cap([...t.dislikes.filter(no), item], 30) };
}
export function markSeen(t, kind, title) {
  const k = seenKey(kind, title), mine = t.seen.filter((s) => s.startsWith(kind + ':') && s !== k), other = t.seen.filter((s) => !s.startsWith(kind + ':'));
  return { ...t, seen: [...other, ...cap(mine, SEEN_MAX - 1), k] }; // bounded per kind, newest kept
}
/** may this title be picked: not shown already (this and earlier picks, so "something else" never repeats) and not given a thumb down. Pure. */
export const allowed = (t, kind, title) => !t.seen.includes(seenKey(kind, title)) && !t.dislikes.some((d) => d.kind === kind && normTitle(d.title) === normTitle(title));
/** the kind the person's thumbs-ups lean to (the most liked), or '' when none: the only way taste picks a kind. */
export function likedKind(t, kinds) {
  const n = {}; for (const l of t.likes) if (kinds.includes(l.kind)) n[l.kind] = (n[l.kind] || 0) + 1;
  const best = Object.entries(n).sort((a, b) => b[1] - a[1])[0]; return best ? best[0] : '';
}
/** the one honest line of why, from what was really used: { mood, liked (a title or ''), kindBy: 'asked'|'liked'|'day', reroll }. Pure. */
export function why({ mood = '', liked = '', kindBy = 'day', reroll = false, kind = '' } = {}) {
  const bits = [];
  if (mood) bits.push('you wanted something ' + mood);
  if (kindBy === 'liked' && liked) bits.push('you gave a thumbs-up to ' + liked + ' before');
  if (kindBy === 'day' && kind) bits.push('you named no kind, so I chose ' + (kind === 'music' ? 'music' : 'a movie') + ' for today');
  if (reroll) bits.push('it is not one I showed you already');
  return bits.length ? 'Because ' + bits.join(' and ') + '.' : 'I had nothing to go on yet, so this is just a good one. Tell me a mood and I will aim.';
}
/** "pick for me", "surprise me", "something else", "funnier", "yes play it", "forget my taste" -> { cmd, mood? } | null. `hasLast`: a pick is up, which lets the bare words count. Pure. */
export function tasteCmd(text, hasLast = false) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
  if (/^(?:please\s+)?(?:forget|clear|reset|delete)\s+(?:my\s+)?taste$/.test(t)) return { cmd: 'forget' };
  if (/^(?:please\s+)?(?:pick|choose|decide)\s+for\s+(?:me|us)$|^(?:you\s+pick|surprise\s+(?:me|us)|just\s+pick|you\s+choose)$/.test(t)) return { cmd: 'pick' };
  if (!hasLast) {
    const m = t.match(/^(?:pick|find|give\s+me|i\s+want)\s+(?:me\s+)?(?:something|a\s+movie|a\s+song)?\s*(?:that\s+is\s+|that's\s+)?(\w[\w-]*)$/); const mood = m && moodWord(m[1]);
    return mood ? { cmd: 'mood', mood } : null;
  }
  if (/^(?:something|anything|another)(?:\s+(?:else|one))?$|^(?:again|next|another|something\s+different|show\s+me\s+another(?:\s+one)?|not\s+that\s+one|skip|re-?roll)$/.test(t)) return { cmd: 'again' };
  if (/^(?:yes\s+)?(?:play|start|put)\s+(?:it|that)(?:\s+on)?$|^yes\s+play\s+it$/.test(t)) return { cmd: 'play' };
  const m = t.match(/^(?:make\s+it\s+|a\s+bit\s+|something\s+|more\s+|pick\s+|a\s+little\s+)*([\w-]+)$/); const mood = m && moodWord(m[1]);
  return mood ? { cmd: 'mood', mood } : null;
}

// ---- the pick algorithm (owner, 2026-10-17: "something new every time ... personalized with interests like YouTube, or an even better algorithm"). All on this device.
// Signals are real ones only: the YouTube history the person imported themselves, their thumbs, the cards they kept, the kinds and words of their recent asks.
// A candidate (a found title with its genre/artist/overview) is scored by the interests it touches; mostly Verse takes the best (exploit), about one pick in four
// it tries a genre the person has not picked yet (explore), and a pick in the genre of the last one is marked down so consecutive picks differ.
export const EXPLORE = 0.25, SAME_GENRE_PENALTY = 3;
const STOP = new Set('the a an and or of to in on for with from by at as is it its this that these those my me you your i we our be are was were not no yes video videos watched watch official music new full hd 4k part episode ep vs feat ft live trailer clip clips how what why who when where'.split(' '));
/** the words of a text that can be interests: lower case letters, 3 to 20 long, no stop words. Pure. */
export const wordsOf = (text) => [...new Set(String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z][a-z'-]{2,19}/g) || [])].filter((w) => !STOP.has(w));
export function cleanTopics(o) {
  const out = {}; if (!o || typeof o !== 'object') return out;
  for (const [k, v] of Object.entries(o).slice(0, 400)) { const w = String(k).toLowerCase().replace(/[^a-z' -]/g, '').slice(0, 40), n = Math.max(0, Math.min(5, +v || 0)); if (w.length >= 3 && n) out[w] = n; }
  return out;
}
/** topic counts -> the top 80, scaled to at most 5 (the strongest interest), so no history can drown the thumbs. Pure. */
function reduce(counts) {
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 80), max = top.length ? top[0][1] : 1, out = {};
  for (const [k, v] of top) out[k] = Math.round((v / max) * 50) / 10; return out;
}
/** a Google Takeout watch-history.json (the person's own file, read in the browser, never uploaded) -> { topics, n } from the video titles and channel names. Pure. */
export function parseTakeout(json) {
  let arr = json; if (typeof json === 'string') { try { arr = JSON.parse(json); } catch (_) { return { topics: {}, n: 0 }; } }
  if (!Array.isArray(arr)) return { topics: {}, n: 0 };
  const counts = {}; let n = 0;
  for (const it of arr.slice(0, 50000)) {
    if (!it || typeof it !== 'object') continue; n += 1;
    const title = String(it.title || '').replace(/^Watched\s+/i, ''), ch = it.subtitles && it.subtitles[0] && it.subtitles[0].name;
    for (const w of wordsOf(title)) counts[w] = (counts[w] || 0) + 1;
    for (const w of wordsOf(ch)) counts[w] = (counts[w] || 0) + 2; // a channel says more than a title
  }
  return { topics: reduce(counts), n };
}
/** a pasted list of channel or video titles, one per line -> { topics, n }. Pure. */
export function parseList(text) {
  const counts = {}; let n = 0;
  for (const line of String(text || '').split(/\n/).slice(0, 5000)) { const ws = wordsOf(line); if (!ws.length) continue; n += 1; for (const w of ws) counts[w] = (counts[w] || 0) + 1; }
  return { topics: reduce(counts), n };
}
/** the interests: word -> { w (weight), src } from every real signal, strongest source per word. `asks`: the recent asks, `kept`: the asks of kept cards. Pure. */
export function interests(t, { asks = [], kept = [] } = {}) {
  const m = {}, put = (w, v, src) => { if (!m[w] || m[w].w < v) m[w] = { w: v, src }; };
  for (const [w, v] of Object.entries(t.yt || {})) put(w, v * 0.6, 'youtube');
  for (const a of asks.slice(-30)) for (const w of wordsOf(a)) put(w, 0.6, 'asks');
  for (const a of kept.slice(-30)) for (const w of wordsOf(a)) put(w, 1.2, 'kept');
  for (const l of t.likes) for (const w of wordsOf(l.title + ' ' + (l.words || ''))) put(w, 3, 'thumbs');
  for (const d of t.dislikes) for (const w of wordsOf(d.title + ' ' + (d.words || ''))) if (!(m[w] && m[w].src === 'thumbs' && m[w].w > 0)) m[w] = { w: -3, src: 'thumbs' };
  return m;
}
const featureWords = (f) => wordsOf([f.genre, f.artist, f.director, f.album, f.title, f.overview].filter(Boolean).join(' '));
/** score one candidate: the sum of the interests it touches (the best few). Returns { score, hit: { word, src } | null }. Pure. */
export function score(f, ints) {
  let score = 0, hit = null;
  for (const w of featureWords(f)) { const i = ints[w]; if (!i) continue; score += i.w; if (!hit || i.w > hit.w) hit = { word: w, src: i.src, w: i.w }; }
  return { score, hit: hit && hit.w > 0 ? hit : null };
}
/** choose among found, allowed candidates. rng: () => [0,1). lastGenre: the previous pick's genre. Returns { pick, mode: 'exploit' | 'explore' | 'fresh', hit } | null. Pure given rng. */
export function choose(cands, t, ints, rng = Math.random, { lastGenre = '' } = {}) {
  if (!cands.length) return null;
  const g = (f) => String(f.genre || '').toLowerCase(), scored = cands.map((f) => { const s = score(f, ints); return { f, score: s.score - (lastGenre && g(f) === lastGenre ? SAME_GENRE_PENALTY : 0) + rng() * 0.01, hit: s.hit }; });
  const known = new Set([...t.likes.map((l) => String(l.genre || '').toLowerCase())].filter(Boolean));
  const anySignal = scored.some((x) => x.hit);
  if (rng() < EXPLORE) {
    const fresh = scored.filter((x) => g(x.f) && !known.has(g(x.f)) && g(x.f) !== lastGenre);
    if (fresh.length) return { pick: fresh[Math.floor(rng() * fresh.length) % fresh.length].f, mode: 'explore', hit: null };
  }
  scored.sort((a, b) => b.score - a.score);
  if (!anySignal) return { pick: scored[Math.floor(rng() * scored.length) % scored.length].f, mode: 'fresh', hit: null };
  return { pick: scored[0].f, mode: 'exploit', hit: scored[0].hit, score: scored[0].score };
}
/** the pick as JSON the person can read (asked by Verse): similarity is how closely the pick touches the interests it was chosen on
 * (0 when nothing was used; s / (s + 3), so one thumbs-up word is 0.5), and reasoning names the one signal and the skill that chose it,
 * the same signal whyPick says, so the number and the sentence never disagree. Pure. */
export function pickRecord(r, { kind = '', skill = 'pick-for-me' } = {}) {
  if (!r || !r.pick) return null;
  const s = r.mode === 'exploit' && r.hit ? Math.max(0, Math.round((r.score || r.hit.w) * 100) / 100) : 0;
  return { title: r.pick.title, kind, mode: r.mode, similarity: Math.round((s / (s + 3)) * 100) / 100,
    reasoning: { skill, signal: r.mode === 'exploit' && r.hit ? { word: r.hit.word, from: r.hit.src, source: SRC[r.hit.src] || r.hit.src } : null } };
}
const SRC = { youtube: 'the YouTube history you imported', thumbs: 'your thumbs-ups', kept: 'a card you kept', asks: 'your recent asks' };
/** the one honest line of why: names only a signal that was really used. Pure. */
export function whyPick({ mode = 'fresh', hit = null, mood = '', kind = '', kindBy = 'day', liked = '', genre = '', reroll = false } = {}) {
  const bits = [];
  if (mood) bits.push('you wanted something ' + mood);
  if (mode === 'exploit' && hit) bits.push('"' + hit.word + '" is one of your strongest interests, from ' + SRC[hit.src]);
  if (mode === 'explore') bits.push('I am trying something new on purpose' + (genre ? ': ' + genre + ' is not a genre you have picked yet' : ''));
  if (kindBy === 'liked' && liked) bits.push('you gave a thumbs-up to ' + liked + ' before');
  if (kindBy === 'day' && kind) bits.push('you named no kind, so I chose ' + (kind === 'music' ? 'music' : 'a movie') + ' for today');
  if (reroll) bits.push('it is not one I have shown you');
  return bits.length ? 'Because ' + (bits.length > 1 ? bits.slice(0, -1).join(', ') + ' and ' + bits[bits.length - 1] : bits[0]) + '.' : 'I had nothing to go on yet, so this is just a good one. Tell me a mood, give a thumb, or import your YouTube taste, and I will aim.';
}
