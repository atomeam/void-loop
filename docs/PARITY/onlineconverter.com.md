# onlineconverter.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: onlineconverter.com (https://onlineconverter.com/)
- Verse: /converter/ (onlineconverter.com, tower gate 0 of 12)
- Live scan: not scanned yet
- History: [docs/HISTORY/onlineconverter.com.md](../HISTORY/onlineconverter.com.md)

**Match: 53%**: 5 have, 6 partial, 3 missing, 1 unreviewed, of 15 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Video converters: MP4, 3GP, AVI, FLV, MKV, MOV, WEBM and WMV | Convert | missing | studied by hand: onlineconverter.com offers this (https://onlineconverter.com/) | no sign of it in the source of /converter/ |
| Audio converters: MP3, AIFF, ALAC, AMR, FLAC, M4A, M4R, OGG, OPUS, WAV and WMA | Convert | partial | studied by hand: onlineconverter.com offers this (https://onlineconverter.com/) | void-live-deploy/converter/app.js:153 `= (s, as) => (as === 'aiff' ? aiff(s.channels, s.rate) : wav(s.channels, s.rate));` |
| Image converters: JPG, BMP, DNG, GIF, PDF, PNG, TIFF and WEBP | Convert | partial | studied by hand: onlineconverter.com offers this (https://onlineconverter.com/) | void-live-deploy/converter/app.js:157 `if (to === 'tiff') return tiff(pixels(c));` |
| Ebook converters: EPUB, AZW, DOCX, HTML, MOBI, PDF, RTF and TXT | Convert | partial | studied by hand: onlineconverter.com offers this (https://onlineconverter.com/) | void-live-deploy/converter/app.js:183 `o === 'epub') return { bytes: epubOf(titled) };` |
| Document converters (PDF, DOCX, HTML, TXT) that keep the layout | Convert | partial | studied by hand: onlineconverter.com offers this (https://onlineconverter.com/) | void-live-deploy/converter/app.js:182 `'docx') return { bytes: await docxBytesOf(d) };` |
| Unit converters: weight, length, area, speed, temperature, time zone, time, currency and volume | Convert | have | studied by hand: onlineconverter.com offers this (https://onlineconverter.com/) | void-live-deploy/lib/converter.js:72 `UNIT('Area', '/convert/?k=area'), tool('Unit', 'Currency', 'verse', { href: '/markets/?s` |
| Audio tools: cut, merge, mix, crossfade, speed, volume, silence and noise removal, cover pictures, compress, repair | Edit | partial | studied by hand: onlineconverter.com offers this (https://onlineconverter.com/) | void-live-deploy/converter/app.js:209 `, 6)) : t.run === 'silence' ? removeSilence(s, val('thr', -45), val('minms', 400)) : { ...` |
| Video tools: cut, merge, resize, rotate, compress, watermark, text, speed and 11 more | Edit | missing | studied by hand: onlineconverter.com offers this (https://onlineconverter.com/) | no sign of it in the source of /converter/ |
| Image tools: blur, brighten, compress, cut, resize, rotate, watermark, merge, GIF speed, a frame from a video, background removal | Edit | partial | studied by hand: onlineconverter.com offers this (https://onlineconverter.com/) | void-live-deploy/converter/app.js:72 `if (run === 'merge-images') o.append(field('Put them', pick('dir', [['row', 'side by sid` |
| Ebook tools: change an EPUB cover, compress AZW3, CBZ, CBR and EPUB, merge EPUB | Edit | missing | studied by hand: onlineconverter.com offers this (https://onlineconverter.com/) | no sign of it in the source of /converter/ |
| PDF tools: add an image, compress, merge and split | Edit | have | studied by hand: onlineconverter.com offers this (https://onlineconverter.com/) | void-live-deploy/converter/app.js:73 `if (run === 'pdf-image') o.append(field('Page', num('page', 1, '1', 1)), field('From the` |
| Free, nothing to download or install | About | have | studied by hand: onlineconverter.com offers this (https://onlineconverter.com/) | void-live-deploy/converter/index.html:63 `device: no file is uploaded, nothing to install, no account. Works offline once opened, o` |
| On a computer or a phone, anytime | About | have | studied by hand: onlineconverter.com offers this (https://onlineconverter.com/) | void-live-deploy/converter/index.html:63 `t. Works offline once opened, on a computer or a phone.</p>` |
| Your files stay yours (the site uploads them to its server; Verse does the work on the device) | About | have | studied by hand: onlineconverter.com offers this (https://onlineconverter.com/) | void-live-deploy/converter/index.html:63 `s="lead">Done on this device: no file is uploaded, nothing to install, no account. Works o` |
| Its live pages could not be read, so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://onlineconverter.com/ | not compared yet |
