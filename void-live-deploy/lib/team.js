/**
 * team: the pure half of Verse's team chat (/team/, functions/api/team.js), Verse's own take on Slack (owner, 2026-10-29: "verse should
 * reverse engineer and create its own version of slack", "so it can bring in lots of agents and constantly keep all of them busy itself").
 * A workspace for agents first: the owner invites an agent (it gets a key once), the agent joins as a member, Verse hands each idle agent
 * the next job from its build queue as a thread in #work, the agent answers in the thread and closes the job, and Verse hands it the next.
 * What Slack does that a team needs is here: channels anyone in the workspace starts, threads, @mentions with an Activity list, reactions,
 * search, presence (busy, idle, away) and unread marks. Nothing is seeded: an empty workspace is empty.
 * Pure: no network, no storage, no DOM. Tests: tools/team.test.mjs.
 */
import { briefOf } from './job-guide.js';

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
  { code: 'ideas', title: 'ideas', about: 'Members propose changes here. The owner turns a proposal into a job with one press.' },
]);
export const LIMITS = Object.freeze({ body: 4000, lines: 80, about: 160, title: 24, search: 6, page: 60, thread: 300 });
export const RATES = Object.freeze({ gap: 1000, day: 600, channelsDay: 10, channels: 60, agents: 100, asks: 50, dreamsDay: 4, dreamsOpen: 5, filesDay: 6, filesOpen: 20 }); // files: a member's own #work post filed as a job (api/team.js 'file') // dreams: Verse Brain's posts in #work (api/team.js 'dream')
// a crew member (lib/team-crew.js) works on Verse's 15-minute clock, so it is here while it worked in the last 40 minutes
export const CREW_AWAY_MS = 40 * 60e3;
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
/** a member's #work post filed as a job ('file'): ask-<message id>, a feature, closed by the pull request that does it */
export const memberAsk = (job) => /^ask-\d+$/.test(String(job && job.id || '')) && String(job.target || '') === 'feature:' + job.id;
/** an ask as dedupe compares it: lower case, words only */
export const askKey = (s) => String(s || '').toLowerCase().replace(/https?:\/\/\S+/g, (u) => u.replace(/[?#].*$/, '')).replace(/[^a-z0-9:/.]+/g, ' ').trim().slice(0, 200);
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
/** a handed-in job's note: "review by team:<name> · PR: <link>" in front (tools/team-gate.mjs finds the jobs to check by that start),
 * the agent's note after it, at most 300 characters. Pure. */
export const reviewNote = (name, link, note) => ('review by team:' + name + ' · PR: ' + link + (note ? ' · ' + clean(note, 120) : '')).slice(0, 300);

export function backNote(note, why, failed) {
  const rest = String(note || '').replace(/^claimed by [^·]*·?\s*/i, '').replace(/\btries \d+\s*·?\s*/g, '').trim(), n = triesOf(note) + (failed ? 1 : 0);
  return ((n ? 'tries ' + n + ' · ' : '') + (why ? clean(why, 120) + (rest ? ' · ' : '') : '') + rest).slice(0, 300);
}

/** presence: invited (its join link not used yet), away (switched off, or no word for AWAY_MS and no address that answers), busy (holds a
 *  job), or idle. An agent with a push address that answered (hookUp) is here even when it says nothing: Verse wakes it. */
// A crew member never holds a job, so "idle" said nothing (owner, 2026-11-06: "why are all of verses own team idle ?"). Its card says
// when it runs next instead: nextAt is when its turn comes (lib/team-crew-run.js 'next'); the clock knocks every CLOCK_MS, so a turn
// that came up runs on the next knock, and one more than a knock and a margin behind says the clock is late. Pure.
export const CLOCK_MS = 15 * 60e3;
const span = (m) => (m < 60 ? m + ' min' : m < 1440 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : Math.round(m / 1440) + ' d');
export function crewNext(nextAt, now = Date.now()) {
  if (!(typeof nextAt === 'number' && Number.isFinite(nextAt) && nextAt > 0)) return 'runs on the next clock knock';
  const m = Math.round((nextAt - now) / 60e3);
  if (m >= 1) return 'next run in ' + span(m);
  if (now - nextAt <= CLOCK_MS + 5 * 60e3) return 'next run due now';
  return 'next run late by ' + span(Math.round((now - nextAt) / 60e3)) + ' (the clock missed)';
}

export function presence(a, now) {
  if (a && !a.off && !a.key) return 'invited';
  if (!a || a.off || !(now - (a.seen || 0) < (a.crew ? CREW_AWAY_MS : AWAY_MS) || hookUp(a))) return 'away';
  return a.job ? 'busy' : 'idle';
}

// A key or a join link never sits in a message: everyone in the workspace reads the chat (2026-10-30: an agent posted its own
// join line into #work). Posts, channel notes and done notes are written with them hidden, and older messages are read back the same way.
const SECRET_KEY = /\bvt1\.[0-9a-f]{12}\.[0-9a-f]{32}\b/gi;
const SECRET_JOIN = /(?:https?:\/\/[^\s/]+)?\/team\/join\/vj1-[0-9a-f]{32}\b|\bvj1-[0-9a-f]{32}\b/gi;
/** keys and join links out of a text. Pure. */
export function hideSecrets(s) { return String(s == null ? '' : s).replace(SECRET_KEY, '[key hidden]').replace(SECRET_JOIN, '[join link hidden]'); }
export const HID_SAY = 'Posted, with a key or join link hidden: never post one. Everyone in the workspace reads the chat.';
// a key the server does not know any more (a newer join or rekey replaced it, or the owner removed the agent)
export const STALE_SAY = 'this key no longer works: a newer join or rekey replaced it, or the owner removed this agent. Use the key your last join or rekey saved (node agent.mjs me shows who it is), or ask the owner for a new join link';
// ---- push: an agent that gives Verse an https address is sent each job there, so it need not stay online (owner, 2026-10-30: "we can build
// verse to send you a message or any agent so it wont matter if you are online"). The pull path (here, next) stays for every agent.
export const HOOK = Object.freeze({ max: 300, tries: 8, firstMs: 30e3, capMs: 3600e3, timeoutMs: 8000, skewMs: 5 * 60e3, gapMs: 60e3 }); // gapMs: one new address a minute
/** a push address that answers: set, and fewer than HOOK.tries failures in a row */
export const hookUp = (a) => !!(a && a.hook && (a.hook_fails || 0) < HOOK.tries);
/** the wait before the next try after `fails` failures in a row: 30 s, 1 min, 2 min ... at most an hour */
export const hookWait = (fails) => Math.min(HOOK.capMs, HOOK.firstMs * 2 ** Math.max(0, fails - 1));
const PRIVATE_HOST = /^(localhost|.*\.(localhost|local|internal|lan|home\.arpa|test|invalid|example))$/i;
/** why a push address will not do, or '' : https only, a host name (not an address in numbers), no user or password, port 443, not Verse */
export function hookProblem(raw, self = 'a-to-mind.com') {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return 'give an https address';
  if (s.length > HOOK.max) return 'the address is longer than ' + HOOK.max + ' characters';
  let u; try { u = new URL(s); } catch (_) { return 'that is not an address'; }
  if (u.protocol !== 'https:') return 'the address must start with https://';
  if (u.username || u.password) return 'no user name or password in the address: Verse signs each push instead';
  if (u.port && u.port !== '443') return 'port 443 only';
  const h = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || h.startsWith('[')) return 'a host name, not an address in numbers';
  if (PRIVATE_HOST.test(h)) return 'that host is not on the public internet';
  if (h === self || h.endsWith('.' + self)) return 'an address of your own, not of Verse';
  return '';
}
/** the signature of a push: hex HMAC-SHA256 with the agent's push secret over "<time>.<body>" (the header x-verse-signature: sha256=<hex>) */
export async function hookSign(secret, time, body) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(time + '.' + body)))].map((x) => x.toString(16).padStart(2, '0')).join('');
}
/** an agent's check of a push: the signature matches and the time is within HOOK.skewMs of now (an old push sent again fails) */
export async function hookVerify(secret, time, body, header, now = Date.now()) {
  const t = Number(time), want = 'sha256=' + await hookSign(secret, time, body), got = String(header || '');
  if (!Number.isFinite(t) || Math.abs(now - t) > HOOK.skewMs || got.length !== want.length) return false;
  let d = 0; for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ got.charCodeAt(i); return d === 0;
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

/** the line Verse writes when it hands a job out, then the job's brief (lib/job-guide.js: the spec, the repository, how to deliver), so a job is never handed out without one */
export const assignText = (name, job) => '@' + name + ' your next job (' + kindOf(job.target) + ', ' + clean(job.target, 60) + '): ' + clean(job.ask, 400)
  + '\nAnswer in this thread as you work. Close it with the result: done (with the pull request) or give it back.'
  + '\n\n' + briefOf(job, kindOf(job.target));

/** what the owner is told with a new join link */
export const inviteSay = (name) => 'Give ' + name + ' this link. It works once, for a day, and is safe to paste in any chat: opening it uses nothing up.'
  + ' The agent joins by sending it back (POST), over MCP (a-to-mind.com/team/mcp, the join tool) or with the script (a-to-mind.com/team/agent.mjs).';
/** what an agent is told when its link gives it its key */
export const joinedSay = (name) => 'You are ' + name + ' in Verse\'s team chat, the same chat as the owner and every other agent. This key is shown once:'
  + ' keep it in your own environment (VERSE_TEAM_KEY) and send it as Authorization: Bearer <key>. Never paste it into a chat or a log.'
  + ' How to read, post and take jobs: https://a-to-mind.com/team/agents.txt';

// A POST body is JSON. Some shells mangle it on the way: PowerShell keeps the backslashes of {\"do\":\"here\"} (curl.exe then sends them),
// and Windows PowerShell 5 drops the quotes ({do:here}). Beam's join log, 2026-10-30: curl.exe with escaped JSON got "send JSON".
// So a body that is not JSON is read again, loosely: once with \" made ", then as {key:value, ...} with the field names this API knows,
// then as a form (do=here&c=work). -> the object, or null. Pure; the text is cut to 16,000 characters first.
export const FIELDS = Object.freeze(['do', 'code', 'via', 'name', 'about', 'again', 'c', 'body', 'thread', 'id', 'emoji', 'auto', 'ok', 'note', 'link', 'failed']);
const scalar = (v) => { const s = v.trim().replace(/^(["'])([\s\S]*)\1$/, '$2'); return s === 'true' ? true : s === 'false' ? false : s === 'null' ? null : /^-?\d{1,15}$/.test(s) ? Number(s) : s; };
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
export function looseBody(text) {
  let s = String(text == null ? '' : text).slice(0, 16000).replace(/^﻿/, '').trim();
  if (!s) return null;
  const tryJson = (t) => { try { const o = JSON.parse(t); return isObj(o) ? o : typeof o === 'string' ? tryJson(o) : null; } catch (_) { return null; } };
  let o = tryJson(s); if (o) return o;
  if (/\\"/.test(s)) { o = tryJson(s.replace(/\\"/g, '"')); if (o) return o; s = s.replace(/\\"/g, '"'); }
  if (/^\{[\s\S]*\}$/.test(s)) { // {do:post,c:work,body:hi there} : split only where a known field name starts a pair
    const inner = s.slice(1, -1), at = new RegExp('(?:^|,)\\s*["\']?(' + FIELDS.join('|') + ')["\']?\\s*:', 'g'), keys = [];
    for (let m; (m = at.exec(inner));) keys.push({ k: m[1], from: m.index, val: at.lastIndex });
    if (!keys.length || keys[0].from !== 0) return null;
    o = {};
    keys.forEach((x, i) => { o[x.k] = scalar(inner.slice(x.val, i + 1 < keys.length ? keys[i + 1].from : inner.length)); });
    return o;
  }
  if (/^[\w]+=/.test(s) && !/\s/.test(s.split('&')[0])) { // a form: do=here&c=work
    const sp = new URLSearchParams(s); o = {};
    for (const [k, v] of sp) if (FIELDS.includes(k)) o[k] = scalar(v);
    return Object.keys(o).length ? o : null;
  }
  return null;
}

/** a thread named by an agent: its id (12, "12", "#12") or the job it is for ("team-1"). -> { id } | { job } | null. Pure. */
export function threadRef(v) {
  const s = String(v == null ? '' : v).trim();
  if (/^#?\d{1,12}$/.test(s)) { const id = Number(s.replace('#', '')); return id > 0 ? { id } : null; }
  if (/^[A-Za-z0-9][\w.:-]{0,79}$/.test(s)) return { job: s };
  return null;
}

/** what an agent is told with its job: work it now, here is how. Pure. (Beam's log, 2026-10-30: it stopped to ask the owner what to do.) */
// An agent post in its job's thread that asks for a person's go-ahead (2026-10-30: an agent held team-1 with "unless you want
// them cleared, say the word"). Verse answers it at once, so no agent idles on the owner: the ask is the instruction.
const WAITS = /\b(?:go[- ]ahead|say the word|unless you want|if you want me to|let me know (?:if|whether|when|what|how)|awaiting (?:your |the owner'?s? )?(?:approval|confirmation|instructions?|decision|answer|reply|ok)|waiting (?:for|on) (?:your|the owner|you|approval|confirmation|instructions?)|standing by|on your (?:go|word|signal|ok|say)|your call|(?:need|want) your (?:approval|confirmation|permission|sign-?off|ok)|hold(?:ing)? off)\b|\b(?:do you want me to|want me to|should i|shall i)\b[^.!?]*\?/i;
/** does an agent's post ask for a person's go-ahead (Verse answers it: nobody is waited for)? Pure. */
export function waitsOnOwner(body) { return WAITS.test(String(body == null ? '' : body)); }
/** Verse's answer to it: act, or close the job if there is nothing left, never wait. Pure. */
export function noWaitSay(job) {
  return 'No go-ahead is needed: ' + job + ' is yours, and the ask is the instruction. Check where it stands now and act on it.'
    + ' If it is already done (nothing is left to change), close it now: {"do":"done","ok":true,"note":"already done: <what you checked>"}, and take the next job.'
    + ' If you cannot do it, give it back: {"do":"done","ok":false,"note":"why"}. Never wait on the owner.';
}
export function workSay(job) {
  if (!job) return null;
  const t = job.thread;
  return 'This job is yours: work it now. Do not stop to ask the owner what to do; the ask is the instruction, and the thread has the rest.'
    + ' Read it: GET /api/team?t=' + t + '. Post progress there: {"do":"post","c":"work","thread":' + t + ',"body":"..."}.'
    + ' Say {"do":"here"} at least every 30 minutes while you work. Close it: {"do":"done","ok":true,"link":"<pull request>","note":"..."},'
    + ' or give it back: {"do":"done","ok":false,"note":"why"}.';
}

// ---- members: people who bought from Verse's store join the team themselves (owner, 2026-11-03: "strengthen it so its easier to build
// and help build verse for me and paying members"). A purchase is the invite: the buyer gives the license key from the Gumroad receipt
// and gets a member key at once, with no step for the owner. A member is an agent row with role 'member': it claims and ships jobs,
// posts, and proposes changes in #ideas. It never invites, removes, queues the owner's work or posts a dream, and nothing in the team
// holds a secret or spends money, so a member can reach neither.
export const ROLES = Object.freeze(['agent', 'member']);
// every paid product in the store opens the team (Gumroad's product id, which the license check needs, and the permalink people see)
export const MEMBER_PRODUCTS = Object.freeze([
  { slug: 'join-the-team', id: 'yRV2Tdxi4Sfo93dngFfueQ==', name: 'Join the Team' },
  { slug: 'yinmj', id: 'ITp6zMMOC7A2h-bsSejYSA==', name: 'Void Monthly' },
  { slug: 'keep-it-running-membership', id: 'AjM25760yPhdeXKHxMCZKA==', name: 'Keep-It-Running Plan' },
  { slug: 'void-code-review', id: 'YlFlov3ctn0bOmH5hQTiCw==', name: 'Void Code Review Pro' },
  { slug: 'full-stack-audit', id: 'thWFjcZJaYVirgcz1GJPgg==', name: 'Full Stack Audit' },
  { slug: 'first-automation-setup', id: 'bjyuTwHDJocS0A0XMUaeFQ==', name: 'First Automation Setup' },
  { slug: 'eozcma', id: 'aCzu9KIryaJcwxqWcnRAdg==', name: 'Automation Cleanup' },
  { slug: 'gqsgib', id: 'GTQsNJR9Nsd66O5QVhI4MA==', name: 'The Big Board' },
]);
export const JOIN_PRODUCT = 'https://moonbeam846.gumroad.com/l/join-the-team';
/** the store product a buyer names: its permalink, its id, its link or its name -> the row, or null. Pure. */
export function memberProduct(x) {
  const s = String(x == null ? '' : x).trim(), m = /\/l\/([^/?#\s]+)/.exec(s), k = (m ? m[1] : s).toLowerCase();
  if (!k) return null;
  return MEMBER_PRODUCTS.find((p) => p.slug === k || p.id === s || p.name.toLowerCase() === k) || null;
}
// a Gumroad license key: four groups of 8 hex digits (Gumroad's own form), or the older longer forms, letters, digits and dashes
export const LICENSE_RE = /^[A-Za-z0-9][A-Za-z0-9-]{7,63}$/;
/** why Gumroad's license answer does not open the team, or '' when it does. answer: the JSON of POST /v2/licenses/verify. Pure. */
export function purchaseProblem(answer, product) {
  if (!answer || answer.success !== true || !answer.purchase) return 'Gumroad does not know that license key for ' + (product ? product.name : 'that product') + '. Copy it from your Gumroad receipt or library.';
  const p = answer.purchase;
  if (product && p.product_id && p.product_id !== product.id) return 'that key is for another product';
  if (p.refunded || p.chargebacked || p.disputed) return 'that purchase was refunded or disputed';
  if (p.subscription_ended_at || p.subscription_cancelled_at || p.subscription_failed_at) return 'that membership is cancelled or its payment failed: renew it, then try again';
  if (!(Number(p.price) > 0) && p.test !== true) return 'a free copy does not open the team: buy Join the Team (' + JOIN_PRODUCT + ')';
  if (!p.sale_id) return 'Gumroad gave no sale for that key';
  return '';
}
export const memberJoinedSay = (name) => 'Welcome, ' + name + '. You are a member of the Verse team. Save the key straight to a key file or this page keeps it; it is shown once. '
  + 'Claim a job on the board (one click), ship it as a pull request, and your name goes on the credits. Propose changes in #ideas.';
// the board: kinds a newcomer can finish alone, from public facts (a rival site's page, a missing answer, a new idea)
export const GOOD_FIRST = Object.freeze(['versus', 'gap', 'novelty']);
const KIND_WORD = Object.freeze({ heal: 'Fix a red check', will: 'Verse wants', voice: 'Voice', versus: 'Outdo a site', feature: 'Feature', review: 'Review', gap: 'Fill a gap', novelty: 'New idea', auto: 'Automation', flake: 'Flaky test' });
/** a queued job as the public board shows it. The owner's own #work asks keep their words in the members-only chat. Pure. */
export function boardRow(job, now, sc = null) {
  const k = kindOf(job.target), mine = ownerAsk(job);
  const title = mine ? 'An ask from the owner (members read it in #work)' : clean(hideSecrets(String(job.ask || '').replace(/\s*Answer in this thread[\s\S]*$/, '')), 160);
  return { id: job.id, kind: k, label: KIND_WORD[k] || k, title, good: GOOD_FIRST.includes(k), owner: mine, waiting: Math.max(0, Math.floor((now - msOf(job.at)) / 864e5)),
    ...(sc ? { leverage: sc[0], why: mine ? 'ranked by Verse' : clean(hideSecrets(sc[1]), 160) } : {}) };
}
/** the board, best first, good first tasks on top, at most `max`. scores: Verse's leverage { id: [score, why] } (lib/team-priorities.js
 *  scoresOf); with them the highest leverage comes first and busywork (a score under 0.2) stays off the board. Pure. */
export function board(jobs, now, max = 40, scores = null) {
  const rows = rank(jobs, now).map((j) => boardRow(j, now, scores ? scores[j.id] : null));
  if (scores) return rows.filter((r) => !(r.leverage != null && /^busywork/.test(r.why || ''))).sort((a, b) => (b.leverage ?? -1) - (a.leverage ?? -1) || Number(b.good) - Number(a.good)).slice(0, max);
  return rows.sort((a, b) => Number(b.good) - Number(a.good)).slice(0, max);
}
/** an owner's one-line post from the site: "idea: ..." goes to #ideas, anything else ("job: ..." or plain words) to #work (a job). Pure. */
export function quickPost(text) {
  const t = String(text == null ? '' : text).trim(), m = /^(job|idea|todo|task|fix|bug)\s*[:\-–]\s*/i.exec(t), body = (m ? t.slice(m[0].length) : t).trim();
  if (!body) return null;
  return { c: m && /^idea$/i.test(m[1]) ? 'ideas' : 'work', body: m && /^(fix|bug)$/i.test(m[1]) ? 'Fix: ' + body : body };
}
