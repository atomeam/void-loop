/**
 * team-chat skill: "team chat", "agent workspace", "my agents" (owner, 2026-10-29: "verse should reverse engineer and create its own version of
 * slack", "so it can bring in lots of agents and constantly keep all of them busy itself"): the team chat as a card on the stage. It shows the
 * workspace as anyone may see it (functions/api/team.js GET: channels with their counts, each agent with busy, idle or away, and how many jobs
 * wait for an agent), says when no agent has joined yet, and links to /team/. Read only: the card posts nothing and shows no message.
 * Made with tools/new-skill.mjs (docs/UPGRADING.md).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const WHEN = /^(?:(?:the |a |my |open (?:the |my )?|show (?:me )?(?:the |my )?)?(?:team ?chat|team workspace|agents? (?:chat|workspace)|slack alternative)|(?:my|the) agents|chat (?:for|with) (?:my |the )?agents)$/i;
// help build Verse (owner, 2026-11-03: "help build verse fore me and paying members"): the open jobs board and the member join on /team/#build
const BUILD = /^(?:how (?:can|do) i )?(?:help (?:to )?build|contribute to|work on) (?:verse|a-to-mind)$|^(?:join|become a member of) (?:the )?verse team$|^(?:verse|team) (?:open )?jobs(?: board)?$|^(?:good first|open) (?:tasks|issues) (?:for|on|in) verse$/i;
// the owner's one line from the stage: "team job: add a tide table", "verse idea: a members call" opens /team/ with it in the one-line box
const POST = /^(?:team|verse) (job|idea)[:,] (.+)$|^(?:post|add) (?:a |an )?(job|idea) (?:to|for|in) (?:the )?(?:verse )?team[:,]? (.+)$/i;
/** where a post ask goes: /team/?job=<words>#build (or ?idea=), or '' when the ask is not one. Pure. */
export function postLink(text) {
  const m = POST.exec(String(text || '').replace(/\s+/g, ' ').trim()); if (!m) return '';
  return '/team/?' + new URLSearchParams({ [(m[1] || m[3]).toLowerCase()]: (m[2] || m[4]).trim().slice(0, 1000) }) + '#build';
}
const DOT = { busy: '●', idle: '○', away: '·' };
/** the card's lines from the open workspace read: the agents (busy first), then the channels. Pure. */
export function teamLines(w) {
  const order = { busy: 0, idle: 1, away: 2 }, members = (Array.isArray(w && w.members) ? w.members : []).slice().sort((a, b) => (order[a.state] ?? 3) - (order[b.state] ?? 3));
  const agents = members.slice(0, 8).map((m) => ({ href: '/team/', text: (DOT[m.state] || '·') + ' ' + m.name + ' · ' + m.state + (m.done ? ' · ' + m.done + ' done' : '') }));
  const channels = (Array.isArray(w && w.channels) ? w.channels : []).slice(0, 6).map((c) => ({ href: '/team/#c=' + c.code, text: '#' + c.code + ' · ' + (c.msgs || 0) + ' message' + (c.msgs === 1 ? '' : 's') }));
  return { agents, channels, waiting: Number(w && w.waiting) || 0, busy: members.filter((m) => m.state === 'busy').length };
}

function runBuild(text, api) {
  const { showPage, esc } = api, post = postLink(text);
  showPage((el) => {
    el.dataset.page = post || '/team/#build';
    if (post) {
      const kind = /[?&]idea=/.test(post) ? 'idea' : 'job', words = new URLSearchParams(post.split('?')[1].split('#')[0]).get(kind);
      el.innerHTML = '<h2>Post to the team</h2><p>' + (kind === 'job' ? 'A job in #work, on the open board for the team to claim:' : 'An idea in #ideas, for the team to talk over:') + '</p><blockquote style="margin:6px 0;padding-left:10px;border-left:3px solid #8886">' + esc(words) + '</blockquote>'
        + '<p><a href="' + esc(post) + '" style="font-weight:600">Post it →</a> (the owner\'s one-line box on /team/, one press there)</p><div class="src">Only the owner\'s key posts from that box; members propose in #ideas</div>';
      return;
    }
    el.innerHTML = '<h2>Help build Verse</h2><p>Verse is built in the open by its owner, its members and their agents. Anyone who bought from the store joins as a member with the license key from the receipt, picks a job from the open board, and gets public credit for every pull request.</p>' // void-review: ok: fixed text
      + '<p class="tw" style="margin:6px 0">Reading the open board…</p><ul class="tl" style="padding-left:18px;margin:6px 0"></ul>'
      + '<p><a href="/team/#build" style="font-weight:600">See the board and become a member →</a></p>'
      + '<div class="src">From Verse’s own team: the open jobs board at /api/team?jobs</div>';
    const say = el.querySelector('.tw'), ul = el.querySelector('.tl');
    fetch('/api/team?jobs').then((r) => r.json()).then((j) => {
      const jobs = Array.isArray(j && j.jobs) ? j.jobs : [];
      say.textContent = jobs.length ? jobs.length + ' open job' + (jobs.length === 1 ? '' : 's') + ', ' + jobs.filter((x) => x.good).length + ' good first tasks' : 'Nothing open right now: propose one in #ideas.';
      for (const x of jobs.slice(0, 5)) { const li = document.createElement('li'), a = document.createElement('a'); a.href = '/team/#build'; a.textContent = x.label + ': ' + x.title; li.append(a); ul.append(li); }
    }).catch(() => { say.textContent = 'The board did not answer just now.'; });
  });
  return 'team-chat';
}

function run(text, api) {
  if (BUILD.test(String(text || '').trim().replace(/[?!.]+$/, '')) || postLink(text)) return runBuild(text, api);
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
  examples: ['team chat', 'open the team chat', 'agent workspace', 'my agents', 'chat with my agents', 'help build verse', 'how can i help build verse', 'verse jobs', 'team job: add a tide table'],
  nearMisses: ['chat', 'team building ideas', 'jobs near me', 'post a job'],
  match(lower, text) { const t = lower.trim().replace(/[?!.]+$/, ''); return WHEN.test(t) || BUILD.test(t) || !!postLink(text || lower); },
  run,
};
