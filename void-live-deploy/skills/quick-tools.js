/**
 * quick-tools skill: the stage picture and small tools family (convergence, lists run 22, 2026-11-12). stage-image (the stage or a card
 * as a PNG, copied, saved or as a QR code of the view) and util (small in-browser tools: passwords, QR codes, colours, word counts, case,
 * hashes, diffs, Markdown, CSV, YAML, CSS) both took "qr code for this stage view" (tools/skill-overlap.mjs listed stage-image~util as a
 * merge candidate): two cards that turn what is on screen into a code or a file. One routing entry where stage-image sat (0455),
 * asking stage-image first as before; util sat at 0460, and a routing replay of every example, near miss and bench ask landed each one
 * on the same member as before (tools/quick-tools-family.test.mjs). Each member keeps its file, examples, near misses and tests, and the
 * page still logs skill:stage-image / skill:util (lib/skill-family.js).
 * parts: ['stage-image', 'util']
 */
import { family } from '../lib/skill-family.js';
import stageImage from './stage-image.js';
import util from './util.js';

export default family('quick-tools', [stageImage, util]);
