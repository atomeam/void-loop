/**
 * stage-marks skill: the family that marks things on the stage (convergence, lists run 25, 2026-11-12). stage-organize (folders, tags,
 * colour labels, saved layouts, snapshots and templates) and label (a tag that rides on a card, free labels, and arrows between things
 * that carry what their source produces) both took "tag the clock as work" (tools/skill-overlap.mjs listed label~stage-organize as a
 * merge candidate): two ways of putting a word on a card. One routing entry where stage-organize sat (0299), asking stage-organize
 * first as before; label sat at 0790, and a routing replay of every example, near miss and bench ask landed each one on the same member
 * as before (tools/stage-marks-family.test.mjs). Each member keeps its file, examples, near misses and tests (label's own self-test runs
 * as the family's), both decorators still draw (badges, then arrows), and the page still logs skill:stage-organize / skill:label
 * (lib/skill-family.js).
 * parts: ['stage-organize', 'label']
 */
import { family } from '../lib/skill-family.js';
import stageOrganize from './stage-organize.js';
import label from './label.js';

export default family('stage-marks', [stageOrganize, label], { suite: label.suite });
