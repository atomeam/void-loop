// the password page's stage ask: only the length goes in, never a password (a link lands in history, logs and referrers).
// The stage's password card makes 8 to 128 characters (skills/util.js), so a length outside that, or a passphrase, keeps the example ask.
export function cardAsk(len, mode = 'pw') {
  const s = String(len ?? '').trim();
  if (mode !== 'pw' || !/^\d{1,3}$/.test(s) || +s < 8 || +s > 128) return '';
  return 'generate a password with ' + +s + ' characters';
}
