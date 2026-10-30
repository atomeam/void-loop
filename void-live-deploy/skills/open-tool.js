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
const ALIASES = { 'character counter': '/word-count/', 'letter counter': '/word-count/', 'word count': '/word-count/', 'online timer': '/stopwatch/', 'countdown timer': '/stopwatch/' };
const OPEN = /^(?:open|show(?: me)?|go to|take me to|launch|bring up)\s+(?:the |my |a |an )?/i;

/** the tool an ask names, as { href, label }, or null. Pure. */
export function toolAsk(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 60) return null;
  const opened = OPEN.test(t), name = t.replace(OPEN, '').replace(/^(?:an? |the )?(?:online |free |simple )?/, '').replace(/ (?:tool|page|app)$/, '').trim();
  const alias = ALIASES[t.replace(OPEN, '')] || ALIASES[name];
  if (!alias && (!name || (!opened && !/ /.test(name)))) return null;
  const href = alias || toolNamed(name);
  if (!href) return null;
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
  examples: ['word counter', 'open the piano', 'base converter', 'go to the metronome', 'character counter'],
  nearMisses: ['gradient', 'piano', 'calculator', 'word counter for my essay hello world', 'open a bank account'],
  match(lower, text) { return !!toolAsk(text); },
  run
};
