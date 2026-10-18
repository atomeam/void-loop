/**
 * routine — frontier #13's first piece. "call this my morning" keeps the last few asks (the ones the ask box already remembers
 * for its hints) as a routine named "morning" in this browser; "my morning" asks them again, in order, exactly as if typed.
 * "my routines" lists them, "forget my morning" drops one. A routine is only asks Void already answers, so it can do nothing
 * typing them could not; it stays in this browser unless its owner offers it. The pure half (the ask, the pick, the store) is
 * lib/routines.js. The second piece: "offer my morning as Sam" sends only that routine's asks and the name Sam chose to a list
 * the site's owner reviews (lib/shared-routines.js, /api/routines); "routines from others" shows the approved ones, and
 * "take Sam's morning" copies one into this browser (never over a routine of your own; taking it does not run it). The owner
 * says "offered routines" to see what waits and approve or reject each one.
 */
import { routineAsk, pick, load, save, remove, recentAsks, MAX_ASKS } from '../lib/routines.js';
import { skillOf } from '../lib/routine-skill.js';
import { offerAsk, othersAsk, cleanOffer, takeAsk, findShared, takeName, pendingAsk } from '../lib/shared-routines.js';

const store = () => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch (_) { return null; } };
let running = false; // a routine never runs inside another one
let seen = []; // the approved routines "routines from others" last showed, so "take Sam's morning" needs no "routine" after it

function card(api, title, rows, foot) {
  const { showPage, esc } = api;
  showPage((p) => {
    p.innerHTML = '<h2>' + esc(title) + '</h2>' // void-review: ok: every value goes through esc()
      + (rows.length ? '<ol data-routine-asks>' + rows.map((r) => '<li>' + esc(r) + '</li>').join('') + '</ol>' : '')
      + '<div class="sub" data-routine-foot>' + esc(foot) + '</div>';
  });
}

async function offer(o, saved, api, log) {
  const asks = (saved[o.name] && saved[o.name].asks) || [];
  if (!o.author) { card(api, 'Offer "my ' + o.name + '"?', asks, 'These asks would go to the site\'s owner to review, with a name you choose and nothing else. Say "offer my ' + o.name + ' as <a name>" to send it.'); log('offer-ask-name'); return 'routine'; }
  const c = cleanOffer({ name: o.name, author: o.author, asks });
  if (c.error) { card(api, 'Not offered', [], c.error + '.'); log('offer-refused'); return 'routine'; }
  let ok = false;
  try { const r = await fetch('/api/routines', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(c) }); ok = r.status === 202; } catch (_) {}
  card(api, ok ? 'Offered "my ' + c.name + '" as ' + c.author : 'Could not offer it just now', ok ? c.asks : [], ok
    ? 'Only these asks and the name ' + c.author + ' were sent. The site\'s owner reviews it first; once approved, others see it under "routines from others".'
    : 'Nothing was kept. Try again in a minute.');
  log(ok ? 'offer' : 'offer-failed'); return 'routine';
}

async function others(api, log) {
  let list = null;
  try { const r = await fetch('/api/routines'); if (r.ok) list = await r.json(); } catch (_) {}
  if (!Array.isArray(list)) { card(api, 'Could not reach shared routines', [], 'Try again in a minute.'); log('others-failed'); return 'routine'; }
  seen = list;
  card(api, list.length ? 'Routines from others' : 'No shared routines yet', list.map((r) => r.name + ' by ' + r.author + ': ' + r.asks.join(' · ')),
    list.length ? 'Each one was offered by its author and approved before it showed here. Say "take ' + list[0].author + '\'s ' + list[0].name + '" to keep one.' : 'Offer one of yours: "offer my morning as <a name>".');
  log('others'); return 'routine';
}

async function take(q, ls, saved, api, log) {
  let list = null;
  try { const r = await fetch('/api/routines'); if (r.ok) list = await r.json(); } catch (_) {}
  if (!Array.isArray(list)) { card(api, 'Could not reach shared routines', [], 'Try again in a minute.'); log('take-failed'); return 'routine'; }
  seen = list;
  const r = findShared(list, q);
  if (!r) { card(api, 'No "' + q.name + '" by ' + q.author, [], 'Say "routines from others" to see the ones you can take.'); log('take-none'); return 'routine'; }
  const name = takeName(saved, r);
  if (!name) { card(api, 'You have "my ' + r.name + '" already', [], 'Nothing changed. "forget my ' + r.name + '" frees the name.'); log('take-have'); return 'routine'; }
  save(ls, name, r.asks, new Date().toISOString().slice(0, 10));
  card(api, 'Took ' + r.author + '\'s ' + r.name + ' as "my ' + name + '"', r.asks, 'Say "my ' + name + '" to ask these, in this order. It stays in this browser; nothing was run yet.');
  api.say('took ' + r.author + '\'s ' + r.name); log('take'); return 'routine';
}

const ownerKey = () => { try { return (typeof localStorage !== 'undefined' && localStorage.getItem('a2m.void.owner.v1')) || ''; } catch (_) { return ''; } };

