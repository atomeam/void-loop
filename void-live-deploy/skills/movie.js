/**
 * movie skill — "pick a movie to watch with me" finds REAL movies (owner, 2026-10-17: Verse wrote 'Talk to Me (2022)' from memory; "have it find the
 * actual movies it suggests ... and play right in v01d"). Verse suggests titles, then each is looked up at /api/movies (iTunes Search + the
 * Internet Archive, lib/movies.js). A verified movie gets its own card: its poster as the card's art, year, genre, the source's one-line overview,
 * and what plays here: a public-domain / Creative Commons film from the Internet Archive plays in a <video>; an official trailer plays from Apple's
 * CDN; an in-copyright film gets the trailer and where-to-watch links, never a pirate source. A title no source knows is listed as "not verified".
 * "movie card for <title> (<year>)" opens one movie's card (the ask a row of the pick page runs). Titles are untrusted: lib/movies.js cleans them.
 */
import { pickAsk, cardAsk, cardAskText, parseSuggestions, cleanTitle, FREE_PICKS } from '../lib/movies.js';
import { parseIntent, pickPrompt, similarity, similarityWords } from '../lib/movie-intent.js';
const money = (n, c) => (n ? (c === 'USD' || !c ? '$' : c + ' ') + n.toFixed(2) : '');
const dayPick = () => FREE_PICKS[Math.floor(Date.now() / 864e5) % FREE_PICKS.length];

