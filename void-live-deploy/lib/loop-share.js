// Share of merged pull requests authored by Verse's own loop, against outside agents.
// The loop is a loop/ or verse/ or tower-self/ branch, or a title the loop writes
// ("Verse loop:", "Better at", "made by Verse", "Versus by itself"). Other pulls the
// Actions bot opens are counted apart, so they do not pad the loop's share.
// A pull that was closed without merging is not counted. Pure.

export function authorOf(pr) {
  const ref = String((pr && (pr.ref || (pr.head && pr.head.ref))) || '');
  const title = String((pr && pr.title) || '');
  const login = String((pr && (pr.login || (pr.user && pr.user.login))) || '');
  if (/^(?:loop|verse|tower-self)\//.test(ref)) return 'loop';
  if (/^Verse loop:/i.test(title) || /^Better at /.test(title) || /made by Verse/i.test(title) || /^Versus by itself/.test(title)) return 'loop';
  if (login === 'github-actions[bot]') return 'verse-bot';
  return 'outside';
}

/** merged pulls -> { loop, outside, bot, of, share } with share as a percent to 0.1, or null when there is nothing to compare. Pure. */
export function shareOf(prs, { since = 0 } = {}) {
  let loop = 0, outside = 0, bot = 0;
  for (const p of prs || []) {
    if (!p || !(p.merged_at || p.merged === true)) continue;
    const at = Date.parse(p.merged_at || p.mergedAt || '');
    if (since && !(at >= since)) continue;
    const who = authorOf(p);
    if (who === 'loop') loop++;
    else if (who === 'verse-bot') bot++;
    else outside++;
  }
  const of = loop + outside;
  return { loop, outside, bot, of, share: of ? Math.round((1000 * loop) / of) / 10 : null };
}
