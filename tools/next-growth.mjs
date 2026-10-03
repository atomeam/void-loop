// Open growth ideas. Prints every open row. Building rows are in progress, not a lock.
import { readFileSync } from 'node:fs';
const text = readFileSync(new URL('../domains/growth-inbox.md', import.meta.url), 'utf8');
const open = text.split('\n').filter((line) => line.startsWith('| open |'));
const building = text.split('\n').filter((line) => line.startsWith('| building |'));
if (!open.length && !building.length) {
  console.log('none');
  process.exit(1);
}
for (const line of open) console.log(line);
for (const line of building) console.log(line);
