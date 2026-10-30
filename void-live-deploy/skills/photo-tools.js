/**
 * photo-tools skill: "edit a photo", "compress an image", "convert png to webp", "crop a photo", "view the exif of a photo", "squoosh", "tinypng" (owner, 2026-10-26:
 * "we have to have everything all the sites have"; Versus' photos lane). A card that says what the photo tools do and opens /photos/ on the right tab (lib/photo-ask.js):
 * compress and convert with a before and after slider, resize, crop, adjust, filters, text, draw, undo, EXIF view and strip, a zip of many. All on this device.
 * Sized asks go to the exact-size resizer (skills/imgfit.js), "strip the exif from a photo" to the stage card (skills/photo-scrub.js).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { photoAsk, photoHref } from '../lib/photo-ask.js';

function run(text, api) {
  const { showPage, esc } = api, a = photoAsk(text) || { slug: '', tab: '' }, href = photoHref(a);
  showPage((el) => {
    el.dataset.cardKind = 'Photo tools';
    el.innerHTML = '<h2>Photo tools</h2>' // void-review: ok (fixed words; the link is built from a closed list and escaped)
      + '<p>Compress and convert a photo (JPEG, PNG, WebP, AVIF) and see the before and after, resize, crop, rotate, adjust, add a filter, text or a drawing, undo any step, read the EXIF and GPS a photo carries and strip it, or do many at once as a zip.</p>'
      + '<p><a class="pt-open" href="' + esc(href) + '" style="display:inline-block;padding:8px 18px;border-radius:999px;background:#6d4aff;color:#fff;text-decoration:none;font-weight:600">Open the photo tools</a></p>'
      + '<div class="src">Done on this device: the picture is never uploaded, and the page opens offline.</div>';
  });
  return 'photo-tools';
}

export default {
  name: 'photo-tools',
  examples: ['edit a photo', 'photo editor', 'compress an image', 'convert png to webp', 'crop a photo', 'view the exif of a photo', 'squoosh', 'tinypng', 'edit lighting on this photo'],
  nearMisses: ['compress my image to 100kb', 'resize a photo to 3.5 x 2.5 cm under 50 kb', 'my photos', 'draw a picture of a cat', 'strip the exif from a photo', 'what is exif data', 'reduce the size of my photo', 'edit the stage', 'rotate the stage image'],
  // "edit" as a word (edit, editing, editor): a bare substring took "credit card photo" and "who edited this image"
  match(lower, text) { return !!photoAsk(text || lower) || (/\bedit(?:ing|or)?\b/.test(lower) && (lower.includes('photo') || lower.includes('image') || lower.includes('lighting'))) || lower.includes('fix lighting'); },
  run
};
