// The one place a Workers AI model is named. Every path that calls a model asks for it here (models(path)), so trying
// another model on one path is one line, and a test (tools/models.test.mjs) fails if any other file names a model.
export const EMBED_MODEL = '@cf/baai/bge-m3';
export const FREE_MODEL = '@cf/google/gemma-4-26b-a4b-it'; // the free chat model
export const PAID_MODEL = '@cf/deepseek-ai/deepseek-v4-flash-0731'; // needs a paid billing method: only from earnings, under an approved standing spend

// Which free model answers on which path. A path missing here uses FREE_MODEL.
export const PATH_MODELS = { answer: '@cf/openai/gpt-oss-120b', will: FREE_MODEL, review: '@cf/openai/gpt-oss-120b' /* the 2026-10-10 bake-off's winner: the closer read follows the verdict (operator) */, figurescript: FREE_MODEL };
export const PATHS = Object.keys(PATH_MODELS);

export function models(path) {
  if (!PATHS.includes(path)) throw new Error('unknown model path: ' + path);
  return PATH_MODELS[path] || FREE_MODEL;
}
