/**
 * formulas: the batches of the formula library, in the order they shipped. Each batch is a list of definitions for lib/formula-engine.js
 * (equation, variables with their kinds and units, a source and a worked example), compiled into /calculators/ by lib/calculators.js. Pure.
 * Tests: tools/formulas.test.mjs.
 */
import batch1 from './formulas-1.js';

export const FORMULA_BATCHES = [batch1];
