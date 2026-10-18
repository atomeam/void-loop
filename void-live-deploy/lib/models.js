// The one place a Workers AI model is named. Every path that calls a model asks for it here (models(path)), so trying
// another model on one path is one line, and a test (tools/models.test.mjs) fails if any other file names a model.
export const EMBED_MODEL = '@cf/baai/bge-m3';
export const CLEF_MODEL = '@cf/cloudflare/clef-flash'; // the decision model beside the router (lib/clef.js, frontier #9)
export const FREE_MODEL = '@cf/google/gemma-4-26b-a4b-it'; // the free chat model
export const PAID_MODEL = '@cf/deepseek-ai/deepseek-v4-flash-0731';
export const VISION_MODEL = FREE_MODEL; // the vision slot (frontier #30): Gemma 4 reads images (Cloudflare's recommended vision model, 2026-05); it describes a photo for V01D's appraiser (functions/api/appraise.js), free on the site's own binding
export const VISION_FALLBACK = '@cf/llava-hf/llava-1.5-7b-hf'; // beta image-to-text model, tried only when the vision slot does not answer

export const ART_MODEL = '@cf/black-forest-labs/flux-2-klein-4b'; // the Art Forge (functions/api/card-art.js): text-to-image, one picture per subject for ever, painted at the card's 16:9 art window (owner, 2026-10-18: "a really good free image generator capable of realistic epic cards"; ~100 neurons a picture, inside the free daily allowance at the 30 a day cap)
export const ART_FALLBACK = '@cf/black-forest-labs/flux-1-schnell'; // when klein fails: square only (no width or height), cropped into the window

// Which free model answers on which path. A path missing here uses FREE_MODEL.
export const PATH_MODELS = { answer: '@cf/openai/gpt-oss-120b', merge: FREE_MODEL, will: FREE_MODEL, review: '@cf/openai/gpt-oss-120b' /* the 2026-10-10 bake-off's winner: the closer read follows the verdict (operator) */, figurescript: FREE_MODEL, digest: FREE_MODEL, vision: VISION_MODEL, art: ART_MODEL };
export const PATHS = Object.keys(PATH_MODELS);

export function models(path) {
  if (!PATHS.includes(path)) throw new Error('unknown model path: ' + path);
  return PATH_MODELS[path] || FREE_MODEL;
}
