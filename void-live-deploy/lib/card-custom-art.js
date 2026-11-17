// Custom card art, PR 1 (owner, 2026-11-17: a [✦ Custom Art] control on the card's export bar). A visitor picks one of five styles and/or a few
// words, and a re-roll count; the same choice always draws the same picture. Nothing leaves the browser: the choice is kept in localStorage
// under one key, and the picture is the card's own procedural art (lib/card-art.js) drawn from a new seed and palette. Pure except the storage helpers.
export const STYLES = {
  obsidian: { label: 'Verse Obsidian', hue: null },
  ledger: { label: 'Emerald Ledger', hue: 150 },
  grid: { label: 'Cyber Grid', hue: 190 },
  pixel: { label: '16-Bit Pixel', hue: 280 },
  solar: { label: 'Solar Gold', hue: 42 },
};
export const CUSTOM_KEY = 'a2m.void.cardart';
const WORDS_MAX = 60;

/** a 32-bit FNV-1a hash of a string (the seed of a choice). Pure. */
export function hashOf(s) {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

/** the choice a visitor typed: a style name (its key or its label) is taken out, the rest is the words. Pure. */
export function parseChoice(text, n = 0) {
  const raw = String(text || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  const whole = Object.keys(STYLES).find((s) => s === raw.toLowerCase() || STYLES[s].label.toLowerCase() === raw.toLowerCase());
  if (whole) return { style: whole, words: '', n: Math.max(0, Math.min(99, Math.floor(+n) || 0)) };
  let style = '';
  const words = raw.split(' ').filter((w) => {
    const k = Object.keys(STYLES).find((s) => s === w.toLowerCase() || STYLES[s].label.toLowerCase() === w.toLowerCase());
    if (k && !style) { style = k; return false; }
    return true;
  }).join(' ').slice(0, WORDS_MAX);
  return { style, words, n: Math.max(0, Math.min(99, Math.floor(+n) || 0)) };
}

/** the card as artInner should draw it under a choice: a new seed (the key carries the choice), the style's hue, and the choice's words as nouns
 *  so a word with a drawing ("car", "loan") draws it. Returns a new object; the card's name, kind and text are untouched. Pure. */
export function customCard(card = {}, choice = {}) {
  const c = card || {}, ch = choice || {}, style = STYLES[ch.style];
  const words = String(ch.words || '').toLowerCase().match(/[a-z]{3,16}/g) || [];
  return {
    ...c,
    key: [c.key || c.name || '', ch.style || '', ch.words || '', ch.n || 0].join('|'),
    hue: style && style.hue != null ? style.hue : c.hue,
    nouns: [...words, ...(Array.isArray(c.nouns) ? c.nouns : [])],
  };
}

/** every saved choice, by card key; a missing or corrupt store is an empty map. Never throws. */
const readAll = (storage) => { try { const v = JSON.parse((storage && storage.getItem(CUSTOM_KEY)) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (_) { return {}; } };

/** a saved choice from storage (a Storage-like object) for a card key, or null. A corrupt value is null, never a throw. */
export function choiceFor(storage, cardKey) {
  try {
    const all = readAll(storage);
    const ch = all[String(cardKey || '')];
    return ch && typeof ch === 'object' ? { style: STYLES[ch.style] ? ch.style : '', words: String(ch.words || '').slice(0, WORDS_MAX), n: Math.max(0, Math.min(99, Math.floor(+ch.n) || 0)) } : null;
  } catch (_) { return null; }
}

/** keeps a choice for a card key, or removes it when `choice` is null. Returns true when stored. Never throws. */
export function saveChoice(storage, cardKey, choice) {
  try {
    const all = readAll(storage);
    if (choice) all[String(cardKey || '')] = choice; else delete all[String(cardKey || '')];
    storage.setItem(CUSTOM_KEY, JSON.stringify(all));
    return true;
  } catch (_) { return false; }
}
