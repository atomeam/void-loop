// /team/: Verse's live bots as team members, from bots/registry.json (tools/bot-factory.mjs: only bots whose probe passed are live)
const box = document.getElementById('botsBox');
if (box) fetch('/bots/registry.json', { cache: 'no-cache' }).then((r) => r.json()).then((reg) => {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const live = reg.bots.filter((b) => b.status === 'live');
  box.querySelector('[data-sum]').textContent = live.length + ' bots on the team, each passing its probe on a real task' + (reg.failed ? ' (' + reg.failed + ' still failing, not counted)' : '') + '.';
  box.querySelector('[data-list]').innerHTML = live.map((b) => '<li><a href="/bots/#' + esc(b.id) + '"><b>' + esc(b.id) + '</b></a> <span class="muted">' + esc(b.cat) + ' · ' + esc(b.job) + '</span></li>').join('');
}).catch(() => { box.querySelector('[data-sum]').textContent = 'The bot list did not load; see /bots/.'; });
