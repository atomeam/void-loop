/**
 * strength skill — "check password strength", "how strong is my password", "password strength for hunter2".
 * Client-side analysis only: length, variety, common patterns. The password never leaves this browser. Empty surface stays empty.
 */
export function strengthOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:check|rate|test|how strong is)\s+(?:my\s+|the\s+|a\s+)?password(?:\s+(?:strength|for)\s+(.+))?$/) || t.match(/^password\s+strength(?:\s+(?:of|for)\s+(.+))?$/);
  return m ? (m[1] || '') : null;
}

function score(pw) {
  if (!pw) return { score: 0, notes: ['type a password to check it'] };
  let s = 0, notes = [];
  if (pw.length >= 12) s += 40; else if (pw.length >= 8) s += 20; else notes.push('short (aim for 12+)');
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 15; else notes.push('mix upper and lower');
  if (/\d/.test(pw)) s += 15; else notes.push('add a number');
  if (/[^a-zA-Z0-9]/.test(pw)) s += 20; else notes.push('add a symbol');
  if (/(.)\1{2,}/.test(pw) || /123|abc|qwerty|password|admin/i.test(pw)) { s -= 20; notes.push('avoid repeats and common words'); }
  s = Math.max(0, Math.min(100, s));
  const label = s >= 80 ? 'strong' : s >= 50 ? 'okay' : 'weak';
  return { score: s, label, notes: notes.length ? notes : ['looks solid'] };
}

function run(text, api) {
  const pw = strengthOf(text);
  if (pw === null) return 'none';
  const { showPage, esc } = api;
  const r = score(pw);
  showPage((p) => {
    p.innerHTML = '<h2>Password strength</h2><div class="sub">' + (pw ? 'For the password you typed' : 'Type one after the ask, or ask again with it') + '</div>'
      + '<div style="margin:12px 0;font-size:28px;font-weight:700">' + r.score + ' / 100 · ' + esc(r.label) + '</div>'
      + '<ul>' + r.notes.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul>'
      + '<div class="src">Checked in this browser only. The password is never sent or stored.</div>';
  });
  return 'strength';
}

export default {
  name: 'strength',
  examples: ['check password strength', 'how strong is my password', 'password strength for hunter2'],
  nearMisses: ['what is a strong password', 'generate a password', 'reset my password'],
  match(lower, text) { return strengthOf(text) !== null; },
  run,
  suite() {
    return { ok: strengthOf('check password strength') === '' && strengthOf('password strength for abc') === 'abc' && strengthOf('hello') === null };
  },
};
