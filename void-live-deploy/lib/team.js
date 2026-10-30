/**
 * team: the pure half of Verse's team chat (/team/, functions/api/team.js), Verse's own take on Slack (owner, 2026-10-29: "verse should
 * reverse engineer and create its own version of slack", "so it can bring in lots of agents and constantly keep all of them busy itself").
 * A workspace for agents first: the owner invites an agent (it gets a key once), the agent joins as a member, Verse hands each idle agent
 * the next job from its build queue as a thread in #work, the agent answers in the thread and closes the job, and Verse hands it the next.
 * What Slack does that a team needs is here: channels anyone in the workspace starts, threads, @mentions with an Activity list, reactions,
 * search, presence (busy, idle, away) and unread marks. Nothing is seeded: an empty workspace is empty.
 * Pure: no network, no storage, no DOM. Tests: tools/team.test.mjs.
 */

export const CODE_RE = /^[a-z0-9][a-z0-9-]{0,20}$/;
export const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,23}$/;
export const KEY_RE = /^vt1\.([0-9a-f]{12})\.([0-9a-f]{32})$/;
// a join link's code (a-to-mind.com/team/join/<code>): 128 random bits, works once, for JOIN_TTL_MS; only its keyed hash is stored
export const JOIN_RE = /^vj1-([0-9a-f]{32})$/;
export const JOIN_TTL_MS = 24 * 3600e3;
export const MCP_IDLE_MS = 30 * 864e5; // an MCP session bound to an agent ends after this long unused
/** the code out of a join link, a bare code, or nothing */
export function joinCode(s) { const m = /(vj1-[0-9a-f]{32})\s*$/.exec(String(s || '').trim()); return m ? m[1] : ''; }
// a channel or an agent may not take these: the workspace's own words, and words that would read as official
export const RESERVED = Object.freeze(['verse', 'void', 'owner', 'admin', 'mod', 'staff', 'official', 'here', 'channel', 'everyone', 'all', 'system', 'api', 'team', 'support', 'help']);
// the channels every workspace has (structure, not content: no message is ever written for them)
export const HOME = Object.freeze([
  { code: 'work', title: 'work', about: 'Verse hands each idle agent its next job here. Every job is a thread: the agent answers in it and closes it.' },
  { code: 'general', title: 'general', about: 'The whole team, Verse and its agents.' },
]);
export const LIMITS = Object.freeze({ body: 4000, lines: 80, about: 160, title: 24, search: 6, page: 60, thread: 300 });
export const RATES = Object.freeze({ gap: 1000, day: 600, channelsDay: 10, channels: 60, agents: 100, asks: 50 });
export const AWAY_MS = 10 * 60e3; // no word from an agent for this long: away
export const STALE_MS = 30 * 60e3; // an agent away this long with a job gives it back to the queue
export const EMOJI = Object.freeze(['👍', '✅', '👀', '🎉', '❤️', '🚀', '🤔', '❌']);

// The build queue's kinds an agent of the team may take: the ones the conductor sends to Verse's coder (tools/conductor-core.mjs ROUTES with
// wf verse-job.yml). Not member (a paid member's idea is held to add-only by the lap), not miss or probe (they carry what visitors typed).
export const TEAM_KINDS = Object.freeze(['heal', 'will', 'voice', 'versus', 'feature', 'review', 'gap', 'novelty', 'auto', 'flake']);
// what a kind is worth, the same numbers as tools/conductor-core.mjs WEIGHT (tools/team.test.mjs holds them equal)
export const WEIGHT = Object.freeze({ heal: 100, will: 95, voice: 95, versus: 85, feature: 75, review: 70, gap: 60, novelty: 50, auto: 50, flake: 45 });
export const MAX_TRIES = 3;

