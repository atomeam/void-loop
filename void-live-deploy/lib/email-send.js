// The send executor behind the confirm line (operator, 2026-10-10: Workers Paid is already paid, so build it).
// Runs only inside the confirm line's decision handler (functions/api/approval.js executors), after the owner's yes
// on the exact draft: the proposal card attaches the draft text to its ask, the fingerprint covers it, and a yes on
// different args never reaches here. Sends through Cloudflare Email Service's send binding (env.EMAIL.send), from a
// sender on the onboarded domain only, under a daily cap (void_kv, EMAIL_DAILY_CAP, default 10). Dry run is the
// default: nothing really goes out until the Pages variable EMAIL_LIVE is set to `send` after the first dry run is
// read and confirmed. Tests: tools/email-send.test.mjs (a stand-in binding; no real mail in any test).
export const SEND_DOMAIN = 'a-to-mind.com';
export const DAILY_CAP = 10;
const ADDR_RE = /^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/;

export async function sendProposal(args, env) {
  const to = String((args && args.to) || '').trim();
  if (!ADDR_RE.test(to)) throw new Error('no valid address to send to');
  const body = String((args && args.body) || '').trim();
  if (!body) throw new Error('no draft on the ask: the yes covers one exact draft, and this ask carried none');
  const from = String(env.SEND_FROM || 'atom@' + SEND_DOMAIN).trim();
  if (!from.endsWith('@' + SEND_DOMAIN)) throw new Error('the sender must be on ' + SEND_DOMAIN + ' (SEND_FROM)');
  const subject = (args.title ? 'Proposal: ' + String(args.title) : 'Your proposal from A-to-Mind').slice(0, 150);
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_kv (k TEXT PRIMARY KEY, v TEXT)').run();
  const day = 'email.sent.' + new Date().toISOString().slice(0, 10);
  const sent = parseInt(await env.DB.prepare('SELECT v FROM void_kv WHERE k = ?').bind(day).first('v') || '0', 10) || 0;
  const cap = Math.max(1, parseInt(env.EMAIL_DAILY_CAP, 10) || DAILY_CAP);
  if (sent >= cap) throw new Error('the daily send cap (' + cap + ') is reached; nothing sent');
  if (String(env.EMAIL_LIVE || '') !== 'send') {
    return 'dry run: would send “' + subject + '” to ' + to + ' from ' + from + ' (' + body.length + ' chars). '
      + 'Real sending starts when the Pages variable EMAIL_LIVE is set to `send`.';
  }
  if (!env.EMAIL || typeof env.EMAIL.send !== 'function') throw new Error('email is not connected: no EMAIL send binding on the project');
  await env.EMAIL.send({ to, from, subject, text: body });
  await env.DB.prepare('INSERT INTO void_kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(day, String(sent + 1)).run();
  return 'sent “' + subject + '” to ' + to + ' (' + (sent + 1) + ' of ' + cap + ' today)';
}
