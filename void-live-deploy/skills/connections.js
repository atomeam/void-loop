/**
 * connections skill: the family that maps and packages how a client's systems connect (convergence, lists run 26, 2026-11-18).
 * connect-flows (the data flows and handoff points between the systems Verse owns) and systems-connect-pack (the systems to connect,
 * the integrations Verse owns, the automations across them, monitoring and handoff) both took "connect systems for invoice
 * automation" (tools/skill-overlap.mjs listed connect-flows~systems-connect-pack when #2963 added the pack without an order file).
 * One routing entry where connect-flows sat (12000), asking connect-flows first as before; systems-connect-pack was adopted at 12020
 * the same run, and a routing replay of every example, near miss and bench ask landed each one on the same member as before
 * (tools/connections-family.test.mjs). Each member keeps its file, examples, near misses and tests (systems-connect-pack's self-test
 * runs as the family's), and the page still logs skill:connect-flows / skill:systems-connect-pack (lib/skill-family.js).
 * parts: ['connect-flows', 'systems-connect-pack']
 */
import { family } from '../lib/skill-family.js';
import connectFlows from './connect-flows.js';
import systemsConnectPack from './systems-connect-pack.js';

export default family('connections', [connectFlows, systemsConnectPack], { suite: () => systemsConnectPack.suite() });
