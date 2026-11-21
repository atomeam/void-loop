// clear-search-history — clear Verse's stored search history / recent asks
// Clears a2m.void.asks.v1 (ask suggestions) and a2m.void.loop.v1 (recent asks).

const STORAGE_KEYS = [
  { key: 'a2m.void.asks.v1', label: 'Recent search suggestions' },
  { key: 'a2m.void.loop.v1', label: 'Recent asks loop' },
];

const CLEAR_RE = /\b(clear|delete|erase|wipe|remove|reset|forget)\s+(my\s+|the\s+|all\s+)?(recent\s+)?(search\s+history|recent\s+searches|recent\s+asks|search\s+asks|searches|history)\b/i;

function match(lower, text) {
  const s = String(text || lower || '').trim();
  if (!s) return false;
  return CLEAR_RE.test(s);
}

function clearStoredHistory() {
  const cleared = [];
  const errors = [];
  if (typeof localStorage === 'undefined') {
    return { cleared, errors: ['localStorage is not available in this environment'] };
  }
  for (const item of STORAGE_KEYS) {
    try {
      const hadValue = localStorage.getItem(item.key) !== null;
      localStorage.removeItem(item.key);
      cleared.push({ key: item.key, label: item.label, hadValue });
    } catch (err) {
      console.warn('[clear-search-history] failed to clear', item.key, err);
      errors.push(`${item.key}: ${err && err.message ? err.message : String(err)}`);
    }
  }
  return { cleared, errors };
}

function cardHtml(esc, result) {
  const rows = result.cleared.map((c) => {
    const status = c.hadValue ? 'Cleared' : 'Already empty';
    return `<li><strong>${esc(c.label)}</strong> (<code>${esc(c.key)}</code>) — ${esc(status)}</li>`;
  }).join('');
  const errNote = result.errors.length
    ? `<p class="vl-warn">Some storage keys could not be cleared: ${esc(result.errors.join('; '))}</p>`
    : '';
  return [
    '<section class="vl-card vl-clear-history">',
    '  <header class="vl-card-head">',
    '    <p class="vl-kicker">PRIVACY · SEARCH HISTORY</p>',
    '    <h2>Search history cleared</h2>',
    '  </header>',
    '  <p>Verse removed your stored recent asks and search suggestions on this device.</p>',
    `  <ul>${rows}</ul>`,
    errNote,
    '</section>',
  ].join('\n');
}

function run(text, api) {
  if (!match(String(text || '').toLowerCase(), text)) return 'none';
  const result = clearStoredHistory();
  const { showPage, esc } = api;
  const safeEsc = typeof esc === 'function' ? esc : (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  showPage((el) => { el.innerHTML = cardHtml(safeEsc, result); });
  return 'clear-search-history';
}

export default {
  name: 'clear-search-history',
  examples: ['clear search history', 'clear my history', 'delete recent searches'],
  nearMisses: ['what is browser history', 'history of Rome', 'clear the table'],
  match,
  run,
  clearStoredHistory,
  cardHtml,
};
