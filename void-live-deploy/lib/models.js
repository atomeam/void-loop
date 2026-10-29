// The one place a Workers AI model is named. Every path that calls a model asks for it here (models(path)), so trying
// another model on one path is one line, and a test (tools/models.test.mjs) fails if any other file names a model.
export const EMBED_MODEL = '@cf/baai/bge-m3';
export const CLEF_MODEL = '@cf/cloudflare/clef-flash'; // the decision model beside the router (lib/clef.js, frontier #9)
export const FREE_MODEL = '@cf/google/gemma-4-26b-a4b-it'; // the free chat model
export const PAID_MODEL = '@cf/deepseek-ai/deepseek-v4-flash-0731';
export const VISION_MODEL = FREE_MODEL; // the vision slot (frontier #30): Gemma 4 reads images (Cloudflare's recommended vision model, 2026-05); it describes a photo for Verse's appraiser (functions/api/appraise.js), free on the site's own binding
export const VISION_FALLBACK = '@cf/llava-hf/llava-1.5-7b-hf'; // beta image-to-text model, tried only when the vision slot does not answer

export const ART_MODEL = '@cf/black-forest-labs/flux-2-klein-4b'; // the Art Forge (functions/api/card-art.js): text-to-image, one picture per subject for ever, painted at the card's 16:9 art window (owner, 2026-10-18: "a really good free image generator capable of realistic epic cards"; ~100 neurons a picture, inside the free daily allowance at the 30 a day cap)
export const ART_FALLBACK = '@cf/black-forest-labs/flux-1-schnell'; // when klein fails: square only (no width or height), cropped into the window
export const TRANSLATE_MODEL = '@cf/meta/m2m100-1.2b'; // the translator (functions/api/translate.js, the tower's Google Translate floor): Meta's many-to-many model, 100 languages, input { text, source_lang, target_lang } (two-letter codes), output { translated_text }

// Which free model answers on which path. A path missing here uses FREE_MODEL.
// answers run on the free model (owner's wishlist #1, docs/wishlist.md; asked by Verse, 2026-10-24: "migrate answer generation from gpt-oss-120b to gemma"):
// gemma-4-26b-a4b spends a fraction of gpt-oss-120b's neurons an answer, so the free 10k a day holds; the bake-off's winner stays the second try
export const ANSWER_FALLBACK = '@cf/openai/gpt-oss-120b';
export const PATH_MODELS = { answer: FREE_MODEL, merge: FREE_MODEL, will: FREE_MODEL, review: '@cf/openai/gpt-oss-120b' /* the 2026-10-10 bake-off's winner: the closer read follows the verdict (operator) */, figurescript: FREE_MODEL, digest: FREE_MODEL, vision: VISION_MODEL, art: ART_MODEL, translate: TRANSLATE_MODEL };
export const PATHS = Object.keys(PATH_MODELS);

// Verse's own coding agent (tools/verse-agent.mjs, docs/brains.md; owner, 2026-10-26: "build verse so that it can"): only models the Workers Free
// plan serves (checked 2026-10-26 against the model pages and the 2026-07-28 changelog, which moved kimi-k2.6/k2.7-code and glm-5.2 to Workers
// Paid; glm-5.3-flash and the deepseek-v4 models are paid too). `fast` takes the small steps (find a path, read, one-hunk edit), `strong` the
// plan and every repair after a failed test; each list is tried in order, the next on an error. Neurons per million tokens [input, output]
// from the pricing page (2026-10-20), so the agent stops before it spends past its cap. Paid models wait for STANDING.md's earnings budget.
export const AGENT_MODELS = {
  fast: ['@cf/zai-org/glm-4.7-flash', '@cf/qwen/qwen3-30b-a3b-fp8', '@cf/openai/gpt-oss-120b'],
  strong: ['@cf/openai/gpt-oss-120b', '@cf/nvidia/nemotron-3-120b-a12b', '@cf/zai-org/glm-4.7-flash'],
};
export const AGENT_NEURONS = {
  '@cf/zai-org/glm-4.7-flash': [5500, 36400],
  '@cf/qwen/qwen3-30b-a3b-fp8': [4625, 30475],
  '@cf/openai/gpt-oss-120b': [31818, 68182],
  '@cf/nvidia/nemotron-3-120b-a12b': [45455, 136364],
};

export function models(path) {
  if (!PATHS.includes(path)) throw new Error('unknown model path: ' + path);
  return PATH_MODELS[path] || FREE_MODEL;
}
