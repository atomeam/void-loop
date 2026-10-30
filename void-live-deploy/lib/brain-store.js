// brain-store — where Verse Brain keeps what it learned between visits (lib/brain-mind.js knowledgeOf: the Q-table, the Hebbian links, the
// gesture kinds, the preferences, the winning genomes and the remembered moments). One IndexedDB record on this device, database
// 'verse-brain'; nothing is sent anywhere. A moment remembers the goal words that were active (the visitor's own words, on their own device).
// A second record holds which ideas were lit (lib/brain-glow.js), so a reload keeps what the brain was just told. Forget clears both. Every call resolves (null or false) where IndexedDB is missing or refused, so the brain runs the same without it.
export const DB = 'verse-brain', STORE = 'knowledge', KEY = 'brain', GLOW = 'glow';

function open() {
  return new Promise((res) => {
    try {
      if (typeof indexedDB === 'undefined') return res(null);
      const q = indexedDB.open(DB, 1), done = setTimeout(() => res(null), 4000);
      q.onupgradeneeded = () => { try { q.result.createObjectStore(STORE); } catch (_) { /* there */ } };
      q.onsuccess = () => { clearTimeout(done); res(q.result); }; q.onerror = q.onblocked = () => { clearTimeout(done); res(null); };
    } catch (_) { res(null); }
  });
}
const run = async (mode, fn) => { const db = await open(); if (!db) return null; return new Promise((res) => { try { const tx = db.transaction(STORE, mode), r = fn(tx.objectStore(STORE)); tx.oncomplete = () => { db.close(); res(r && 'result' in r ? r.result : true); }; tx.onerror = tx.onabort = () => { db.close(); res(null); }; } catch (_) { db.close(); res(null); } }); };

/** the kept knowledge, or null. */
export const loadKept = () => run('readonly', (s) => s.get(KEY));
/** keep knowledge (a plain object). Resolves true when kept. */
export const keep = async (k) => !!(await run('readwrite', (s) => s.put({ ...k, at: Date.now() }, KEY)));
/** the kept glow (lib/brain-glow.js glowOf), or null. */
export const loadGlow = () => run('readonly', (s) => s.get(GLOW));
/** keep the glow. Resolves true when kept. */
export const keepGlow = async (g) => !!(await run('readwrite', (s) => s.put(g, GLOW)));
/** forget everything kept: the knowledge and the glow. */
export const forget = async () => !!(await run('readwrite', (s) => { s.delete(GLOW); return s.delete(KEY); }));
