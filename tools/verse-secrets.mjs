// The names of the secrets and settings Verse's own code reads, so Verse answers "what is the secret called?" from its real setup
// and never guesses one (owner, 2026-10-30: a pasted chat log about the Modal step was answered with a made-up MODAL_TOKEN and a
// question back about what the name is). Names only, never a value: the names are in the public code already.
//   cloudflare: what the site's code reads from env (void-live-deploy: functions, lib, skills): a Cloudflare variable or secret
//   github:     what the repo's workflows read from secrets: a GitHub repository secret
// node tools/verse-secrets.mjs --write   rewrite void-live-deploy/lib/verse-secrets.js (tools/note-ask.test.mjs checks it is current)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = path.join(root, 'void-live-deploy/lib/verse-secrets.js');
// bindings from wrangler.toml are not settings anyone saves: they are wired to a KV, D1, R2 or AI resource
const BINDINGS = new Set(['ASSETS', 'AI', 'DB', 'MISSES', 'FILMS', 'EMAIL']);
const walk = (dir, ext) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name);
  return d.isDirectory() ? (d.name === 'node_modules' || d.name === 'vendor' ? [] : walk(p, ext)) : ext.test(d.name) ? [p] : [];
}) : []);
const names = (files, re) => [...new Set(files.flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(re)].map((m) => m[1])))].sort();
export function scan() {
  const site = ['functions', 'lib', 'skills'].flatMap((d) => walk(path.join(root, 'void-live-deploy', d), /\.(?:m?js)$/));
  const cloudflare = names(site, /\benv\s*(?:\.\s*|\[\s*['"])([A-Z][A-Z0-9_]{2,})\b/g).filter((n) => !BINDINGS.has(n) && !n.endsWith('_')); // a name built from parts (env['FREE_PICS_' + day]) is not one name
  const github = names(walk(path.join(root, '.github/workflows'), /\.ya?ml$/), /\bsecrets\.([A-Z][A-Z0-9_]{2,})\b/g);
  return { cloudflare, github };
}
/** the module file: written by --write, compared by tools/note-ask.test.mjs */
export const render = (v) => '// Written by tools/verse-secrets.mjs --write: the secret and setting names Verse\'s own code reads. Names only, never a value.\n'
  + 'export default ' + JSON.stringify(v, null, 1) + ';\n';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = render(scan());
  if (process.argv.includes('--write')) { fs.writeFileSync(OUT, s); console.log('wrote ' + path.relative(root, OUT)); } else process.stdout.write(s);
}
