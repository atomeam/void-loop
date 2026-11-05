/**
 * image skill — one picture on the stage from a url, shown as an instant photo (white frame, a caption in the felt-tip hand
 * under it, its own tilt): "show this image https://…/cat.png", "add an image <url>", a pasted
 * image url, "remove the image"; "make the image red" edges it through the page's shared colours. Its caption is yours to
 * write; a picture that will not load says so. Moved out of void.html in cleanup step 6. The page asks its two hooks where
 * its image code always ran (`askAt`): `ask` (create, remove) before the link card, `askBare` (a pasted image url) after
 * it. There is no `ensure`, since an image means nothing without its url.
 * A Wikimedia link ("show this image https://upload.wikimedia.org/…") is also shown on a card, inline, with its source and, once
 * Commons answers, its author and licence. "picture of a cat" (a subject on lib/free-pics.js's closed list only; a visitor's own
 * words are never sent) finds a freely licensed photo on Wikimedia Commons and shows it with its credit; "Paint it" carries
 * either picture to /paint/ (lib/image-handoff.js). A bare "image" asks which picture is meant.
 */
import { resolveSubject, findPictures, creditHtml, stripHtml, esc as escHtml, httpsUrl } from '../lib/free-pics.js';
import { sendImage, blobOf } from '../lib/image-handoff.js';

/** the first http(s) url in the text, without trailing punctuation (null when none). Pure. */
export function urlOf(text) {
  const m = String(text || '').match(/https?:\/\/[^\s]+/i);
  return m ? m[0].replace(/[),.!]+$/, '') : null;
}

const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|svg)\b/i;

/** the ask puts up a picture. Pure. */
export function wantsCreate(lower, raw = lower) {
  if (/\b(remove|delete|get rid|hide)\b/.test(lower) && /\b(image|picture|photo|img)\b/.test(lower)) return false;
  const url = urlOf(raw);
  if (!url) return false;
  if (/\b(image|picture|photo|img)\b/.test(lower)) return true; // "show this image <url>", "add an image <url>", "image: <url>"
  if (/\b(put|place|drop)\b.*\bhere\b/.test(lower) && IMG_EXT.test(url)) return true;
  return IMG_EXT.test(raw);
}

/** "remove the image", "get rid of the picture", "the photo, away", and "remove it" (as it always was). Pure. */
export function wantsRemove(lower) {
  if (/\b(remove|delete|get\s+rid\s+of|hide|clear)\b.*\b(image|picture|photo|img)\b/.test(lower)) return true;
  if (/\b(image|picture|photo)\b.*\b(away|gone)\b/.test(lower)) return true;
  return /^(remove|delete|get\s+rid\s+of|hide)\s+(it|this)\s*[.!]?\s*$/.test(lower);
}

/** a pasted image url and nothing else. Pure. */
export const bareImageUrl = (raw) => /^https?:\/\/[^\s]+\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(String(raw || '').trim());

/** the plain asks the skill takes before the page's own parser: "show/add an image <url>" and "image: <url>". A pasted url
 *  is left to the page, which asks `askBare` after the link card, as before. Pure. */
export const plainImage = (lower, raw = lower) => !!urlOf(raw) && !/\b(remove|delete|get\s+rid|hide|clear)\b/.test(lower)
  && /^(?:please\s+)?(?:(?:show|display|add|put|make|create)\s+(?:me\s+)?(?:this\s+|an?\s+|the\s+)?(?:image|picture|photo)|image)\s*:?\s*https?:\/\/\S+\s*$/.test(lower);

