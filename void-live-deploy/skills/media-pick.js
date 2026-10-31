/**
 * media-pick skill — "pick something to listen to", "pick a song", "pick something" (owner, 2026-10-17: the real-movie pick for music, shows, video and
 * games too; "Verse should pick on its own ... when the ask names no kind or title"). lib/media.js says which kind the ask is for, or Verse chooses
 * by the day; Verse suggests titles; each is looked up at /api/media (a real source); only a found one is shown as fact, as a card with its own art
 * (the first https image on the card is the card frame's art). Music plays as the 30 s official preview in an <audio>; the full song links out.
 * Movies are the movie skill's (skills/movie.js): a pick of kind movie runs that. Titles are untrusted: lib/media.js cleans them.
 */
import { pickKind, parseMusic, musicCardAsk, musicAskText, cleanTitle, MUSIC_FALLBACK, showCardAsk, showAskText, parseShows, SHOW_FALLBACK } from '../lib/media.js';
import { runPick as pickMovie } from './movie.js';

const PROMPT = 'Suggest 5 well-loved songs for someone to listen to right now, a mix of eras and genres. Reply with only a numbered list, one per line, exactly like: 1. Song Title - Artist';
const safeUrl = (u) => (/^https:\/\//i.test(String(u || '')) ? String(u) : '#');
const SRC = (esc) => '<div class="src">Source: iTunes Search API · Verse plays only the 30 s official preview; the full song is on Apple Music or wherever you listen</div>';
const artMeta = (el, f) => { if (f && f.verified) { el.dataset.artGenre = f.genre || ''; el.dataset.artYear = f.year || ''; } }; // the card's art follows the source's genre and year (lib/art-meta.js)
const art = (f, esc) => (f.poster && /^https:\/\//.test(f.poster) ? '<img src="' + esc(f.poster) + '" alt="" referrerpolicy="no-referrer" style="display:none">' : '');

async function lookup(m) {
  try { const r = await fetch('/api/media?kind=music&title=' + encodeURIComponent(m.title) + '&artist=' + encodeURIComponent(m.artist || '')); if (!r.ok) return { verified: false, ...m }; return await r.json(); } catch (_) { return { verified: false, ...m }; }
}
/** the card of one song: art, facts, the 30 s preview, the links. Pure given a lookup result. */
export function songCard(f, esc) {
  if (!f.verified) return '<h2>' + esc(f.title) + (f.artist ? ' · ' + esc(f.artist) : '') + '</h2><p>Not verified: no source I check knows a song by this name, so I will not state anything about it.</p>';
  const meta = [f.artist, f.album, f.year, f.genre].filter(Boolean).map(esc).join(' · ');
  return art(f, esc) + '<h2>' + esc(f.title) + '</h2><div class="sub">' + meta + '</div>'
    + '<div class="mv-player" style="margin:8px 0"></div>'
    + (f.preview ? '<div class="mv-btns"><button class="g-btn md-preview" type="button">Play the 30-second preview</button></div><div class="sub">The official preview, from Apple. The full song is not streamed here.</div>' : '<div class="sub">No preview from the source: listen where it is sold or streamed legally.</div>')
    + '<div class="mv-links" style="margin-top:6px">' + (f.links || []).map((l) => '<a href="' + esc(safeUrl(l.url)) + '" target="_blank" rel="noopener">' + esc(l.label) + '</a>').join(' · ') + '</div>' + SRC(esc);
}
export function wire(el, f) {
  const b = el.querySelector('.md-preview'), box = el.querySelector('.mv-player'); if (!b || !box) return;
  b.addEventListener('click', () => { const a = document.createElement('audio'); a.controls = true; a.autoplay = true; a.src = f.preview; a.style.cssText = 'width:100%'; box.textContent = ''; box.append(a); });
}
async function runCard(m, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(m.title) + '</h2><div class="sub">looking it up…</div>'; });
  el.dataset.artKind = 'Song';
  const f = await lookup(m);
  if (!api._pageStill(el)) return 'media-pick';
  artMeta(el, f); el.innerHTML = songCard(f, esc); wire(el, f);
  return 'media-pick';
}
async function runMusic(api, chosen) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Something to listen to</h2><div class="sub">' + (chosen ? 'I chose music for you · ' : '') + 'picking, then checking each one is real…</div>'; }); // void-review: ok (chosen is a boolean: only fixed text reaches innerHTML)
  el.dataset.artKind = 'Song';
  let picks = [];
  try { const r = await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask: PROMPT }) }); if (r.ok) picks = parseMusic((await r.json()).answer); } catch (_) {}
  if (!api._pageStill(el)) return 'media-pick';
  if (picks.length < 3) picks = MUSIC_FALLBACK.slice(0, 5); // the model was away: classics the lookup finds
  const found = await Promise.all(picks.slice(0, 6).map(lookup));
  if (!api._pageStill(el)) return 'media-pick';
  const real = found.filter((f) => f.verified), fake = found.filter((f) => !f.verified);
  const row = (f) => '<div class="mv-row" style="display:flex;gap:10px;margin:10px 0;align-items:flex-start">'
    + (f.poster ? '<img src="' + esc(f.poster) + '" alt="" referrerpolicy="no-referrer" loading="lazy" style="width:56px;border-radius:5px;flex:none">' : '')
    + '<div><a href="#" data-ask="' + esc(musicAskText(f.title, f.artist)) + '"><b>' + esc(f.title) + '</b></a> · ' + esc(f.artist) + ' <span style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;border-radius:5px;border:1px solid var(--edge,#3a3a44)">' + (f.preview ? 'preview here' : 'links only') + '</span>'
    + '<div class="sub">' + esc([f.album, f.year, f.genre].filter(Boolean).join(' · ')) + '</div></div></div>';
  artMeta(el, real[0]);
  el.innerHTML = real.length
    ? art(real[0], esc) + '<h2>Something to listen to</h2><div class="sub">' + (chosen ? 'I chose music for you · ' : '') + 'every song below was found in a real source; open one to hear the 30-second preview</div>' + real.map(row).join('')
      + (fake.length ? '<div class="sub">Not verified (no source knows them, so not shown as fact): ' + fake.map((f) => esc(f.title)).join(', ') + '</div>' : '') + SRC(esc)
    : '<h2>Something to listen to</h2><p>I could not reach the music source just now, so I will not name a song from memory. Ask again in a moment.</p>';
  return 'media-pick';
}

