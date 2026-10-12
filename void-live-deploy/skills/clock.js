/**
 * clock skill — the clock on the stage: "make a clock", "a big red clock", "make the clock bigger", "24 hour", "hide
 * seconds", "bold", "remove the clock". The brass desk clock beside it keeps the same time (skills/mini/clock.js). It is
 * the page's last word: an alter nothing else took ("make it blue" on an empty stage) makes a clock and applies it.
 * Moved out of void.html in cleanup step 6. The page asks `askRemove` and `ask` (create) where the clock code ran, and
 * runs its own last branch with `ensure` and its shared targeting (stageApi.alterThing: this kind's `alter` words, then
 * colour, then position), as before.
 */

/** the ask makes a clock (with any colour, size or format in the same words). Pure. */
export function wantsCreate(lower) {
  if (/\b(remove|delete|get rid|hide|clear the clock)\b/.test(lower)) return false;
  if (/^(a\s+)?clock(\s+please)?\s*[.!]?\s*$/.test(lower)) return true;
  if (/\b(i\s+want|i'd\s+like|i\s+need|give\s+me|can\s+i\s+have|could\s+i\s+have)\b.*\bclock\b/.test(lower)) return true;
  if (/\b(make|add|create|show|spawn|put|place|drop)\b.*\bclock\b/.test(lower)) return true;
  if (/\bclock\b.*\b(please|here|on\s+(the\s+)?(stage|screen|page))\b/.test(lower)) return true;
  if (/\b(blue|red|green|yellow|white|black|purple|orange|pink|gray|grey|gold|cyan|teal|#(?:[0-9a-f]{3}|[0-9a-f]{6}))\s+clock\b/.test(lower)) return true;
  if (/\b(big|large|huge|giant|small|tiny|little)\s+clock\b/.test(lower)) return true;
  return false;
}

/** "remove the clock", "the clock, gone", and "remove it" (as it always was). Pure. */
export const wantsRemove = (lower) => /\b(remove|delete|get\s+rid\s+of|hide|clear)\b.*\b(clock|it|this)\b/.test(lower)
  || /\b(clock)\b.*\b(away|gone)\b/.test(lower)
  || /^(remove|delete|get\s+rid\s+of|hide)\s+(it|this)\s*[.!]?\s*$/.test(lower);

/** the plain asks the skill takes before the page's own parser: a clock by itself ("clock", "make a clock", "give me a
 *  clock"). A world clock, a clock in a city, colours and sizes go on to the page and the other skills, as before. Pure. */
export const plainClock = (lower) => /^(?:please\s+)?(?:(?:make|add|show|give\s+me|put\s+up)\s+(?:me\s+)?)?(?:a\s+|the\s+)?clock(?:\s+please)?\s*[.!]?$/.test(lower);

/** its own words, asked by the page's shared targeting before colour and position: sizes, 12/24 hour, the date, seconds,
 *  bold */
export function alter(c, lower) {
  let ok = false;
  if (/\b(bigger|larger|increase|grow|enlarge)\b/.test(lower)) { c.size = Math.min(200, (c.size || 56) + 16); ok = true; }
  if (/\b(smaller|tinier|decrease|shrink)\b/.test(lower)) { c.size = Math.max(16, (c.size || 56) - 16); ok = true; }
  if (/\b(huge|giant|enormous|massive)\b/.test(lower)) { c.size = 120; ok = true; }
  if (/\b(tiny|mini|petite)\b/.test(lower)) { c.size = 22; ok = true; }
  if (/\b(big|large)\b/.test(lower) && !/\bbigger\b|\blarger\b/.test(lower)) { c.size = Math.max(c.size || 56, 96); ok = true; }
  if (/\b(small|little)\b/.test(lower) && !/\bsmaller\b/.test(lower)) { c.size = Math.min(c.size || 56, 28); ok = true; }
  if (/\b(24\s*-?\s*h(our)?s?|24h|military(\s+time)?)\b/.test(lower)) { c.format = '24h'; ok = true; }
  if (/\b(12\s*-?\s*h(our)?s?|12h|am\s*\/?\s*pm)\b/.test(lower)) { c.format = '12h'; ok = true; }
  if (/\b(show\s+date|with\s+date|date\s*time|datetime|full\s+date)\b/.test(lower)) { c.format = 'date'; ok = true; }
  if (/\b(hide\s+seconds|no\s+seconds|without\s+seconds)\b/.test(lower)) { c.seconds = false; ok = true; }
  if (/\b(show\s+seconds|with\s+seconds)\b/.test(lower)) { c.seconds = true; ok = true; }
  if (/\bbold\b/.test(lower)) { c.bold = true; ok = true; }
  if (/\b(unbold|not\s+bold|normal\s+weight)\b/.test(lower)) { c.bold = false; ok = true; }
  return ok;
}

/** the time as the clock shows it: 12 hour (the default), 24 hour, or the date and time. */
export function faceText(c, now = new Date()) {
  if (c.format === '24h') return now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: c.seconds ? '2-digit' : undefined });
  if (c.format === 'date') return now.toLocaleString();
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: c.seconds ? '2-digit' : undefined });
}

