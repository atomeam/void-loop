/**
 * light-look skill — "make my void light".
 * Uses the look already stored at a2m.void.look.v1 (void.html applyLook).
 * A light preset only. Empty surface stays empty: nothing is summoned or published.
 */
export const LOOK_KEY = 'a2m.void.look.v1';
export const LIGHT = { bg: '#f4f1ea', glow: '#fffdf8', stars: 'off', quiet: false, scale: 1, fx: 'off', theme: 'light' };

const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();

export function lightOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?make my void light$/.test(t)) return { theme: 'light' };
  if (/^(?:please\s+)?light look$/.test(t)) return { theme: 'light' };
  if (/^(?:please\s+)?switch (?:my void|the void) to light$/.test(t)) return { theme: 'light' };
  if (/^(?:please\s+)?make the void light$/.test(t)) return { theme: 'light' };
  return null;
}

export function paintLight(doc, store) {
  const next = { ...LIGHT };
  try { if (store) store.setItem(LOOK_KEY, JSON.stringify(next)); } catch (_) {}
  if (doc && doc.documentElement) {
    const r = doc.documentElement.style;
    r.setProperty('--void-bg', LIGHT.bg);
    r.setProperty('--void-glow', LIGHT.glow);
    r.setProperty('--fg', '#1c1c1c');
    r.setProperty('--bg', '#f7f4ee');
    r.setProperty('--muted', '#5e5a52');
    r.setProperty('--line', '#d9d3c7');
    r.colorScheme = 'light';
  }
  return { theme: 'light', html: '', published: false };
}

async function run(text, api) {
  const hit = lightOf(text);
  if (!hit) return 'none';
  const doc = typeof document !== 'undefined' ? document : null;
  const store = typeof localStorage !== 'undefined' ? localStorage : null;
  paintLight(doc, store);
  if (api.say) api.say('light look');
  return 'light-look';
}

export default {
  name: 'light-look',
  examples: ['make my void light', 'light look', 'switch my void to light', 'make the void light'],
  nearMisses: ['make my void deep blue', 'make my void darker', 'make a light', 'what is light', 'add stars'],
  lightOf,
  paintLight,
  match(lower, text) { return !!lightOf(text); },
  run,
  suite() {
    const hit = lightOf('make my void light');
    const painted = paintLight(null, null);
    const ok = !!hit && hit.theme === 'light' && painted.published === false && painted.html === '' && LIGHT.bg === '#f4f1ea' && lightOf('make my void deep blue') === null && lightOf('make a light') === null;
    return { ok, got: ok ? 'light preset' : 'miss' };
  }
};
