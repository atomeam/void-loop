/**
 * dates skill — the dates family (convergence, owner 2026-10-15: "existing skills should merge"): one place in the routing order
 * for the calendar, today, public holidays and countdowns. Its members are broad (any ask naming a day), so the family sits where
 * calendar sat, after the skills that take a date as part of something else (intent, sleep, cycle, weather). Each member keeps its
 * own file, examples and near misses; asks reach them in their old order (lib/skill-family.js), and the page still logs
 * skill:<member>.
 * parts: ['calendar', 'today', 'holidays', 'countdown']
 */
import { family } from '../lib/skill-family.js';
import calendar from './calendar.js';
import today from './today.js';
import holidays from './holidays.js';
import countdown from './countdown.js';

export default family('dates', [calendar, today, holidays, countdown]);
