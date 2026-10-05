// One suite check per growth skill that exports suite(). Exit 1 on any failure.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'skills');
let failed = 0;

// The skill index has to be exactly one json array of names that each have a file, and nothing else.
// It was briefly two arrays on two lines. JSON.parse rejects that, the page's loader swallowed it in
// its catch, learnedSkills stayed empty, and every ask fell through to the model with no skill
// registered and nothing in the logs - which is indistinguishable from a routing bug and cost two
// merges to spot. It also breaks inventory.js, which imports this file directly.
// Checked first and on its own: importing the skills below would throw on a corrupt index before we
// got here, so a clean message here is the whole point.
{
  let note = '', good = false;
  try {
    const idx = JSON.parse(readFileSync(resolve(dir, 'index.json'), 'utf8'));
    if (!Array.isArray(idx)) note = 'root is ' + (idx === null ? 'null' : typeof idx) + ', not an Array';
    else if (!idx.every((n) => typeof n === 'string' && n)) note = 'a name is not a string';
    else if (new Set(idx).size !== idx.length) note = 'duplicate names: ' + idx.filter((n, i) => idx.indexOf(n) !== i).join(',');
    else {
      const orphans = idx.filter((n) => !existsSync(resolve(dir, n + '.js')));
      if (orphans.length) note = 'no file for: ' + orphans.join(',');
    }
    good = !note;
  } catch (e) { note = String((e && e.message) || e); }
  console.log((good ? 'pass ' : 'FAIL ') + 'skills index: one array, no duplicates, every name has a file' + (good ? '' : '  -> ' + note));
  if (!good) { console.log('fix the index before reading anything into it: one array, one line'); process.exit(1); }
}

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