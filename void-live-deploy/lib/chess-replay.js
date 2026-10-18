// chess-replay — step through a finished game from your match history, move by move, with the engine's read of each move (asked by
// Void: "Implement a 'match-replay' button on the chess history table that lets the user step through the moves with engine
// annotations"). The game's moves come from the history (lib/match-history.js keeps a chess game's line as coordinates); the
// positions are rebuilt with the rules (skills/chess-rules.js play), and each move is graded on demand by moveVerdict (a shallow
// search: best move, good, inaccuracy, mistake, blunder, checkmate), cached, so stepping back costs nothing.
//   positions(R, line)                  -> [start, after move 1, …] (stops at the first move the rules refuse)
//   replayHtml(esc, R, view)            -> the panel for view { line, pos, i, verdict } (pure)
//   mountReplay(host, R, line)          -> draws the panel in host and wires its buttons and the arrow keys; returns { go(i), close() }
const GLYPH = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const TINT = { best: '#7fd6a0', good: '#a9c7ff', inaccuracy: '#ffd27a', mistake: '#ff9f5a', blunder: '#ff6b6b', mate: '#e7c6ff' };

export function positions(R, line) {
  const out = [R.create()];
  for (const mv of line || []) { try { out.push(R.play(out[out.length - 1], mv)); } catch (_) { break; } }
  return out;
}

export function replayHtml(esc, R, { line, pos, i, verdict }) {
  const s = pos[i], last = i > 0 ? line[i - 1] : '', from = last ? R.sqIndex(last.slice(0, 2)) : -1, to = last ? R.sqIndex(last.slice(2, 4)) : -1;
  let cells = '';
  for (let r = 7; r >= 0; r--) for (let f = 0; f < 8; f++) {
    const sq = r * 8 + f, p = s.board[sq], dark = (r + f) % 2 === 0, lit = sq === from || sq === to;
    cells += '<div class="cr-sq' + (dark ? ' dark' : '') + (lit ? ' lit' : '') + '" aria-hidden="true">' + (p ? GLYPH[p] : '') + '</div>';
  }
  const n = pos.length - 1, moveNo = i > 0 ? Math.ceil(i / 2) + (i % 2 ? '.' : '…') + ' ' : '';
  const note = i === 0 ? 'The start: step forward to see each move and how good it was.'
    : verdict ? moveNo + verdict.label + ' · ' + R.VERDICTS[verdict.verdict] + (verdict.allowsMate ? ': it lets the other side mate at once' + (verdict.best ? ' (' + verdict.best + ' instead)' : '')
      : verdict.best ? ' (the engine liked ' + verdict.best + (verdict.loss ? ', about ' + (verdict.loss / 100).toFixed(1) + ' pawns better' : '') + ')' : '')
    : moveNo + 'reading this move…';
  const btn = (k, label, aria, off) => '<button type="button" class="cr-btn" data-step="' + k + '" aria-label="' + aria + '"' + (off ? ' disabled' : '') + '>' + label + '</button>';
  return '<div class="chess-replay" role="group" aria-label="Match replay">'
    + '<div class="cr-board" role="img" aria-label="' + esc('Position after move ' + i + ' of ' + n) + '">' + cells + '</div>'
    + '<p class="cr-note" aria-live="polite"' + (verdict ? ' data-verdict="' + esc(verdict.verdict) + '" style="color:' + TINT[verdict.verdict] + '"' : '') + '>' + esc(note) + '</p>'
    + '<div class="cr-row">' + btn('first', '⏮', 'First position', i === 0) + btn('prev', '◀', 'Previous move', i === 0)
    + '<span class="cr-count">' + i + ' / ' + n + '</span>' + btn('next', '▶', 'Next move', i === n) + btn('last', '⏭', 'Last move', i === n)
    + btn('close', '✕', 'Close the replay', false) + '</div></div>';
}

const STYLE = '<style>.chess-replay{margin:10px 0 4px;padding:10px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1)}'
  + '.cr-board{display:grid;grid-template-columns:repeat(8,1fr);width:min(100%,300px,24vh);aspect-ratio:1;margin:0 auto;border-radius:8px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.4)}'
  + '.cr-sq{display:grid;place-items:center;background:#e9dcc4;color:#1b1b1b;font-size:min(7vw,2.7vh,28px);line-height:1}.cr-sq.dark{background:#a97c55}'
  + '.cr-sq.lit{box-shadow:inset 0 0 0 999px rgba(122,92,255,.35)}.cr-note{text-align:center;margin:8px 0 6px;min-height:1.3em;font-size:14px;line-height:1.35}'
  + '.cr-row{display:flex;justify-content:center;align-items:center;gap:5px}.cr-count{opacity:.7;font-variant-numeric:tabular-nums;min-width:3.6em;text-align:center}'
  + '.cr-btn{min-width:38px;min-height:38px;padding:0 8px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:inherit;cursor:pointer;font-size:16px}'
  + '.cr-btn:disabled{opacity:.35;cursor:default}.cr-btn:focus-visible{outline:2px solid rgba(170,190,255,.85);outline-offset:2px}'
  + '.mh-replay{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:inherit;border-radius:8px;padding:4px 10px;cursor:pointer;white-space:nowrap}</style>';
export const REPLAY_STYLE = STYLE;

export function mountReplay(host, R, line, esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))) {
  const pos = positions(R, line), seen = new Map(); let i = 0;
  const verdictAt = (k) => { if (k < 1) return null; if (!seen.has(k)) { try { seen.set(k, R.moveVerdict(pos[k - 1], line[k - 1])); } catch (_) { seen.set(k, null); } } return seen.get(k); };
  const draw = (v) => { host.innerHTML = STYLE + replayHtml(esc, R, { line, pos, i, verdict: v }); };
  // the board moves at once; the engine's read follows a frame later, so stepping never waits on the search
  const go = (k) => { i = Math.max(0, Math.min(pos.length - 1, k)); draw(seen.get(i) || null); if (i > 0 && !seen.has(i)) { const at = i; setTimeout(() => { if (at === i) draw(verdictAt(at)); }, 0); } };
  const step = { first: () => go(0), prev: () => go(i - 1), next: () => go(i + 1), last: () => go(pos.length - 1), close: () => close() };
  const onClick = (e) => { const b = e.target.closest && e.target.closest('.cr-btn'); if (!b || b.disabled) return; e.stopPropagation(); step[b.dataset.step](); const again = host.querySelector('.cr-btn[data-step="' + b.dataset.step + '"]:not([disabled])'); if (again) again.focus({ preventScroll: true }); }; // keeping focus must not scroll the card (it pushed the board off a phone's card)
  const onKey = (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); } else if (e.key === 'Escape') close(); };
  function close() { host.removeEventListener('click', onClick); host.removeEventListener('keydown', onKey); host.innerHTML = ''; }
  host.addEventListener('click', onClick); host.addEventListener('keydown', onKey);
  go(0);
  return { go, close, get i() { return i; }, positions: pos.length };
}
