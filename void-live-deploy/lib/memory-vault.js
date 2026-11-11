// Semantic Memory Vault (local-first): Verse links related entities (cards, skills, topics) across disparate cards
// and cross-references research archives, all on this device. Pure over the store handed in; no network, no server.
// ADR-001-adjacent: complements the Time Machine's event log with a knowledge graph that persists.
//   put(store, entity)     add or update an entity (id, kind, title, body, tags[])
//   link(store, a, b, kind) add an edge between two entities
//   related(store, id)     entities linked to id (1 hop)
//   search(store, query)   entities whose title/body/tags contain the query words
//   stats(store)           { entities, edges, kinds }
const KEY = (s) => String(s || '').toLowerCase().trim();

export const KINDS = ['card', 'skill', 'topic', 'fact', 'archive', 'note'];

export function emptyVault() { return { entities: {}, edges: [], meta: { created: Date.now(), updated: Date.now() } }; }

export function normalizeEntity(e) {
  if (!e || typeof e !== 'object') return null;
  const id = String(e.id || '').trim();
  if (!id) return null;
  const kind = KINDS.includes(e.kind) ? e.kind : 'note';
  const title = String(e.title || '').trim().slice(0, 200);
  const body = String(e.body || '').trim().slice(0, 2000);
  const tags = [...new Set((Array.isArray(e.tags) ? e.tags : []).map((t) => KEY(t)).filter(Boolean))].slice(0, 40);
  return { id, kind, title, body, tags, at: Number.isFinite(+e.at) ? +e.at : Date.now() };
}

export function put(store, entity) {
  const s = store || emptyVault();
  const n = normalizeEntity(entity);
  if (!n) return s;
  s.entities[n.id] = n;
  s.meta.updated = Date.now();
  return s;
}

export function link(store, a, b, kind = 'related') {
  const s = store || emptyVault();
  if (!s.entities[a] || !s.entities[b] || a === b) return s;
  const edge = { from: a, to: b, kind: String(kind || 'related').slice(0, 40) };
  if (!s.edges.some((e) => e.from === edge.from && e.to === edge.to && e.kind === edge.kind)) s.edges.push(edge);
  s.meta.updated = Date.now();
  return s;
}

export function related(store, id) {
  const s = store || emptyVault();
  if (!s.entities[id]) return [];
  const ids = new Set();
  for (const e of s.edges || []) {
    if (e.from === id) ids.add(e.to);
    if (e.to === id) ids.add(e.from);
  }
  return [...ids].map((x) => s.entities[x]).filter(Boolean);
}

export function search(store, query) {
  const s = store || emptyVault();
  const q = KEY(query).split(/\s+/).filter(Boolean);
  if (!q.length) return Object.values(s.entities || {});
  return Object.values(s.entities || {}).filter((e) => {
    const hay = (e.title + ' ' + e.body + ' ' + (e.tags || []).join(' ')).toLowerCase();
    return q.every((w) => hay.includes(w));
  });
}

export function autoLink(store, id) {
  // link an entity to others sharing a tag (1 hop, no duplicates)
  const s = store || emptyVault();
  const e = s.entities[id];
  if (!e) return s;
  for (const other of Object.values(s.entities)) {
    if (other.id === id) continue;
    if ((e.tags || []).some((t) => (other.tags || []).includes(t))) link(s, id, other.id, 'shared-tag');
  }
  return s;
}

export function stats(store) {
  const s = store || emptyVault();
  const kinds = {};
  for (const e of Object.values(s.entities || {})) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  return { entities: Object.keys(s.entities || {}).length, edges: (s.edges || []).length, kinds };
}

export function remove(store, id) {
  const s = store || emptyVault();
  delete s.entities[id];
  s.edges = (s.edges || []).filter((e) => e.from !== id && e.to !== id);
  s.meta.updated = Date.now();
  return s;
}

// storage helpers (default localStorage; never throw)
export function loadVault(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return emptyVault();
  try { const raw = storage.getItem('a2m.void.vault.v1'); if (!raw) return emptyVault(); const v = JSON.parse(raw); return v && v.entities ? v : emptyVault(); } catch { return emptyVault(); }
}
export function saveVault(store, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return false;
  try { storage.setItem('a2m.void.vault.v1', JSON.stringify(store)); return true; } catch { return false; }
}