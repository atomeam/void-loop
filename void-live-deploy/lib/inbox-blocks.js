// Grok's structured "Growth inbox item" blocks. A block is public only when it is not marked private.
// Owner-personal notes never become an inbox row or a frontier line.
const HEAD = /^\s*\*{0,2}Growth inbox item\*{0,2}\s*$/i;
const FIELD = /^\s*(?:[-*]\s*)?(?:\*\*)?([a-z][a-z ]{0,20})(?:\*\*)?\s*:\s*(.+)$/i;

const clean = (s) => String(s || '').replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim();

/** blocks in a note: [{ status, date, ask, source, private }]. A block with no ask is dropped. Pure. */
export function blocksOf(text) {
  const lines = String(text || '').split('\n'), out = [], cur = [];
  const flush = () => {
    if (!cur.length) return;
    const row = { status: 'open', date: '', ask: '', source: '', private: false };
    for (const line of cur) {
      const m = FIELD.exec(line);
      if (!m) continue;
      const k = m[1].toLowerCase().replace(/\s+/g, ''), v = clean(m[2]);
      if (k === 'status') row.status = v.toLowerCase() || 'open';
      else if (k === 'date') row.date = v.slice(0, 10);
      else if (k === 'ask') row.ask = v.slice(0, 300);
      else if (k === 'source') row.source = v.slice(0, 160);
      else if (k === 'private') row.private = /^(?:yes|true|1|owner)$/i.test(v);
    }
    if (row.ask) out.push(row);
    cur.length = 0;
  };
  for (const line of lines) {
    if (HEAD.test(line)) { flush(); cur.push(line); }
    else if (cur.length) cur.push(line);
  }
  flush();
  return out;
}

/** the blocks a public page may keep. Pure. */
export const publicBlocks = (rows) => (rows || []).filter((r) => r && !r.private && r.ask);

/** one inbox table row. Pure. */
export function inboxRow(block, date) {
  const ask = clean(block.ask).replace(/\|/g, '/');
  const source = clean(block.source || 'growth inbox item').replace(/\|/g, '/');
  return '| ' + (block.status || 'open') + ' | ' + (block.date || date) + ' | ' + ask + ' | ' + source + ' |';
}
