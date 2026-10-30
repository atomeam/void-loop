/**
 * grip: the slim handle under a board standing in the void. The canvas takes taps and orbits, so this is what you drag.
 * Its own file (owner, 2026-10-30: the games family loads only what match() needs) so the Magic 8 Ball's card, which needs
 * only this, does not pull in the side card, the how-to and the sounds; skills/side-card.js hands it on unchanged.
 */
export function grip(label) {
  const g = document.createElement('div');
  g.className = 'board-grip';
  g.title = 'drag to move the board';
  g.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-top:-6px;padding:3px 12px;border-radius:999px;color:var(--muted,#8a8a8a);font-size:11px;letter-spacing:.06em;text-transform:uppercase;cursor:grab;user-select:none;background:rgba(12,12,13,.35)';
  g.textContent = '⠿ ' + label;
  return g;
}
