// Which asks does Void already handle with a live skill? stdin: JSON array of asks -> stdout: JSON array of booleans.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy', 'skills');
const names = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const skills = [];
for (const n of names) { try { skills.push((await import(pathToFileURL(path.join(dir, n + '.js')).href)).default); } catch (_) {} }
const asks = JSON.parse(fs.readFileSync(0, 'utf8'));
console.log(JSON.stringify(asks.map((a) => skills.some((s) => { try { return s.match(a.toLowerCase(), a); } catch (_) { return false; } }))));
