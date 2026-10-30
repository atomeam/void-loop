/**
 * toolkit skill: "what tools do you have", "all tools" (owner, 2026-10-25: "and vice versa , should be a card for all too"): the tool pages as one
 * card on the stage, each a link to its full page, and the card itself links to /tools/. The list is lib/toolkit.js allTools() (TOOLS and
 * MORE_PAGES), the same pages /tools/ lists, so a new tool page shows up on both the day it lands. Made with tools/new-skill.mjs (docs/UPGRADING.md).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { allTools } from '../lib/toolkit.js';

const WHEN = /^(?:(?:what|which) tools (?:do you have|are there|can i use|)?|(?:show me |list )?(?:all|every|your) (?:the )?tools|every tool|show me your tools|tool list|list of tools|how many rolls of tape for .+)$/i; // only tape: "how many rolls of wallpaper", paint, tiles and drywall belong to walls and home (tools/skill-overlap.mjs)

function run(text, api) {
  const { showPage, esc } = api;
  // one chip per name, as /tools/ lists them (tools/seo-pages.mjs moreTools): a tool built twice for two sites (/convert/unit-converter/ and -2/) is one tool to a reader
  const seen = new Set();
  const list = allTools().filter(([, label]) => { const k = String(label).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  showPage((el) => {
    el.dataset.page = '/tools/';
    el.innerHTML = '<h2>' + list.length + ' tools</h2>' // void-review: ok: a fixed table, escaped
      + '<p style="display:flex;flex-wrap:wrap;gap:6px">' + list.map(([href, label]) => '<a href="' + esc(href) + '" style="display:inline-block;padding:5px 12px;border:1px solid #8884;border-radius:999px;text-decoration:none">' + esc(label) + '</a>').join('') + '</p>'
      + '<div class="src">Each is a full page that works on this device; ask any of them here too, like "flip a coin" or "100 c to f".</div>';
  });
  return 'toolkit';
}

export default {
  name: 'toolkit',
  examples: ['what tools do you have', 'all tools', 'every tool', 'show me your tools', 'how many rolls of tape for 200ft'],
  nearMisses: ['tool shed', 'what is a tool', 'power tools'],
  match(lower) { return WHEN.test(lower.trim().replace(/[?!.]+$/, '')); },
  run
};