const clocks = (stageApi) => Object.values(stageApi.things()).filter((t) => t && t.kind === 'clock');

/** the first clock, or a new one (picked when new) */
export function ensure(stageApi) {
  let clock = clocks(stageApi)[0];
  if (!clock) {
    const st = stageApi.stage;
    clock = { id: 'clock_' + Math.random().toString(36).slice(2, 9), kind: 'clock',
      x: Math.max(40, (st.clientWidth || 800) / 2 - 80), y: Math.max(40, (st.clientHeight || 600) / 2 - 40),
      size: 56, color: '#e8e8e8', format: '12h', seconds: true, bold: false };
    stageApi.things()[clock.id] = clock;
    stageApi.select(clock.id);
  }
  return clock;
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing clock';
  el.dataset.id = th.id;
  el.style.left = th.x + 'px';
  el.style.top = th.y + 'px';
  el.style.fontSize = (th.size || 48) + 'px';
  el.style.color = th.color || '#e8e8e8';
  el.style.fontFamily = th.font || 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  if (th.bold) el.style.fontWeight = '600';
  if (stageApi.selected() === th.id) el.style.outline = '1px solid rgba(255,255,255,0.25)';
  const face = document.createElement('span'); // the time lives in its own span, so the 3D clock beside it survives each tick
  el.appendChild(face);
  const tick = () => { const t = faceText(th); face.textContent = t; face.dataset.ghost = t.replace(/\d/g, '8'); }; // the unlit segments behind the lit ones
  tick();
  el._timer = setInterval(tick, 250);
  // the brass desk clock beside it (skills/mini/clock.js), keeping the same time in this device's zone
  let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) {}
  if (tz) stageApi.miniature(el, 'clock', { clocks: [{ tz, label: 'Here' }] }, { key: th.id, place: 'beside', width: 150, height: 160, label: '3D desk clock showing the time here' }).catch(() => {});
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** remove (the picked clock, or the first): 'removed', 'no clock' when there is none, or '' */
export function askRemove(lower, text, stageApi) {
  if (!wantsRemove(lower) || /\b(sticky|note)\b/.test(lower)) return '';
  const sel = stageApi.things()[stageApi.selected()];
  const c = (sel && sel.kind === 'clock' && sel) || clocks(stageApi)[0];
  if (!c) { stageApi.say(''); return 'no clock'; }
  delete stageApi.things()[c.id];
  if (stageApi.selected() === c.id) stageApi.select(null);
  stageApi.save(); stageApi.render();
  return 'removed';
}

/** create, with any colour, size or format named in the same words: 'clock', or '' */
export function ask(lower, text, stageApi) {
  if (!wantsCreate(lower)) return '';
  const c = ensure(stageApi);
  stageApi.select(c.id);
  stageApi.alterThing(c, 'clock', lower);
  stageApi.save(); stageApi.render();
  return 'clock';
}

export default {
  name: 'clock',
  examples: ['make a clock', 'clock', 'give me a clock'],
  nearMisses: ['world clock', 'what time is it in tokyo'],
  match(lower) { return plainClock(lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'clock' : 'none'; },
  // askAt: the page asks this kind's askRemove and ask at its own places, and keeps its last branch (the clock is its last word)
  stageKinds: { clock: { mount, ensure: (stageApi) => ensure(stageApi), alter, ask, askRemove, askAt: 'clock' } },
};
