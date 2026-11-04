// /team/: Verse's bots as team members: the count per category from bots/registry.json (families summed), a page of the hand-made ones,
// and a search that opens /bots/ (thousands of bots: the full list, search and pages live there, not here)
const box = document.getElementById('botsBox');
if (box) fetch('/bots/registry.json', { cache: 'no-cache' }).then((r) => r.json()).then((reg) => {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const live = reg.bots.filter((b) => b.status === 'live'), by = {};
  for (const b of live) by[b.cat] = (by[b.cat] || 0) + 1;
  for (const f of reg.families || []) by[f.cat] = (by[f.cat] || 0) + f.live;
  box.querySelector('[data-sum]').innerHTML = Number(reg.live || live.length).toLocaleString() + ' bots on the team, each passing its checks' + (reg.failed ? ' (' + reg.failed + ' failing, not counted)' : '') + ': '
    + Object.entries(by).sort((a, b) => b[1] - a[1]).map(([c, n]) => '<a href="/bots/?cat=' + encodeURIComponent(c) + '">' + esc(c) + ' ' + n.toLocaleString() + '</a>').join(' · ')
    + ' <form action="/bots/" style="display:inline"><label class="sr" for="botq">Search the bots</label><input id="botq" name="q" placeholder="Find a bot" autocomplete="off"></form>';
  box.querySelector('[data-list]').innerHTML = live.slice(0, 40).map((b) => '<li><a href="/bots/?q=' + esc(b.id) + '"><b>' + esc(b.id) + '</b></a> <span class="muted">' + esc(b.job) + '</span></li>').join('') + (live.length > 40 ? '<li><a href="/bots/">all of them</a></li>' : '');
}).catch(() => { box.querySelector('[data-sum]').textContent = 'The bot list did not load; see /bots/.'; });
