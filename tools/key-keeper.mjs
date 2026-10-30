#!/usr/bin/env node
// Verse's key keeper: Verse makes, uses and retires its own Cloudflare keys (owner, 2026-10-30: "verse gets its own money and needs
// to learn to handle all the keys and secrets, stop trying to make this a manual operation"). One bootstrap key, CF_KEYMASTER_TOKEN
// (an account-owned Cloudflare token with Account > Account API Tokens > Edit), is the only key a person ever makes. From it, each job
// mints its own child token at the start of a run: scoped to exactly what that job needs (JOBS below), owned by the account, and
// expiring a few hours later, so every run rotates its key and an old key stops working because Verse retired it. A daily sweep
// deletes Verse's own expired child tokens. Nothing here prints, logs or stores a token value: a minted value goes only to
// $GITHUB_ENV, masked first with ::add-mask::.
//   node tools/key-keeper.mjs mint <job>    mint the job's child token; writes <JOBS[job].env>=<value> to $GITHUB_ENV (or exits 0 with a
//                                           note when there is no keymaster, so the job falls back to the old repo secret)
//   node tools/key-keeper.mjs sweep         delete this account's expired verse-* child tokens; prints how many
//   node tools/key-keeper.mjs status        one line per job: can the keymaster mint it (the permission groups exist), never a value
// API (developers.cloudflare.com/fundamentals/api/how-to/create-via-api): POST /accounts/{id}/tokens creates an account-owned token,
// GET /accounts/{id}/tokens/permission_groups lists the groups. List and delete (GET and DELETE /accounts/{id}/tokens[/{token_id}])
// follow the same shape as the user-token API; a child token expires on its own even if a delete is refused.
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const API = 'https://api.cloudflare.com/client/v4';
export const PREFIX = 'verse-';
/** each job's key: the env name it is handed to the job under, the permission groups (by exact Cloudflare name), and hours to live */
export const JOBS = {
  coder: { env: 'CLOUDFLARE_AI_TOKEN', groups: ['Workers AI Read', 'Workers AI Write'], hours: 3 },
  ai: { env: 'CLOUDFLARE_AI_TOKEN', groups: ['Workers AI Read', 'Workers AI Write'], hours: 3 },
  r2: { env: 'CLOUDFLARE_R2_TOKEN', groups: ['Workers R2 Storage Read', 'Workers R2 Storage Write'], hours: 2 },
  analytics: { env: 'CLOUDFLARE_ANALYTICS_TOKEN', groups: ['Account Analytics Read'], hours: 1 },
};

