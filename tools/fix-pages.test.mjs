// The fix pages are generated from tools/fix-pages.json: the files on disk and the sitemap must match what the generator
// writes, and every page's "Ask Verse" link must be an ask Verse's fixer takes (build() throws otherwise).
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, [resolve(here, 'fix-pages.mjs'), '--check'], { encoding: 'utf8' });
process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
process.exit(r.status === 0 ? 0 : 1);
