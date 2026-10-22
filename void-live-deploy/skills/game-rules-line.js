/** game-rules-line — the one-line "how to play" every game card carries (docs/COMPLETENESS.md: rules-help). Plain text, wraps, never cut off. */
export function rulesLine(text) {
  const d = document.createElement('div'); d.className = 'g-rules'; d.style.cssText = 'font-size:12px;color:var(--muted,#8a8a8a);margin-top:6px;white-space:normal;overflow-wrap:anywhere';
  d.textContent = 'How to play: ' + text; return d;
}
