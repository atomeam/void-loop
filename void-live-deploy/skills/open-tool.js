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
  // the colour page's modes (owner, 2026-11-03: the colour pages are one page, /color/?mode=)
  'color picker': '/color/?mode=picker', 'colour picker': '/color/?mode=picker', 'eyedropper': '/color/?mode=picker', 'eye dropper': '/color/?mode=picker',
  'color picker from image': '/color/?mode=picker', 'colour picker from image': '/color/?mode=picker', 'image color picker': '/color/?mode=picker', 'image colour picker': '/color/?mode=picker',
  'palette generator': '/color/?mode=palette', 'color palette generator': '/color/?mode=palette', 'colour palette generator': '/color/?mode=palette', 'color scheme generator': '/color/?mode=palette', 'colour scheme generator': '/color/?mode=palette',
  'random color generator': '/color/?mode=random', 'random colour generator': '/color/?mode=random', 'random hex generator': '/color/?mode=random',
  'gradient generator': '/color/?mode=gradient', 'css gradient generator': '/color/?mode=gradient', 'gradient maker': '/color/?mode=gradient', 'gradient editor': '/color/?mode=gradient',
  'contrast checker': '/color/?mode=contrast', 'color contrast checker': '/color/?mode=contrast', 'colour contrast checker': '/color/?mode=contrast', 'wcag contrast checker': '/color/?mode=contrast',
  'shade generator': '/color/?mode=shades', 'tint generator': '/color/?mode=shades', 'color shades generator': '/color/?mode=shades', 'tailwind color generator': '/color/?mode=shades',
  'color blindness simulator': '/color/?mode=blindness', 'colour blindness simulator': '/color/?mode=blindness', 'color blind simulator': '/color/?mode=blindness', 'colour blind simulator': '/color/?mode=blindness' };
// the names those modes go by on their card
const MODE_LABEL = { picker: 'Colour picker', palette: 'Palette generator', random: 'Random colour', gradient: 'CSS gradient', contrast: 'Contrast checker', shades: 'Shades and tints', blindness: 'Colour-blind view' };
const TOOL_NOUN = /\s(?:counter|converter|calculator|generator|checker|picker|maker|editor|tester|finder|timer|formatter|encoder|decoder|viewer)$/;
// pages whose own stage skill answers their name with a card that links the page (tools/skill-overlap.mjs): those asks stay there
const OWNED = new Set(['/calculator/', '/converter/', '/convert/', '/pdf/', '/photos/', '/stl/', '/cpan/', '/team/', '/random/wheel/', '/vat/']);
const OPEN = /^(?:open|show(?: me)?|go to|take me to|launch|bring up)\s+(?:the |my |a |an )?/i;

/** the tool an ask names, as { href, label }, or null. Pure. */
export function toolAsk(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 60) return null;
  const opened = OPEN.test(t) || / (?:tool|page|app)$/.test(t), name = t.replace(OPEN, '').replace(/^(?:an? |the )?(?:online |free |simple )?/, '').replace(/ (?:tool|page|app)$/, '').trim();
  const alias = ALIASES[t.replace(OPEN, '')] || ALIASES[name];
  // a bare name with no verb must read as a tool ("word counter", "base converter"): a bare "wheel of names" or "piano" stays with its own skill
  if (!alias && (!name || (!opened && !TOOL_NOUN.test(name)))) return null;
  const href = alias || toolNamed(name);
  if (!href || OWNED.has(href)) return null;
  const mode = /^\/color\/\?mode=(\w+)$/.exec(href);
  const label = mode ? MODE_LABEL[mode[1]] : (allTools().find(([p]) => p === href) || [href, name])[1];
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
  examples: ['word counter', 'open the piano', 'base converter', 'go to the metronome', 'character counter', 'time zone converter', 'random number generator', 'binary to decimal', 'color picker', 'contrast checker'],
  nearMisses: ['gradient', 'piano', 'calculator', 'word counter for my essay hello world', 'open a bank account'],
  match(lower, text) { return !!toolAsk(text); },
  run
};
