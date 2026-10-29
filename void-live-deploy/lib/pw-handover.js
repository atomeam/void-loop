// a password goes from one Verse page to another in memory only: never in an address, a hash, history or storage.
// the opener holds it until the page it opened asks for it, from the same origin, once; then both sides drop it.
const KIND = 'a2m-pw-handover', WAIT = 30000;

// open url in a new tab and hand pw to that tab when it asks. false when the tab did not open (nothing is carried then)
export function handOver(win, pw, url = '/password-strength/') {
  if (typeof pw !== 'string' || !pw) return false;
  const w = win.open(url, '_blank'); if (!w) return false;
  const origin = win.location.origin; let held = pw;
  const done = () => { held = ''; win.removeEventListener('message', on); clearTimeout(t); };
  const on = (e) => { if (e.source !== w || e.origin !== origin || !e.data || e.data.kind !== KIND || e.data.want !== true) return; const v = held; done(); try { w.postMessage({ kind: KIND, pw: v }, origin); } catch (_) { /* the tab went away */ } };
  const t = setTimeout(done, WAIT);
  win.addEventListener('message', on); return true;
}

// on the page that was opened: ask the opener for the password and give it to take, once
export function receive(win, take, wait = WAIT) {
  let o = null; try { o = win.opener; } catch (_) {} if (!o) return false;
  const origin = win.location.origin;
  const done = () => { win.removeEventListener('message', on); clearTimeout(t); };
  const on = (e) => { if (e.source !== o || e.origin !== origin || !e.data || e.data.kind !== KIND || typeof e.data.pw !== 'string') return; done(); take(e.data.pw.slice(0, 128)); };
  const t = setTimeout(done, wait);
  win.addEventListener('message', on);
  try { o.postMessage({ kind: KIND, want: true }, origin); } catch (_) { done(); return false; }
  return true;
}