export const kindOf = (target) => { const t = String(target || ''); const i = t.indexOf(':'); return (i > 0 ? t.slice(0, i) : t).toLowerCase(); };
export const triesOf = (note) => { const m = /\btries (\d+)\b/.exec(String(note || '')); return m ? Number(m[1]) : 0; };
const msOf = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? t : 0; };
/** a job's worth now, the conductor's way: its kind's weight, 2 a day of waiting (up to 30), minus 25 a try (5 for the will) */
export function score(job, now) {
  const k = kindOf(job.target), days = Math.max(0, (now - msOf(job.at)) / 864e5);
  return (WEIGHT[k] ?? 30) + Math.min(30, 2 * days) - (k === 'will' ? 5 : 25) * triesOf(job.note);
}
/** an ask the owner posted in #work (enqueue in functions/api/team.js gives it the id team-<message> and the target feature:team-<message>) */
export const ownerAsk = (job) => /^team-\d+$/.test(String(job && job.id || '')) && String(job.target || '') === 'feature:' + job.id;
/** the queued jobs an agent may take, best first: the owner's #work asks before every background job, oldest first, then the rest by worth;
 *  skip: job ids this agent gave back or failed (it gets another) */
export function rank(jobs, now, skip = []) {
  const no = new Set(skip);
  return (jobs || []).filter((j) => j && j.state === 'queued' && TEAM_KINDS.includes(kindOf(j.target)) && !no.has(j.id) && triesOf(j.note) < MAX_TRIES)
    .map((j) => ({ j, o: ownerAsk(j) ? 1 : 0, s: score(j, now) })).sort((a, b) => b.o - a.o || (a.o ? 0 : b.s - a.s) || msOf(a.j.at) - msOf(b.j.at)).map((x) => x.j);
}
/** a queue note with "claimed by team:<name> ·" in front (the API checks a job is still an agent's by that start), the rest (tries and reasons) kept, at most 300 characters (the queue's cap) */
export const claimNote = (note, name) => { const rest = String(note || '').replace(/^claimed by [^·]*·?\s*/i, '').trim(); return ('claimed by team:' + name + ' ·' + (rest ? ' ' + rest : '')).slice(0, 300); };
/** a note for a job given back: the claim taken off; a failure counts a try */
export function backNote(note, why, failed) {
  const rest = String(note || '').replace(/^claimed by [^·]*·?\s*/i, '').replace(/\btries \d+\s*·?\s*/g, '').trim(), n = triesOf(note) + (failed ? 1 : 0);
  return ((n ? 'tries ' + n + ' · ' : '') + (why ? clean(why, 120) + (rest ? ' · ' : '') : '') + rest).slice(0, 300);
}

/** presence: invited (its join link not used yet), away (switched off, or no word for AWAY_MS), busy (holds a job), or idle */
export function presence(a, now) {
  if (a && !a.off && !a.key) return 'invited';
  if (!a || a.off || !(now - (a.seen || 0) < AWAY_MS)) return 'away';
  return a.job ? 'busy' : 'idle';
}

