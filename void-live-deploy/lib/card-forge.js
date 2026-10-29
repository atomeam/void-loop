// The Art Forge on the card (owner, 2026-10-17: "the art should be of the subject of each card"). keep() in lib/card-frame.js calls forge(el, c) after it
// builds a card's frame. A card with no painted art yet asks GET /api/card-art for its folded subject (a read of the cache, free); if the picture is
// there it fills the art box (cover-fit, over Verse's ink plate, under the foil frame). If it is not and the card is an answer or a merged card (never a
// skill, game or miniature), it paints it ONCE by itself (one POST per subject per page; the server's daily cap, rate limit and kill switch bound the spend) and the plate stays until the picture lands. ?art=button offers a "paint this card" button instead; ?art=off never asks.
// The picture is kept on the card element (el._vcForge) so a rebuilt frame shows it again, and the saved card picture (lib/card-image.js) includes it.
import { safeImg } from './art-rules.js';
import { artSource } from './art-source.js';

export const FORGE_CSS = [
  '.vcard .vc-art{position:relative}.vpage.vcard .vc-art img.vc-forge-img{position:absolute!important;inset:0;float:none!important;margin:0!important;max-width:none!important;max-height:none!important;width:100%!important;height:100%!important;object-fit:cover;object-position:50% 50%;display:block;border-radius:0!important;animation:vc-forge-in .25s ease-out 1}',
  '.vcard .vc-art.vc-forged::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 50%,transparent 55%,rgba(0,0,0,.55) 100%),linear-gradient(180deg,rgba(255,215,140,.10),transparent 30%,rgba(0,0,0,.28));box-shadow:inset 0 0 22px rgba(0,0,0,.6)}',
  '.vcard .vc-forge-btn{position:absolute;right:6px;bottom:6px;z-index:3;font:inherit;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;padding:3px 9px;border-radius:6px;border:1px solid var(--edge);background:rgba(10,10,16,.72);color:hsl(var(--h) 55% 80%);cursor:pointer}',
  '.vcard .vc-forge-btn:hover{background:rgba(10,10,16,.9);box-shadow:0 0 10px var(--edge)}.vcard .vc-forge-btn[disabled]{cursor:default;opacity:.8}',
  '@keyframes vc-forge-in{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){.vcard .vc-art .vc-forge-img{animation:none}}',
  // paint status (asked by Verse): a subtle glow pulses round the art box while its painting is pending; a still glow when motion is reduced
  '.vcard .vc-art.vc-painting{animation:vc-paint 1.6s ease-in-out infinite alternate}@keyframes vc-paint{from{box-shadow:inset 0 0 4px hsl(var(--h,260) 70% 70% / .15)}to{box-shadow:inset 0 0 20px hsl(var(--h,260) 75% 70% / .6)}}',
  '@media (prefers-reduced-motion:reduce){.vcard .vc-art.vc-painting{animation:none;box-shadow:inset 0 0 14px hsl(var(--h,260) 75% 70% / .45)}}',
].join('');