// ---- shows (TVMaze): a found show is a card with its real poster as art; it links out, nothing is streamed ----
const SHOW_PROMPT = 'Suggest 5 well-regarded TV shows for someone to watch, a mix of genres and eras. Reply with only a numbered list, one per line, exactly like: 1. Title (Year)';
async function lookupShow(m) {
  try { const r = await fetch('/api/media?kind=show&title=' + encodeURIComponent(m.title) + (m.year ? '&year=' + m.year : '')); if (!r.ok) return { verified: false, ...m }; return await r.json(); } catch (_) { return { verified: false, ...m }; }
}
/** the card of one show: poster as art, facts from TVMaze (omitted when it did not return them), links out. Pure given a lookup result. */
export function showCard(f, esc) {
  if (!f.verified) return '<h2>' + esc(f.title) + (f.year ? ' (' + f.year + ')' : '') + '</h2><p>Not verified: no source I check knows a show by this name, so I will not state anything about it.</p>';
  const facts = [['Premiered', f.year], ['Genre', (f.genres || []).join(', ')], ['Network', f.network], ['Status', f.status + (f.ended ? ' (ended ' + f.ended + ')' : '')], ['Seasons', f.seasons], ['Episodes', f.episodes], ['Rating', f.rating && f.rating + ' / 10']].filter((x) => x[1]);
  const no = f.availability === 'region' || f.availability === 'unavailable';
  return art(f, esc) + '<h2>' + esc(f.title) + (f.year ? ' (' + f.year + ')' : '') + '</h2>'
    + (no ? '<p class="mv-no"><b>' + (f.availability === 'region' ? 'Not available here' : 'Not verified as available') + '.</b> ' + esc(f.why || '') + ' Official links only, no search or stream.</p>' : '')
    + '<dl class="mv-facts" style="display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:6px 0">' + facts.map((x) => '<dt style="color:var(--muted,#9a9aa2)">' + x[0] + '</dt><dd style="margin:0">' + esc(x[1]) + '</dd>').join('') + '</dl>'
    + (f.overview ? '<p>' + esc(f.overview) + '</p>' : '')
    + (no ? '' : '<div class="sub">Verse does not stream shows: watch it where it is legally offered.</div>')
    + '<div class="mv-links" style="margin-top:6px">' + (f.links || []).map((l) => '<a href="' + esc(safeUrl(l.url)) + '" target="_blank" rel="noopener">' + esc(l.label) + '</a>').join(' · ') + '</div>'
    + '<div class="src">Source: TVMaze</div>';
}
async function runShowCard(m, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(m.title) + '</h2><div class="sub">looking it up…</div>'; });
  el.dataset.artKind = 'Show';
  const f = await lookupShow(m);
  if (!api._pageStill(el)) return 'media-pick';
  el.innerHTML = showCard(f, esc);
  return 'media-pick';
}
async function runShows(api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A show to watch</h2><div class="sub">picking, then checking each one is real…</div>'; });
  el.dataset.artKind = 'Show';
  let picks = [];
  try { const r = await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask: SHOW_PROMPT }) }); if (r.ok) picks = parseShows((await r.json()).answer); } catch (_) {}
  if (!api._pageStill(el)) return 'media-pick';
  if (picks.length < 3) picks = SHOW_FALLBACK;
  const found = await Promise.all(picks.slice(0, 6).map(lookupShow));
  if (!api._pageStill(el)) return 'media-pick';
  const real = found.filter((f) => f.verified), fake = found.filter((f) => !f.verified);
  const row = (f) => '<div class="mv-row" style="display:flex;gap:10px;margin:10px 0;align-items:flex-start">'
    + (f.poster ? '<img src="' + esc(f.poster) + '" alt="" referrerpolicy="no-referrer" loading="lazy" style="width:56px;border-radius:5px;flex:none">' : '')
    + '<div><a href="#" data-ask="' + esc(showAskText(f.title, f.year)) + '"><b>' + esc(f.title) + '</b></a>' + (f.year ? ' (' + f.year + ')' : '') + ' <span style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;border-radius:5px;border:1px solid var(--edge,#3a3a44)">' + (f.availability === 'region' ? 'not available here' : f.availability === 'unavailable' ? 'not verified' : 'links only') + '</span>'
    + '<div class="sub">' + esc([(f.genres || []).join(', '), f.seasons && f.seasons + ' seasons'].filter(Boolean).join(' · ')) + '</div>' + (f.overview ? '<div>' + esc(f.overview) + '</div>' : '') + '</div></div>';
  el.innerHTML = real.length
    ? art(real[0], esc) + '<h2>A show to watch</h2><div class="sub">every show below was found in a real source; open one for its facts and where to watch</div>' + real.map(row).join('')
      + (fake.length ? '<div class="sub">Not verified (no source knows them, so not shown as fact): ' + fake.map((f) => esc(f.title)).join(', ') + '</div>' : '') + '<div class="src">Source: TVMaze</div>'
    : '<h2>A show to watch</h2><p>I could not reach the show source just now, so I will not name a show from memory. Ask again in a moment.</p>';
  return 'media-pick';
}

export default {
  name: 'media-pick',
  examples: ['pick something to listen to with me', 'pick a song', 'pick something to watch', 'music card for Hey Jude by The Beatles', 'pick a tv show', 'show card for Severance (2022)', 'best sci-fi movies 2024'],
  nearMisses: ['pick a color', 'film metadata for inception', 'what should we play', 'pick a movie to watch with me', 'how do I listen to my heart'],
  match(lower, text) { return !!pickKind(text) || !!musicCardAsk(text) || !!showCardAsk(text) || /best .* movies \d{4}/i.test(text); },
  run(text, api) {
    const c = musicCardAsk(text); if (c) return runCard(c, api);
    const sc = showCardAsk(text); if (sc) return runShowCard(sc, api);
    const k = pickKind(text);
    return k && k.kind === 'movie' ? pickMovie(api) : k && k.kind === 'show' ? runShows(api) : runMusic(api, k && k.chosen);
  },
  suite() {
    const c = musicCardAsk('music card for Hey Jude by The Beatles');
    return { ok: !!pickKind('pick a song') && pickKind('pick a tv show').kind === 'show' && !pickKind('pick a color') && c && c.artist === 'The Beatles' && cleanTitle('<b>x</b>') === 'b x b' };
  },
};
