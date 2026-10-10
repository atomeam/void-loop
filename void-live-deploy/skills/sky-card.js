/**
 * sky-card skill — frontier #21, sky PR C: "where is Jupiter", "is Venus up", "can I see Mars tonight", "where is the moon"
 * put one card on the stage for that thing in the sky: a short definition, a take on seeing it now whose every claim shows
 * its numbers, a "Right now" row (altitude, direction, distance, phase, next rise and set) and chips for the next ask.
 * All of it from skills/sky-card-rules.js (tests: tools/sky-card.test.mjs), for this minute and this place; the place is
 * the browser's location when it gives it, else a rough place from the time zone (as the sky world), and the card says so.
 */
import { bodyOf, card } from './sky-card-rules.js';
import { placeFromZone } from './night-sky.js';

/** what the ask means: null, or { key } for the body it names */
export function skyCardOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = /^(?:where(?:'s|\s+is)|where\s+can\s+i\s+(?:see|find))\s+(?:the\s+)?([a-z]+(?:\s[a-z]+)??)(?:\s+(?:tonight|now|right\s+now|in\s+the\s+sky))?$/.exec(t)
    || /^(?:is|can\s+i\s+see)\s+(?:the\s+)?([a-z]+(?:\s[a-z]+)?)\s+(?:up|out|visible)(?:\s+(?:tonight|now|right\s+now))?$/.exec(t)
    || /^can\s+i\s+see\s+(?:the\s+)?([a-z]+(?:\s[a-z]+)?)\s+(?:tonight|now|right\s+now)$/.exec(t)
    || /^when\s+does\s+(?:the\s+)?([a-z]+(?:\s[a-z]+)?)\s+(?:rise|set)(?:\s+(?:today|tonight))?$/.exec(t);
  if (!m) return null;
  const key = bodyOf(m[1]);
  return key ? { key } : null;
}

let place = null; // the place for this page: asked once, kept for the session
function placeNow() {
  if (place) return Promise.resolve(place);
  let zone = ''; try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) {}
  const rough = placeFromZone(zone, new Date().getTimezoneOffset());
  if (!navigator.geolocation) return Promise.resolve(place = rough);
  // never keep the ask waiting on a permission prompt: the rough place after 1.5 s, and the real one for the next ask once given
  return new Promise((res) => {
    const t = setTimeout(() => res(rough), 1500);
    navigator.geolocation.getCurrentPosition((p) => { place = { lat: p.coords.latitude, lonE: p.coords.longitude, rough: false }; clearTimeout(t); res(place); }, () => { clearTimeout(t); res(place = rough); }, { timeout: 60000, maximumAge: 600000 });
  });
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card sky-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(360px, calc(100vw - 20px))';
  const p = th.place || { lat: 45, lonE: 0, rough: true }, c = card(th.key, new Date(), p.lat, p.lonE);
  const head = document.createElement('div'); head.className = 'g-head';
  const title = document.createElement('span'); title.className = 'g-title'; title.textContent = c.title;
  const sub = document.createElement('span'); sub.className = 'g-sub'; sub.textContent = 'in the sky ' + (p.rough ? 'about here (from your time zone)' : 'here');
  head.append(title, sub);
  const def = document.createElement('div'); def.className = 'sky-definition'; def.style.cssText = 'margin:6px 0;color:var(--muted,#9a9aa2)'; def.textContent = c.definition;
  const tk = document.createElement('div'); tk.className = 'sky-take g-status'; tk.style.cssText = 'display:block;margin:8px 0;font-weight:600'; tk.textContent = c.take;
  const ev = document.createElement('details'); ev.className = 'sky-evidence';
  const sm = document.createElement('summary'); sm.textContent = 'the numbers behind it'; ev.appendChild(sm);
  const evl = document.createElement('div'); evl.style.cssText = 'color:var(--muted,#9a9aa2);font-size:13px'; evl.textContent = c.evidence.join(' · '); ev.appendChild(evl);
  const now = document.createElement('div'); now.className = 'sky-now'; now.style.cssText = 'margin-top:10px;display:grid;grid-template-columns:auto 1fr;gap:2px 10px';
  const nowH = document.createElement('div'); nowH.textContent = 'Right now'; nowH.style.cssText = 'grid-column:1/-1;font-weight:700;margin-bottom:2px';
  now.appendChild(nowH);
  for (const [k, v] of c.now) { const a = document.createElement('span'); a.style.color = 'var(--muted,#9a9aa2)'; a.textContent = k; const b = document.createElement('span'); b.textContent = v; now.append(a, b); }
  const chips = document.createElement('div'); chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:10px';
  for (const ask of c.chips) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn sky-chip'; b.textContent = ask;
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); if (stageApi.ask) stageApi.ask(ask); });
    chips.appendChild(b);
  }
  el.append(head, def, tk, ev, now, chips);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

async function run(text, api) {
  const q = skyCardOf(text);
  if (!q) return 'none';
  const p = await placeNow();
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'skycard' && t.key === q.key);
  if (existing) { existing.place = p; api.stage.save && api.stage.save(); api.stage.render(); if (api.stage.center) api.stage.center(existing.id); }
  else api.summon('skycard', { key: q.key, place: p, center: true });
  api.say(card(q.key, new Date(), p.lat, p.lonE).take);
  return 'skycard';
}

export default {
  name: 'skycard',
  skyCardOf,
  examples: ['where is jupiter', 'where is the moon tonight', 'is venus up', 'can i see mars tonight', 'where is sirius', 'when does the moon rise', 'where is the north star'],
  nearMisses: ['where is paris', 'is the store open', 'where is my phone', 'can i see you tonight', 'when does the store open', 'where is the moon landing site'],
  match(lower, text) { return !!skyCardOf(text); },
  run,
  stageKinds: { skycard: { mount } },
};
