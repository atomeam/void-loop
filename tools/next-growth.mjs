// Oldest open growth-inbox row. Building rows are already claimed.
import { readFileSync } from 'node:fs';
const text = readFileSync(new URL('../domains/growth-inbox.md', import.meta.url), 'utf8');
const rows = text.split('\n').filter((line) => line.startsWith('| open |') || line.startsWith('| building |'));
const open = rows.find((line) => line.startsWith('| open |'));
if (!open) {
  console.log(rows[0] || 'none');
  process.exit(rows.length ? 0 : 1);
}
console.log(open);
