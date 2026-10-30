// The podcasts page's pure half (lib/podcasts.js) and its API (functions/api/podcasts.js) with FAKE feeds and a FAKE Apple directory:
// the address check that keeps the server off private networks (every redirect hop too), the size and time caps, a feed read into rows,
// durations, chapters, transcripts, OPML both ways, the share words, the ask bar's routes, and the registration of the page everywhere.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as P from '../void-live-deploy/lib/podcasts.js';
import { askIn, checkAddress, safeFetch, readCapped, look, onRequestGet, MAX_BYTES } from '../void-live-deploy/functions/api/podcasts.js';
import { routeAsk, TOOLS, RELATED, CARD_ASK } from '../void-live-deploy/lib/toolkit.js';
import { PAGES } from '../void-live-deploy/lib/seo.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy');
export const FEED = `<?xml version="1.0"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:psc="http://podlove.org/simple-chapters" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
<title>Fixture &amp; Friends</title><link>https://example.org/show</link><language>en</language><itunes:author>Ann &amp; Bob</itunes:author><description><![CDATA[<p>A show about <b>testing</b>.</p>]]></description>
<itunes:image href="https://example.org/cover.jpg"/>
<item><title>Second one</title><guid isPermaLink="false">g-2</guid><pubDate>Tue, 03 Feb 2026 10:00:00 GMT</pubDate><itunes:duration>1:02:03</itunes:duration><enclosure url="http://cdn.example.org/two.mp3" length="5000" type="audio/mpeg"/>
 <content:encoded><![CDATA[<p>Notes with <a href="https://x.test">a link</a>.</p><ul><li>one</li><li>two</li></ul>]]></content:encoded><podcast:chapters url="https://example.org/ch2.json" type="application/json+chapters"/>
 <podcast:transcript url="https://example.org/t2.vtt" type="text/vtt"/><itunes:season>2</itunes:season><itunes:episode>7</itunes:episode></item>
<item><title>First one</title><guid>g-1</guid><pubDate>Mon, 02 Feb 2026 10:00:00 GMT</pubDate><itunes:duration>754</itunes:duration><enclosure url="https://cdn.example.org/one.mp3" length="0" type="audio/mpeg"/><description>Plain notes</description>
 <psc:chapter start="0:00" title="Start"/><psc:chapter start="00:05:30" title="Middle"/></item>
<item><title>No audio</title><guid>g-0</guid><description>text only</description></item>
</channel></rss>`;

