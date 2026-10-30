// The backdrop (owner, 2026-10-25: "a static, beautifully lit 2D painted scene with fixed camera angles ... swap pre-rendered backdrops depending on the
// rung or theme you're working on (a retro server room, a cyberpunk rooftop, or an atmospheric study) ... the heavy lifting is baked into the background
// image"). Pure: the asks (backdropOf), the record this browser keeps (sceneRecord, parseScene) and where a card's cast shadow goes (shadowRect).
// skills/backdrop.js owns the layer behind the stage and the shadows under the cards; the picture is painted once by the Art Forge (lib/art-rules.js
// backdropPrompt, functions/api/card-art.js kind 'backdrop').
export const STORE_KEY = 'a2m.void.backdrop.v1';
export const SRC_MAX = 1400040; // the forge's largest kept picture (lib/art-rules.js IMG_MAX) plus its data URL head
export const SHADOW = { dy: 18, blur: 16, alpha: 0.5 }; // a card's cast shadow: a little below it, soft, dark
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
// "remove my backdrop" (with "my") stays the Draw card's own ask, answered by the page (void.html handleLookAsk): only "the backdrop" and the bare forms are this skill's
const CLEAR_RE = /^(?:please\s+)?(?:(?:clear|remove|take off|drop|no more|hide|turn off)\s+(?:the\s+)?(?:backdrop|scene|stage backdrop|painted (?:backdrop|scene))|plain (?:void|verse|stage)|back to the void|(?:backdrop|scene):\s*(?:none|off|clear))$/;
// "the background" is the stage-style skill's word (a colour: "set the background to #112233"); a scene is the stage, the scene or the backdrop
const SET_RE = /^(?:please\s+)?(?:(?:set|make|turn|change|switch|put|paint)\s+(?:the\s+)?(?:stage|scene|backdrop)\s+(?:to|into|as|of|with)\s+|(?:stage|backdrop|scene|set the scene):\s*|(?:paint|give me|i want)\s+(?:a|the)\s+(?:backdrop|scene|stage)\s+(?:of|with)\s+)(.+)$/;
const NOT = /^(?:my drawing|this drawing|it|this|that|the drawing|my (?:void|verse)|none|nothing|off|a card|the card)$/;

/** { clear: true } | { subject } | null for an ask. "make it my backdrop" (the Draw card's own ask) and plain words about backdrops are never it. Pure. */
export function backdropOf(text) {
  const t = CLEAN(text);
  if (!t) return null;
  if (CLEAR_RE.test(t)) return { clear: true };
  const m = SET_RE.exec(t); if (!m) return null;
  const subject = m[1].replace(/^(?:a|an|the|some)\s+/, '').replace(/\s+(?:please|for me|scene|backdrop)$/, '').trim();
  if (!subject || NOT.test(subject) || subject.length > 60) return null;
  return { subject };
}

const DATA_IMG = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
/** what this browser keeps: the painted picture (a data URL from the forge), the scene's name and the ask. Pure. */
export function sceneRecord({ src = '', subject = '', ask = '' } = {}) {
  const s = typeof src === 'string' && src.length <= SRC_MAX && DATA_IMG.test(src) ? src : '';
  return { v: 1, src: s, subject: String(subject || '').replace(/[^a-z0-9 '-]/gi, '').trim().slice(0, 60), ask: String(ask || '').slice(0, 80) };
}
/** the kept record, or null when there is none, it is not ours, or it has no picture. Pure. */
export function parseScene(raw) {
  try { const j = JSON.parse(raw || 'null'); if (!j || j.v !== 1) return null; const r = sceneRecord(j); return r.src ? r : null; } catch (_) { return null; }
}

/** where a card at (x, y, w, h) casts its shadow on the painted floor: the same box, SHADOW.dy lower. Pure. */
export function shadowRect({ x = 0, y = 0, w = 0, h = 0 } = {}) {
  return { x: Math.round(x), y: Math.round(y + SHADOW.dy), w: Math.max(0, Math.round(w)), h: Math.max(0, Math.round(h)) };
}