const inflight = new Map(); // subject -> its one POST
const waiting = new Map(); // subject -> the card elements waiting on a read or a paint (a card's frame is rebuilt when its stats arrive)
const land = (key, img) => { for (const e of waiting.get(key) || []) { if (e.isConnected) { e._vcForge = img; show(e, img); } } waiting.delete(key); };
/** what to paint: the answer's own nouns (card-subject.js), or the card's key when the answer says too little. */
// kept on the card from its first ask: a frame rebuilt mid-paint (its stats arrive, a merged card gains data-skill="merge") must not become a
// new subject, or a slow paint is asked for twice and spends two of the day's paintings on one card
const subjectFor = (el, c) => {
  if (el._vcArtKey) return el._vcArtKey;
  const k = el.dataset && el.dataset.skill ? el.dataset.skill.replace(/[-_]+/g, ' ') : el._vcSubject || c.key;
  if (!/^(?:looking|loading|thinking|searching)\b/i.test(String(k || ''))) el._vcArtKey = k; // a "thinking ..." frame is not the subject: the answer's own words are, once they arrive
  return k;
};
export const RETRY_S = [25, 50, 100]; const tries = new Map(); // a subject's retries after a busy or slow paint
/** a paint worth trying again later: no answer, a model timeout, a rate limit or an HTTP error; never the cap or the switch. Pure. */
export const retryable = (got) => !got || ['busy', 'slow', 'http'].includes(got.why);
const seen = new Map(); // folded-or-typed subject + kind -> 'art' | 'none' | 'plate' with the picture, so a card shown twice asks once
/** is this card one the forge paints: an answer or a merged card, never a skill, a game or a miniature, a person, or a sky card. Pure. */
export function worthy(el, c) {
  if (!el || !c || (el.classList && el.classList.contains('skyc'))) return false; // a skill's card is painted too (backfill, tools/prepaint-art.mjs): its subject is its name
  const kind = String(c.kindName || '').toLowerCase();
  // a card still loading is never painted ("Repository — looking" painted the word "looking"), nor a fragment of a word ("rt")
  const sk = String(subjectFor(el, c) || '').trim();
  if (sk.replace(/[^a-z0-9]/gi, '').length < 3 || /^(?:looking|loading|thinking|searching)\b/i.test(sk) || /\b(?:looking|loading)\b|…$/i.test(String(c.typeLine || ''))) return false;
  return kind !== 'person' && !c.notFound && !!String(c.key || '').trim(); // a Not found card is never painted: a picture would dress a refusal as an answer
}
/** the text of the answer on a card: its own paragraphs, not the frame, the sources, the share bar, the title or the .thin "Closest match I found for ..." line (the search, not the subject). */
export function answerText(el) {
  let t = ''; for (const n of el.children || []) { if (n.matches && n.matches('.vc-art,.vc-type,.vc-foot,.vc-arrows,.vc-adds,.vc-variants,.src,.vtail,.vtell,.vtell-box,.vc-share,.thin,style,script,button,h2,nav')) continue; t += ' ' + (n.textContent || ''); }
  return t.replace(/\s+/g, ' ').trim().slice(0, 1500);
}
export const kindOf = (el, c) => (el.dataset && el.dataset.cardOwn ? 'merge' : el.dataset && el.dataset.skill ? 'skill' : (c && c.kindName) || 'answer');
const mode = () => { try { const m = typeof location !== 'undefined' && /[?&]art=(off|button)\b/.exec(location.search); return m ? m[1] : 'auto'; } catch (_) { return 'auto'; } };
const autoOn = () => mode() === 'auto';

/** the paint-status glow on a card's art box: on while its picture is being painted or a retry waits, off when it lands or settles on its plate. */
function painting(el, on) {
  const art = el && el.querySelector && el.querySelector(':scope > .vc-art'); if (!art) return;
  art.classList.toggle('vc-painting', !!on); if (on) el.dataset.painting = '1'; else delete el.dataset.painting;
}
function show(el, img) {
  const art = el.querySelector(':scope > .vc-art'); if (!art) return; painting(el, false);
  if (artSource({ photo: (art.querySelector('.vc-art-photo') || {}).src || '' }) === 'photo') return; // a real photo is the art: a painting never goes over it
  const url = safeImg(img); if (!url) return;
  for (const n of art.querySelectorAll('.vc-forge-btn, .vc-forge-img')) n.remove();
  const im = document.createElement('img'); im.className = 'vc-forge-img'; im.alt = ''; im.decoding = 'async'; im.src = url;
  for (const n of art.querySelectorAll(':scope > .vc-seal, :scope > svg')) n.remove(); art.classList.remove('vc-sealed'); // the painting is the one picture: no seal or plate left under it (lib/art-source.js)
  art.appendChild(im); art.classList.add('vc-forged'); el.dataset.forged = '1'; // the painting simply replaces the seal; no badge, button or flash (owner, 2026-10-18: "get rid of the distracting evolve stuff on the card art")
}
async function ask(method, el, c, again = false) {
  const kind = kindOf(el, c), rarity = c.rarity ? c.rarity.name.toLowerCase() : 'common';
  const url = '/api/card-art' + (method === 'GET' ? '?key=' + encodeURIComponent(subjectFor(el, c)) + '&kind=' + encodeURIComponent(kind) : '');
  const r = await fetch(url, method === 'GET' ? { cache: 'no-store' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject: subjectFor(el, c), kind, rarity, family: c.chapter || '', take: answerText(el).slice(0, 300), ...(again ? { again: true } : {}) }) });
  return r.ok ? r.json() : { state: 'plate', why: r.status === 429 ? 'slow' : 'http' };
}
function button(el, c) {
  if (mode() === 'off') return;
  if (!worthy(el, el._vcard || c)) return; // the card may have turned out to be a skill while the read was out
  const art = el.querySelector(':scope > .vc-art'); if (!art || art.querySelector('.vc-forge-btn')) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'vc-forge-btn'; b.textContent = 'Paint card';
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  b.addEventListener('click', (e) => { e.stopPropagation(); paint(el, c, b); });
  art.appendChild(b);
}
async function paint(el, c, b) {
  if (b) { b.disabled = true; b.textContent = 'painting…'; } else seen.set(subjectFor(el, c), 'asking'); // one paint per subject at a time
  painting(el, true);
  const sk = subjectFor(el, c); let got = null; // one POST per subject, whichever card element asks (a frame is rebuilt as its facts arrive)
  try { if (!inflight.has(sk)) inflight.set(sk, ask('POST', el, c).finally(() => setTimeout(() => inflight.delete(sk), 3000))); got = await inflight.get(sk); } catch (_) {}
  const img = got && got.state === 'art' ? safeImg(got.img) : '';
  // busy (the model timed out) or slow (more than three paints a minute from one place): try again later, three times at most, so a
  // person opening cards quickly still gets their paintings (owner, 2026-10-17: "still no art": three paintings in all, the rest 429s)
  // the cap and an off switch are final for the page
  if (!img && !b && autoOn() && retryable(got) && (tries.get(sk) || 0) < RETRY_S.length) { const n = tries.get(sk) || 0; tries.set(sk, n + 1); setTimeout(() => { seen.delete(sk); if (el.isConnected) forge(el, el._vcard || c, null); }, RETRY_S[n] * 1000); return; }
  if (!img && !b) seen.set(subjectFor(el, c), 'plate'); // a capped, switched-off or thrice-failed paint is not retried this page
  if (!img) painting(el, false);
  if (img) { seen.set(subjectFor(el, c), img); land(subjectFor(el, c), img); if (el.isConnected) { el._vcForge = img; show(el, img); } return; }
  if (!el.isConnected) return;
  if (b) { b.disabled = false; b.textContent = got && got.why === 'cap' ? 'out of paint today' : 'try again later'; if (got && (got.why === 'cap' || got.why === 'off')) setTimeout(() => b.remove(), 2500); }
}

