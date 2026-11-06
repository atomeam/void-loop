/**
 * open-tool skill: a tool page asked for by its name ("word counter", "base converter", "open the piano", "go to the metronome") opens as a card
 * that links to the full page (2026-10-30: these asks fell to a topic article, and the page that does the job was one tap away but not offered).
 * The names are lib/toolkit.js allTools(), the same list /tools/ shows, so a new tool page is found the day it lands. A name of one word
 * ("gradient", "piano", "calculator") is a topic or another skill's ask, so it opens a tool only after open, show or go to. Last in the order:
 * every other skill is asked first. Made with tools/new-skill.mjs (docs/UPGRADING.md).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { allTools, toolNamed } from '../lib/toolkit.js';

// other names people type for a tool's page
// (2026-10-30: "time zone converter", "random number generator", "binary to decimal", "hex to rgb" and "online stopwatch" fell to an article)
const ALIASES = { 'character counter': '/word-count/', 'letter counter': '/word-count/', 'word count': '/word-count/', 'character count': '/word-count/', 'letter count': '/word-count/',
  'online timer': '/stopwatch/', 'countdown timer': '/stopwatch/', 'online stopwatch': '/stopwatch/', 'stopwatch online': '/stopwatch/',
  'time zone converter': '/time/', 'timezone converter': '/time/', 'time zone calculator': '/time/',
  'random number generator': '/random/', 'random number picker': '/random/', 'number generator': '/random/',
  'binary to decimal': '/base64/bases/', 'decimal to binary': '/base64/bases/', 'hex to decimal': '/base64/bases/', 'decimal to hex': '/base64/bases/',
  'binary to hex': '/base64/bases/', 'hex to binary': '/base64/bases/', 'binary converter': '/base64/bases/', 'number base converter': '/base64/bases/',
  'hex to rgb': '/color/', 'rgb to hex': '/color/', 'hex color converter': '/color/', 'color code converter': '/color/', 'colour code converter': '/color/',
  // the Lab's tools (2026-11-06: the owner found the Lab's experiments pointless; these are the jobs inside them)
  'spirit level': '/lab/level/', 'bubble level': '/lab/level/', 'level app': '/lab/level/', 'phone level': '/lab/level/', 'level tool': '/lab/level/',
  'sha256 checksum': '/lab/checksum/', 'checksum': '/lab/checksum/', 'file checksum': '/lab/checksum/', 'file hash': '/lab/checksum/', 'sha256 checker': '/lab/checksum/', 'md5 checker': '/lab/checksum/', 'verify sha256': '/lab/checksum/',
  'seamless pattern': '/lab/pattern/', 'tileable texture': '/lab/pattern/', 'seamless texture': '/lab/pattern/', 'pattern generator': '/lab/pattern/',
  'color palette from a photo': '/lab/photo-palette/', 'colour palette from a photo': '/lab/photo-palette/', 'palette from photo': '/lab/photo-palette/', 'color palette from image': '/lab/photo-palette/', 'colors from a photo': '/lab/photo-palette/',
  'speech to text': '/lab/dictation/', 'dictation': '/lab/dictation/', 'voice typing': '/lab/dictation/', 'voice to text': '/lab/dictation/', 'talk to type': '/lab/dictation/',
  'mind map': '/lab/mind-map/', 'mind map maker': '/lab/mind-map/', 'mindmap': '/lab/mind-map/', 'make a mind map': '/lab/mind-map/' };
const TOOL_NOUN = /\s(?:counter|converter|calculator|generator|checker|picker|maker|editor|tester|finder|timer|formatter|encoder|decoder|viewer)$/;
// pages whose own stage skill answers their name with a card that links the page (tools/skill-overlap.mjs): those asks stay there
const OWNED = new Set(['/calculator/', '/converter/', '/convert/', '/pdf/', '/photos/', '/stl/', '/cpan/', '/team/', '/random/wheel/', '/vat/']);
const OPEN = /^(?:open|show(?: me)?|go to|take me to|launch|bring up)\s+(?:the |my |a |an )?/i;

/** the tool an ask names, as { href, label }, or null. Pure. */
export function toolAsk(text) {
  // what it is for does not change the tool: "word counter for essay", "character counter for twitter" (2026-11-06: fell to an article)
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim()
    .replace(/ (?:for|in) (?:an? |my )?(?:essays?|school|college|homework|assignments?|papers?|twitter|tweets?|instagram|seo|work|students?)$/, '');
  if (!t || t.length > 60) return null;
  const opened = OPEN.test(t) || / (?:tool|page|app)$/.test(t), name = t.replace(OPEN, '').replace(/^(?:an? |the )?(?:online |free |simple )?/, '').replace(/ (?:tool|page|app)$/, '').trim();
  const alias = ALIASES[t.replace(OPEN, '')] || ALIASES[name];
  // a bare name with no verb must read as a tool ("word counter", "base converter"): a bare "wheel of names" or "piano" stays with its own skill
  if (!alias && (!name || (!opened && !TOOL_NOUN.test(name)))) return null;
  const href = alias || toolNamed(name);
  if (!href || OWNED.has(href)) return null;
  const label = (allTools().find(([p]) => p === href) || [href, name])[1];
  return { href, label };
}

function run(text, api) {
  const { showPage, esc } = api;
  const to = toolAsk(text);
  if (!to) return 'none';
  showPage((el) => {
    el.dataset.page = to.href; // the card's own page link opens the tool (lib/card-frame.js pageOfCard)
    el.innerHTML = '<h2>' + esc(to.label) + '</h2><p><a href="' + esc(to.href) + '">Open the ' + esc(to.label) + ' page</a>: the full tool, on this device.</p>'
      + '<div class="src">One of Verse\'s tool pages · <a href="/tools/">every tool</a></div>';
  });
  return 'open-tool';
}

export default {
  name: 'open-tool',
  examples: ['word counter', 'open the piano', 'base converter', 'go to the metronome', 'character counter', 'time zone converter', 'random number generator', 'binary to decimal'],
  nearMisses: ['gradient', 'piano', 'calculator', 'word counter for my essay hello world', 'open a bank account'],
  match(lower, text) { return !!toolAsk(text); },
  run
};
