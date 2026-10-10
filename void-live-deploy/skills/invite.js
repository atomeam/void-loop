/**
 * invite skill: bring someone into your Void (frontier #11). A signed-in member gets a link; whoever opens it appears here
 * as a faint presence, and what either of you summons shows on both stages. Closing the tab ends it; your Void stays yours.
 * The room is made by POST /api/share (lib/share.js); the page joins it on the 'void:share-join' event (lib/share-client.js).
 * "invite someone", "invite a friend into my Void", "bring someone in".
 */
const ME_KEY = 'a2m.void.me.v1';
export function inviteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:please\s+)?(?:invite\s+(?:someone|somebody|a\s+friend|a\s+person|people)|bring\s+(?:someone|somebody|a\s+friend|a\s+person)\s+in(?:to)?)(?:\s+(?:in|into|to)?\s*(?:my|your|this)\s+void)?$/.test(t)
    || /^(?:please\s+)?share\s+(?:my|this)\s+void\s+live$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!inviteOf(text)) return 'none';
  let me = null; try { me = JSON.parse(localStorage.getItem(ME_KEY) || 'null'); } catch (_) {}
  if (!me || !me.token) {
    showPage((p) => { p.innerHTML = '<h2>Invite someone</h2><p>An invite comes from a signed-in Void. Say <b>remember me</b> first, then <b>invite someone</b>.</p>'; });
    return 'invite';
  }
  let j = null;
  try { const r = await fetch('/api/share', { method: 'POST', headers: { authorization: 'Bearer ' + me.token } }); j = await r.json(); if (!r.ok) j = { error: j.error || 'HTTP ' + r.status }; } catch (_) { j = { error: 'no connection' }; }
  if (!j || !j.link) {
    showPage((p) => { p.innerHTML = '<h2>Invite someone</h2><p>No invite just now: ' + esc((j && j.error) || 'try again') + '.</p>'; });
    return 'none';
  }
  showPage((p) => {
    p.innerHTML = '<h2>Invite someone</h2><p>Whoever opens this link appears in your Void as a faint presence, and what either of you summons shows on both.</p>'
      + '<p><a href="' + esc(j.link) + '" target="_blank" rel="noopener">' + esc(j.link) + '</a></p>'
      + '<p>Close the tab to end it. Your own Void stays yours: nothing of theirs is saved here.</p>'
      + '<div class="src">' + (j.live ? 'Live across devices.' : 'The live relay is not on yet: for now, tabs in this browser share.') + '</div>';
  });
  document.dispatchEvent(new CustomEvent('void:share-join', { detail: j.room }));
  return 'invite';
}

export default {
  name: 'invite',
  examples: ['invite someone', 'invite a friend', 'invite someone into my Void', 'bring someone in', 'share my Void live'],
  nearMisses: ['share this card', 'how do i invite someone to a zoom call', 'send an invite to the party', 'invite'],
  match(lower, text) { return inviteOf(text); },
  run,
};