// LOOKUP_V names the lookup's answers: before 2026-10-30 a well-known film came back "not verified" (iTunes refused, no second source) and
// browsers and the edge kept that answer for a day. A new v is a new address, so no answer cached by the old lookup is read again.
export const LOOKUP_V = 3; // 3, 2026-11-06: the Wikidata answer carries the genres, so a pick's match score can test its genre
export const lookupUrl = (m) => '/api/movies?title=' + encodeURIComponent(m.title) + (m.year ? '&year=' + m.year : '') + '&v=' + LOOKUP_V;
async function lookup(m) {
  try { const r = await fetch(lookupUrl(m)); if (!r.ok) return { verified: false, title: m.title, year: m.year }; return await r.json(); } catch (_) { return { verified: false, title: m.title, year: m.year }; }
}
const badge = (f, esc) => '<span class="mv-badge" style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;border-radius:5px;border:1px solid var(--edge,#3a3a44)">' + esc(f.free ? 'plays here' : f.trailer ? 'trailer here' : 'links only') + '</span>';
const artMeta = (el, f) => { if (f && f.verified) { el.dataset.artGenre = f.genre || ''; el.dataset.artYear = f.year || ''; } }; // the card's art follows the source's genre and year (lib/art-meta.js)
const art = (f, esc) => (f.poster && /^https:\/\//.test(f.poster) ? '<img src="' + esc(f.poster) + '" alt="" referrerpolicy="no-referrer" style="display:none">' : '');
const safeUrl = (u) => (/^https:\/\//i.test(String(u || '')) ? String(u) : '#');
const SRC = (f, esc) => '<div class="src">Source: ' + esc((f.sources || ['iTunes Search API', 'Internet Archive']).join(' · ')) + ' · Verse plays only free, legal films and official trailers</div>';

/** the card of one movie: art, facts, the player, the links. Pure given a lookup result. */
export function movieCard(f, esc) {
  if (!f.verified) return '<h2>' + esc(f.title) + (f.year ? ' (' + f.year + ')' : '') + '</h2><p>' + (f.unreachable ? 'Not checked: the movie sources did not answer just now, so I will not state anything about it. Ask again in a moment.' : 'Not verified: no source I check knows a movie by this name, so I will not state anything about it.') + '</p>';
  const price = [money(f.price, f.currency) && 'buy ' + money(f.price, f.currency), money(f.rentPrice, f.currency) && 'rent ' + money(f.rentPrice, f.currency)].filter(Boolean).join(' · ');
  // the structured facts (asked by Verse, 2026-10-17): only what the source returned, never a guess; iTunes gives no cast, so none is shown
  const facts = [['Year', f.year], ['Genre', f.genre], ['Rated', f.rating], ['Director', f.director], ['Runtime', f.runtime ? f.runtime + ' min' : '']].filter((x) => x[1]);
  const meta = '<dl class="mv-facts" style="display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:6px 0">' + facts.map((x) => '<dt style="color:var(--muted,#9a9aa2)">' + x[0] + '</dt><dd style="margin:0">' + esc(x[1]) + '</dd>').join('') + '</dl>'
    + '<a href="#" class="mv-json" data-ask="film metadata for ' + esc(f.title) + '">Full metadata as JSON</a>';
  return art(f, esc) + '<h2>' + esc(f.title) + (f.year ? ' (' + f.year + ')' : '') + '</h2>'
    + meta
    + (f.overview ? '<p>' + esc(f.overview) + '</p>' : '')
    + '<div class="mv-player" style="margin:8px 0"></div>'
    + '<div class="mv-btns" style="display:flex;gap:8px;flex-wrap:wrap">'
    + (f.free ? '<button class="g-btn mv-play" type="button">Play the film here</button>' : '')
    + (f.trailer ? '<button class="g-btn mv-trailer" type="button">Play the official trailer</button>' : '') + '</div>'
    + (f.free ? '<div class="sub">Free and legal: ' + esc(f.play.license) + ' · <a href="' + esc(safeUrl(f.play.page)) + '" target="_blank" rel="noopener">its page</a></div>' : '<div class="sub">Not free to stream here: watch it where it is sold or streamed legally.' + (price ? ' ' + esc(price) + '.' : '') + '</div>')
    + '<div class="mv-links" style="margin-top:6px">' + (f.links || []).map((l) => '<a href="' + esc(safeUrl(l.url)) + '" target="_blank" rel="noopener">' + esc(l.label) + '</a>').join(' · ') + '</div>'
    + SRC(f, esc);
}
export function wirePlayers(el, f) {
  const box = el.querySelector('.mv-player'); if (!box) return;
  const show = (node) => { box.textContent = ''; box.append(node); };
  const vid = (src, poster) => { const v = document.createElement('video'); v.controls = true; v.autoplay = true; v.playsInline = true; v.preload = 'metadata'; if (poster && /^https:/.test(poster)) v.poster = poster; v.src = src; v.style.cssText = 'width:100%;max-height:60vh;background:#000;border-radius:8px'; return v; };
  const p = el.querySelector('.mv-play'), t = el.querySelector('.mv-trailer');
  if (p) p.addEventListener('click', () => {
    if (f.play.kind === 'video') show(vid(f.play.src, f.poster));
    else { const i = document.createElement('iframe'); i.src = f.play.src; i.allowFullscreen = true; i.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation'); i.title = f.title; i.style.cssText = 'width:100%;aspect-ratio:16/9;border:0;border-radius:8px'; show(i); }
  });
  if (t) t.addEventListener('click', () => show(vid(f.trailer, f.poster)));
}

export async function runCard(m, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(m.title) + '</h2><div class="sub">looking it up…</div>'; });
  el.dataset.artKind = 'Film';
  const f = await lookup(m);
  if (!api._pageStill(el)) return 'movie';
  artMeta(el, f); el.innerHTML = movieCard(f, esc); wirePlayers(el, f);
  return 'movie';
}

/** every verified pick as structured film metadata (asked by Void, 2026-10-18: "Link the 'Pick a movie' skill output to the
 *  'film-metadata' skill so every selection returns structured JSON metadata"): film-metadata's own fields, filled only from what the
 *  source returned for that pick, never a second guess; a field the source left empty is left out. Each pick also has its
 *  "similarity-score" (asked by Verse, 2026-10-22: "so users can see how closely a pick matches their expressed intent"): 0 to 100 from
 *  lib/movie-intent.js, with what matched and what did not; null with the reason when the ask named nothing to match. Pure. */
export function pickJson(films, intent = null) {
  return (films || []).filter((f) => f && f.verified).map((f) => {
    const o = { title: f.title, year: f.year, director: f.director, genre: f.genre, rated: f.rating, runtime: f.runtime ? f.runtime + ' min' : '', description: f.overview, free: !!f.free };
    for (const k of Object.keys(o)) if (o[k] === '' || o[k] === undefined || o[k] === null) delete o[k];
    const s = similarity(f, intent);
    o['similarity-score'] = s.score;
    if (s.score === null) o['similarity-reason'] = s.reason; else { o['similarity-matches'] = s.matched; o['similarity-misses'] = s.missed; }
    return o;
  });
}
/** the free film added to a pick: the day's one, or with an intent that names years the free film from those years (none if none fits). Pure. */
export function freePick(intent, day = dayPick()) {
  if (!intent) return day;
  if (!intent.from) return null;
  return FREE_PICKS.find((x) => x.year >= intent.from && x.year <= intent.to) || null;
}
export async function runPick(api, text = '') {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A movie to watch</h2><div class="sub">picking, then checking each one is real…</div>'; });
  el.dataset.artKind = 'Film';
  // the ask's own intent ("scary movies from the 90s": horror, 1990 to 1999) goes into the prompt, and each pick is scored against it
  const intent = parseIntent(text);
  let picks = [];
  try { const r = await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask: pickPrompt(intent) }) }); if (r.ok) picks = parseSuggestions((await r.json()).answer); } catch (_) {}
  if (!api._pageStill(el)) return 'movie';
  const free = freePick(intent); if (free && !picks.some((x) => x.title.toLowerCase() === free.title.toLowerCase())) picks.push(free);
  if (picks.length < 3) picks = FREE_PICKS.slice(0, 5); // the model was away: the free, legal films
  const found = await Promise.all(picks.slice(0, 6).map(lookup));
  if (!api._pageStill(el)) return 'movie';
  const sims = new Map(found.map((f) => [f, similarity(f, intent)]));
  const real = found.filter((f) => f.verified), fake = found.filter((f) => !f.verified && !f.unreachable), away = found.filter((f) => !f.verified && f.unreachable);
  const used = [...new Set(real.flatMap((f) => f.sources || []))];
  const row = (f) => '<div class="mv-row" style="display:flex;gap:10px;margin:10px 0;align-items:flex-start">'
    + (f.poster ? '<img src="' + esc(f.poster) + '" alt="" referrerpolicy="no-referrer" loading="lazy" style="width:56px;border-radius:5px;flex:none">' : '')
    + '<div><a href="#" data-ask="' + esc(cardAskText(f.title, f.year)) + '"><b>' + esc(f.title) + '</b>' + (f.year ? ' (' + f.year + ')' : '') + '</a> ' + badge(f, esc)
    + ' <a href="#" class="mv-json" data-ask="film metadata for ' + esc(f.title) + '">JSON</a>'
    + '<div class="sub">' + esc([f.genre, f.rating].filter(Boolean).join(' · ')) + '</div>'
    + (intent ? '<div class="mv-sim sub" data-score="' + sims.get(f).score + '">' + esc(similarityWords(sims.get(f), intent)) + '</div>' : '')
    + (f.overview ? '<div>' + esc(f.overview) + '</div>' : '') + '</div></div>';
  if (intent) real.sort((a, b) => sims.get(b).score - sims.get(a).score); // the closest match first (a stable sort keeps the model's order on a tie)
  artMeta(el, real[0]);
  el.innerHTML = real.length
    ? (real[0].poster ? '<img src="' + esc(real[0].poster) + '" alt="" referrerpolicy="no-referrer" style="display:none">' : '')
      + '<h2>A movie to watch' + (intent ? ': ' + esc(intent.criteria.map((c) => c.label).join(', ')) : '') + '</h2><div class="sub">every title below was found in a real source'
      + (intent ? ', and each says how closely its own genre, year and overview match what you asked' : '') + '; open one to watch or see the trailer</div>' + real.map(row).join('')
      + (fake.length ? '<div class="sub">Not verified (no source knows them, so not shown as fact): ' + fake.map((f) => esc(f.title)).join(', ') + '</div>' : '')
      + (away.length ? '<div class="sub">Not checked (the movie sources did not answer just now, so not shown as fact): ' + away.map((f) => esc(f.title)).join(', ') + '</div>' : '')
      + '<details class="mv-picks-json"><summary>These picks as JSON</summary><pre style="white-space:pre-wrap;font-size:12px;max-height:300px;overflow:auto">'
      + esc(JSON.stringify({ count: real.length, intent: intent ? intent.criteria.map((c) => c.label) : null, films: pickJson(real, intent) }, null, 2)) + '</pre></details>'
      + SRC({ sources: used.length ? used : undefined }, esc)
    : '<h2>A movie to watch</h2><p>I could not reach the movie sources just now, so I will not name a movie from memory. Ask again in a moment.</p>';
  return 'movie';
}

export default {
  name: 'movie',
  examples: ['pick a movie to watch with me', 'movie night', 'movie card for Nosferatu (1922)', 'scary movies from the 90s'],
  nearMisses: ['film metadata for inception', 'watch this for me', 'movie metadata for the matrix', 'how do I film a video', 'pick a color'],
  match(lower, text) { return pickAsk(text) || !!cardAsk(text) || (text.includes('movie') && (text.includes('from the') || text.includes('in the') || text.includes('genre'))); },
  run(text, api) { const c = cardAsk(text); return c ? runCard(c, api) : runPick(api, text); },
  suite() {
    const c = cardAsk('movie card for Talk to Me (2022)');
    return { ok: pickAsk('pick a movie to watch with me') && !pickAsk('film metadata for x') && c && c.title === 'Talk to Me' && c.year === 2022 && cleanTitle('<b>x</b>') === 'b x b' };
  },
};