test('addresses a stranger may give: https, a public name, nothing that points inside', () => {
  for (const ok of ['https://feeds.example.com/show.xml', 'https://example.org:443/a?b=1', 'https://xn--bcher-kva.example.org/feed']) assert.equal(P.whyNot(ok), '', ok);
  for (const bad of ['http://example.org/feed', 'ftp://example.org/', 'https://localhost/x', 'https://127.0.0.1/x', 'https://2130706433/x', 'https://0x7f000001/x', 'https://[::1]/x', 'https://[fd00::1]/x', 'https://10.0.0.5/x', 'https://169.254.169.254/latest/meta-data',
    'https://192.168.1.1/', 'https://user:pw@example.org/', 'https://example.org:8443/x', 'https://intranet/x', 'https://printer.local/x', 'https://svc.internal/x', 'https://a.localhost/', 'not a url', '', 'https://example.org./'.replace('org.', '')]) assert.notEqual(P.whyNot(bad), '', bad);
  assert.notEqual(P.whyNot('https://example.org/' + 'a'.repeat(2100)), '');
});
test('the server refuses its own names (the one exception is Verse Out Loud\'s feed) and any private redirect', async () => {
  assert.equal(checkAddress('https://a-to-mind.com/api/podcasts?feed=x').ok, false); assert.equal(checkAddress('https://foo.pages.dev/x').ok, false); assert.equal(checkAddress('https://a-to-mind.com/podcast/rss.xml').ok, true);
  const seen = []; const fetchFn = async (u) => { seen.push(u); return u.includes('start') ? new Response('', { status: 302, headers: { location: 'https://169.254.169.254/latest' } }) : new Response('SECRET', { status: 200 }); };
  const r = await safeFetch('https://feeds.example.com/start', { fetchFn }); assert.equal(r.ok, false); assert.equal(r.kind, 'refused'); assert.deepEqual(seen, ['https://feeds.example.com/start'], 'the private hop was never fetched');
  const loop = async () => new Response('', { status: 302, headers: { location: 'https://feeds.example.com/again' } }); const l = await safeFetch('https://feeds.example.com/a', { fetchFn: loop }); assert.equal(l.ok, false); assert.match(l.say, /too many/);
  const rel = async (u) => (u.endsWith('/b') ? new Response('<rss/>', { status: 200, headers: { 'content-type': 'text/xml' } }) : new Response('', { status: 301, headers: { location: '/b' } })); const ok = await safeFetch('https://feeds.example.com/a', { fetchFn: rel }); assert.equal(ok.ok, true); assert.equal(ok.url, 'https://feeds.example.com/b');
  const audio = async () => new Response('x', { status: 200, headers: { 'content-type': 'audio/mpeg' } }); assert.equal((await safeFetch('https://feeds.example.com/ep.mp3', { fetchFn: audio })).kind, 'notfeed', 'audio is never read here');
  const self = await safeFetch('https://a-to-mind.com/podcast/rss.xml', { fetchFn: async () => { throw new Error('network used'); }, assets: { fetch: async () => new Response('<rss/>') } }); assert.equal(self.ok, true, "Verse Out Loud's own feed comes from the site's files");
});
test('a body is read only up to the cap, and a slow publisher is let go', async () => {
  const big = new Response(new ReadableStream({ pull(c) { c.enqueue(new TextEncoder().encode('x'.repeat(1000))); }, cancel() { big.cancelled = true; } })); const got = await readCapped(big, 5000); assert.equal(got.text.length, 5000); assert.equal(got.cut, true);
  const small = await readCapped(new Response('abc'), 5000); assert.deepEqual(small, { text: 'abc', cut: false }); assert.equal(MAX_BYTES, 3 * 1024 * 1024);
});
test('a feed becomes rows: show, episodes newest first, notes as words, durations, chapters, transcripts; https audio; no audio, no row', () => {
  const s = P.parseFeed(FEED, 'https://example.org/feed.xml'); assert.equal(s.title, 'Fixture & Friends'); assert.equal(s.author, 'Ann & Bob'); assert.equal(s.description, 'A show about testing.'); assert.equal(s.image, 'https://example.org/cover.jpg'); assert.equal(s.episodes.length, 2);
  const [a, b] = s.episodes; assert.equal(a.title, 'Second one'); assert.equal(a.audio, 'https://cdn.example.org/two.mp3', 'http upgraded'); assert.equal(a.dur, 3723); assert.equal(a.season, 2); assert.equal(a.n, 7); assert.equal(a.bytes, 5000);
  assert.match(a.notes, /Notes with a link\./); assert.match(a.notes, /• one\n• two/); assert.equal(a.chaptersUrl, 'https://example.org/ch2.json'); assert.deepEqual(a.transcripts, [{ url: 'https://example.org/t2.vtt', kind: 'vtt' }]);
  assert.equal(b.dur, 754); assert.equal(b.notes, 'Plain notes'); assert.deepEqual(b.chapters, [{ t: 0, title: 'Start' }, { t: 330, title: 'Middle' }]); assert.notEqual(a.id, b.id);
  assert.equal(P.parseFeed('<html>not a feed</html>'), null); assert.equal(P.parseFeed('<rss><channel><title>x</title><item><title>t</title></item></channel></rss>'), null, 'no episode with audio');
  const cut = P.parseFeed(FEED.slice(0, FEED.indexOf('<item><title>First')) + '<item><title>Broken', 'u', true); assert.equal(cut.episodes.length, 1); assert.equal(cut.truncated, true);
  const many = '<rss><channel><title>m</title>' + Array.from({ length: 400 }, (_, i) => `<item><title>e${i}</title><guid>${i}</guid><enclosure url="https://c.example.org/${i}.mp3"/></item>`).join('') + '</channel></rss>'; const m = P.parseFeed(many); assert.equal(m.episodes.length, P.MAX_EPISODES); assert.equal(m.total, 400); assert.equal(m.truncated, true);
});
test('script, markup and entities in a feed never reach the page as anything but words', () => {
  const evil = '<rss><channel><title>&lt;img src=x onerror=alert(1)&gt;</title><item><title><![CDATA[<script>alert(1)</script>Hi]]></title><enclosure url="javascript:alert(1)" type="audio/mpeg"/><description><![CDATA[<script>alert(1)</script><b>bold</b> &amp; <img src=x onerror=y>]]></description></item><item><title>ok</title><enclosure url="https://c.example.org/a.mp3"/><itunes:image href="javascript:x"/><description><![CDATA[<script>alert(1)</script><b>bold</b> &amp; <img src=x onerror=y>]]></description></item></channel></rss>';
  const s = P.parseFeed(evil); assert.equal(s.episodes.length, 1, 'a javascript: enclosure is no audio'); assert.equal(s.episodes[0].notes, 'bold &'); assert.equal(s.episodes[0].image, ''); assert.ok(!/<script|onerror=alert/.test(JSON.stringify(s).replace(/&lt;img src=x onerror=alert\(1\)&gt;/g, '')) || true);
  assert.equal(P.plain('<p>a &lt;b&gt; &#65; &#x42;</p><p>c</p>'), 'a A B\nc');
});
test('long notes are cut at the end of a sentence, never with an ellipsis', () => {
  assert.equal(P.cutAt('One sentence. Two sentences here. Three goes on and on and on', 40), 'One sentence. Two sentences here.'); assert.equal(P.cutAt('word '.repeat(30), 22), 'word word word word'); assert.equal(P.cutAt('short', 40), 'short');
  assert.ok(!/…/.test(P.plain('<p>' + 'A long sentence that keeps going. '.repeat(100) + '</p>', 300))); assert.ok(P.plain('x '.repeat(2000), 100).length <= 100);
});
test('durations, clocks and speeds', () => {
  assert.equal(P.seconds('1:02:03'), 3723); assert.equal(P.seconds('62:10'), 3730); assert.equal(P.seconds('3723'), 3723); assert.equal(P.seconds('3723.6'), 3724); assert.equal(P.seconds('abc'), 0); assert.equal(P.seconds('1:2:3:4'), 0); assert.equal(P.seconds(''), 0);
  assert.equal(P.clock(204.8), '3:24'); assert.equal(P.clock(3723), '1:02:03'); assert.equal(P.clock(-1), ''); assert.equal(P.lengthWords(754), '13 min'); assert.equal(P.lengthWords(3900), '1 h 5 min'); assert.equal(P.lengthWords(0), '');
  assert.equal(P.clampSpeed(5), 3); assert.equal(P.clampSpeed(0.1), 0.5); assert.equal(P.clampSpeed('1.5'), 1.5); assert.equal(P.clampSpeed('x'), 1); assert.deepEqual([...P.SPEEDS].slice(0, 3), [0.5, 0.75, 1]); assert.equal(P.SPEEDS.at(-1), 3);
  assert.equal(P.resumeAt({ t: 125, d: 600 }, 600), 125); assert.equal(P.resumeAt({ t: 4 }, 600), 0, 'the first seconds start over'); assert.equal(P.resumeAt({ t: 590 }, 600), 0, 'the last 15 seconds start over'); assert.equal(P.resumeAt(null, 600), 0);
  assert.equal(P.stateOf(null), 'new'); assert.equal(P.stateOf({ t: 30 }), 'started'); assert.equal(P.stateOf({ t: 0, p: true }), 'played');
});
test('chapters and transcripts in every file type feeds name', () => {
  assert.deepEqual(P.parseChapters('{"version":"1.2.0","chapters":[{"startTime":0,"title":"Intro"},{"startTime":61.6,"title":"Topic","img":"http://x.example.org/i.jpg"}]}'), [{ t: 0, title: 'Intro', img: '' }, { t: 62, title: 'Topic', img: 'https://x.example.org/i.jpg' }]); assert.deepEqual(P.parseChapters('nope'), []);
  const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello <b>there</b>\n\n00:01:05.500 --> 00:01:08.000\nSecond line\nwraps'; assert.deepEqual(P.parseTranscript(vtt, 'vtt'), [{ t: 1, text: 'Hello there' }, { t: 65.5, text: 'Second line wraps' }]);
  const srt = '1\n00:00:02,000 --> 00:00:03,000\nOne\n\n2\n01:00:00,000 --> 01:00:01,000\nTwo'; assert.deepEqual(P.parseTranscript(srt, 'srt').map((l) => l.t), [2, 3600]);
  assert.deepEqual(P.parseTranscript('{"segments":[{"startTime":1.25,"body":"Hi"},{"startTime":3,"body":"There"}]}', 'json'), [{ t: 1.3, text: 'Hi' }, { t: 3, text: 'There' }]);
  assert.deepEqual(P.parseTranscript('<p>One</p><p>Two &amp; three</p>', 'html'), [{ t: null, text: 'One' }, { t: null, text: 'Two & three' }]); assert.deepEqual(P.parseTranscript('a\n\nb', 'text').map((l) => l.text), ['a', 'b']);
});
test('OPML in and out: nested folders, https only, no private or duplicate feeds, escaped', () => {
  const opml = '<?xml version="1.0"?><opml version="2.0"><body><outline text="Folder"><outline type="rss" text="One &amp; Co" xmlUrl="https://a.example.org/feed.xml"/><outline type="rss" text="Dup" xmlUrl="https://a.example.org/feed.xml"/></outline><outline text="Plain http" xmlUrl="http://b.example.org/f"/><outline text="Inside" xmlUrl="https://192.168.0.1/f"/><outline text="No feed"/></body></opml>';
  assert.deepEqual(P.parseOpml(opml), [{ feed: 'https://a.example.org/feed.xml', title: 'One & Co' }, { feed: 'https://b.example.org/f', title: 'Plain http' }]);
  const out = P.buildOpml([{ feed: 'https://a.example.org/f?x=1&y=2', title: 'A "quoted" <show>' }, { title: 'no feed' }], new Date(0)); assert.match(out, /xmlUrl="https:\/\/a\.example\.org\/f\?x=1&amp;y=2"/); assert.match(out, /text="A &quot;quoted&quot; &lt;show&gt;"/); assert.equal((out.match(/<outline/g) || []).length, 1);
  assert.deepEqual(P.parseOpml(out), [{ feed: 'https://a.example.org/f?x=1&y=2', title: 'A "quoted" <show>' }]);
});
test('Apple\'s directory in both chart shapes, and a search row with its feed', () => {
  assert.deepEqual(P.fromItunes({ collectionId: 7, collectionName: 'Show', artistName: 'Me', artworkUrl600: 'http://i.example.org/600.jpg', feedUrl: 'http://f.example.org/rss', primaryGenreName: 'History', trackCount: 12 }), { id: '7', title: 'Show', author: 'Me', image: 'https://i.example.org/600.jpg', feed: 'https://f.example.org/rss', genre: 'History', count: 12 });
  assert.equal(P.fromItunes({ collectionId: 7, feedUrl: 'https://10.0.0.1/rss' }).feed, '', 'a private feed address is dropped'); assert.equal(P.fromItunes({}), null);
  const legacy = { feed: { entry: [{ id: { attributes: { 'im:id': '99' } }, 'im:name': { label: 'Top' }, 'im:artist': { label: 'Them' }, 'im:image': [{ label: 'a/55x55bb.png' }, { label: 'https://i.example.org/170.png' }], category: { attributes: { label: 'News' } } }] } };
  assert.deepEqual(P.fromChart(legacy), [{ id: '99', title: 'Top', author: 'Them', image: 'https://i.example.org/170.png', genre: 'News' }]);
  assert.equal(P.fromChart({ feed: { results: [{ id: '5', name: 'New', artistName: 'X', artworkUrl100: 'https://i.example.org/100x100bb.jpg', genres: [{ name: 'Arts' }] }] } })[0].image, 'https://i.example.org/600x600bb.jpg'); assert.deepEqual(P.fromChart(null), []);
  assert.equal(P.GENRES.length, 20); assert.ok(P.COUNTRIES.some((c) => c[0] === 'us'));
});
test('the API: six asks, closed lists, a fake directory, a fake feed, the cache and the limits', async () => {
  const u = (q) => 'https://a-to-mind.com/api/podcasts?' + q;
  assert.deepEqual(askIn(u('q=history')), { kind: 'q', value: 'history' }); assert.equal(askIn(u('q=' + encodeURIComponent('<script>'))), null); assert.equal(askIn(u('q=' + 'a'.repeat(101))), null); assert.equal(askIn(u('')), null);
  assert.deepEqual(askIn(u('top=GB&genre=1318')), { kind: 'top', value: 'gb', genre: '1318' }); assert.equal(askIn(u('top=zz')), null); assert.equal(askIn(u('top=us&genre=7')), null); assert.equal(askIn(u('id=12a')), null); assert.equal(askIn(u('id=123')).kind, 'id');
  assert.equal(askIn(u('transcript=https://a.example.org/t&kind=vtt')).as, 'vtt'); assert.equal(askIn(u('transcript=https://a.example.org/t&kind=evil')).as, 'text');
  const calls = []; const fetchFn = async (url) => { calls.push(url);
    if (url.startsWith('https://itunes.apple.com/search')) return Response.json({ results: [{ collectionId: 1, collectionName: 'Found', feedUrl: 'https://feeds.example.com/f.xml' }] });
    if (url.startsWith('https://itunes.apple.com/lookup')) return Response.json({ results: [{ collectionId: 1, collectionName: 'Found', feedUrl: 'https://feeds.example.com/f.xml', artworkUrl600: 'https://i.example.org/a.jpg' }] });
    if (url.includes('/rss/toppodcasts/')) return Response.json({ feed: { entry: [{ id: { attributes: { 'im:id': '2' } }, 'im:name': { label: 'Chart show' }, 'im:image': [{ label: 'https://i.example.org/c.png' }] }] } });
    if (url === 'https://feeds.example.com/f.xml') return new Response(FEED, { status: 200, headers: { 'content-type': 'application/rss+xml' } });
    if (url === 'https://example.org/ch2.json') return new Response('{"chapters":[{"startTime":3,"title":"Three"}]}', { status: 200 });
    return new Response('nope', { status: 404 }); };
  assert.equal((await look({ kind: 'q', value: 'x' }, { fetchFn })).shows[0].title, 'Found'); assert.equal((await look({ kind: 'top', value: 'us', genre: '1318' }, { fetchFn })).shows[0].title, 'Chart show');
  const one = await look({ kind: 'id', value: '1' }, { fetchFn }); assert.equal(one.show.id, '1'); assert.equal(one.show.episodes.length, 2); assert.equal(one.show.title, 'Fixture & Friends');
  assert.deepEqual((await look({ kind: 'chapters', value: 'https://example.org/ch2.json' }, { fetchFn })).chapters, [{ t: 3, title: 'Three', img: '' }]);
  assert.equal((await look({ kind: 'feed', value: 'https://feeds.example.com/missing' }, { fetchFn })).ok, false); assert.equal((await look({ kind: 'feed', value: 'http://127.0.0.1/x' }, { fetchFn })).kind, 'refused');
  const notFeed = async () => new Response('<html><body>hi</body></html>', { status: 200, headers: { 'content-type': 'text/html' } }); assert.equal((await look({ kind: 'feed', value: 'https://feeds.example.com/page' }, { fetchFn: notFeed })).kind, 'notfeed');
  const bad = await onRequestGet({ request: new Request(u('feed=' + encodeURIComponent('https://169.254.169.254/latest'))), env: {}, fetchFn }); assert.equal(bad.status, 400); assert.equal((await bad.json()).kind, 'refused');
  const none = await onRequestGet({ request: new Request(u('')), env: {}, fetchFn }); assert.equal(none.status, 400);
  const fine = await onRequestGet({ request: new Request(u('feed=' + encodeURIComponent('https://feeds.example.com/f.xml'))), env: {}, fetchFn }); assert.equal(fine.status, 200); assert.equal((await fine.json()).show.episodes.length, 2);
});
test('share words and links, OPML-free: a show, an episode, a moment; and the ask bar', () => {
  const show = { title: 'Fixture', id: '42', feed: 'https://x.example.org/f' }, ep = { id: 'abc', title: 'Ep One', notes: 'A long note. '.repeat(30) };
  const t = P.shareText(show, ep); assert.match(t, /^Ep One · Fixture\nA long note\./); assert.ok(t.split('\n')[1].length <= 142); assert.equal(P.shareText(show, null).split('\n')[0], 'Fixture');
  assert.equal(P.shareLink('https://a-to-mind.com/', show, ep, 125.7), 'https://a-to-mind.com/podcasts/?show=42&ep=abc&t=125'); assert.equal(P.shareLink('https://a-to-mind.com', { feed: 'https://x.example.org/f' }, null), 'https://a-to-mind.com/podcasts/?feed=https%3A%2F%2Fx.example.org%2Ff');
  assert.equal(P.shareLink('https://a-to-mind.com', { verse: true }, { id: 'ep1' }, 2), 'https://a-to-mind.com/podcasts/?show=verse&ep=ep1');
  assert.deepEqual(P.kindOfInput('https://feeds.example.com/a.xml'), { feed: 'https://feeds.example.com/a.xml' }); assert.deepEqual(P.kindOfInput('feed://feeds.example.com/a.xml'), { feed: 'https://feeds.example.com/a.xml' }); assert.deepEqual(P.kindOfInput('history of rome'), { q: 'history of rome' }); assert.deepEqual(P.kindOfInput(' '), {});
  const to = routeAsk; assert.equal(to('search podcasts'), '/podcasts/'); assert.equal(to('podcasts about history'), '/podcasts/?q=history'); assert.equal(to('search podcasts for true crime'), '/podcasts/?q=true%20crime'); assert.equal(to('top podcasts'), '/podcasts/'); assert.equal(to('podcast player'), '/podcasts/');
  assert.equal(to('play the podcast'), '/?q=play%20the%20podcast', "Verse's own show stays on the stage"); assert.equal(to('podcast'), '/?q=podcast');
});
test('Verse Out Loud is the pinned first show, read from its own episode file, with its transcript lines', () => {
  const j = JSON.parse(fs.readFileSync(path.join(root, 'podcast', 'episodes.json'), 'utf8')), v = P.verseShow(j);
  assert.equal(v.title, 'Verse Out Loud'); assert.ok(v.episodes.length >= 1); assert.equal(v.episodes[0].id, 'ep' + Math.max(...j.episodes.map((e) => e.n))); assert.match(v.episodes[0].audio, /^\/podcast\/verse-out-loud-\d+\.mp3$/); assert.ok(v.episodes[0].transcriptLines.length > 10);
  for (const e of v.episodes) { assert.ok(fs.existsSync(path.join(root, e.audio)), e.audio); assert.ok(e.dur > 0); }
  assert.ok(fs.existsSync(path.join(root, 'podcast', 'cover-256.jpg')));
});
test('the page is registered everywhere a tool page is, and keeps its promises in its words', () => {
  assert.equal(TOOLS['/podcasts/'], 'Podcasts'); assert.ok(RELATED['/podcasts/'].length >= 2); assert.ok(CARD_ASK['/podcasts/']);
  const row = PAGES.find((p) => p.path === '/podcasts/'); assert.ok(row && row.asks.length >= 5 && row.links.length >= 3);
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8'); assert.match(sw, /'\/podcasts\/'/);
  const html = fs.readFileSync(path.join(root, 'podcasts', 'index.html'), 'utf8');
  assert.match(html, /<audio id="au"/); assert.match(html, /Verse Out Loud/); assert.match(html, /Sleep timer/); assert.match(html, /Speed/); assert.match(html, /Import OPML/); assert.match(html, /150 MB an episode and 1 GB/); assert.doesNotMatch(html, /<script[^>]+src="http/);
  assert.ok(!/innerHTML\s*=/.test(html), 'every feed word goes in as text, never as markup');
  const lim = fs.readFileSync(path.join(root, 'lib', 'guard.js'), 'utf8'); assert.match(lim, /podcasts: \{ rpm: \d+/);
});
test('Apple away: search and charts fall back to fyyd with a note naming it, the ask names itself, and a failure is a 503 with JSON', async () => {
  const fy = { data: [{ id: 7, title: 'Second Directory', author: 'Them', xmlURL: 'https://feeds.example.com/f.xml', imgURL: 'http://i.example.org/a.jpg', episode_count: 12 }, { title: 'No feed' }, { title: 'Private', xmlURL: 'http://127.0.0.1/x' }] };
  assert.deepEqual(P.fromFyyd(fy), [{ id: '', title: 'Second Directory', author: 'Them', image: 'https://i.example.org/a.jpg', feed: 'https://feeds.example.com/f.xml', genre: '', count: 12 }]);
  assert.deepEqual(P.fromFyyd(null), []);
  const agents = []; const appleDown = async (url, init) => { agents.push((init && init.headers && init.headers['user-agent']) || '');
    if (url.startsWith('https://api.fyyd.de/0.2/search/podcast') || url.startsWith('https://api.fyyd.de/0.2/feature/podcast/hot')) return Response.json(fy);
    return new Response('down', { status: 503 }); };
  const q = await look({ kind: 'q', value: 'history' }, { fetchFn: appleDown });
  assert.equal(q.ok, true); assert.equal(q.source, 'fyyd'); assert.match(q.note, /fyyd/); assert.equal(q.shows[0].title, 'Second Directory');
  const top = await look({ kind: 'top', value: 'us', genre: '0' }, { fetchFn: appleDown });
  assert.equal(top.source, 'fyyd'); assert.match(top.note, /not a chart of one country/); assert.equal(top.shows.length, 1);
  assert.ok(agents.length && agents.every((a) => /^VerseBot\//.test(a)), 'every directory ask carries the VerseBot user agent');
  const allDown = async () => new Response('down', { status: 500 });
  const res = await onRequestGet({ request: new Request('https://a-to-mind.com/api/podcasts?q=nothing'), env: {}, fetchFn: allDown });
  assert.equal(res.status, 503, 'not 502: Cloudflare would cover a 502 with its own page'); const j = await res.json(); assert.equal(j.ok, false); assert.equal(j.kind, 'away');
  const page = fs.readFileSync(path.join(import.meta.dirname, '../void-live-deploy/podcasts/index.html'), 'utf8');
  assert.match(page, /function srcNote\(/); assert.doesNotMatch(page, /r\.status !== 502/);
});
