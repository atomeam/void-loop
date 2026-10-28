/**
 * shop skill: the selling family (convergence, owner 2026-10-15: "most skills can be combined"; lists run 7, 2026-10-28). One place in
 * the routing order for what Verse sells: the store card (store: the catalog, what's new, tip, buy, join) and the pricing and services
 * card (services: what Verse sells as hands-on work, hire it, what it costs). Both took "what can i buy" and "pricing", so they were one
 * job in two places (tools/skill-overlap.mjs listed them as a merge candidate). store is asked first, as before (it sat at rank 1035,
 * services at 1040), so every ask lands where it did; each member keeps its file, examples, near misses and tests, and the page still
 * logs skill:store / skill:services (lib/skill-family.js).
 * parts: ['store', 'services']
 */
import { family } from '../lib/skill-family.js';
import store from './store.js';
import services from './services.js';

export default family('shop', [store, services], { suite: () => (typeof store.suite === 'function' ? store.suite() : { ok: true }) });
