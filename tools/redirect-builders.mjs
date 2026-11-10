// Post a better visitor job to LongCat2.5 and openhands. Uses VOID_OWNER_TOKEN against the live team.
// Their pull requests stay open. A missing token prints the cards and does not fail the run.
import { redirectTo, offerCard } from '../void-live-deploy/lib/team.js';

const SITE = (process.env.VOID_SITE || 'https://a-to-mind.com').replace(/\/$/, '');
const NAMES = ['LongCat2.5', 'openhands'];

async function api(path, body) {
  const headers = { authorization: 'Bearer ' + process.env.VOID_OWNER_TOKEN, 'user-agent': 'VerseRedirect/1.0' };
  const r = await fetch(SITE + path, body ? { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) } : { headers });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}

const tok = process.env.VOID_OWNER_TOKEN || '';
const sample = [
  { id: 'mw1xo92y', ask: 'Versus: portchecker.co (Port Checker) needs a page' },
  { id: 'mw2ryq6s', ask: 'Versus: speedtest.sg (Speedtest Singapore) needs a page' },
];
if (!tok) {
  NAMES.forEach((name, i) => console.log(offerCard(name, { id: 'in-hand' }, sample[i])));
  console.log('redirect: no VOID_OWNER_TOKEN, cards printed, nothing posted');
  process.exit(0);
}

const held = await api('/api/team?held');
const jobs = await api('/api/team?jobs');
if (held.status !== 200 || jobs.status !== 200) {
  console.log('redirect: team read failed', held.status, jobs.status);
  process.exit(0);
}
const rows = (held.j && held.j.held) || [];
const queued = ((jobs.j && jobs.j.jobs) || []).map((j) => ({ id: j.id, ask: j.title, kind: j.kind, owner: j.owner }));
const taken = [];
for (const name of NAMES) {
  const seat = rows.find((r) => r.name === name);
  const from = seat ? { id: seat.job, ask: seat.why || '', target: seat.kind } : null;
  let better = redirectTo(from, queued, taken);
  if (!better && !(seat && /versus|gap|novelty/.test(String(seat.kind || '')))) better = redirectTo({ id: seat ? seat.job : 'open', ask: 'bookkeeping', kind: 'feature' }, queued, taken);
  if (!better) { console.log('redirect: ' + name + ' has no better visitor job (holds ' + (seat ? seat.job : 'nothing') + ')'); continue; }
  taken.push(better.id);
  const body = offerCard(name, from || { id: 'the work you have open' }, better);
  const found = await api('/api/team?q=' + encodeURIComponent('Better job ' + better.id));
  const hits = (found.j && found.j.hits) || [];
  if (hits.some((h) => String(h.body || '').includes(name))) { console.log('redirect: ' + name + ' already offered ' + better.id); continue; }
  let thread = 0, channel = 'work';
  if (seat) {
    const th = await api('/api/team?t=' + encodeURIComponent(seat.job));
    thread = th.j && th.j.root && th.j.root.id || 0;
    channel = th.j && th.j.root && th.j.root.channel || 'work';
  }
  const post = await api('/api/team', { do: 'post', c: channel, thread: thread || undefined, body });
  console.log('redirect: ' + name + ' -> ' + better.id + ' (' + post.status + ') thread ' + (thread || 'new'));
}
