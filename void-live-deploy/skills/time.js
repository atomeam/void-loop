/**
 * time skill — the time and dates family (convergence, owner 2026-10-15: "existing skills should merge"): one place in the
 * routing order for timers and clocks (timer, clock), the time around the world and the sun's times (worldtime, suntimes) and
 * reminders (remind). Dates (calendar, today, holidays, countdown) are the `dates` family, later in the order. Each member keeps
 * its own file, examples and near misses; asks reach them in their old order (lib/skill-family.js), and the page still logs
 * skill:<member>.
 * parts: ['timer', 'clock', 'worldtime', 'suntimes', 'remind']
 */
import { family } from '../lib/skill-family.js';
import timer from './timer.js';
import clock from './clock.js';
import worldtime from './worldtime.js';
import suntimes from './suntimes.js';
import remind from './remind.js';

export default family('time', [timer, clock, worldtime, suntimes, remind]);
