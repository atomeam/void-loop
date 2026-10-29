/**
 * pick-for-me skill — "pick for me", "surprise me" (owner, 2026-10-17: Netflix's Max picked for you and was tedious; "Verse will be way better than Max").
 * Verse picks the kind (your thumbs-ups, else the day) and ONE found title, says it with its why in one line, and shows its card (movie or song) with
 * a way to play what is legal. Taste is optional and never blocks: a mood chip (cozy, thrilling, funny, curious, calm), a thumb on the pick, "something
 * else" (never a repeat), "forget my taste". Taste lives in this browser (lib/taste.js); the server hears the mood word only. Spoken: a pick asked by voice
 * is read out by the page's own voice path, only the pick line (data-nospeak hides the rest); "something else", "funnier", "yes play it" work by voice or
 * typing. A title is spoken or shown only when a real source found it. Kinds so far: movie and music; shows, video and games join as their adapters ship.
 */
import { parseMusic, MUSIC_FALLBACK, KINDS } from '../lib/media.js';
import { parseSuggestions, FREE_PICKS, cleanTitle } from '../lib/movies.js';
import { MOODS, load, save, forget, rate, markSeen, allowed, likedKind, tasteCmd, moodWord, interests, choose, whyPick, pickRecord, parseTakeout, parseList } from '../lib/taste.js';
import { movieCard, wirePlayers } from './movie.js';
import { songCard, wire as wireSong } from './media-pick.js';

const store = () => { try { return localStorage; } catch (_) { return { getItem: () => null, setItem() {}, removeItem() {} }; } };
let last = null; // { kind, f (the lookup result), at }: the pick that is up, for "something else", the thumbs and "yes play it"
const FRESH_MS = 15 * 60 * 1000;
const hasLast = () => !!last && Date.now() - last.at < FRESH_MS;
const PROMPT = {
  movie: (mood) => 'Suggest 8 well-regarded movies, a mix of genres, eras and countries,' + (mood ? ' that feel ' + mood : '') + ' for someone to watch tonight. Reply with only a numbered list, one per line, exactly like: 1. Title (Year)',
  music: (mood) => 'Suggest 8 well-loved songs, a mix of genres, eras and countries,' + (mood ? ' that feel ' + mood : '') + ' for someone to listen to right now. Reply with only a numbered list, one per line, exactly like: 1. Song Title - Artist',
};
const PARSE = { movie: parseSuggestions, music: parseMusic };
const FALLBACK = { movie: () => FREE_PICKS, music: () => MUSIC_FALLBACK };
const query = (kind, m) => '/api/media?kind=' + kind + '&title=' + encodeURIComponent(m.title) + (m.year ? '&year=' + m.year : '') + (m.artist ? '&artist=' + encodeURIComponent(m.artist) : '');
async function lookup(kind, m) { try { const r = await fetch(query(kind, m)); return r.ok ? await r.json() : { verified: false, ...m }; } catch (_) { return { verified: false, ...m }; } }
const kindWord = (k) => (k === 'music' ? 'song' : 'movie');

