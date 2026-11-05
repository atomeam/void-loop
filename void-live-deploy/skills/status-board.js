/**
 * status-board skill: the status family (convergence, owner 2026-10-15: "most skills can be combined"; lists run 9, 2026-11-04).
 * One place in the routing order for "how is it doing": Verse's own live health card (status: sources pinged, skills loaded,
 * checks on main, deploys) and a status card for a system the ask names (system-status: an address is pinged with status's own
 * ping()). Both answered "system status ..." asks, so tools/skill-overlap.mjs listed them as a merge candidate. status is asked
 * first, as it sat first (rank 0650, system-status at 9510); system-status's match was tightened to a named thing (a flow, an
 * automation, a site, an address) so it takes no ask from the skills between the old ranks. Each member keeps its file, examples,
 * near misses and tests, and the page still logs skill:status / skill:system-status (lib/skill-family.js).
 * parts: ['status', 'system-status']
 */
import { family } from '../lib/skill-family.js';
import status from './status.js';
import systemStatus from './system-status.js';

export default family('status-board', [status, systemStatus], { suite: () => (typeof systemStatus.suite === 'function' ? systemStatus.suite() : { ok: true }) });
