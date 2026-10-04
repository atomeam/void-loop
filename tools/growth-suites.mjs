// One suite check per growth skill that exports suite(). Exit 1 on any failure.
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'skills');
let failed = 0;
for (const name of readdirSync(dir)) {
  if (!name.endsWith('.js')) continue;
  const mod = await import(pathToFileURL(resolve(dir, name)).href);
  const skill = mod.default;
  if (!skill || typeof skill.suite !== 'function') continue;
  const r = skill.suite();
  const ok = !!(r && r.ok);
  console.log((ok ? 'pass ' : 'FAIL ') + skill.name + (ok ? '' : '  -> ' + (r && r.got)));
  if (!ok) failed += 1;
}
if (!failed) console.log('growth suites ok');
process.exit(failed ? 1 : 0);
