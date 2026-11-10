/**
 * team-chat skill: the workspace as a card. Builders, owner asks, and finished work a visitor can open.
 * Clock-crew checks stay off this card. Contract: { name, examples, nearMisses, match, run }.
 */
const WHEN = /^(?:(?:the |a |my |open (?:the |my )?|show (?:me )?(?:the |my )?)?(?:team ?chat|team workspace|agents? (?:chat|workspace)|slack alternative)|(?:my|the) agents|chat (?:for|with) (?:my |the )?agents)$/i;

/** the card's pieces from the open workspace read. Pure. */
export function teamLines(w) {
  const members = Array.isArray(w && w.members) ? w.members : [];
  const order = { busy: 0, idle: 1, away: 2 };
  const builders = members.filter((m) => m && !m.crew).slice().sort((a, b) => (order[a.state] ?? 3) - (order[b.state] ?? 3)).slice(0, 8);
  const asks = (Array.isArray(w && w.asks) ? w.asks : []).slice(0, 6);
  const feed = (Array.isArray(w && w.feed) ? w.feed : []).slice(0, 6);
  const busy = builders.filter((m) => m.state === 'busy');
  return { builders, asks, feed, waiting: Number(w && w.waiting) || 0, busy: busy.length, busiest: busy[0] ? busy[0].name : (builders[0] ? builders[0].name : '') };
}

function run(text, api) {
  const { showPage } = api;
  showPage((el) => {
    el.dataset.page = '/team/';
    el.innerHTML = '<h2>Team chat</h2><div class="tc-art" aria-hidden="true"></div><p class="tc-stats"></p><div class="tc-asks"></div><div class="tc-chips"></div><ol class="tc-feed"></ol><p><a href="/team/">Open the team chat</a></p>';
    const art = el.querySelector('.tc-art'), stats = el.querySelector('.tc-stats'), asks = el.querySelector('.tc-asks'), chips = el.querySelector('.tc-chips'), feed = el.querySelector('.tc-feed');
    fetch('/api/team').then((r) => r.json()).then((j) => {
      const t = teamLines(j);
      const dots = t.builders.map((m) => '<span title="' + m.name + '" style="display:inline-block;width:14px;height:14px;border-radius:50%;margin:2px;background:' + (m.state === 'busy' ? '#9eb2ff' : '#3a4158') + '"></span>').join('');
      art.innerHTML = '<div style="min-height:72px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">' + (dots || '<span style="opacity:.7">No builder has joined</span>') + '</div>';
      stats.textContent = t.waiting + ' jobs waiting · ' + t.feed.length + ' recent shipments · ' + (t.busiest ? 'busiest ' + t.busiest : 'nobody busy');
      asks.innerHTML = t.asks.length ? '<p><b>Owner asks</b></p>' + t.asks.map((a) => '<div>' + a.state + ' · ' + a.title + '</div>').join('') : '';
      chips.innerHTML = t.builders.map((m) => '<span style="display:inline-block;margin:4px 6px 0 0;padding:4px 8px;border:1px solid #2a3148;border-radius:999px">' + m.name + ' · ' + (m.now || m.state) + '</span>').join('');
      for (const f of t.feed) { const li = document.createElement('li'); const a = document.createElement('a'); a.href = f.href || '/team/'; a.textContent = f.text; li.append(a); feed.append(li); }
      const box = el.closest('.vc') && el.closest('.vc').querySelector('.vc-art');
      if (box) box.innerHTML = art.innerHTML;
    }).catch(() => { stats.textContent = 'The team chat did not answer just now.'; });
  });
  return 'team-chat';
}

export default {
  name: 'team-chat',
  examples: ['team chat', 'open the team chat', 'agent workspace', 'my agents', 'chat with my agents'],
  nearMisses: ['chat', 'team building ideas'],
  match(lower) { return WHEN.test(lower.trim()); },
  run,
};
