/**
 * image skill — one picture on the stage from a url, shown as an instant photo (white frame, a caption in the felt-tip hand
 * under it, its own tilt): "show this image https://…/cat.png", "add an image <url>", a pasted
 * image url, "remove the image"; "make the image red" edges it through the page's shared colours. Its caption is yours to
 * write; a picture that will not load says so. Moved out of void.html in cleanup step 6. The page asks its two hooks where
 * its image code always ran (`askAt`): `ask` (create, remove) before the link card, `askBare` (a pasted image url) after
 * it. There is no `ensure`, since an image means nothing without its url.
 */

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

export default {
  name: 'image',
  examples: ['show this image https://example.org/cat.png', 'add an image https://example.org/dog.jpg'],
  nearMisses: ['https://example.org/guides/getting-started', 'remove the image'],
  match(lower, text) { return plainImage(lower, text); },
  async run(text, api) { const d = ask(String(text || '').toLowerCase(), text, api.stage); return d && d !== 'no image' ? 'image' : 'none'; },
  // askAt: the page asks this kind's ask and askBare at its own places, not in the early loop the counter and shape use
  stageKinds: { image: { mount, ask, askBare, askAt: 'image' } },
};
