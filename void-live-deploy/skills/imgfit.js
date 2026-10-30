/**
 * imgfit skill: "resize a photo to 3.5 x 2.5 cm under 50 kb", "compress my image to 100kb", "image resizer" (owner, 2026-10-24: back to the easy sites; pancardresizer.com).
 * A card that says what it does and opens the resizer with the size and limit the ask named already filled in; the resizer itself is /resize-image/ (lib/imgfit.js): any size
 * in cm, mm, inches or pixels, a size limit in KB that is actually met, a JPEG or a PDF, all on this device, nothing uploaded. The page's own stage
 * card (lib/resize-card.js) asks for the size open on it, so the page and this card lead to each other.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { isAsk, sizeIn } from '../lib/imgfit.js';
import { photoAsk } from '../lib/photo-ask.js'; // a bare "compress an image" or "crop a photo" (no size) is the photo tools' (skills/photo-tools.js)

function run(text, api) {
  const { showPage, esc } = api, s = sizeIn(text), q = [];
  if (s.w && s.h) { q.push('w=' + s.w, 'h=' + s.h, 'u=' + (s.unit || 'px')); } if (s.kb) q.push('kb=' + s.kb);
  const href = '/resize-image/' + (q.length ? '?' + q.join('&') : ''), said = (s.w && s.h ? s.w + ' × ' + s.h + ' ' + (s.unit || 'px') : 'the size you need') + (s.kb ? ', under ' + s.kb + ' KB' : '');
  showPage((el) => {
    el.dataset.cardKind = 'Photo resizer';
    if (q.length && el.dataset) el.dataset.page = href; // the card's "Open the full page" link opens the resizer at this size (lib/card-frame.js pageOfCard)
    el.innerHTML = '<h2>Resize and compress a photo</h2>' // void-review: ok (numbers and fixed words only; escaped)
      + '<p>Make a photo or signature <b>' + esc(said) + '</b>: pick the file, and it is cropped, resized and squeezed under the limit as a JPEG or a PDF.</p>'
      + '<p><a class="ir-open" href="' + esc(href) + '" style="display:inline-block;padding:8px 18px;border-radius:999px;background:#6d4aff;color:#fff;text-decoration:none;font-weight:600">Open the resizer</a></p>'
      + '<div class="src">Done on this device: the picture is never uploaded. Sizes in cm, mm, inches or pixels; the limit counts 1 KB as 1,000 bytes.</div>';
  });
  return 'imgfit';
}

export default {
  name: 'imgfit',
  examples: ['resize a photo to 3.5 x 2.5 cm under 50 kb', 'compress my image to 100kb', 'image resizer', 'resize my signature', 'reduce the size of my photo'],
  nearMisses: ['strip the exif from a photo', 'my photos', 'draw a picture of a cat', 'resize the stage', 'what is the size of the moon', 'make a cartoon image'],
  match(lower, text) { return isAsk(text || lower) && !photoAsk(text || lower); },
  run
};
