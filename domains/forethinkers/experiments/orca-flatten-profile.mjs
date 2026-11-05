// Flattens an OrcaSlicer system profile (follows 'inherits') into one JSON the CLI can load. Usage: node orca-flatten-profile.mjs <machine|process|filament> "<profile name>" out.json [ROOT=<profiles/BBL dir>]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const ROOT = process.env.ROOT || '/workspace/ft-3mf/squashfs-root/resources/profiles/BBL';
function find(kind, name) {
  for (const sub of [kind, kind === 'filament' ? 'filament' : kind]) {
    const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) { if (f.isDirectory()) { const r = walk(d + '/' + f.name); if (r) return r; } else if (f.name === name + '.json') return d + '/' + f.name; } };
    const r = walk(ROOT + '/' + sub); if (r) return r;
  }
  throw new Error('missing ' + kind + ' ' + name);
}
function flat(kind, name) {
  const j = JSON.parse(readFileSync(find(kind, name), 'utf8'));
  const parent = j.inherits ? flat(kind, j.inherits) : {};
  return { ...parent, ...j };
}
const [kind, name, out, extra] = process.argv.slice(2);
const j = flat(kind, name); delete j.inherits; j.from = 'User'; j.is_custom_defined = '1';
if (extra) Object.assign(j, JSON.parse(extra));
writeFileSync(out, JSON.stringify(j, null, 1));
