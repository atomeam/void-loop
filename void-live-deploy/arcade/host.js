// The rounds that play on /arcade/. The cabinet still lists every ladder game; these are the ones with a canvas on this page.
import * as glide from '../skills/gap-glide-rules.js';
import * as bus from '../skills/cross-bus-rules.js';
import * as debris from '../skills/debris-field-rules.js';
import * as waves from '../skills/null-waves-rules.js';
import * as maze from '../skills/packet-maze-rules.js';
import * as jump from '../skills/jump-stack-rules.js';
import * as stack from '../skills/stackwell-rules.js';
import * as push from '../skills/push-packets-rules.js';
import * as grid from '../skills/nine-grid-rules.js';
import * as glyph from '../skills/glyph-verse-rules.js';
import * as three from '../skills/three-alike-rules.js';
import * as stand from '../skills/token-stand-rules.js';

export const HOST = Object.fromEntries([glide, bus, debris, waves, maze, jump, stack, push, grid, glyph, three, stand].map((g) => [g.id, g]));