/** the interests the person really has on this device: imported YouTube taste, thumbs, the asks of kept cards, recent asks (words only, never sent anywhere) */
function localSignals() {
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (_) { return d; } };
  const state = read('a2m.void.state.v1', {}), asks = read('a2m.void.asks.v1', []);
  return { asks: (Array.isArray(asks) ? asks : []).map(String).filter((a) => !tasteCmd(a, true) && !/pick|surprise|something else/i.test(a)), kept: Object.values(state).filter((x) => x && x.kind === 'kept' && x.ask).map((x) => String(x.ask)) };
}
/** find ONE found, unseen title of the kind: the model's list (told the mood word only) is looked up as a pool, then chosen on the person's own taste (lib/taste.js choose). */
async function findOne(kind, taste) {
  let picks = [];
  try { const r = await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask: PROMPT[kind](taste.mood) }) }); if (r.ok) picks = PARSE[kind]((await r.json()).answer); } catch (_) {}
  const ok = (m) => allowed(taste, kind, m.title), ints = interests(taste, localSignals());
  for (const list of [picks.filter(ok), FALLBACK[kind]().filter(ok)]) {
    const found = (await Promise.all(list.slice(0, 8).map((m) => lookup(kind, m)))).filter((f) => f.verified && allowed(taste, kind, f.title));
    const r = choose(found, taste, ints, Math.random, { lastGenre: last && last.kind === kind ? String(last.f.genre || '').toLowerCase() : '' }); if (r) return r;
  }
  return null;
}
function controls(taste, esc) {
  const chip = (m) => '<a href="#" class="pk-chip" data-ask="' + esc('pick something ' + m) + '" style="padding:3px 10px;border-radius:14px;border:1px solid var(--edge,#3a3a44);' + (taste.mood === m ? 'background:rgba(255,255,255,.14)' : '') + '">' + esc(m) + '</a>';
  return '<div class="sub pk-controls" style="margin-top:10px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
    + '<button class="g-btn pk-up" type="button" aria-label="I like this one">👍</button><button class="g-btn pk-down" type="button" aria-label="Not for me">👎</button>'
    + '<a href="#" class="pk-else" data-ask="something else">Something else</a></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">mood (optional): ' + Object.keys(MOODS).map(chip).join('') + '</div>'
    + '<div style="margin-top:8px"><button class="g-btn pk-yt" type="button">Import my YouTube taste</button> <input type="file" class="pk-file" accept=".json,.txt,application/json,text/plain" hidden>'
    + ' <a href="#" class="pk-paste">or paste titles</a>' + (Object.keys(taste.yt || {}).length ? ' · ' + taste.ytN + ' videos imported' : '') + '</div>'
    + '<div class="pk-pastebox" hidden style="margin-top:6px"><textarea class="pk-text" rows="4" style="width:100%" placeholder="one channel or video title per line"></textarea><button class="g-btn pk-use" type="button">Use these</button></div>'
    + '<div style="margin-top:8px">Your Google Takeout watch-history.json is read in this browser only: nothing is uploaded and no account is linked. <a href="#" class="pk-forget" data-ask="forget my taste">Forget my taste</a></div></div>';
}
function show(api, el, kind, f, taste, line) {
  const again = () => { const e = el.querySelector('.pk-else'); if (e) e.click(); };
  const { esc } = api;
  el.innerHTML = '<p class="pick-say">' + esc(line) + '</p>' + (kind === 'music' ? songCard(f, esc) : movieCard(f, esc)).replace(/<h2>/, '<h2 data-nospeak>')
    .replace(/<p>/g, '<p data-nospeak>') + controls(taste, esc);
  el.querySelectorAll('.mv-facts,.mv-links,.mv-btns,.mv-player').forEach((n) => n.setAttribute('data-nospeak', ''));
  if (kind === 'music') wireSong(el, f); else wirePlayers(el, f);
  const thumb = (up) => () => { const t = rate(load(store()), kind, f.title, up, { genre: f.genre, words: [f.genre, f.artist, f.director].filter(Boolean).join(' ') }); save(store(), t); el.querySelector(up ? '.pk-up' : '.pk-down').setAttribute('aria-pressed', 'true'); if (!up) again(); };
  const imported = (r) => { if (!r.n) { el.querySelector('.pk-yt').textContent = 'Nothing usable in that file'; return; } save(store(), { ...load(store()), yt: r.topics, ytN: r.n }); el.querySelector('.pk-else').click(); };
  const file = el.querySelector('.pk-file'); el.querySelector('.pk-yt').addEventListener('click', () => file.click());
  file.addEventListener('change', () => { const fl = file.files && file.files[0]; if (!fl || fl.size > 60e6) return; fl.text().then((t) => imported(/^\s*[\[{]/.test(t) ? parseTakeout(t) : parseList(t))).catch(() => {}); });
  el.querySelector('.pk-paste').addEventListener('click', (e) => { e.preventDefault(); el.querySelector('.pk-pastebox').hidden = false; });
  el.querySelector('.pk-use').addEventListener('click', () => imported(parseList(el.querySelector('.pk-text').value)));
  el.querySelector('.pk-up').addEventListener('click', thumb(true)); el.querySelector('.pk-down').addEventListener('click', thumb(false));
}
async function pickOne(api, { kind: forced = '', mood = '', reroll = false } = {}) {
  const { showPage, esc } = api;
  let taste = load(store()); if (mood) taste = { ...taste, mood }; save(store(), taste);
  const liked = !forced && likedKind(taste, Object.keys(KINDS)), kind = forced || (reroll && last && last.kind) || liked || Object.keys(KINDS)[Math.floor(Date.now() / 864e5) % Object.keys(KINDS).length];
  const kindBy = forced || (reroll && last) ? 'asked' : liked ? 'liked' : 'day';
  const el = showPage((p) => { p.innerHTML = '<h2>Picking for you</h2><div class="sub">finding a real ' + kindWord(kind) + '…</div>'; }); // void-review: ok (kindWord returns one of two fixed words)
  const r = await findOne(kind, taste), f = r && r.pick;
  if (!api._pageStill(el)) return 'pick-for-me';
  if (!f) { el.innerHTML = '<h2>Picking for you</h2><p class="pick-say">I could not reach my sources just now, so I will not name anything from memory. Ask again in a moment.</p>'; return 'pick-for-me'; }
  taste = markSeen(taste, kind, f.title); save(store(), taste);
  const lk = taste.likes.filter((l) => l.kind === kind).pop();
  last = { kind, f, at: Date.now() };
  const lead = 'How about ' + f.title + (kind === 'music' ? (f.artist ? ' by ' + f.artist : '') : (f.year ? ' (' + f.year + ')' : '')) + '? ';
  show(api, el, kind, f, taste, lead + whyPick({ mode: r.mode, hit: r.hit, mood: taste.mood, genre: f.genre, liked: kindBy === 'liked' && lk ? lk.title : '', kindBy, reroll, kind }));
  const rec = pickRecord(r, { kind }); last.record = rec;
  if (rec && api._pageStill(el)) { const say = el.querySelector('.pick-say'), m = document.createElement('div'); m.className = 'sub pk-match'; m.setAttribute('data-nospeak', ''); m.setAttribute('data-pick', JSON.stringify(rec));
    m.textContent = 'Match ' + Math.round(rec.similarity * 100) + '% · chosen by ' + rec.reasoning.skill + (rec.reasoning.signal ? ' from ' + rec.reasoning.signal.source + ' ("' + rec.reasoning.signal.word + '")' : rec.mode === 'explore' ? ', exploring on purpose' : ', no taste signal yet');
    if (say) say.after(m); }
  return 'pick-for-me';
}
function play(api) {
  const pg = document.querySelector('.vpage.on'); const b = pg && pg.querySelector('.mv-play, .mv-trailer, .md-preview');
  if (b) { b.click(); return 'pick-for-me'; }
  return pickOne(api, { reroll: true });
}
export default {
  name: 'pick-for-me',
  examples: ['pick for me', 'surprise me', 'pick something cozy', 'forget my taste'],
  nearMisses: ['pick a color', 'pick a card', 'surprise me with a joke', 'forget my password'],
  match(lower, text) { return !!tasteCmd(text, hasLast()); },
  run(text, api) {
    const c = tasteCmd(text, hasLast()); api.ask = text;
    if (!c) return 'none';
    if (c.cmd === 'forget') { const el = api.showPage((p) => { p.innerHTML = '<h2>Taste forgotten</h2><p class="pick-say">Done: I no longer remember any mood or thumbs. Nothing was kept anywhere else.</p>'; }); last = null; forget(store()); return el ? 'pick-for-me' : 'none'; }
    if (c.cmd === 'play') return play(api);
    if (c.cmd === 'mood') return pickOne(api, { mood: c.mood, reroll: hasLast() });
    return pickOne(api, { reroll: c.cmd === 'again' });
  },
  suite() { return { ok: !!tasteCmd('pick for me') && !tasteCmd('pick a color') && tasteCmd('funnier', true).mood === 'funny' && !tasteCmd('funnier', false) && moodWord('x') === '' && cleanTitle('a') === 'a' }; },
};
