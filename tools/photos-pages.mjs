// The photos lane's own pages (owner, 2026-10-26: "even if we are sure we already stomp them we still make a page and beat them"; docs/RULES.md): every site of the
// photos lane gets a page of its own that has everything that site has, framed the way that site frames it, all driven by one engine (void-live-deploy/photos/app.js,
// lib/photo-edit.js). /photos/index.html is the source; this writes /photos/<slug>/index.html from it with the site's title, words and first tab, and lib/tower.js
// LANE_PAGES points each lane site at its page.  node tools/photos-pages.mjs        (writes them)   node tools/photos-pages.mjs --check   (fails when one is stale)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'photos');
export const PAGES = [
  { slug: 'squoosh', host: 'squoosh.app', start: 'out', title: 'Compress and convert images', sub: 'Pick a quality, a format and a size, and drag the slider to compare the original and the result. JPEG, PNG, WebP and AVIF; the file never leaves this device.', tab: 'Image compressor: JPEG, PNG, WebP, AVIF' },
  { slug: 'tinypng', host: 'tinypng.com', start: 'out', title: 'Image compressor: shrink PNG, JPEG and WebP', sub: 'Drop many photos, make them smaller (PNGs drop to a palette of up to 256 colours) and download them all as one zip. No limit on size or count, nothing uploaded.', tab: 'Image compressor: shrink PNG, JPEG, WebP and AVIF' },
  { slug: 'exif', host: 'exif.tools', start: 'info', title: 'EXIF viewer and metadata remover', sub: 'See what a photo says about you: camera, serial number, time and GPS. Strip it, or save it as JSON. Nothing is uploaded.', tab: 'EXIF viewer and metadata remover' },
  { slug: 'exifeditor', host: 'exifeditor.io', start: 'info', title: 'Photo metadata viewer & stripper', sub: 'See what a photo records (camera, time, place) and strip it before you share. Everything happens on this device.', tab: 'Photo metadata viewer & stripper' },
  { slug: 'photopea', host: 'photopea.com', start: 'adj', title: 'Photo editor: crop, adjust, text and draw', sub: 'Crop, adjust, filters, text and drawing with a full undo history, then save as JPEG, PNG, WebP or AVIF. One picture at a time, no layers.', tab: 'Photo editor: crop, adjust, text and draw' },
  { slug: 'iloveimg', host: 'iloveimg.com', start: 'crop', title: 'Batch photo tools: resize, crop, rotate, convert', sub: 'Resize, crop with shapes, rotate, convert, put text on a picture, and do many pictures at once as a zip. Everything happens on this device.', tab: 'Batch photo tools: resize, crop, rotate, convert' },
];
const BLOCKS = [/<!-- seo -->[\s\S]*?<!-- \/seo -->\n?/g, /<!-- asks -->[\s\S]*?<!-- \/asks -->\n?/g]; // tools/seo-pages.mjs writes these into every page itself
export const bare = (h) => BLOCKS.reduce((t, re) => t.replace(re, ''), h);
export function render(src, p) {
  src = bare(src);
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  let s = src.replace('<body data-start="out">', '<body data-start="' + p.start + '" data-slug="' + p.slug + '">');
  s = s.replace('<meta name="viewport" content="width=device-width,initial-scale=1">', '<meta name="viewport" content="width=device-width,initial-scale=1">\n<link rel="canonical" href="https://a-to-mind.com/photos/' + p.slug + '/">');
  s = s.replace(/<title>[^<]*<\/title>/, '<title>' + p.tab + ' · Verse</title>');
  s = s.replace(/(<meta name="description" content=")[^"]*/, '$1' + esc(p.sub + ' Compress, convert, resize, crop, edit and strip EXIF.'));
  s = s.replace(/(<meta property="og:title" content=")[^"]*/, '$1' + esc(p.title) + ' · Verse').replace(/(<meta property="og:description" content=")[^"]*/, '$1' + esc(p.sub)).replace(/(<meta property="og:url" content=")[^"]*/, '$1https://a-to-mind.com/photos/' + p.slug + '/');
  s = s.replace(/<h1 id="h1" data-i="title">[^<]*/, '<h1 id="h1" data-i="title_' + p.slug + '">' + p.title).replace(/<p class="sub" id="sub" data-i="sub">[^<]*/, '<p class="sub" id="sub" data-i="sub_' + p.slug + '">' + p.sub);
  return s;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8'); let stale = 0;
  for (const p of PAGES) { const f = path.join(root, p.slug, 'index.html'), want = render(src, p), have = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    if (process.argv.includes('--check')) { if (bare(have) !== want) { console.log('stale: photos/' + p.slug + '/index.html (node tools/photos-pages.mjs)'); stale++; } } else { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, want); console.log('wrote photos/' + p.slug + '/index.html'); } }
  process.exit(stale ? 1 : 0);
}
