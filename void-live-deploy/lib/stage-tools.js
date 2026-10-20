// Stage tools (owner, 2026-10-18; "tools pack 4"): align, distribute, grid, guides, multi-select, lock, look of a card, stage background,
// folders, tags, snapshots, layouts, templates. Pure logic only (no DOM, no storage of its own): the three skills stage-arrange,
// stage-style and stage-organize read the stage through these and draw it. Everything is device-local; nothing is sent anywhere.

export const norm = (s) => String(s || '').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[?!.]+$/, '').replace(/\s+/g, ' ').replace(/^(?:please|pls)\s+/, '').replace(/\s+please$/, '');

/** HTML-escape a value before it goes into markup. Pure. */
export const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
