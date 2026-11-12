/**
 * client-status skill: the client status family (convergence, lists run 18, 2026-11-11). client-status-pack (the status Verse already
 * stores, as a client handoff) and delivery-board (ownership, progress, monitors and the next handoff on one client board) did the same
 * job: both show a client where the systems Verse owns stand. delivery-board came without a family, a book page or a map line and turned
 * main's book checks red; it now reads its progress from client-status-pack's live readings instead of a fixed line. One routing entry
 * at 9890, where client-status-pack sat, asking the members in their old order; a routing replay of every example and near miss landed
 * each one on the same member as before (tools/client-status-family.test.mjs). Each member keeps its file, examples, near misses and
 * tests, and the page still logs skill:client-status-pack / skill:delivery-board (lib/skill-family.js).
 * Lists run 19: status-digest (#2713) joined as the third member; it arrived the same way, with no family, and printed a fixed
 * "all systems green" line. It now reads the same live readings through delivery-board's progressOf.
 * parts: ['client-status-pack', 'delivery-board', 'status-digest']
 */
import { family } from '../lib/skill-family.js';
import clientStatusPack from './client-status-pack.js';
import deliveryBoard from './delivery-board.js';
import statusDigest from './status-digest.js';

export default family('client-status', [clientStatusPack, deliveryBoard, statusDigest]);
