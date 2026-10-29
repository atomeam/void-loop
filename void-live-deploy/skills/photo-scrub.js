/**
 * photo-scrub skill — "strip the exif from a photo" / "remove the location from a picture" puts a card on the stage: choose a
 * JPEG or PNG and it says what hidden data the file carried (camera, time, place, comments), then offers a cleaned copy to
 * save. The pixels are not redrawn or recompressed: only the metadata segments are cut out of the bytes. The picture never
 * leaves this browser (asked for by the owner, 2026-10-18, "strip EXIF on image add"; images come onto the stage by link, so
 * this is the card for a photo from your own device). Pure logic: lib/safety.js stripMeta (tests: tools/tools-pack-8.test.mjs).
 */
import { cardEl, keepOut, addThing } from '../lib/stage-pack.js';
import { stripMeta, scrubSentence } from '../lib/safety.js';

const WORDS = '(?:exif|metadata|meta\\s*data|geo\\s*tags?|location\\s+data|gps(?:\\s+data)?|hidden\\s+data|(?:the\\s+)?(?:location|place|gps))';
const ASK = new RegExp('^(?:please\\s+)?(?:(?:strip|remove|clean|scrub|delete|wipe|erase|take\\s+out)\\s+(?:the\\s+|all\\s+)?' + WORDS + '\\s+(?:from|off|out\\s+of|of|in)\\s+(?:a\\s+|my\\s+|this\\s+|the\\s+)?(?:photo|picture|image|pic|jpe?g|png)s?'
  + '|(?:scrub|clean|strip)\\s+(?:a\\s+|my\\s+|this\\s+|the\\s+)?(?:photo|picture|image|pic)s?(?:\\s+(?:of|for)\\s+' + WORDS + ')?'
  + '|(?:photo|picture|image)\\s+(?:scrub(?:ber)?|cleaner)|exif\\s+(?:stripper|remover|scrub(?:ber)?|cleaner))$');

/** is this ask for the photo scrub. Pure. */
export function scrubIntent(text) { return ASK.test(String(text || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '')); }

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'scrub-card');
  el.innerHTML = '<div style="font-weight:600;margin-bottom:6px">Strip hidden photo data</div>'
    + '<div style="font-size:13px;opacity:.8;margin-bottom:8px">Choose a JPEG or PNG. It stays in this browser; you get back a copy without the camera, time and place data.</div>'
    + '<input type="file" class="scrub-file" accept="image/jpeg,image/png" aria-label="choose a JPEG or PNG photo" style="font:inherit;font-size:13px">'
    + '<div class="scrub-out" role="status" style="margin-top:10px;font-size:13px"></div>';
  const file = el.querySelector('.scrub-file'), out = el.querySelector('.scrub-out');
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0]; if (!f) return;
    const r = stripMeta(new Uint8Array(await f.arrayBuffer()));
    out.textContent = '';
    const p = document.createElement('div'); p.className = 'scrub-said'; p.textContent = scrubSentence(r); out.appendChild(p);
    if (r.type) {
      const blob = new Blob([r.bytes], { type: r.type === 'png' ? 'image/png' : 'image/jpeg' }), url = URL.createObjectURL(blob);
      const img = document.createElement('img'); img.src = url; img.alt = 'cleaned copy'; img.style.cssText = 'display:block;max-width:220px;max-height:160px;margin:8px 0;border-radius:8px';
      const a = document.createElement('a'); a.className = 'scrub-save'; a.href = url; a.download = f.name.replace(/(\.[a-z0-9]+)?$/i, '-clean$1'); a.textContent = 'Save the cleaned copy';
      a.style.cssText = 'color:#9fd0ff'; out.append(img, a);
    }
  });
  keepOut(file);
  stageApi.bindDrag(el, th); stageApi.stage.appendChild(el);
}

export default {
  name: 'photo-scrub',
  examples: ['strip the exif from a photo', 'remove the location from a picture', 'photo scrubber'],
  nearMisses: ['what is exif data', 'show me a photo of paris', 'remove the image', 'edit my photo'],
  scrubIntent,
  match(lower, text) { return scrubIntent(text || lower); },
  async run(text, api) {
    const th = addThing(api.stage, 'scrub', {}); api.stage.select(th.id); api.stage.render();
    if (api.say) api.say('choose a photo · it stays in this browser');
    return 'photo-scrub';
  },
  stageKinds: { scrub: { mount, ephemeral: true } },
};
