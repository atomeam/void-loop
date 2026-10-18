// tools/youtube.mjs: Verse's films go to Verse's channel and nowhere else.
import assert from 'node:assert/strict';
import { accessToken, checkChannel, videoResource, upload, CHANNEL_ID } from './youtube.mjs';

const calls = [];
const google = (channel) => async (url, o = {}) => {
  calls.push({ url, method: o.method || 'GET', headers: o.headers || {}, body: o.body });
  if (url.startsWith('https://oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'at-1' }), { status: 200 });
  if (url.includes('/youtube/v3/channels')) return new Response(JSON.stringify({ items: channel ? [{ id: channel }] : [] }), { status: 200 });
  if (url.includes('uploadType=resumable')) return new Response('', { status: 200, headers: { location: 'https://upload.example/session-1' } });
  if (url === 'https://upload.example/session-1') return new Response(JSON.stringify({ id: 'vid123' }), { status: 200 });
  return new Response('?', { status: 404 });
};
const f = google(CHANNEL_ID);
assert.equal(await accessToken({ clientId: 'c', clientSecret: 's', refreshToken: 'r' }, f), 'at-1');
assert.match(calls[0].body, /grant_type=refresh_token/);
// the first real run (2026-10-14): Google's 401 unauthorized_client says what to redo, not only the code
const refuse = (error) => async () => new Response(JSON.stringify({ error }), { status: 401, headers: { 'content-type': 'application/json' } });
await assert.rejects(accessToken({ clientId: 'c', clientSecret: 's', refreshToken: 'r' }, refuse('unauthorized_client')), /401: unauthorized_client\): .*Use your own OAuth credentials/);
await assert.rejects(accessToken({ clientId: 'c', clientSecret: 's', refreshToken: 'r' }, refuse('invalid_grant')), /expired or was revoked/);
assert.equal(await checkChannel('at-1', f), CHANNEL_ID);
await assert.rejects(checkChannel('at-1', google('UCsomeoneelse')), /not Verse's/, 'a token for another channel uploads nothing');
await assert.rejects(checkChannel('at-1', google(null)), /not Verse's/);
const meta = { title: 'T'.repeat(120), description: 'D', tags: ['Verse', 'Shorts'] };
const r = videoResource(meta, 'public');
assert.equal(r.snippet.title.length, 100); assert.equal(r.status.privacyStatus, 'public'); assert.equal(r.status.selfDeclaredMadeForKids, false);
assert.equal(videoResource(meta, 'whatever').status.privacyStatus, 'private', 'anything unknown stays private');
assert.equal(await upload('at-1', Buffer.from('webm'), meta, 'private', f), 'vid123');
const open = calls.find((c) => c.url.includes('uploadType=resumable'));
assert.equal(open.headers.authorization, 'Bearer at-1'); assert.equal(open.headers['x-upload-content-type'], 'video/webm');
console.log('youtube: ok');
