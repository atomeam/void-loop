// node tools/gate-badge.test.mjs: every tower floor carries a gate badge ([Gate: Code], [Gate: Partner] or [Gate: License]), every regulated floor a
// stage 1 to 3, the build queue's current fight is always buildable (Code work, or stage 1 on a regulated floor), the card shows the badge, and
// docs/NEXT.md records the rule.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { FLOORS, tower } from '../void-live-deploy/lib/tower.js';
import { badgeOf, badgeText, buildable } from '../void-live-deploy/lib/gate-badge.js';
import { pickCandidates } from './tower-self.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const t = tower();
const noBadge = t.floors.filter((f) => !f.badge || !['Code', 'Partner', 'License'].includes(f.badge.gate));
ok(t.floors.length === FLOORS.length + (t.floors.length - FLOORS.length) && noBadge.length === 0, 'every floor (' + t.floors.length + ') has a badge' + (noBadge.length ? ': missing on ' + noBadge.map((f) => f.id).join(', ') : ''));
const regNoStage = t.floors.filter((f) => f.badge.regulated && ![1, 2, 3].includes(f.badge.stage));
ok(regNoStage.length === 0, 'every regulated floor has a stage');
ok(t.floors.every((f) => f.badge.regulated || f.badge.stage === null), 'only regulated floors carry a stage');
const cur = t.floors.find((f) => f.state === 'current');
ok(!cur || buildable(cur.badge), 'the current fight is buildable: ' + (cur ? cur.id + ' ' + badgeText(cur.badge) : 'none'));
const q = t.floors.filter((f) => !f.beaten); const firstGated = q.findIndex((f) => !buildable(f.badge)), lastOk = q.map((f) => buildable(f.badge)).lastIndexOf(true);
ok(firstGated === -1 || firstGated > lastOk, 'every floor that needs a partner or a licence waits behind all buildable work');
ok(badgeOf({ id: 'music' }).gate === 'License' && badgeOf({ id: 'music: metronomeonline.com', lane: 'music' }).gate === 'Code', 'music streaming needs a licence, a metronome does not');
const bank = badgeOf({ id: 'chase.com', url: 'https://www.chase-bank.com/' }), gov = badgeOf({ id: 'usa.gov', url: 'https://www.usa.gov/' }), food = badgeOf({ id: 'doordash.com', url: 'https://doordash.com/' });
ok([bank, gov, food].every((b) => b.regulated && b.stage === 1 && buildable(b)), 'a bank, a government site and food delivery are regulated, stage 1, buildable as stage 1');
ok(!buildable({ ...bank, stage: 2 }) && !buildable({ gate: 'Partner', regulated: false, stage: null }), 'stage 2, or partner work on an unregulated floor, is not picked');
ok(badgeOf({ id: 'weather', url: 'https://weather.gov/' }).gate === 'Code' && !badgeOf({ id: 'weather', url: 'https://weather.gov/' }).regulated, 'an open-data government forecast is plain Code');
ok(badgeText({ gate: 'Partner', stage: 1 }) === '[Gate: Partner] · Stage 1' && badgeText({ gate: 'Code', stage: null }) === '[Gate: Code]', 'badge text');
ok(pickCandidates({ sites: [{ host: 'mybank.com', rank: 1 }, { host: 'usa.gov', rank: 2 }, { host: 'spotify.com', rank: 3 }] }, {}, { floors: [] }).every((x) => buildable(badgeOf({ id: x.host, url: 'https://' + x.host + '/' }))), 'the self-run picks only buildable sites');
const card = fs.readFileSync(path.join(root, 'void-live-deploy/skills/tower.js'), 'utf8');
ok(/gateTag\(f, esc\)/.test(card) && /badgeText/.test(card), 'the tower card shows each floor\'s badge');
const next = fs.readFileSync(path.join(root, 'docs/NEXT.md'), 'utf8');
ok(/\[Gate: Code\]/.test(next) && /\[Gate: Partner\]/.test(next) && /\[Gate: License\]/.test(next) && /Stage 1/.test(next) && /only Code work/i.test(next), 'docs/NEXT.md records the badges, the stages and the queue rule');
process.exit(bad ? 1 : 0);