// the owner's card: each offer that waits, its asks, and Approve / Reject (POST /api/routines with the owner's key)
async function pending(api, log) {
  const tok = ownerKey();
  if (!tok) { card(api, 'Offered routines are the owner\'s to review', [], 'Unlock Verse first (unlock <key>), then ask again.'); log('pending-locked'); return 'routine'; }
  let list = null;
  try { const r = await fetch('/api/routines?pending=1', { headers: { authorization: 'Bearer ' + tok } }); if (r.ok) list = await r.json(); } catch (_) {}
  if (!Array.isArray(list)) { card(api, 'Could not read offered routines', [], 'The key was refused or the list is unreachable. Try again in a minute.'); log('pending-failed'); return 'routine'; }
  const { showPage, esc } = api;
  showPage((p) => {
    p.innerHTML = '<h2>' + esc(list.length ? 'Offered routines (' + list.length + ')' : 'No offered routines waiting') + '</h2>' // void-review: ok: every value goes through esc()
      + list.map((r, i) => '<div class="routine-offer" data-i="' + i + '"><b>' + esc(r.name) + '</b> by ' + esc(r.author) + '<ol>' + r.asks.map((a) => '<li>' + esc(a) + '</li>').join('') + '</ol>'
        + '<button type="button" data-yes>Approve</button> <button type="button" data-no>Reject</button> <button type="button" data-forge>Forge into a skill</button> <span class="sub" data-said></span></div>').join('')
      + '<div class="sub" data-routine-foot>' + esc(list.length ? 'Approved ones show to everyone under "routines from others", with the author\'s name.' : 'When someone offers a routine, it waits here.') + '</div>';
    p.querySelectorAll('.routine-offer').forEach((row) => {
      const r = list[+row.dataset.i], said = row.querySelector('[data-said]');
      const decide = async (yes) => {
        row.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        let ok = false;
        try { const res = await fetch('/api/routines', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify(yes ? { approve: r.id } : { reject: r.id }) }); ok = res.ok && !!(await res.json()).ok; } catch (_) {}
        said.textContent = ok ? (yes ? 'approved' : 'rejected') : 'not changed, try again';
        if (!ok) row.querySelectorAll('button').forEach((b) => { b.disabled = false; });
      };
      row.querySelector('[data-yes]').addEventListener('click', () => decide(true));
      row.querySelector('[data-no]').addEventListener('click', () => decide(false));
      // one click (asked by Void): the offer becomes a skill file to commit; the file is made here, from the offer, and downloaded
      row.querySelector('[data-forge]').addEventListener('click', () => {
        const k = skillOf(r);
        if (k.error) { said.textContent = 'not forged: ' + k.error; return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([k.source], { type: 'text/javascript' })); a.download = k.name + '.js';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        said.textContent = 'forged ' + k.name + '.js · approve it first, then in the repo: node tools/routine-skill.mjs ' + r.id + ' (says "' + k.phrase + '")';
      });
    });
  });
  log('pending'); return 'routine';
}

async function run(text, api) {
  const ls = store(), saved = load(ls), log = (note) => api.loopLog({ domain: 'void.page', ask: text, score: 'pass', note: 'routine:' + note });
  const o = offerAsk(text, saved);
  if (o) return offer(o, saved, api, log);
  if (othersAsk(text)) return others(api, log);
  if (pendingAsk(text)) return pending(api, log);
  const tq = takeAsk(text, seen);
  if (tq) return take(tq, ls, saved, api, log);
  const ask = routineAsk(text, saved);
  if (!ask) return 'none';
  if (ask.kind === 'save') {
    const asks = pick(recentAsks(ls), ask.count);
    if (!asks.length) { card(api, 'Nothing to keep yet', [], 'Ask a few things first, then say "call this my ' + ask.name + '" and I will keep them as a routine.'); log('empty'); return 'routine'; }
    save(ls, ask.name, asks, new Date().toISOString().slice(0, 10));
    card(api, 'Saved "my ' + ask.name + '"', asks, 'Say "my ' + ask.name + '" to ask these again, in this order. It stays in this browser; "forget my ' + ask.name + '" drops it. A routine keeps at most ' + MAX_ASKS + ' asks.');
    api.say('saved my ' + ask.name); log('save'); return 'routine';
  }
  if (ask.kind === 'list') {
    const names = Object.keys(saved);
    card(api, names.length ? 'Your routines' : 'No routines yet', names.map((n) => 'my ' + n + ': ' + saved[n].asks.join(' · ')), names.length ? 'Say one to run it. They stay in this browser.' : 'Ask a few things, then say "call this my morning".');
    log('list'); return 'routine';
  }
  if (ask.kind === 'forget') { remove(ls, ask.name); card(api, 'Forgot "my ' + ask.name + '"', [], 'It is gone from this browser.'); log('forget'); return 'routine'; }
  // run: each ask goes through the same path as typing it, one after another
  if (running) return 'none';
  const asks = (saved[ask.name] && saved[ask.name].asks) || [];
  running = true; log('run');
  try { for (const a of asks) await api.stage.ask(a); } finally { running = false; }
  api.say('my ' + ask.name + ': ' + asks.length + ' ask' + (asks.length === 1 ? '' : 's'));
  return 'routine';
}

export default {
  name: 'routine',
  routineAsk, offerAsk, othersAsk,
  examples: ['call this my morning', 'save that as my evening', 'save the last 2 asks as my study', 'my routines', 'routines from others', "take Sam's morning routine"],
  nearMisses: ['call my mom', 'what is a morning routine', 'save the whales', 'call this number', 'my calendar', 'forget my password', 'share my screen', 'offer my condolences', "take Sam's advice", 'take a picture'],
  match(lower, text) { const t = text || lower, saved = load(store()); return !!(routineAsk(t, saved) || offerAsk(t, saved) || othersAsk(t) || pendingAsk(t) || takeAsk(t, seen)); },
  run,
};
