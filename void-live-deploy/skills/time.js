/**
 * time skill — the time and dates family (convergence, owner 2026-10-15: "existing skills should merge"): one place in the
 * routing order for timers and clocks (timer, clock), the sky, weather and earth (the sky-weather members: sky, moontonight,
 * aurora-tonight, eclipse, meteors, constellation, weather, air, uv, quake, pollen), the time around the world and the sun's
 * times (worldtime, suntimes) and reminders (remind): time, weather and sky as one family (owner, 2026-10-15: sunrise, sunset,
 * moon, seasons and forecasts by date overlap). It sits at rank 131, after convert ("temperature converter" is convert's). Dates (calendar, today, holidays, countdown) are the `dates` family, later in the order. Each member keeps
 * its own file, examples and near misses; asks reach them in their old order (lib/skill-family.js), and the page still logs
 * skill:<member>.
 * nightsky (the sky world behind the stage, "show the night sky" / "hide the sky") joined on lists run 6, 2026-10-28: sky and nightsky both took
 * "show me the sky" and "sky tonight" (tools/skill-overlap.mjs), sky first as before, so the sky card keeps them and the world keeps the rest.
 * parts: ['timer', 'clock', 'sky', 'night-sky', 'moontonight', 'aurora-tonight', 'eclipse', 'meteors', 'constellation', 'weather', 'air', 'uv', 'quake', 'pollen', 'worldtime', 'suntimes', 'remind']
 */
import { family } from '../lib/skill-family.js';
import timer from './timer.js';
import clock from './clock.js';
import sky from './sky.js';
import nightsky from './night-sky.js';
import moontonight from './moontonight.js';
import auroraTonight from './aurora-tonight.js';
import eclipse from './eclipse.js';
import meteors from './meteors.js';
import constellation from './constellation.js';
import weather from './weather.js';
import air from './air.js';
import uv from './uv.js';
import quake from './quake.js';
import pollen from './pollen.js';
import worldtime from './worldtime.js';
import suntimes from './suntimes.js';
import remind from './remind.js';

export default family('time', [timer, clock, sky, nightsky, moontonight, auroraTonight, eclipse, meteors, constellation, weather, air, uv, quake, pollen, worldtime, suntimes, remind]);