const req = async (fetchFn, token, method, path, body) => {
  const r = await fetchFn(API + path, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (_) { /* not JSON */ }
  if (!r.ok || !j || j.success === false) {
    const e = (j && j.errors && j.errors[0]) || {};
    const err = new Error(method + ' ' + path.replace(/\/accounts\/[^/]+/, '/accounts/:id').replace(/\/tokens\/[0-9a-f]{20,}/, '/tokens/:token') + ' answered ' + r.status + (e.code ? ' code ' + e.code : '') + (e.message ? ': ' + String(e.message).slice(0, 120) : ''));
    err.status = r.status; throw err;
  }
  return j.result;
};

/** the permission group ids for one job, by exact name; throws naming every group the account does not offer */
export function groupsFor(job, all) {
  const spec = JOBS[job]; if (!spec) throw new Error('no such job: ' + job + ' (jobs: ' + Object.keys(JOBS).join(', ') + ')');
  const byName = new Map((all || []).map((g) => [g.name, g.id]));
  const missing = spec.groups.filter((n) => !byName.has(n));
  if (missing.length) throw new Error('the account offers no permission group named ' + missing.join(', '));
  return spec.groups.map((n) => ({ id: byName.get(n) }));
}

/** the body for a child token: account-owned, scoped to this account only, expiring after the job's hours */
export function tokenBody(job, account, groups, now = new Date(), run = '') {
  const spec = JOBS[job];
  const exp = new Date(now.getTime() + spec.hours * 3600e3);
  return {
    name: PREFIX + job + '-' + now.toISOString().slice(0, 16).replace(/[-:T]/g, '') + (run ? '-' + run : ''),
    policies: [{ effect: 'allow', resources: { ['com.cloudflare.api.account.' + account]: '*' }, permission_groups: groups }],
    expires_on: exp.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
}

/** mint the job's child token. Returns { minted, env, name, expires, value } or { minted: false, why }; never logs the value */
export async function mint(job, env = process.env, fetchFn = fetch, now = new Date()) {
  if (!JOBS[job]) return { minted: false, why: 'no such job: ' + job };
  const master = env.CF_KEYMASTER_TOKEN, account = env.CLOUDFLARE_ACCOUNT_ID;
  if (!master || !account) return { minted: false, why: (master ? 'CLOUDFLARE_ACCOUNT_ID' : 'CF_KEYMASTER_TOKEN') + ' is not set, so this job uses the repo secret it had before' };
  try {
    const all = await req(fetchFn, master, 'GET', '/accounts/' + encodeURIComponent(account) + '/tokens/permission_groups');
    const body = tokenBody(job, account, groupsFor(job, all), now, String(env.GITHUB_RUN_ID || ''));
    const made = await req(fetchFn, master, 'POST', '/accounts/' + encodeURIComponent(account) + '/tokens', body);
    if (!made || !made.value) return { minted: false, why: 'Cloudflare made the token but sent no value' };
    return { minted: true, env: JOBS[job].env, name: body.name, expires: body.expires_on, value: made.value };
  } catch (e) { return { minted: false, why: e.message }; }
}

/** delete this account's expired child tokens that Verse made (name starts verse-); a token not Verse's is never touched */
export async function sweep(env = process.env, fetchFn = fetch, now = new Date()) {
  const master = env.CF_KEYMASTER_TOKEN, account = env.CLOUDFLARE_ACCOUNT_ID;
  if (!master || !account) return { swept: 0, kept: 0, why: 'no keymaster' };
  const base = '/accounts/' + encodeURIComponent(account) + '/tokens';
  let list; try { list = await req(fetchFn, master, 'GET', base + '?per_page=100'); } catch (e) { return { swept: 0, kept: 0, why: e.message }; }
  let swept = 0, kept = 0; const errors = [];
  for (const t of list || []) {
    if (!String(t.name || '').startsWith(PREFIX)) continue;
    const dead = t.status === 'expired' || (t.expires_on && Date.parse(t.expires_on) <= now.getTime());
    if (!dead) { kept++; continue; }
    try { await req(fetchFn, master, 'DELETE', base + '/' + encodeURIComponent(t.id)); swept++; } catch (e) { errors.push(e.message); }
  }
  return { swept, kept, why: errors.length ? errors.length + ' not deleted (they expire on their own): ' + errors[0] : '' };
}

/** can the keymaster mint each job's key? names and yes/no only */
export async function status(env = process.env, fetchFn = fetch) {
  const master = env.CF_KEYMASTER_TOKEN, account = env.CLOUDFLARE_ACCOUNT_ID;
  if (!master || !account) return { keymaster: false, jobs: Object.keys(JOBS).map((job) => ({ job, ok: false, why: 'no keymaster' })) };
  let all; try { all = await req(fetchFn, master, 'GET', '/accounts/' + encodeURIComponent(account) + '/tokens/permission_groups'); }
  catch (e) { return { keymaster: true, jobs: Object.keys(JOBS).map((job) => ({ job, ok: false, why: e.message })) }; }
  return { keymaster: true, jobs: Object.keys(JOBS).map((job) => { try { groupsFor(job, all); return { job, ok: true, why: '' }; } catch (e) { return { job, ok: false, why: e.message }; } }) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, job] = process.argv.slice(2);
  if (cmd === 'mint') {
    const m = await mint(job);
    if (!m.minted) { console.log('::notice title=Verse keys::' + job + ': ' + m.why); process.exit(0); }
    console.log('::add-mask::' + m.value);
    if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, m.env + '=' + m.value + '\n');
    console.log('Verse minted its own ' + job + ' key (' + m.name + ', handed over as ' + m.env + ', expires ' + m.expires + ')');
  } else if (cmd === 'sweep') {
    const s = await sweep(); console.log('Verse retired ' + s.swept + ' expired key(s) of its own, ' + s.kept + ' still live' + (s.why ? '; ' + s.why : ''));
  } else if (cmd === 'status') {
    const s = await status(); console.log('keymaster: ' + (s.keymaster ? 'present' : 'missing')); for (const j of s.jobs) console.log(j.job + ': ' + (j.ok ? 'can mint' : 'cannot mint (' + j.why + ')'));
  } else { console.error('usage: key-keeper.mjs mint <' + Object.keys(JOBS).join('|') + '> | sweep | status'); process.exit(2); }
}