/** the one picture, pointed at src (made when there is none); it is picked */
export function put(stageApi, src) {
  const things = stageApi.things(), st = stageApi.stage;
  let img = Object.values(things).find((t) => t && t.kind === 'image');
  if (!img) {
    img = { id: 'image_' + Math.random().toString(36).slice(2, 9), kind: 'image',
      x: Math.max(40, (st.clientWidth || 800) / 2 - 160), y: Math.max(40, (st.clientHeight || 600) / 2 - 160) };
    things[img.id] = img;
  }
  img.src = src;
  stageApi.select(img.id);
  return img;
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing image';
  el.dataset.id = th.id;
  el.style.left = th.x + 'px';
  el.style.top = th.y + 'px';
  if (th.color) el.style.borderColor = th.color;
  if (stageApi.selected() === th.id) el.style.outline = '1px solid rgba(255,255,255,0.25)';
  el.style.rotate = tiltOf(th.id) + 'deg'; // a photo put down never sits square; each keeps its own tilt

  const title = document.createElement('div');
  title.className = 'image-title';
  title.dataset.placeholder = 'Image';
  title.contentEditable = 'true';
  title.spellcheck = false;
  title.textContent = th.title || '';
  title.addEventListener('pointerdown', (e) => e.stopPropagation());
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });
  title.addEventListener('input', () => { th.title = title.textContent || ''; stageApi.save(); });

  const img = document.createElement('img');
  img.src = th.src;
  img.alt = '';
  img.draggable = false;
  img.onerror = () => { img.style.display = 'none'; title.textContent = th.title || 'Image (failed)'; stageApi.say('image failed to load'); };
  img.onload = () => { if (!th.title) title.textContent = ''; };

  el.appendChild(img);
  el.appendChild(title); // the caption goes on the strip under the picture
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** a photo's own slight tilt, -2.5 to 2.5 degrees, the same every time for the same photo (as skills/sticky.js). Pure. */
export function tiltOf(id) {
  let h = 0;
  for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.round(((Math.abs(h) % 51) - 25) / 10 * 10) / 10 || 1.2; // never square
}

const done = (stageApi) => { stageApi.save(); stageApi.render(); return 'image'; };

/** create or remove, at the place the image code ran: what it did ('no image' when there is none to remove), or '' */
export function ask(lower, text, stageApi) {
  if (wantsCreate(lower, text)) { put(stageApi, urlOf(text)); return done(stageApi); }
  if (wantsRemove(lower)) {
    const things = stageApi.things(), img = Object.values(things).find((t) => t && t.kind === 'image');
    if (!img) return 'no image'; // the page says so rather than handing the ask on
    delete things[img.id];
    if (stageApi.selected() === img.id) stageApi.select(null);
    stageApi.save(); stageApi.render();
    return 'image-removed';
  }
  return '';
}

/** a pasted image url, at the later place the page always asked it (after the link card) */
export function askBare(lower, text, stageApi) {
  if (!bareImageUrl(text)) return '';
  put(stageApi, String(text).trim());
  return done(stageApi);
}

// ---- the picture cards ----
/** a Wikimedia upload link's file: { file, wiki } (wiki: 'commons' or a language code), or null for any other link. Pure. */
export function wikimediaFile(url) {
  let u; try { u = new URL(String(url || '')); } catch (_) { return null; }
  if (u.hostname !== 'upload.wikimedia.org') return null;
  const parts = u.pathname.split('/').filter(Boolean).map((x) => { try { return decodeURIComponent(x); } catch (_) { return x; } });
  if (parts[0] !== 'wikipedia' || parts.length < 4) return null;
  const wiki = parts[1] === 'commons' ? 'commons' : /^[a-z-]{2,12}$/.test(parts[1]) ? parts[1] : null;
  if (!wiki) return null;
  const t = parts.indexOf('thumb'), file = t > 0 ? parts[t + 3] : parts[parts.length - 1];
  return file && /\.[a-z0-9]{2,5}$/i.test(file) ? { file, wiki } : null;
}

