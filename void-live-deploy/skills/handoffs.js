/**
 * handoffs skill: the client handoff family (convergence, lists run 23, 2026-11-12). delivery-pack (an idea turned into a delivery
 * package), client-handoff (a shareable handoff card for one system), system-handoff (the package for a system Verse is taking on) and
 * full-handoff (the complete package: ownership, status, docs, monitors, automations, next step) all hand a client one package for a
 * system Verse owns; tools/skill-overlap.mjs listed delivery-pack~full-handoff as a merge candidate (both took "handoff pack for my
 * SaaS idea"). One routing entry where delivery-pack sat (1192), asking the members in their old order: delivery-pack, client-handoff
 * (1193), system-handoff (1194), then full-handoff, which had no order file and sat last. A routing replay of every example, near miss
 * and bench ask landed each one on the same member as before (tools/handoffs-family.test.mjs). Each member keeps its file, examples,
 * near misses and tests, and the page still logs skill:delivery-pack / skill:client-handoff / skill:system-handoff / skill:full-handoff
 * (lib/skill-family.js).
 * parts: ['delivery-pack', 'client-handoff', 'system-handoff', 'full-handoff']
 */
import { family } from '../lib/skill-family.js';
import deliveryPack from './delivery-pack.js';
import clientHandoff from './client-handoff.js';
import systemHandoff from './system-handoff.js';
import fullHandoff from './full-handoff.js';

export default family('handoffs', [deliveryPack, clientHandoff, systemHandoff, fullHandoff]);