const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‪-‮⁦-⁩]/g;
/** one line: control and direction characters out, spaces folded, cut */
export const clean = (s, max = 80) => String(s == null ? '' : s).replace(CTRL, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
/** a message body: lines kept (at most LIMITS.lines), control characters out, cut to LIMITS.body */
export function cleanBody(s) {
  const lines = String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(CTRL, '').split('\n').map((l) => l.replace(/[ \t]+$/g, ''));
  return lines.slice(0, LIMITS.lines).join('\n').replace(/\n{4,}/g, '\n\n\n').trim().slice(0, LIMITS.body);
}
export function codeProblem(code) {
  if (!CODE_RE.test(code || '')) return 'a channel name is 1 to 21 of a-z, 0-9 and -, starting with a letter or digit';
  if (RESERVED.includes(code)) return 'that name is the workspace\'s own: pick another';
  return null;
}
export function nameProblem(name) {
  if (!NAME_RE.test(name || '')) return 'an agent name is 1 to 24 of letters, digits, . _ and -, starting with a letter or digit';
  if (RESERVED.includes(String(name).toLowerCase())) return 'that name is the workspace\'s own: pick another';
  return null;
}

/** the @names a body mentions (lowercased, each once), @here included */
export function mentionsOf(body) {
  const out = new Set(), re = /(^|[^A-Za-z0-9._-])@([A-Za-z0-9][A-Za-z0-9._-]{0,23})/g; let m;
  while ((m = re.exec(String(body || '')))) out.add(m[2].replace(/[._-]+$/, '').toLowerCase());
  return [...out];
}

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** a body as HTML: every character escaped first, then ```blocks```, `code`, *bold*, _italic_, ~strike~, https links, @mentions and #channels.
 *  names: the workspace's member names (lowercase), so only a real member's @name lights up; channels: the channel codes. */
export function render(body, { names = [], channels = [] } = {}) {
  const known = new Set(names.map((n) => String(n).toLowerCase())), chans = new Set(channels);
  const blocks = String(body || '').split(/```/);
  return blocks.map((part, i) => {
    if (i % 2 === 1 && i < blocks.length - 1) return '<pre><code>' + esc(part.replace(/^\n/, '')) + '</code></pre>';
    const raw = i % 2 === 1 ? '```' + part : part; // an unclosed fence stays text
    return raw.split(/(`[^`\n]+`)/).map((seg) => {
      if (/^`[^`\n]+`$/.test(seg)) return '<code>' + esc(seg.slice(1, -1)) + '</code>';
      // links are found in the raw text, so an escaped character is never cut in half; the address is escaped inside the tag
      return seg.split(/(https:\/\/[^\s<>"'`]*[^\s<>"'`.,;:!?)\]])/).map((part, k) => {
        if (k % 2 === 1) return '<a href="' + esc(part) + '" rel="noopener nofollow ugc" target="_blank">' + esc(part) + '</a>';
        let h = esc(part);
        h = h.replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,!?:;])/g, '$1<b>$2</b>').replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,!?:;])/g, '$1<i>$2</i>').replace(/(^|[\s(])~([^~\n]+)~(?=$|[\s).,!?:;])/g, '$1<s>$2</s>');
        h = h.replace(/(^|[^A-Za-z0-9._\-/&])@([A-Za-z0-9][A-Za-z0-9._-]{0,23})/g, (all, pre, n) => {
          const k2 = n.replace(/[._-]+$/, '').toLowerCase(), tail = n.slice(k2.length);
          return k2 === 'here' || known.has(k2) ? pre + '<span class="mention">@' + n.slice(0, k2.length) + '</span>' + tail : all;
        });
        h = h.replace(/(^|[\s(])#([a-z0-9][a-z0-9-]{0,20})\b/g, (all, pre, c) => (chans.has(c) ? pre + '<a class="chan" href="#c=' + c + '">#' + c + '</a>' : all));
        return h.replace(/\n/g, '<br>');
      }).join('');
    }).join('');
  }).join('');
}

/** the words of a search: at most LIMITS.search words of 2 to 40 characters, LIKE-escaped */
export function searchWords(q) {
  return [...new Set(String(q || '').toLowerCase().split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}@#._-]/gu, '')).filter((w) => w.length >= 2))]
    .slice(0, LIMITS.search).map((w) => w.slice(0, 40).replace(/[\\%_]/g, (c) => '\\' + c));
}

/** the line Verse writes when it hands a job out */
export const assignText = (name, job) => '@' + name + ' your next job (' + kindOf(job.target) + ', ' + clean(job.target, 60) + '): ' + clean(job.ask, 400)
  + '\nAnswer in this thread as you work. Close it with the result: done (with the pull request) or give it back.';

/** what the owner is told with a new join link */
export const inviteSay = (name) => 'Give ' + name + ' this link. It works once, for a day, and is safe to paste in any chat: opening it uses nothing up.'
  + ' The agent joins by sending it back (POST), over MCP (a-to-mind.com/team/mcp, the join tool) or with the script (a-to-mind.com/team/agent.mjs).';
/** what an agent is told when its link gives it its key */
export const joinedSay = (name) => 'You are ' + name + ' in Verse\'s team chat, the same chat as the owner and every other agent. This key is shown once:'
  + ' keep it in your own environment (VERSE_TEAM_KEY) and send it as Authorization: Bearer <key>. Never paste it into a chat or a log.'
  + ' How to read, post and take jobs: https://a-to-mind.com/team/agents.txt';
