/**
 * ai-pages skill - made with tools/new-skill.mjs (docs/UPGRADING.md); owner, 2026-10-26: every tower site gets its own page. "browse ai models", "llm leaderboard",
 * "run an llm locally", "ai model prices", "ai model arena", "chat with verse", "private ai chat", "answer with sources" answer with a card that opens the page
 * that does it (lib/ai-sites.js aiAskOf, the same asks the tool pages' ask bar routes, and each page's own stage ask). Nothing is made here: the pages read
 * the model hub live and chat on Verse's free models. Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { AI_SITES, aiAskOf } from '../lib/ai-sites.js';
const CARD = Object.fromEntries(AI_SITES.map((r) => [r.card, r.path]));
const pageOf = (t) => { const s = String(t || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' '); return CARD[s] || aiAskOf(s); };
function run(text, api) {
  const { showPage, esc } = api, to = pageOf(text) || '/models/', models = to.startsWith('/models/'), rows = AI_SITES.filter((r) => r.path.startsWith(models ? '/models/' : '/assistant/'));
  showPage((el) => {
    el.dataset.page = to.replace(/\?.*$/, '');
    el.innerHTML = '<h2>' + (models ? 'AI models' : 'Assistant') + '</h2><p>' + (models // void-review: ok: fixed text and escaped table rows
      ? 'Open models and datasets read live from a public model hub, with filters, model cards, a side-by-side comparison, licences explained and a free try of the models Verse can run.'
      : 'Chat on Verse\'s free open model: your chats stay on your device, with templates, text tools, export and a share link. A smaller model than the biggest assistants, with a daily free limit, and it says so.') + '</p>'
      + '<p><a href="' + esc(to) + '" style="font-weight:600">Open the page →</a></p><ul style="padding-left:18px;margin:6px 0">' + rows.map((r) => '<li><a href="' + esc(r.path) + '">' + esc(r.name) + '</a>: ' + esc(r.does.split(/[:.]/)[0]) + '</li>').join('') + '</ul>' // void-review: ok: fixed text and escaped
      + '<div class="src">Made by Verse</div>';
  });
  return 'ai-pages';
}
export default {
  name: 'ai-pages',
  examples: ['browse ai models', 'llm leaderboard', 'chat with verse', 'private ai chat', 'run an llm locally', 'ai model prices', 'ai model arena', 'answer with sources'],
  nearMisses: ['what is an ai model', 'make a 3d model', 'who made you', 'write a poem'],
  match(lower) { return !!pageOf(lower); },
  run,
};
