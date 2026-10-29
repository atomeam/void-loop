#!/usr/bin/env node
// Step 2 of the broadcast loop (owner, 2026-10-14: "Verse should use my Youtube channel to make its own Videos"): upload a film
// tools/record.mjs made to Verse's channel, "A-to-Mind's Verse" (https://www.youtube.com/@atombomb983). The YouTube Data API v3 with
// the owner's own OAuth client: a refresh token is traded for an access token, the token's channel must be Verse's (anything else is
// refused, so a wrong token never posts somewhere else), then a resumable upload of the video with its title, description and tags.
// Uploads from an API project Google has not audited are kept private by YouTube itself (videos.insert docs); YT_PRIVACY sets the
// status asked for (private by default; public once the project is audited and the owner says so).
//   node tools/youtube.mjs media/<id>.json      needs YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN (repo secrets)
// Without the three it says so and exits 0: the film is still kept as the workflow's artifact.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CHANNEL_ID = 'UCk9IOf_MwoC6Bw3zxEZiTPg'; // A-to-Mind's Verse, @atombomb983 (the owner, 2026-10-14)
export const CATEGORY = '28'; // Science & Technology

// what Google's refusals mean, in the owner's terms (the first real run, 2026-10-14, got unauthorized_client)
export const HINTS = {
  unauthorized_client: 'the refresh token was made for a different OAuth client than YT_CLIENT_ID and YT_CLIENT_SECRET. Make it again in the OAuth Playground with "Use your own OAuth credentials" ticked (the gear icon) and this client\'s ID and secret',
  invalid_grant: 'the refresh token has expired or was revoked (a consent screen left in "Testing" expires them after 7 days). Publish the app, then make a new token',
  invalid_client: 'YT_CLIENT_ID or YT_CLIENT_SECRET is wrong: copy both again from Google Cloud, Credentials',
};

/** a fresh access token from the refresh token */
export async function accessToken({ clientId, clientSecret, refreshToken }, fetchFn = fetch) {
  const r = await fetchFn('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }).toString() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Google refused the refresh token (' + r.status + (j.error ? ': ' + j.error : '') + ')' + (HINTS[j.error] ? ': ' + HINTS[j.error] : ''));
  return j.access_token;
}

/** the channel the token posts to; refuses any channel but Verse's */
export async function checkChannel(token, fetchFn = fetch, want = CHANNEL_ID) {
  const r = await fetchFn('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', { headers: { authorization: 'Bearer ' + token } });
  const j = await r.json().catch(() => ({}));
  const id = j.items && j.items[0] && j.items[0].id;
  if (id !== want) throw new Error('the token belongs to channel ' + (id || '(none)') + ', not Verse\'s ' + want + ': nothing uploaded');
  return id;
}

/** the request body videos.insert takes, from the film's metadata. Pure. */
export function videoResource(meta, privacy = 'private') {
  return { snippet: { title: String(meta.title).slice(0, 100), description: String(meta.description).slice(0, 5000), tags: (meta.tags || []).slice(0, 15), categoryId: CATEGORY },
    status: { privacyStatus: ['private', 'unlisted', 'public'].includes(privacy) ? privacy : 'private', selfDeclaredMadeForKids: false } };
}

/** upload the video (resumable: open the session, then send the bytes); returns the new video's id */
export async function upload(token, bytes, meta, privacy, fetchFn = fetch) {
  const open = await fetchFn('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', { method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': 'video/webm', 'x-upload-content-length': String(bytes.length) },
    body: JSON.stringify(videoResource(meta, privacy)) });
  const at = open.headers.get('location');
  if (!open.ok || !at) throw new Error('YouTube would not open an upload (' + open.status + '): ' + (await open.text().catch(() => '')).slice(0, 300));
  const put = await fetchFn(at, { method: 'PUT', headers: { 'content-type': 'video/webm', 'content-length': String(bytes.length) }, body: bytes });
  const j = await put.json().catch(() => ({}));
  if (!put.ok || !j.id) throw new Error('the upload failed (' + put.status + '): ' + JSON.stringify(j).slice(0, 300));
  return j.id;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const metaPath = process.argv[2];
  const env = { clientId: process.env.YT_CLIENT_ID, clientSecret: process.env.YT_CLIENT_SECRET, refreshToken: process.env.YT_REFRESH_TOKEN };
  if (!env.clientId || !env.clientSecret || !env.refreshToken) { console.log('No YouTube credentials (YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN): nothing uploaded; the film is kept as the run\'s artifact.'); process.exit(0); }
  if (!metaPath || !fs.existsSync(metaPath)) { console.error('usage: node tools/youtube.mjs media/<id>.json'); process.exit(2); }
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const bytes = fs.readFileSync(path.join(path.dirname(metaPath), meta.video));
  const token = await accessToken(env);
  await checkChannel(token);
  const id = await upload(token, bytes, meta, process.env.YT_PRIVACY || 'private');
  console.log('uploaded to Verse\'s channel: https://www.youtube.com/shorts/' + id + ' (' + (process.env.YT_PRIVACY || 'private') + ')');
}
