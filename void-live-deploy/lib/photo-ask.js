/**
 * photo-ask: which asks open the photo tools page (/photos/, and the pages of its lane: squoosh, tinypng, exif.tools, exifeditor, photopea, iloveimg) and on which
 * tab. "compress an image", "convert png to webp", "crop a photo", "edit a photo", "view the exif of a photo", "photopea". An ask with a size in it ("to 50 kb",
 * "3.5 x 2.5 cm") belongs to the exact-size resizer (lib/imgfit.js), and "strip the exif from a photo" to the stage card (skills/photo-scrub.js). Pure.
 * Used by skills/photo-tools.js and the ask bar of every tool page (lib/toolkit.js).
 */
const THING = '(?:image|photo|picture|pic|selfie|jpe?g|jpg|png|webp|avif|gif|bmp|screenshot)s?';
const DET = '(?:an?\\s+|my\\s+|the\\s+|this\\s+|some\\s+|these\\s+|our\\s+)?';
const SITES = { squoosh: 'squoosh', tinypng: 'tinypng', 'tiny png': 'tinypng', tinyjpg: 'tinypng', photopea: 'photopea', 'photo pea': 'photopea', iloveimg: 'iloveimg', 'i love img': 'iloveimg', 'exif tools': 'exif', exiftools: 'exif', 'exif tool': 'exif', exifeditor: 'exifeditor', 'exif editor': 'exifeditor' };
const VERB = [['out', /^(?:compress|optimi[sz]e|shrink|minify|convert|reduce)\b/], ['crop', /^(?:crop|rotate|flip|mirror|straighten|turn)\b/], ['adj', /^(?:edit|retouch|brighten|darken|sharpen|blur|enhance|touch up)\b/], ['fil', /^(?:filter|add a filter to|apply a filter to)\b/], ['draw', /^(?:draw on|annotate|doodle on|scribble on)\b/], ['text', /^(?:add text to|put text on|caption|watermark|meme)\b/]];
/** { slug, tab } for an ask that wants the photo tools ('' slug is /photos/ itself), or null. Pure. */
export function photoAsk(text) {
  const t = String(text || '').toLowerCase().replace(/\s+/g, ' ').replace(/[?!.]+$/, '').replace(/^(?:please |can you |could you |i want to |i need to |how do i |how to )/, '').trim();
  if (!t || t.length > 90 || /\d/.test(t.replace(/\b(?:png|jpe?g|webp|avif|gif|bmp)\b/g, ''))) return null;
  if (SITES[t]) return { slug: SITES[t], tab: '' };
  if (/^(?:online )?(?:photo|image|picture) (?:editor|tools?|toolkit|compressor|optimi[sz]er)$|^(?:free )?(?:online )?(?:photo|image) editor$/.test(t)) return { slug: '', tab: /compressor|optimi/.test(t) ? 'out' : '' };
  if (/^(?:(?:view|see|show|read|check|find|inspect|open)\s+(?:the\s+)?)?(?:exif|metadata|meta data|gps)\b.*\b(?:viewer|of|from|in|for|on)\b.*|^(?:photo|image|picture) (?:exif|metadata) (?:viewer|reader|checker)$|^exif (?:viewer|reader|data viewer)$/.test(t) && !/^(?:what|why|how)\b|\b(?:strip|remove|delete|clean|scrub|wipe|erase)\b/.test(t)) return { slug: 'exif', tab: 'info' };
  if (/^(?:what|why|who|when|where)\b/.test(t)) return null;
  for (const [tab, re] of VERB) {
    if (!re.test(t)) continue; const rest = t.replace(re, '').trim();
    if (new RegExp('^' + DET + THING + '(?:\\s+(?:to|into|as|in)\\s+(?:a\\s+|an\\s+)?(?:jpe?g|jpg|png|webp|avif|pdf|smaller|gif))?(?:\\s+online|\\s+for free|\\s+on my phone)?$').test(rest) || new RegExp('^(?:png|jpe?g|jpg|webp|avif|gif|bmp)\\s+(?:to|into)\\s+(?:png|jpe?g|jpg|webp|avif)$').test(rest) || new RegExp('^' + DET + THING + '\\s+(?:file|files)$').test(rest)) {
      if (/\bpdf\b/.test(rest)) return null; return { slug: '', tab: tab === 'out' ? '' : tab };
    }
  }
  if (/^(?:image|photo|picture) (?:converter|cropper|rotator)$|^(?:jpe?g|png|webp|avif) (?:converter|compressor)$|^(?:png|jpe?g|webp|avif) to (?:png|jpe?g|webp|avif)(?: converter)?$/.test(t)) return { slug: '', tab: /cropper|rotator/.test(t) ? 'crop' : '' };
  return null;
}
/** the address that opens the tool for an ask: '/photos/', '/photos/?tab=crop', '/photos/exif/'. Pure. */
export const photoHref = (a) => '/photos/' + (a.slug ? a.slug + '/' : '') + (a.tab ? '?tab=' + a.tab : '');
