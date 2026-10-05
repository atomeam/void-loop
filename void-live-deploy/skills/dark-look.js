/**
 * dark-look skill — "dark", "make my void dark".
 * Restores the default dark look stored at a2m.void.look.v1 (void.html applyLook).
 * Empty surface stays empty: nothing is summoned or published.
 */
export const LOOK_KEY = 'a2m.void.look.v1';
export const DARK = { bg: '#050505', glow: '#16161c', stars: 'on', quiet: false, scale: 1, fx: 'off', theme: 'dark' };

const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();

export function darkOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?dark$/.test(t)) return { theme: 'dark' };
  if (/^(?:please\s+)?dark look$/.test(t)) return { theme: 'dark' };
  if (/^(?:please\s+)?make my void dark$/.test(t)) return { theme: 'dark' };
  if (/^(?:please\s+)?switch (?:my void|the void) to dark$/.test(t)) return { theme: 'dark' };
  if (/^(?:please\s+)?make the void dark$/.test(t)) return { theme: 'dark' };
  return null;
}

export function paintDark(doc, store) {
  const next = { ...DARK };
  try { if (store) store.setItem(LOOK_KEY, JSON.stringify(next)); } catch (_) {}
  if (doc && doc.documentElement) {
    const r = doc.documentElement.style;
    r.setProperty('--void-bg', DARK.bg);
    r.setProperty('--void-glow', DARK.glow);
    r.setProperty('--fg', '#e6e6ea');
    r.setProperty('--bg', '#050505');
    r.setProperty('--muted', '#8a8a8a');
    r.setProperty('--line', '#26262b');
    r.colorScheme = 'dark';
  }
  return { theme: 'dark', html: '', published: false };
}

async function run(text, api) {
  const hit = darkOf(text);
  if (!hit) return 'none';
  const doc = typeof document !== 'undefined' ? document : null;
  const store = typeof localStorage !== 'undefined' ? localStorage : null;
  paintDark(doc, store);
  if (api.say) api.say('dark look');
  return 'dark-look';
}

export default {
  name: 'dark-look',
  examples: ['dark', 'make my void dark', 'switch my void to dark', 'dark look', 'make the void dark'],
  nearMisses: ['make my void darker', 'dark mode settings', 'what is dark', 'light look', 'what is dark matter'],
  darkOf,
  paintDark,
  match(lower, text) { return !!darkOf(text); },
  run,
  suite() {
    const hit = darkOf('dark');
    const painted = paintDark(null, null);
    const ok = !!hit && hit.theme === 'dark' && painted.published === false && painted.html === '' && DARK.bg === '#050505' && darkOf('make my void darker') === null && darkOf('what is dark') === null;
    return { ok, got: ok ? 'dark preset' : 'miss' };
  }
};
