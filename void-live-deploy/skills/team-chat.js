/**
 * team-chat skill: "team chat", "agent workspace", "my agents" (owner, 2026-10-29: "verse should reverse engineer and create its own version of
 * slack", "so it can bring in lots of agents and constantly keep all of them busy itself"): the team chat as a card on the stage. It shows the
 * workspace as anyone may see it (functions/api/team.js GET: channels with their counts, each agent with busy, idle or away, and how many jobs
 * wait for an agent), says when no agent has joined yet, and links to /team/. Read only: the card posts nothing and shows no message.
 * Made with tools/new-skill.mjs (docs/UPGRADING.md).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const WHEN = /^(?:(?:the |a |my |open (?:the |my )?|show (?:me )?(?:the |my )?)?(?:team ?chat|team workspace|agents? (?:chat|workspace)|slack alternative)|(?:my|the) agents|chat (?:for|with) (?:my |the )?agents)$/i;
const DOT = { busy: '●', idle: '○', away: '·' };
/** the card's lines from the open workspace read: the agents (busy first), then the channels. Pure. */
export function teamLines(w) {
  const order = { busy: 0, idle: 1, away: 2 }, members = (Array.isArray(w && w.members) ? w.members : []).slice().sort((a, b) => (order[a.state] ?? 3) - (order[b.state] ?? 3));
  const agents = members.slice(0, 8).map((m) => ({ href: '/team/', text: (DOT[m.state] || '·') + ' ' + m.name + ' · ' + m.state + (m.done ? ' · ' + m.done + ' done' : '') }));
  const channels = (Array.isArray(w && w.channels) ? w.channels : []).slice(0, 6).map((c) => ({ href: '/team/#c=' + c.code, text: '#' + c.code + ' · ' + (c.msgs || 0) + ' message' + (c.msgs === 1 ? '' : 's') }));
  return { agents, channels, waiting: Number(w && w.waiting) || 0, busy: members.filter((m) => m.state === 'busy').length };
}

function run(text, api) {
  const { showPage } = api;
  showPage((el) => {
    el.dataset.page = '/team/';
    el.innerHTML = '<h2>Team chat</h2><p>Verse and its agents at work: channels, threads, mentions, reactions and search. Verse hands every idle agent its next job as a thread in #work, and the next one the moment it closes it.</p>' // void-review: ok: fixed text
      + '<p class="tw" style="margin:6px 0">Looking at the team…</p><ul class="tl" style="padding-left:18px;margin:6px 0"></ul>'
      + '<p><a href="/team/" style="font-weight:600">Open the team chat →</a></p>'
      + '<div class="src">From Verse’s own workspace: names and presence only; messages are for its members</div>';
    const say = el.querySelector('.tw'), ul = el.querySelector('.tl');
    const line = (l) => { const li = document.createElement('li'), a = document.createElement('a'); a.href = l.href; a.textContent = l.text; li.append(a); ul.append(li); };
    fetch('/api/team').then((r) => r.json()).then((j) => {
      const t = teamLines(j);
      say.textContent = (t.agents.length ? t.agents.length + ' agent' + (t.agents.length === 1 ? '' : 's') + ', ' + t.busy + ' busy' : 'No agent has joined yet: the owner invites the first from /team/') + ' · ' + t.waiting + ' job' + (t.waiting === 1 ? '' : 's') + ' waiting for an agent';
      for (const l of t.agents.concat(t.channels)) line(l);
    }).catch(() => { say.textContent = 'The team chat did not answer just now.'; });
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
