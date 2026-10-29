/**
 * ai-sites: the pages of two Versus floors, one table (the rows live in lib/tool-sites.js, which lib/toolkit.js already reads) (owner, 2026-10-26: every tower site gets its own page; easiest first; have everything the sites
 * have; use the sites as well as beat them). "ai models" (Hugging Face) has /models/ and a page under it for each site of its lane; "assistant" (Claude)
 * has /assistant/ and a page under it for each of its. tools/ai-pages.mjs writes the pages from these rows; lib/toolkit.js (TOOLS, RELATED, CARD_ASK),
 * lib/seo.js (PAGES) and lib/card-frame.js (PAGE_OF) read the same rows, so a page is added in one place. `lane` names the tower floor the row answers
 * (lib/tower.js LANE_PAGES); Verse's pages name no other site except to credit data they read from it. Pure data.
 */
export { MODEL_SITES, ASSISTANT_SITES, AI_SITES, aiSiteOf, aiAskOf } from './tool-sites.js';

// The models Verse can run for free, as a model hub names them (the Workers AI name of each is in lib/models.js TRY_MODELS, the one place a model is named):
// key -> the hub repository it is a build of, and the name a person reads. Pure data.
export const TRY = Object.freeze([
  { key: 'verse', hub: 'google/gemma-4-26b-a4b-it', label: 'Gemma 4 (26B, mixture of experts)', size: 26e9 },
  { key: 'oss120', hub: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', size: 117e9 },
  { key: 'oss20', hub: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B', size: 21e9 },
  { key: 'llama8', hub: 'meta-llama/Llama-3.1-8B-Instruct', label: 'Llama 3.1 8B Instruct', size: 8e9 },
  { key: 'llama3', hub: 'meta-llama/Llama-3.2-3B-Instruct', label: 'Llama 3.2 3B Instruct', size: 3.2e9 },
  { key: 'mistral24', hub: 'mistralai/Mistral-Small-3.1-24B-Instruct-2503', label: 'Mistral Small 3.1 24B', size: 24e9 },
  { key: 'qwencoder', hub: 'Qwen/Qwen2.5-Coder-32B-Instruct', label: 'Qwen 2.5 Coder 32B', size: 32.8e9 },
]);
export const TRY_KEYS = Object.freeze(TRY.map((x) => x.key));
/** the free model that runs a hub repository (case aside), or null. Pure. */
export const tryOf = (hubId) => TRY.find((x) => x.hub.toLowerCase() === String(hubId || '').toLowerCase()) || null;
