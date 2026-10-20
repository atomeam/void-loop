/**
 * light-look skill — "make my void light".
 * Uses the look already stored at a2m.void.look.v1 (void.html applyLook).
 * A light preset only. Also clears stage-style global blur / high contrast so a
 * leftover filter does not stack on the new theme. Empty surface stays empty.
 */
import { cleanLower } from '../lib/ask-text.js';
export const LOOK_KEY = 'a2m.void.look.v1';
export const STYLE_FX_KEY = 'a2m.void.stylefx.v1';
export const LIGHT = { bg: '#f4f1ea', glow: '#fffdf8', stars: 'off', quiet: false, scale: 1, fx: 'off', theme: 'light' };

const CLEAN = cleanLower; // shared: lib/ask-text.js

export function lightOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?make my (?:verse|void) light$/.test(t)) return { theme: 'light' };
  if (/^(?:please\s+)?light look$/.test(t)) return { theme: 'light' };
  if (/^(?:please\s+)?switch (?:my (?:verse|void)|the (?:verse|void)) to light$/.test(t)) return { theme: 'light' };
  if (/^(?:please\s+)?make the (?:verse|void) light$/.test(t)) return { theme: 'light' };
  if (/^(?:please\s+)?light$/.test(t)) return { theme: 'light' };
  return null;
}

function clearStyleFx(store, doc) {
  try {
    if (store) {
      let g = {};
      try { g = JSON.parse(store.getItem(STYLE_FX_KEY) || '{}') || {}; } catch (_) { g = {}; }
      store.setItem(STYLE_FX_KEY, JSON.stringify({ ...g, blur: 0, hc: false }));
    }
  } catch (_) {}
  if (doc && doc.documentElement) {
    const d = doc.documentElement;
    delete d.dataset.hc;
    delete d.dataset.bgblur;
    d.style.removeProperty('--bgblur');
  }
}

export function paintLight(doc, store) {
  const next = { ...LIGHT };
  try { if (store) store.setItem(LOOK_KEY, JSON.stringify(next)); } catch (_) {}
  clearStyleFx(store, doc);
  if (doc && doc.documentElement) {
    const r = doc.documentElement.style;
    r.setProperty('--void-bg', LIGHT.bg);
    r.setProperty('--void-glow', LIGHT.glow);
    r.setProperty('--fg', '#1c1c1c');
    r.setProperty('--bg', '#f7f4ee');
    r.setProperty('--muted', '#5e5a52');
    r.setProperty('--line', '#d9d3c7');
    r.colorScheme = 'light';
    if (doc.body) {
      doc.body.classList.toggle('void-quiet', !!LIGHT.quiet);
      if (LIGHT.scale) doc.body.style.fontSize = (15 * (LIGHT.scale || 1)) + 'px';
    }
  }
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('void-look', { detail: { ...LIGHT } }));
  } catch (_) {}
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
