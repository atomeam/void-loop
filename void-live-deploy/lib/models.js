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
export const VOICE_MODEL = '@cf/myshell-ai/melotts'; // Verse's rapping voice (functions/api/rapvoice.js; owner, 2026-10-30: "improve verse spoken voice so it sound good rapping"): MyShell's MeloTTS, text in ({ prompt, lang }), MP3 out; about 19 neurons an audio minute, the cheapest speech model on Workers AI, so a rap's bars fit the free daily allowance
export const TRANSLATE_MODEL = '@cf/meta/m2m100-1.2b'; // the translator (functions/api/translate.js, the tower's Google Translate floor): Meta's many-to-many model, 100 languages, input { text, source_lang, target_lang } (two-letter codes), output { translated_text }

// The studio (lib/studio.js, functions/api/studio.js; owner, 2026-10-30: "we should have the best of everything"): every image model Verse can paint
// with on its own binding, by a short name, and how each is asked. 'multipart' takes form fields (prompt, width, height, seed, steps); 'json' takes
// { prompt, width, height, seed, num_steps, guidance }. The bench paints the same reference prompts with each, Verse's vision model judges every
// picture, and the best one for the neurons becomes the painter (lib/studio.js championOf). Costs are in lib/studio.js NEURONS.
export const IMAGE_MODELS = Object.freeze({
  'klein-4b': Object.freeze({ id: ART_MODEL, ask: 'multipart' }),
  'klein-9b': Object.freeze({ id: '@cf/black-forest-labs/flux-2-klein-9b', ask: 'multipart' }),
  'flux-2-dev': Object.freeze({ id: '@cf/black-forest-labs/flux-2-dev', ask: 'multipart', steps: 20 }),
  schnell: Object.freeze({ id: ART_FALLBACK, ask: 'json', steps: 6, square: true }),
  'lucid-origin': Object.freeze({ id: '@cf/leonardo/lucid-origin', ask: 'json', steps: 20, guidance: 4.5 }),
  'phoenix-1': Object.freeze({ id: '@cf/leonardo/phoenix-1.0', ask: 'json', steps: 25, guidance: 3 }),
  'sdxl-lightning': Object.freeze({ id: '@cf/bytedance/stable-diffusion-xl-lightning', ask: 'json', steps: 8 }),
});
// The studio's video makers: partner models on the same binding (no open-weight video model is hosted on Workers AI, 2026-10-30), billed in
// dollars a second through Cloudflare's unified billing, never in the free neurons; prices in lib/studio.js VIDEO_PRICES.
export const VIDEO_MODELS = Object.freeze({ 'p-video': 'pruna/p-video', 'ltx-fast': 'lightricks/ltx-2-5-fast' });

// Which free model answers on which path. A path missing here uses FREE_MODEL.
// answers run on the free model (owner's wishlist #1, docs/wishlist.md; asked by Verse, 2026-10-24: "migrate answer generation from gpt-oss-120b to gemma"):
// gemma-4-26b-a4b spends a fraction of gpt-oss-120b's neurons an answer, so the free 10k a day holds; the bake-off's winner stays the second try
export const ANSWER_FALLBACK = '@cf/openai/gpt-oss-120b';
export const PATH_MODELS = { answer: FREE_MODEL, merge: FREE_MODEL, will: FREE_MODEL, review: '@cf/openai/gpt-oss-120b' /* the 2026-10-10 bake-off's winner: the closer read follows the verdict (operator) */, figurescript: FREE_MODEL, digest: FREE_MODEL, vision: VISION_MODEL, art: ART_MODEL, translate: TRANSLATE_MODEL, voice: VOICE_MODEL, coder: FREE_MODEL /* Verse's coder on the site's own binding (functions/api/coder.js) */ };
export const PATHS = Object.keys(PATH_MODELS);

export function models(path) {
  if (!PATHS.includes(path)) throw new Error('unknown model path: ' + path);
  return PATH_MODELS[path] || FREE_MODEL;
}
