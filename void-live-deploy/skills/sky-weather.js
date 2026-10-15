/**
 * sky-weather skill — the sky, weather and earth family (convergence, owner 2026-10-15: "existing skills should merge"):
 * one place in the routing order for the sky (sky, moontonight, aurora-tonight, eclipse, meteors, constellation), the weather
 * (weather, air, uv, pollen) and the earth (quake). Each member keeps its own file, examples and near misses; asks reach them
 * in their old order (lib/skill-family.js), and the page still logs skill:<member>.
 * parts: ['sky', 'moontonight', 'aurora-tonight', 'eclipse', 'meteors', 'constellation', 'weather', 'air', 'uv', 'quake', 'pollen']
 */
import { family } from '../lib/skill-family.js';
import sky from './sky.js';
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

export default family('sky-weather', [sky, moontonight, auroraTonight, eclipse, meteors, constellation, weather, air, uv, quake, pollen]);
