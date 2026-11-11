/**
 * status-board skill: the status family (convergence, owner 2026-10-15: "most skills can be combined"; lists run 9, 2026-11-04).
 * One place in the routing order for "how is it doing": Verse's own live health card (status: sources pinged, skills loaded,
 * checks on main, deploys) and a status card for a system the ask names (system-status: an address is pinged with status's own
 * ping()). Both answered "system status ..." asks, so tools/skill-overlap.mjs listed them as a merge candidate. status is asked
 * first, as it sat first (rank 0650, system-status at 9510); system-status's match was tightened to a named thing (a flow, an
 * automation, a site, an address) so it takes no ask from the skills between the old ranks. Each member keeps its file, examples,
 * near misses and tests, and the page still logs skill:status / skill:system-status (lib/skill-family.js).
 * Lists run 17 (2026-11-11): automation-status (a client-facing status of the automations Verse owns, #2701) joined as the third member.
 * system-status already answered its "automation status for ..." and "status of the automations ..." asks, so tools/skill-overlap.mjs
 * listed automation-status~system-status; it is asked last, as it sat last (9995), and a routing replay of every example and near miss
 * landed each one on the same member as before (tools/status-family.test.mjs). The automations skill (rank 1010) sat between the old ranks
 * and answered a bare "what automations are running" first, so the member leaves to it whatever it takes, as before.
 * parts: ['status', 'system-status', 'automation-status']
 */
import { family } from '../lib/skill-family.js';
import status from './status.js';
import systemStatus from './system-status.js';
import automationStatusSkill from './automation-status.js';
import automations from './automations.js';

const automationStatus = { ...automationStatusSkill, match: (lower, text) => automationStatusSkill.match(lower, text) && !automations.match(lower, text) };

export default family('status-board', [status, systemStatus, automationStatus], { suite: () => (typeof systemStatus.suite === 'function' ? systemStatus.suite() : { ok: true }) });
