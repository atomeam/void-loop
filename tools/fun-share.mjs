// Fun first, held (owner, 2026-11-20: the build loops kept making business-tool packs nobody plays with). A skill whose
// name reads as a business tool (lib/visible.js laneOf: client-*, *-pack, handoff, delivery, runbook, ...) is one of the
// business share. On 2026-11-20 main had 573 skills and 46 of them were business tools. From there, at most one new business
// tool per five new skills (BUSINESS_SHARE 0.2) lands; the rest of the new work is games, cards, daily challenges and
// creative tools. To build a real client ask past the cap, raise BUSINESS_AT in a reviewed commit and say why.
//   node tools/fun-share.mjs
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { laneOf, BUSINESS_SHARE } from '../void-live-deploy/lib/visible.js';

export const TOTAL_AT = 573, BUSINESS_AT = 46;
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'skills');

/** true when a skill's name reads as a business tool. Pure. */
export const isBusiness = (name) => laneOf(String(name).replace(/-/g, ' ') + ' ' + name) === 'business';

/** { total, business, allowed, over } for a list of skill names. Pure. */
export function share(names) {
  const total = names.length, business = names.filter(isBusiness);
  const allowed = BUSINESS_AT + Math.max(0, Math.floor((total - TOTAL_AT) * BUSINESS_SHARE));
  return { total, business: business.length, allowed, over: Math.max(0, business.length - allowed), names: business };
}

export const skillNames = (d = dir) => readdirSync(d).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const s = share(skillNames());
  console.log(s.total + ' skills, ' + s.business + ' business tools, ' + s.allowed + ' allowed' + (s.over ? ': ' + s.over + ' over. Fun first: build a game, card, daily challenge or creative tool instead.' : ''));
  process.exit(s.over ? 1 : 0);
}
