// Approve one of Verse's fixes that waits for the owner (lib/v01d-fixes.js). Owner only; needs GITHUB_TOKEN in the Pages project.
// POST { pr, op: 'approve' }  -> { ok, pr }   the pull request loses "waits for owner" and gets automerge, so it merges once Void's
//                                review is clean. Only a pull request labelled "made by Verse" can be approved here.
// 400 for anything else; 503 without GITHUB_TOKEN (the card then links to the pull request on GitHub); 502 when GitHub says no.
import { ownerOk } from '../../lib/guard.js';
import { track } from '../../lib/actions.js';
import { REPO, LABEL, WAITS, MERGES } from '../../lib/v01d-fixes.js';

const GH = 'https://api.github.com';
const gh = (env, method, path, body) => fetch(GH + path, { method, headers: { authorization: 'Bearer ' + env.GITHUB_TOKEN, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'void-v01d-fixes', ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });

export async function onRequestPost({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  let b = {}; try { b = JSON.parse((await request.text()).slice(0, 500)); } catch (_) {}
  const pr = Number.isInteger(b.pr) && b.pr > 0 && b.pr < 1e7 ? b.pr : null;
  if (!pr || b.op !== 'approve') return new Response('{ pr, op: "approve" }', { status: 400 });
  if (!env.GITHUB_TOKEN) return Response.json({ error: 'GITHUB_TOKEN is not set in the Pages project: approve it on GitHub', url: 'https://github.com/' + REPO + '/pull/' + pr }, { status: 503 });
  const run = async () => {
    const r = await gh(env, 'GET', '/repos/' + REPO + '/pulls/' + pr); const p = r.ok ? await r.json() : null;
    if (!p || p.state !== 'open' || !(p.labels || []).some((l) => l && l.name === LABEL)) throw new Error('not an open pull request made by Verse');
    const add = await gh(env, 'POST', '/repos/' + REPO + '/issues/' + pr + '/labels', { labels: [MERGES] });
    if (!add.ok) throw new Error('GitHub did not add the label (HTTP ' + add.status + ')');
    await gh(env, 'DELETE', '/repos/' + REPO + '/issues/' + pr + '/labels/' + encodeURIComponent(WAITS));
    return 'approved #' + pr;
  };
  try { if (env.DB) await track(env, { owner: 'owner', kind: 'v01d-fix.approve', ref: '#' + pr }, run); else await run(); return Response.json({ ok: true, pr }); }
  catch (e) { return Response.json({ error: String((e && e.message) || e).slice(0, 200) }, { status: 502 }); }
}
