/**
 * digest skill: Verse reads a video's words. "summarize this transcript: …" (paste any transcript, YouTube's included),
 * "summarize https://<peertube>/w/<id>" or an archive.org/details link (their open captions), then "what did this teach?"
 * or "what did it say about X?". Server: /api/digest (lib/digest.js). The transcript stays in this tab's memory only.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
let last = null; // { text } or { url }: the one video being discussed, this tab only, never saved
const LINK = /(https:\/\/(?:archive\.org\/(?:details|embed)\/[^\s]+|[a-z0-9.-]+\.[a-z]{2,}\/(?:w|videos\/watch)\/[A-Za-z0-9-]{8,40}))/i;
export function digestAsk(text) {
  const t = String(text || '').trim();
  let m = t.match(/^(?:summari[sz]e|digest|tl;?dr)\s+(?:this\s+|the\s+)?(?:transcript|captions|video transcript)\s*[:\-]?\s*([\s\S]{80,})$/i)
    || t.match(/^(?:transcript|captions)\s*:\s*([\s\S]{80,})$/i);
  if (m) return { kind: 'text', text: m[1] };
  m = t.match(/^(?:summari[sz]e|digest|tl;?dr|what\s+did|what\s+does)\b[^\n]*?/i) && t.match(LINK);
  if (m && !/youtu/i.test(m[1])) { const ask = /what\s+(?:did|does)/i.test(t) ? t.replace(m[1], 'this video') : ''; return { kind: 'url', url: m[1], ask }; }
  m = t.match(/^what\s+(?:did|does)\s+(?:this|that|the|it)\s*(?:video|transcript|talk|tutorial)?\s*(teach|say|show|explain|cover)\b(?:\s+(?:me\s+)?(?:about\s+)?(.{2,120}))?\??$/i);
  if (m) return { kind: 'ask', ask: t };
  return null;
}
async function run(text, api) {
  const { showPage, esc } = api, d = digestAsk(text);
  if (!d) return 'none';
  // no video yet: a card that says how, with a sample to try (issue #766: a whisper alone read as "nothing appeared")
  if (d.kind === 'ask' && !last) {
    const sample = 'summarize https://makertube.net/w/02f54689-5640-4be7-b51c-bcbb6587a07f';
    showPage((p) => { p.innerHTML = '<h2>What this video teaches</h2><p>I haven\'t read a video in this tab yet. Give me one first:</p><ul>'
      + '<li>a PeerTube or Internet Archive link: <i>summarize https://…/w/…</i></li><li>or any transcript (YouTube\'s too): <i>summarize this transcript: …</i></li></ul>'
      + '<p>then ask “what did this video teach?” or “what did it say about …?”</p><button type="button" class="dg-try">Try a sample video</button>';
      const b = p.querySelector('.dg-try'); if (b) b.addEventListener('click', () => { if (api.stage && api.stage.ask) api.stage.ask(sample); }); });
    api.say('give me a video first'); return 'digest';
  }
  if (d.kind === 'text') last = { text: d.text.slice(0, 60000) };
  if (d.kind === 'url') last = { url: d.url };
  const body = Object.assign({}, last, { ask: d.ask || '' });
  const el = showPage((p) => { p.innerHTML = '<h2>What this video teaches</h2><div class="sub">reading it…</div>'; });
  try {
    const r = await fetch('/api/digest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!api._pageStill(el)) return 'digest';
    if (!j.ok) { el.innerHTML = '<h2>What this video teaches</h2><p>' + esc(j.error || 'could not read it') + '</p>'; return 'digest'; }
    const li = (a) => '<ul>' + a.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    const src = j.source.kind === 'pasted' ? 'your pasted transcript (not saved)' : '<a href="' + esc(j.source.url) + '" target="_blank" rel="noopener">its open captions on ' + (j.source.kind === 'archive' ? 'the Internet Archive' : 'PeerTube') + '</a>';
    el.innerHTML = '<h2>What this video teaches</h2>'
      + (j.summary ? '<div style="white-space:pre-wrap">' + esc(j.summary) + '</div>' : '')
      + (j.answer.length ? '<h3>On your question</h3>' + li(j.answer) : '')
      + '<h3>Key lines</h3>' + li(j.points)
      + (j.tricks.length ? '<h3>Editing tricks it mentions</h3>' + li(j.tricks) : '')
      + '<div class="src">Read from ' + src + ' · ' + j.words + ' words' + (j.model ? ' · summary by Gemma' : '') + ' · ask "what did this teach about …?"</div>';
    api.say(j.summary ? j.summary.split('\n')[0].replace(/^[-*•\s]+/, '').slice(0, 200) : (j.answer[0] || j.points[0] || 'read it'));
    return 'digest';
  } catch (_) { if (api._pageStill(el)) el.innerHTML = '<h2>What this video teaches</h2><p>That did not answer just now. Ask again in a moment.</p>'; return 'digest'; }
}
export default {
  name: 'digest',
  examples: ['summarize this transcript: black holes form when massive stars collapse and nothing escapes past the event horizon', 'summarize https://makertube.net/w/02f54689-5640-4be7-b51c-bcbb6587a07f', 'what did this video teach?'],
  nearMisses: ['summarize this article', 'what did you learn today', 'play a video about black holes'],
  match(lower, text) { return !!digestAsk(text); },
  run,
  suite() { const long = 'x '.repeat(150); return { ok: digestAsk('summarize this transcript: ' + long).kind === 'text' && digestAsk('summarize https://tilvids.com/w/c3c07e95-5a0a-4997-9a14-6d8979e03e9f').kind === 'url' && digestAsk('what did this video teach?').kind === 'ask' && digestAsk('what did you learn today') === null && digestAsk('play a video about black holes') === null }; },
};
