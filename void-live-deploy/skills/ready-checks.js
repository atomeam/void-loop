/**
 * ready-checks skill: the family that says whether a client system is ready to hand over (convergence, lists run 26, 2026-11-18).
 * delivery-ready (ownership, monitors, tests, status, kickoff and docs for a business idea) and handoff-ready (ownership, status, docs,
 * monitors and running automations for a system) both took "is this system handoff ready" (tools/skill-overlap.mjs listed
 * delivery-ready~handoff-ready as a merge candidate): two lists of the same readiness checks. One routing entry where delivery-ready sat
 * (10120), asking delivery-ready first as before; handoff-ready sat at 11010, and a routing replay of every example, near miss and
 * bench ask landed each one on the same member as before (tools/ready-checks-family.test.mjs). Each member keeps its file, examples,
 * near misses and tests (delivery-ready's self-test runs as the family's), and the page still logs skill:delivery-ready /
 * skill:handoff-ready (lib/skill-family.js).
 * parts: ['delivery-ready', 'handoff-ready']
 */
import { family } from '../lib/skill-family.js';
import deliveryReady from './delivery-ready.js';
import handoffReady from './handoff-ready.js';

export default family('ready-checks', [deliveryReady, handoffReady], { suite: () => deliveryReady.suite() });
