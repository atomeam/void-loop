// The asks that open the file converter (/converter/, 2026-10-29, assimilates onlineconverter.com). Pure, with no import, so that the stage's
// skill and the toolkit's router can both use it without loading the converter itself. A picture target ('png to jpg') stays with the photo
// tools, a PDF target and the PDF tools ('merge pdf', 'jpg to pdf') stay with the PDF page, and a unit ('5 km to miles') stays with the unit
// converter: none of those match here.
const SOUND = 'mp3|wav|aiff?|flac|ogg|opus|m4a|m4r|amr|wma|alac';
const TEXT = 'epub|mobi|azw3?|docx?|word|rtf|txt|text|html?';
const VIDEO = 'mp4|mov|3gp|avi|flv|mkv|webm|wmv';
const FROM = SOUND + '|' + TEXT + '|' + VIDEO + '|pdf|gif|jpe?g|png|webp|bmp|tiff?|video|audio|sound|song|music|voice|ebook|book|document|doc';
const FORMAT_TO = new RegExp('^(?:please )?(?:convert |change |turn |save )?(?:an? |my |the |this )?(?:(' + FROM + ') )?(?:files? )?(?:to|into|2|as) (?:an? )?\\.?(' + SOUND + '|' + TEXT + '|' + VIDEO + ')(?: files?| format| online| free| converter)*$', 'i');
const CONVERTER = /^(?:an? |the |free |online |open (?:the |a )?)*(?:file|audio|video|sound|ebook|e-book|document|doc|format|media|mp3|wav|epub|docx|rtf|gif)(?: file)? converter(?: online| free)*$|^(?:online ?converter|onlineconverter(?:\.com)?|convert (?:a |my )?files?)$/i;
const TOOLS = [
  [/^(?:cut|trim|split) (?:an? |my |the )?(?:mp3|audio|sound|song|music)(?: file)?$/i, 'cut mp3'],
  [/^(?:merge|join|combine) (?:mp3s?|audio|sounds?|songs?|music)(?: files?)?$/i, 'merge audio'],
  [/^(?:mix|blend|overlay) (?:mp3s?|audio|sounds?|songs?|music)(?: files?)?$/i, 'mix audio'],
  [/^(?:change|speed up|slow down) (?:the )?(?:gif|animated gif)(?: speed)?$|^gif speed(?: changer)?$/i, 'change gif speed'],
  [/^(?:remove|cut|delete|trim) (?:the )?silences? (?:from|in) (?:an? |my |the )?(?:audio|mp3|sound|recording)$|^silence remover$/i, 'remove silence from audio'],
  [/^(?:extract|get|rip|save) (?:the )?(?:audio|sound) (?:from|of) (?:an? |my |the )?(?:video|mp4|movie|clip)$|^video to (?:audio|sound)$/i, 'extract audio from video'],
  [/^(?:change|speed up|slow down) (?:the )?(?:audio|mp3|song|sound)(?: speed)?$|^(?:audio|mp3) speed(?: changer)?$/i, 'change audio speed'],
  [/^(?:increase|boost|raise|amplify) (?:the )?(?:mp3|audio|sound) volume$|^(?:make (?:an? |my |the )?)?(?:mp3|audio|sound) louder$|^volume booster$/i, 'increase mp3 volume'],
  [/^(?:add|put|insert) (?:an? )?(?:image|picture|photo|logo|signature) (?:to|on|in|into) (?:an? |my |the )?pdf$/i, 'add image to pdf'],
  [/^(?:extract|get|grab|save) (?:an? )?(?:image|picture|frame|still|screenshot) (?:from|of) (?:an? |my |the )?(?:video|mp4|movie|clip)$/i, 'extract image from video'],
  [/^(?:merge|join|combine|stitch) (?:images|pictures|photos|jpgs|pngs)$/i, 'merge images'],
];

/** the converter's address for an ask, or '' when the ask is not the converter's. Pure. */
export function converterAskOf(text) {
  const t = String(text || '').replace(/\s+/g, ' ').replace(/[?!.]+$/, '').trim(); if (!t || t.length > 80) return '';
  for (const [re, q] of TOOLS) if (re.test(t)) return '/converter/?q=' + encodeURIComponent(q);
  const m = FORMAT_TO.exec(t);
  if (m) return '/converter/?q=' + encodeURIComponent(((m[1] ? m[1] + ' ' : '') + 'to ' + m[2]).toLowerCase().replace(/^word /, 'docx ').replace(/ word$/, ' docx'));
  if (CONVERTER.test(t)) return '/converter/';
  return '';
}
