/**
 * date-math skill: the date-and-time-arithmetic family (convergence, owner 2026-10-15: "most skills can be combined"; lists run 10,
 * 2026-11-04). time-math (meeting lengths, ISO week numbers, the age box, "days since" counters) and date-calc (date math as a card:
 * "30 days after ...", business days, quarters, overlaps, renewals) both took "what week number is it" and "week number of oct 25",
 * so tools/skill-overlap.mjs listed them as a merge candidate. One routing entry at time-math's rank (0025); time-math is asked
 * first, as it sat first (date-calc was at 0125), and every ask of either skill lands on the same member as before (checked over
 * every skill's examples and near misses, tools/date-math-family.test.mjs). Each member keeps its file, examples, near misses and
 * tests, and the page still logs skill:time-math / skill:date-calc (lib/skill-family.js).
 * parts: ['time-math', 'date-calc']
 */
import { family } from '../lib/skill-family.js';
import timeMath from './time-math.js';
import dateCalc from './date-calc.js';

export default family('date-math', [timeMath, dateCalc]);