const NOUN = /^(?:a\s+|an\s+|the\s+|some\s+|my\s+)?([a-z][a-z' -]{1,40}?)$/;
/** "picture of a cat", "show me a photo of the moon", "image of mountains": the closed-list subject asked for ('' when the ask is not
 *  this form, or its subject is not on lib/free-pics.js's lists: only those words are ever sent to Commons). Pure. */
export function pictureOf(lower) {
  const l = String(lower || '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '').replace(/\s+please$/, '');
  const m = /^(?:please\s+)?(?:(?:show|give|find|get|send)\s+me\s+|can i see\s+|i want\s+|i'd like\s+)?(?:a\s+|an\s+|the\s+|some\s+)?(?:picture|photo|photograph|image|pic)s?\s+of\s+(.+)$/.exec(l);
  if (!m) return '';
  const n = NOUN.exec(m[1]); if (!n) return '';
  const words = n[1].trim().split(/\s+/), sing = (w) => w.replace(/(?:ies)$/, 'y').replace(/(ch|sh|x|ss)es$/, '$1').replace(/([^s])s$/, '$1');
  for (const cand of [n[1].trim(), sing(n[1].trim()), words[words.length - 1], sing(words[words.length - 1])]) { const q = resolveSubject(cand); if (q) return q.toLowerCase(); }
  return '';
}
/** a bare "image" / "a picture" / "photo": the ask that needs to say which. Pure. */
export const bareAsk = (lower) => /^(?:an?\s+)?(?:image|picture|photo|pic)s?\s*[.!?]?$/.test(String(lower || '').trim());

const KIND = { lion: 'animal', elephant: 'animal', dog: 'animal', cat: 'animal', bird: 'animal', horse: 'animal', moon: 'space', mars: 'space', galaxy: 'space', nebula: 'space', eclipse: 'space', 'space shuttle': 'space', painting: 'art', 'landscape painting': 'art', sculpture: 'art', mountain: 'place', ocean: 'place', forest: 'place', 'city skyline': 'place' };
// Commons answers a browser when the request carries origin=* (CORS) and only the plain headers
const commonsFetch = (url, o = {}) => fetch(String(url) + (/[?&]origin=/.test(url) ? '' : '&origin=*'), { signal: o.signal });
const IMG_CSS = 'float:none;display:block;max-width:100%;width:100%;height:auto;max-height:52vh;object-fit:contain;margin:6px 0;border-radius:8px;background:#0001';
const buttons = '<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="vi-paint">Paint it in /paint/</button><button type="button" class="vi-stage">Put it on the stage</button></div><div class="vi-said sub" aria-live="polite"></div>';
function wireButtons(el, api, src, name) {
  const said = el.querySelector('.vi-said');
  el.querySelector('.vi-paint').addEventListener('click', async () => { said.textContent = 'Opening /paint/ with the picture…'; const ok = await sendImage('/paint/', () => blobOf(src), { name, fromPage: '/' }); if (!ok) said.textContent = 'The picture could not be handed to /paint/ from here.'; });
  el.querySelector('.vi-stage').addEventListener('click', () => { put(api.stage, src); done(api.stage); said.textContent = 'It is on your stage as an instant photo.'; });
}

/** the card for a Wikimedia link: the picture inline, where it is from, and its author and licence once Commons answers */
function wikimediaCard(url, api) {
  const w = wikimediaFile(url), { showPage, esc } = api, home = w.wiki === 'commons' ? 'commons.wikimedia.org' : w.wiki + '.wikipedia.org';
  const page = 'https://' + home + '/wiki/File:' + encodeURIComponent(w.file.replace(/ /g, '_'));
  const el = showPage((p) => {
    p.innerHTML = '<h2>' + esc(w.file.replace(/_/g, ' ').replace(/\.[a-z0-9]+$/i, '')) + '</h2>'
      + '<img class="vi-pic" src="' + esc(url) + '" alt="' + esc(w.file) + '" style="' + IMG_CSS + '">'
      + '<p class="sub">Shown from upload.wikimedia.org (' + (w.wiki === 'commons' ? 'Wikimedia Commons' : esc(w.wiki) + ' Wikipedia') + '), the file ' + esc(w.file) + '. It is on your stage too, as an instant photo.</p>'
      + '<p class="src vi-credit">Source: <a href="' + esc(page) + '" rel="noopener noreferrer" target="_blank">File:' + esc(w.file) + '</a> on ' + esc(home) + '; author and licence on the file page.</p>' + buttons;
  });
  wireButtons(el, api, url, w.file.replace(/\.[a-z0-9]+$/i, ''));
  // the author and licence, from the file page's own record
  commonsFetch('https://' + home + '/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata|url&titles=' + encodeURIComponent('File:' + w.file))
    .then((r) => r.json()).then((j) => {
      const pg = Object.values((j && j.query && j.query.pages) || {})[0], ii = pg && pg.imageinfo && pg.imageinfo[0], m = (ii && ii.extmetadata) || {}, v = (k) => (m[k] && m[k].value != null ? m[k].value : '');
      const author = stripHtml(v('Artist'), 100), lic = stripHtml(v('LicenseShortName'), 40), licUrl = httpsUrl(stripHtml(v('LicenseUrl'), 200)), at = httpsUrl((ii && ii.descriptionurl) || '') || page;
      const c = el.querySelector('.vi-credit'); if (!c || (!author && !lic)) return;
      c.innerHTML = 'Photo: ' + escHtml(author || 'author not stated') + ', ' + (licUrl ? '<a href="' + escHtml(licUrl) + '" rel="noopener noreferrer" target="_blank">' + escHtml(lic || 'licence') + '</a>' : escHtml(lic || 'licence on the file page'))
        + ', via <a href="' + escHtml(at) + '" rel="noopener noreferrer" target="_blank">Wikimedia Commons</a> (upload.wikimedia.org)';
    }).catch(() => {});
}

/** the card for "picture of a cat": a freely licensed Commons photo with its credit (the subject is from the closed list) */
function pictureCard(subject, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => {
    p.innerHTML = '<h2>A picture of ' + esc(subject === 'moon' ? 'the moon' : subject === 'mars' ? 'Mars' : (/^[aeiou]/.test(subject) ? 'an ' : 'a ') + subject) + '</h2>'
      + '<p class="sub">A real photo from Wikimedia Commons, under a free licence, with its author and licence credited under it.</p>'
      + '<div class="vi-slot"><p class="sub">Finding one on Wikimedia Commons…</p></div>';
  });
  findPictures(subject, { kind: KIND[subject] || 'place', sources: ['commons'], fetch: commonsFetch, cache: null, max: 1, timeoutMs: 8000 })
    .then((pics) => {
      const slot = el.querySelector('.vi-slot'), pic = pics && pics[0]; if (!slot) return;
      if (!pic) { slot.innerHTML = '<p class="sub">Wikimedia Commons had no freely licensed photo of that just now. <a href="#" data-ask="draw a cartoon ' + esc(subject) + '">Draw a cartoon ' + esc(subject) + '</a> instead.</p>'; return; }
      slot.innerHTML = '<img class="vi-pic" src="' + escHtml(pic.thumb || pic.url) + '" alt="' + escHtml(pic.alt) + '" style="' + IMG_CSS + '">'
        + '<p class="src vi-credit">' + creditHtml({ ...pic, archive: false, taken: pic.taken }) + '</p>' + buttons;
      wireButtons(slot, api, pic.thumb || pic.url, subject.replace(/\s+/g, '-'));
    })
    .catch(() => { const slot = el.querySelector('.vi-slot'); if (slot) slot.innerHTML = '<p class="sub">Wikimedia Commons did not answer just now; ask again in a moment, or <a href="#" data-ask="draw a cartoon ' + esc(subject) + '">draw a cartoon ' + esc(subject) + '</a>.</p>'; });
  return 'image';
}

/** a bare "image": which one */
function whichCard(api) {
  api.showPage((p) => {
    p.innerHTML = '<h2>Which picture do you mean?</h2>'
      + '<p class="sub">A picture can be a few different things here: a link you paste to show ("show this image" and the link), a real photo of something, or one drawn for you.</p>'
      + '<p><a href="#" data-ask="picture of a cat">A photo of a cat</a> · <a href="#" data-ask="draw a red circle">Draw a red circle</a> · <a href="#" data-ask="let me draw">Draw one yourself</a></p>';
  });
  return 'image';
}

async function run(text, api) {
  const lower = String(text || '').toLowerCase().trim(), card = typeof api.showPage === 'function';
  if (card && bareAsk(lower)) return whichCard(api);
  const subject = card && !urlOf(text) ? pictureOf(lower) : '';
  if (subject) return pictureCard(subject, api);
  const d = ask(lower, text, api.stage);
  if (d && d !== 'no image' && card && wikimediaFile(urlOf(text))) wikimediaCard(urlOf(text), api);
  return d && d !== 'no image' ? 'image' : 'none';
}

export default {
  name: 'image',
  examples: ['show this image https://example.org/cat.png', 'add an image https://example.org/dog.jpg', 'picture of a cat', 'show me a photo of the moon', 'image'],
  nearMisses: ['https://example.org/guides/getting-started', 'remove the image', 'draw a picture of a cat', 'make an image of a cat', 'picture of my grandmother'],
  match(lower, text) { return plainImage(lower, text) || !!pictureOf(lower) || bareAsk(lower); },
  run,
  // askAt: the page asks this kind's ask and askBare at its own places, not in the early loop the counter and shape use
  stageKinds: { image: { mount, ask, askBare, askAt: 'image' } },
};
