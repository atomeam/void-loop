// POST /api/appraise { image: data URL (PNG, JPEG or WebP, downsized by the page), note?: what the person typed }
// -> { seen, value: { kind, cents, text, says, expert, person }, text }. V01D values anything from a photo (frontier #30):
// the vision model (lib/models.js path 'vision', the site's own Workers AI binding) describes the photo, and lib/appraise-photo.js
// turns the description into V01D's valuation. The photo is read for this answer and dropped: nothing is stored or logged.
// People are never priced: a person in the photo, or an ask about one, gets a compliment (owner, 2026-10-15). 503 with no AI
// binding (a deploy without the model), 502 when the model does not answer, 400 for anything that is not a small image.
import { models, VISION_FALLBACK } from '../../lib/models.js';
import { valueFrom, appraisalText, isPersonAsk, complimentFor, VISION_PROMPT } from '../../lib/appraise-photo.js';

export const MAX_IMAGE_CHARS = 1100000; // base64 characters, about 800 KB: the page sends a 768 px JPEG, far under this
const IMAGE = /^data:image\/(?:png|jpeg|jpg|webp);base64,([A-Za-z0-9+/]+=*)$/;

/** the image bytes from a data URL, or null for anything else (wrong type, too big, not base64). Pure. */
export function imageBytes(dataUrl) {
  const m = IMAGE.exec(String(dataUrl || '').trim());
  if (!m || m[1].length > MAX_IMAGE_CHARS) return null;
  try { const bin = atob(m[1]); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; } catch (_) { return null; }
}

const said = (r) => String((r && (r.description || r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || (r.result && (r.result.description || r.result.response)))) || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
/** what the vision model sees: its description, or '' when it says nothing usable. The vision slot (Gemma 4) reads the photo as a
 * chat image; when it fails or says nothing, the beta image-to-text model gets the raw bytes. Throws only when both fail. */
export async function describe(env, bytes, dataUrl) {
  let first = null;
  try {
    const r = await env.AI.run(models('vision'), { messages: [{ role: 'user', content: [{ type: 'text', text: VISION_PROMPT }, { type: 'image_url', image_url: { url: dataUrl } }] }], max_tokens: 256, chat_template_kwargs: { enable_thinking: false } });
    const s = said(r); if (s) return s;
  } catch (e) { first = e; }
  try { return said(await env.AI.run(VISION_FALLBACK, { image: [...bytes], prompt: VISION_PROMPT, max_tokens: 256 })); }
  catch (e) { const m = (x) => String((x && x.message) || x || 'said nothing').replace(/\s+/g, ' ').slice(0, 80); throw new Error('vision: ' + m(first) + '; fallback: ' + m(e)); }
}

const json = (body, status = 200) => Response.json(body, { status });

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'send JSON: { image, note }' }, 400); }
  const note = String((body && body.note) || '').slice(0, 300);
  if (isPersonAsk(note)) { const v = { kind: 'person', cents: 0, text: '', says: [complimentFor(note, note.length)], expert: false, person: true }; return json({ seen: '', value: v, text: appraisalText(v) }); }
  const bytes = imageBytes(body && body.image);
  if (!bytes) return json({ error: 'a PNG, JPEG or WebP photo, under 800 KB' }, 400);
  if (!env || !env.AI) return json({ error: 'Verse cannot see photos from this deploy yet (no vision model bound)' }, 503);
  let seen = '';
  try { seen = await describe(env, bytes, String(body.image).trim()); } catch (e) { return json({ error: 'the vision model did not answer; try again in a moment', reason: String((e && e.message) || e).replace(/\s+/g, ' ').slice(0, 200) }, 502); }
  const value = valueFrom(seen, note);
  return json({ seen: value.person ? '' : seen, value, text: appraisalText(value) });
}
