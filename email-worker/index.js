// void-email: the buyer's emailed reply reaches its job with no outside service (replaces the Gmail filter + Zapier
// zap in docs/intake.md). Cloudflare Email Routing hands this worker every message sent to the routed address on
// a-to-mind.com. The worker always forwards the message on to the owner's verified inbox (FORWARD_TO), so nothing is
// lost; when the subject carries the receipt drafts' `[sale:<id>]` tag, it also reads the text body out of the raw
// MIME and POSTs it to /api/handoff with the bearer token — the same endpoint the zap called, which keeps only the
// sender's domain, redacts the body, appends `reply received: <url>` to the job and writes the sale.reply record.
// A post that fails never loses the mail (the forward already happened); it is retried by replying again.
//   deploy once:  cd email-worker && npx wrangler deploy      (then Email Routing, see docs/intake.md)
// Tests: tools/email-worker.test.mjs (the parsing and the post, on a real multipart fixture).

export const SALE_TAG_RE = /\[sale:([A-Za-z0-9._-]+)\]/;
const MAX_RAW = 256 * 1024; // a reply is a few KB; attachments past this are not the words we need

/** the text/plain part of a raw MIME message, decoded; a single-part message is its body after the blank line */
export function textBodyOf(raw) {
  const s = String(raw || '').slice(0, MAX_RAW).replace(/\r\n/g, '\n');
  const split = s.indexOf('\n\n');
  const head = split < 0 ? s : s.slice(0, split), rest = split < 0 ? '' : s.slice(split + 2);
  const b = /boundary="?([^";\n]+)"?/i.exec(head);
  if (!b) return decodePart(head, rest);
  for (const part of rest.split('--' + b[1])) {
    const ps = part.replace(/^\n/, ''), psplit = ps.indexOf('\n\n');
    if (psplit < 0) continue;
    const phead = ps.slice(0, psplit);
    if (/content-type:\s*text\/plain/i.test(phead) || !/content-type:/i.test(phead)) {
      return decodePart(phead, ps.slice(psplit + 2).replace(/\n--\s*$/, ''));
    }
  }
  return '';
}
// both encodings carry UTF-8 as bytes, so the decoded bytes go through TextDecoder, never straight to characters
const utf8 = (byteString) => new TextDecoder().decode(Uint8Array.from([...byteString].map((c) => c.charCodeAt(0) & 0xff)));
function decodePart(head, body) {
  body = body.trim();
  if (/content-transfer-encoding:\s*base64/i.test(head)) {
    try { return utf8(atob(body.replace(/\s+/g, ''))); } catch (_) { return ''; }
  }
  if (/content-transfer-encoding:\s*quoted-printable/i.test(head)) {
    return utf8(body.replace(/=\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))));
  }
  return body;
}

/** one message through the pipe; returns a short line saying what happened (for tests and tail logs) */
export async function handleEmail(message, env, fetchImpl = fetch) {
  let forwarded = 'no forward address';
  if (env.FORWARD_TO) {
    try { await message.forward(env.FORWARD_TO); forwarded = 'forwarded'; }
    catch (e) { forwarded = 'forward failed: ' + ((e && e.message) || e); }
  }
  const subject = message.headers.get('subject') || '';
  const tag = SALE_TAG_RE.exec(subject);
  if (!tag) return forwarded + ', no sale tag';
  let body = '';
  try { body = textBodyOf(await new Response(message.raw).text()); } catch (_) {}
  if (!body) return forwarded + ', no text body to post';
  let r;
  try {
    r = await fetchImpl((env.HANDOFF_URL || 'https://a-to-mind.com/api/handoff'), {
      method: 'POST',
      headers: { authorization: 'Bearer ' + (env.HANDOFF_TOKEN || ''), 'content-type': 'application/json' },
      body: JSON.stringify({ name: subject, author: message.from || '', body, job: 'sale:' + tag[1] }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) { return forwarded + ', post failed: ' + ((e && e.message) || e); }
  return forwarded + ', handoff answered ' + r.status;
}

export default { email: (message, env, ctx) => handleEmail(message, env) };
