/**
 * rooms skill: the room-project family (convergence, owner 2026-10-15: "most skills can be combined"; lists run 5, 2026-10-22). One place in
 * the routing order for a room's work: the whole room on one card with a price on each line (room), wallpaper, drywall and baseboard (walls),
 * and paint and flooring (home). room and home both took "paint and carpet a 12x14 room" (tools/skill-overlap.mjs listed them as a merge
 * candidate), and room is built on the other two, so they were one job in three places. They sat side by side (ranks 0370, 0380, 0390) and are
 * asked in that order, so every ask lands where it did; each member keeps its file, examples, near misses and follow-ups ("the whole room",
 * "what about 3 coats"), and the page still logs skill:<member> (lib/skill-family.js).
 * parts: ['room', 'walls', 'home']
 */
import { family } from '../lib/skill-family.js';
import room from './room.js';
import walls from './walls.js';
import home from './home.js';

export default family('rooms', [room, walls, home]);