/** paint this card now, whatever kind it is (a collectible card asks for its painting at once: owner, 2026-10-18: "a real image generator that
 *  can just generate a badass dragon"); the same one POST per subject, cap and rate limit as any paint. Never throws. */
export function paintNow(el) {
  try { const c = el && el._vcard; if (!c || el._vcForge || typeof fetch === 'undefined' || mode() === 'off') return; const k = seen.get(subjectFor(el, c)); if (k && k.startsWith('data:')) { el._vcForge = k; show(el, k); return; } paint(el, c, null); } catch (_) {}
}
/** the forge's turn for a card whose frame was just built: show the art it has, look for cached art, or offer the button. Never throws. */
export function forge(el, c, photo) {
  try {
    if (el._vcForge) { show(el, el._vcForge); return; } // a rebuilt frame shows the picture it already has, whatever the card turned out to be
    if (photo) return; // a real picture of the thing (a poster, a still) is the art: never paint over it
    if (!worthy(el, c) || typeof fetch === 'undefined' || mode() === 'off') return;
    const known = seen.get(subjectFor(el, c));
    if (known && known.startsWith('data:')) { el._vcForge = known; show(el, known); return; }
    if (known === 'asking') { (waiting.get(subjectFor(el, c)) || waiting.set(subjectFor(el, c), new Set()).get(subjectFor(el, c))).add(el); if (inflight.has(subjectFor(el, c)) || tries.get(subjectFor(el, c))) painting(el, true); return; }
    if (known === 'plate') return;
    if (known === 'none') { if (autoOn()) paint(el, c, null); else button(el, c); return; }
    seen.set(subjectFor(el, c), 'asking'); // one read per subject at a time
    ask('GET', el, c).then((got) => {
      const img = got && got.state === 'art' ? safeImg(got.img) : '';
      if (img) { seen.set(subjectFor(el, c), img); land(subjectFor(el, c), img); if (el.isConnected) { el._vcForge = img; show(el, img); } return; }
      seen.set(subjectFor(el, c), got && got.state === 'none' ? 'none' : 'plate');
      if (got && got.state === 'none' && worthy(el, el._vcard || c)) { if (autoOn()) paint(el, c, null); else button(el, c); }
    }).catch(() => seen.set(subjectFor(el, c), 'plate'));
  } catch (_) {}
}
