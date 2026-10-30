/**
 * appraise skill — Verse values anything from a photo (frontier #30; owner, 2026-10-15: "the coin, card, value appraisal system
 * which needs image viewing capabilities", "an image should value all items if asked", "Verse can decide, it's an appraiser").
 * "what is this worth", "value this", "appraise this coin", "how much is my watch worth", "how much could I sell this for": a
 * card that takes one photo (the camera on a phone), downsizes it in the browser, and asks /api/appraise; Verse says what it
 * sees and gives one value, the details that moved it, and when an expert in hand is needed. The photo is sent once for that
 * answer and never kept. People are never priced: "what am I worth", or a person in the photo, gets a compliment and no number.
 */
import { isPersonAsk, complimentFor, makeableIn } from '../lib/appraise-photo.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const THING = "(?:(?:this|that|these|those|my|our|an?|the) [a-z]+(?: [a-z]+)?|this|that|it|these|those)";
const ASK_RE = new RegExp('^(?:hey |yo |please |(?:verse|v01d) |(?:verse|void) )?(?:'
  + "what(?:'s| is| are) " + THING + ' worth'
  + '|how much (?:is|are) ' + THING + ' worth'
  + '|how much (?:could|can|would|should) i (?:sell|get for|ask for|list) ' + THING + '(?: for)?'
  + '|(?:value|appraise|price|evaluate) ' + THING
  + '|(?:an? )?(?:appraisal|valuation)(?: (?:of|for) ' + THING + ')?'
  + '|is ' + THING + ' (?:worth anything|worth something|valuable|rare)'
  + '|what am i worth|how much am i worth|value me|appraise me'
  + ')$', 'i');
// not a photo valuation: money words, abstractions, "worth it"
const NOT = /\b(dollar|euro|pound|yen|bitcoin|crypto|stock|share|company|house|home|land|salary|time|life|degree|worth it|worthwhile|a stamp cost|postage|pi|gold price|silver price|per ounce|exchange rate)\b/i;

/** { person } for an ask about a person's worth, { photo: true } for a valuation ask, else null. Pure. */
export function appraiseOf(text) {
  const t = CLEAN(text);
  if (isPersonAsk(t)) return { person: true };
  if (!ASK_RE.test(t) || NOT.test(t)) return null;
  return { photo: true };
}

// the photo, downsized in the browser (768 px on its long side, JPEG) so the upload is small and nothing identifying beyond the item travels
async function shrink(file, max = 768) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.82);
}

async function run(text, api) {
  const q = appraiseOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  if (q.person) {
    showPage((p) => { p.innerHTML = '<h2>What you are worth</h2><p>' + esc(complimentFor('', String(text || '').length)) + '</p><div class="src">Verse values coins, cards and chairs. Never people.</div>'; });
    return 'appraise';
  }
  const el = showPage((p) => {
    p.innerHTML = '<h2>What is it worth?</h2><div class="sub">Show me one photo: I say what I see and what I value it at. The photo is read once for this answer and never kept.</div>'
      + '<p><input type="file" accept="image/*" capture="environment" data-ap-file aria-label="Choose or take a photo"></p>'
      + '<p><input type="text" data-ap-note maxlength="300" placeholder="Anything you know: maker, year, size (optional)" aria-label="What you know about it" style="width:100%;font:inherit;background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:6px 8px"></p>'
      + '<div data-ap-out aria-live="polite"></div>'
      + '<div class="src">An estimate from a photo, never a certified appraisal or an authentication. People are never priced.</div>';
  });
  const out = el.querySelector('[data-ap-out]'), file = el.querySelector('[data-ap-file]');
  file.addEventListener('pointerdown', (e) => e.stopPropagation());
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0]; if (!f) return;
    out.innerHTML = '<p>Looking…</p>';
    try {
      const image = await shrink(f), note = el.querySelector('[data-ap-note]').value.trim();
      const r = await fetch('/api/appraise', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image, note }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { out.innerHTML = '<p>' + esc(j.error || 'That did not work just now. Try again in a moment.') + '</p>'; return; }
      const v = j.value || {};
      out.innerHTML = (v.person ? '<p class="ap-person">' + esc(j.text) + '</p>'
        : '<div style="font-size:40px;font-weight:300;line-height:1.1;margin:8px 0 4px" class="ap-value">' + esc(v.text || '') + '</div><p class="ap-text">' + esc(j.text || '') + '</p>')
        + (Array.isArray(j.heard) && j.heard.length ? '<p class="sub ap-heard">' + j.heard.map(esc).join('<br>') + '</p>' : '') // what Verse heard on TV about things like this (functions/api/watchalong.js)
        + (j.seen ? '<p class="sub ap-seen">What I saw: ' + esc(j.seen) + '</p>' : '');
      // what Verse saw is a thing its forge can model: one tap makes it (asked by Verse, ask-20261015-2008-1); the mesher loads only then
      if (!v.person && j.seen) import('./forge-rules.js').then((F) => {
        const m = makeableIn(j.seen, F.THINGS); if (!m || !out.isConnected) return;
        const line = document.createElement('p'), a = document.createElement('a');
        line.className = 'ap-make'; a.href = '#'; a.dataset.ask = m.ask; a.textContent = m.ask;
        line.append('I can make one of these: ', a, ', a model you can turn and an STL you can print.'); out.appendChild(line);
      }).catch(() => {});
    } catch (_) { out.innerHTML = '<p>I could not read that photo. Try a JPEG or PNG.</p>'; }
  });
  return 'appraise';
}

export default {
  name: 'appraise',
  examples: ['what is this worth', 'value this', 'appraise this coin', 'how much is my watch worth', 'how much could I sell this for', 'what am I worth'],
  nearMisses: ['what is the dollar worth', 'is it worth it', 'how much is a stamp', 'value of pi', 'what is my time worth', 'gold price today'],
  appraiseOf,
  match(lower, text) { return !!appraiseOf(text); },
  run,
};
