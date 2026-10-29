/**
 * converter skill - a card that opens the file converter (/converter/) on the tool the ask names.
 * "mp4 to mp3", "file converter", "cut mp3", "merge audio", "change gif speed", "epub to txt", "add image to pdf" (2026-10-29, assimilates
 * onlineconverter.com; lib/converter-ask.js). The page lists all 106 tools onlineconverter.com lists, each with Verse's honest status (here, on
 * another Verse page, in part, or not on Verse yet), and does the ones it can on this device. This file stays light: the stage loads every skill
 * at start, so the converter itself is not imported.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { converterAskOf } from '../lib/converter-ask.js';

export const TOOL_COUNT = 106; // CATALOG.length in lib/converter.js (tools/converter.test.mjs holds the two equal)

function run(text, api) {
  const { showPage, esc } = api, href = converterAskOf(text) || '/converter/';
  showPage((el) => {
    el.dataset.cardKind = 'File converter';
    el.innerHTML = '<h2>File converter</h2>' // void-review: ok (fixed words; the link comes from a closed set of asks and is escaped)
      + '<p>Sound to WAV or AIFF; pictures to JPG, PNG, WebP, GIF, BMP, TIFF or PDF; the words of an EPUB, DOCX, PDF, RTF or HTML file to any of the others. Cut, speed up, merge, mix or crossfade sounds, take the silence out, change a GIF\'s speed, take a frame or the sound out of a video, put a picture on a PDF.</p>'
      + '<p>All ' + TOOL_COUNT + ' tools of onlineconverter.com are listed, each with what Verse does: on this page, on another Verse page, in part, or not yet.</p>'
      + '<p><a class="cv-open" href="' + esc(href) + '" style="display:inline-block;padding:8px 18px;border-radius:999px;background:#6d4aff;color:#fff;text-decoration:none;font-weight:600">Open the file converter</a></p>'
      + '<div class="src">Done on this device: no file is uploaded.</div>';
  });
  return 'converter';
}

export default {
  name: 'converter',
  examples: ['mp4 to mp3', 'file converter', 'audio converter', 'cut mp3', 'merge audio', 'mix audio', 'change gif speed', 'epub to txt', 'pdf to docx', 'extract audio from video', 'add image to pdf', 'remove silence from audio'],
  nearMisses: ['png to jpg', 'jpg to pdf', 'merge pdf', 'compress pdf', '5 km to miles', 'unit converter', 'currency converter', 'convert png to webp', 'play some music', 'translate hello to french'],
  match(lower, text) { return !!converterAskOf(text || lower); },
  run
};
