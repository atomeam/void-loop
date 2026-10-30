// Which asks does Verse already handle with a live skill? stdin: JSON array of asks -> stdout: JSON array of booleans.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy', 'skills');
const names = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const skills = [];
for (const n of names) { try { skills.push((await import(pathToFileURL(path.join(dir, n + '.js')).href)).default); } catch (_) {} }
const asks = JSON.parse(fs.readFileSync(0, 'utf8'));
// the page answers some asks itself (the inline list takes "add milk"); tools/grown.json lists every once-missed ask Verse now
// answers, each replayed on the real page by the browser suite, so an ask there counts as handled too
// a note about one of Verse's own answer cards ("this card is the first one that speaks as itself ... some parts are still off") is
// answered on purpose by the question path, as Verse speaking of its own card (lib/self-context.js isOwnCardNote, OWN_CARD_RULE).
// The router logs it near the self skill, but it is no wording to teach a skill (owner, 2026-10-30: one such note, asked 4 times,
// came back as the want "teach my self skill" and the will's rewrite called it "self-reflection probes")
const { isOwnCardNote } = await import(pathToFileURL(path.join(dir, '..', 'lib', 'self-context.js')).href);
const grown = new Set((() => { try { return JSON.parse(fs.readFileSync(path.join(dir, '..', '..', 'tools', 'grown.json'), 'utf8')); } catch (_) { return []; } })().map((g) => String(g.ask || '').trim().toLowerCase()));
console.log(JSON.stringify(asks.map((a) => grown.has(String(a).trim().toLowerCase()) || isOwnCardNote(a) || skills.some((s) => { try { return s.match(a.toLowerCase(), a); } catch (_) { return false; } }))));
