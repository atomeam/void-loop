// The asks our own robots type into the live page: the claims check (tools/claims-verify.mjs: its must-pass asks, its topics and every
// ledger try ask) and the site tester (tools/site-test.json cases). Their misses are replays, never people: tools/will.py leaves them out
// of Verse's will (owner, 2026-10-19: the will wanted "deep ocean floor inquiries, asked 72 times", a ledger try ask the claims check typed
// on every run). Since the same day the page tags a robot's miss and /api/miss keeps none, but the miss list remembers 7 days.
//   node tools/robot-asks.mjs          prints the asks as JSON, cleaned the way the miss list keeps them (lower case, no end punctuation)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { MUST, TOPICS, CLEAN } from './claims-verify.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; } };
/** every robot ask, cleaned, one of each. Pure over its inputs. */
export function robotAsks(ledger, siteTest) {
  const L = Array.isArray(ledger) ? ledger : (ledger && ledger.entries) || [];
  const cases = (siteTest && Array.isArray(siteTest.cases)) ? siteTest.cases : [];
  const all = [...MUST, ...TOPICS, ...L.map((e) => e && e.try), ...cases.map((c) => c && c.ask)].map(CLEAN).filter(Boolean);
  return [...new Set(all)];
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify(robotAsks(read(path.join(here, '..', 'void-live-deploy', 'void.growth.json')), read(path.join(here, 'site-test.json')))));
}
