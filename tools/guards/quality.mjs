// The quality engine rides the house lanes as a self-guard (tools/quality-engine.mjs): it settles the change it started last time, measures the least
// recently measured surfaces for real, and starts the next fix in the tree, which the house lane ships as a pull request. Its numbers go to
// void-live-deploy/quality/board.json (the quality board on /scoreboard/); its cost and what it did go to its line of "What Verse is doing".
export async function run(ctx) {
  let charter = '';
  try { const ch = await import('../charter.mjs'), c = ch.check(); if (c.standingMissing.length) ch.restore(); charter = ' Charter: ' + (c.standingMissing.length ? 'restored ' + c.standingMissing.length + ' lines' : 'whole') + (c.promptsDropped.length ? ', prompts that dropped it: ' + c.promptsDropped.join(' ') : '') + '.'; } catch (e) { charter = ' Charter check failed: ' + String(e && e.message || e).slice(0, 60); }
  const { lane } = await import('../quality-engine.mjs');
  const r = await lane({ limit: 4, dry: ctx.dry, env: ctx.env });
  let want = '';
  try { if (!ctx.dry) { const { next } = await import('../quality-create.mjs'); const n = await next({ env: ctx.env }); want = ' Next to make: ' + (n.pick ? n.pick.want + ' (' + n.pick.count + ', ' + n.pick.source + (n.pick.extend ? ', adds to ' + n.pick.extend : '') + ')' : 'nothing asked yet') + (n.note ? ' [' + n.note + ']' : '') + '.'; } } catch (e) { want = ' Next to make: unread (' + String(e && e.message || e).slice(0, 60) + ').'; }
  let shown = '';
  try { const { run: show } = await import('../win-post.mjs'); const s = await show({ env: ctx.env, dry: ctx.dry }); shown = ' Showcase: ' + (s.note || s.last || ''); } catch (e) { shown = ' Showcase: ' + String(e && e.message || e).slice(0, 80); }
  return { last: r.last + charter + want + shown, ok: true, minutes: r.minutes, note: r.note, paidCents: 0 };
}
