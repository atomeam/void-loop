/**
 * systems-monitor skill — the board of systems Verse already watches.
 * Reads GET /api/status (the hourly guards). A guard is up, down, or unknown.
 * Nothing here is painted green when the status API did not say up.
 * "systems monitor", "monitor board for client", "status of my systems".
 */
export function isSystemsMonitor(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:systems?\s+monitor|monitor\s+(?:board|status)|status\s+of\s+my\s+systems|handoff\s+monitor)/i.test(t);
}

const STATE = new Set(['up', 'down', 'unknown']);

/** the public status JSON -> rows the card may show. A missing answer is unknown, never up. Pure. */
export function boardOf(status) {
  if (!status || typeof status !== 'object') return { overall: 'unknown', rows: [], note: 'the status API did not answer' };
  if (status.note) return { overall: 'unknown', rows: [], note: String(status.note) };
  const rows = (Array.isArray(status.guards) ? status.guards : []).map((g) => ({
    name: String((g && (g.name || g.id)) || 'guard').slice(0, 80),
    now: STATE.has(g && g.now) ? g.now : 'unknown',
    what: String((g && g.what) || '').slice(0, 160),
  }));
  const overall = status.overall === 'up' || status.overall === 'degraded' ? status.overall : 'unknown';
  return { overall, rows, note: rows.length ? '' : 'no guards in the status answer' };
}

export function boardHtml(esc, board) {
  const head = '<h2>Systems monitor</h2><p>Overall: <b>' + esc(board.overall) + '</b>' + (board.note ? '. ' + esc(board.note) + '.' : '.') + '</p>';
  if (!board.rows.length) return head + '<div class="src">Source: GET /api/status · no invented state</div>';
  const rows = board.rows.map((g) => '<tr><td>' + esc(g.name) + '</td><td>' + esc(g.now) + '</td><td>' + esc(g.what) + '</td></tr>').join('');
  return head + '<table><thead><tr><th>Guard</th><th>Now</th><th>What it watches</th></tr></thead><tbody>' + rows + '</tbody></table>'
    + '<div class="src">Source: GET /api/status · the hourly guards · nothing invented</div>';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Systems monitor</h2><div class="sub">reading /api/status…</div>'; });
  let status = null;
  try {
    const r = await fetch('/api/status');
    status = r.ok ? await r.json() : null;
  } catch (_) { status = null; }
  el.innerHTML = boardHtml(esc, boardOf(status));
  return 'systems-monitor';
}

export default {
  name: 'systems-monitor',
  examples: ['systems monitor', 'monitor board for client', 'status of my systems', 'handoff monitor board'],
  nearMisses: ['what is a monitor', 'system status', 'system status for the onboarding flow', 'monitor the weather'],
  match(lower, text) { return isSystemsMonitor(text || lower); },
  run,
};
