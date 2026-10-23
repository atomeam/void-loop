/**
 * podcast skill - Verse Out Loud, Verse's own weekly podcast (owner, 2026-10-21: "Verse should make its own podcast").
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * The episodes are made by tools/podcast.mjs from the public record only (growth ledger, proven asks, Verse's own daily readout,
 * the incident log) and voiced with Piper, an open-source voice that runs on the CI machine (no account, no cost). The card plays the
 * newest episode (or "episode 2"), shows the whole transcript (every line whole, wrapping at any width; a line jumps the player to it),
 * and has Download, Share (this moment too), the RSS feed and the transcript file: every Verse media is free to download and repost.
 * Leaves other people's podcasts ("best podcasts about history", "start a podcast") to the skills that answer those.
 */
const WHOSE = "(?:(?:the\\s+)?(?:verse|v01d|void|your|a-?to-?mind)'?s?\\s+(?:own\\s+)?)";
const POD = '(?:podcasts?|pod|show|episodes?)';
const PLAY = '(?:(?:play|open|show|start|listen\\s+to|put\\s+on|hear)\\s+(?:me\\s+)?)?';
const RES = [
  new RegExp('^' + PLAY + '(?:the\\s+)?(?:verse\\s+)?(?:latest|newest|last|new)\\s+(?:verse\\s+)?(?:podcast\\s+)?episode$'), // "latest episode"
  new RegExp('^' + PLAY + '(?:the\\s+)?podcast$'), // "play the podcast", "podcast"
  new RegExp('^' + PLAY + WHOSE + POD + '$'), // "verse podcast", "your podcast", "play verse's show"
  new RegExp('^' + PLAY + '(?:the\\s+)?verse\\s+(?:out\\s+loud|show)(?:\\s+podcast)?$'), // "verse out loud"
  /^(?:does\s+)?(?:verse|v01d|void|you)\s+(?:have|has|make|do)\s+(?:a|its\s+own|your\s+own)\s+podcast$/,
  /^(?:podcast|verse out loud)\s+(?:rss|feed)$|^(?:the\s+)?podcast\s+(?:rss|feed)$/,
  /^(?:play\s+)?(?:podcast\s+|verse out loud\s+)?episode\s+(\d{1,3})$/,
];
const norm = (s) => String(s || '').toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
export const wantsPodcast = (lower) => { const t = norm(lower); return RES.some((r) => r.test(t)); };
export const episodeAsked = (lower) => { const m = norm(lower).match(/episode\s+(\d{1,3})$/); return m ? +m[1] : 0; };
const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

/** the card's HTML for one episode. Pure (esc passed in). */
export function cardHtml(ep, all, esc) {
  const url = '/podcast/' + ep.file;
  const lines = (ep.lines || []).map((l, i) => '<p class="vpod-line" data-i="' + i + '"' + (l.t != null ? ' data-t="' + l.t + '"' : '') + ' style="margin:.5em 0;white-space:normal;overflow-wrap:anywhere;word-break:normal;line-height:1.45;cursor:' + (l.t != null ? 'pointer' : 'auto') + '">'
    + (l.t != null ? '<span class="sub" style="font-variant-numeric:tabular-nums;margin-right:.4em">' + mmss(l.t) + '</span>' : '') + '<b>' + esc(l.who) + ':</b> ' + esc(l.text) + '</p>').join('');
  const others = all.filter((e) => e.n !== ep.n).slice(-5).reverse().map((e) => '<li><a href="#" data-ep="' + e.n + '">' + esc(e.title) + '</a></li>').join('');
  const btn = 'style="display:inline-block;margin:4px 6px 4px 0;padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.25);color:inherit;text-decoration:none;background:none;font:inherit;cursor:pointer"';
  return '<div class="vpod" data-podcast="' + ep.n + '" style="max-width:100%;overflow-wrap:anywhere">'
    + '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><img src="/podcast/cover.jpg" alt="Verse Out Loud cover" width="84" height="84" style="border-radius:10px;flex:none"><div style="min-width:0;flex:1 1 180px"><h2 style="margin:0;overflow-wrap:anywhere">Verse Out Loud</h2><div class="sub" style="white-space:normal">' + esc(ep.title) + ' · ' + mmss(ep.seconds || 0) + '</div></div></div>'
    + '<audio class="vpod-audio" controls preload="metadata" src="' + esc(url) + '" style="width:100%;margin:10px 0"></audio>'
    + '<div><a ' + btn + ' href="' + esc(url) + '" download data-act="download">Download mp3</a><button ' + btn + ' data-act="share">Share</button><button ' + btn + ' data-act="moment">Share this moment</button><a ' + btn + ' href="/podcast/' + esc(ep.transcript) + '" download>Transcript</a><a ' + btn + ' href="/podcast/rss.xml" target="_blank" rel="noopener">RSS feed</a><a ' + btn + ' href="/store/" target="_blank" rel="noopener">Tip Verse</a></div>'
    + '<p class="sub" style="white-space:normal">' + esc(ep.summary || '') + ' Free to download and repost, no sign-in.</p>'
    + '<details open><summary><b>Full transcript</b></summary>' + lines + '</details>'
    + (others ? '<details><summary>Other episodes</summary><ul>' + others + '</ul></details>' : '')
    + '<div class="src" style="white-space:normal">Source: Verse\'s growth ledger, proven asks, daily readout and incident log, read aloud by tools/podcast.mjs with Piper voices. Nothing in it is made up.</div></div>';
}

async function run(text, api) {
  const { showPage, esc } = api, want = episodeAsked(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Verse Out Loud</h2><div class="sub">\u2026</div>'; });
  let all = [];
  try { all = (await fetch('/podcast/episodes.json', { cache: 'no-cache' }).then((r) => r.json())).episodes || []; } catch (_) {}
  if (api._pageStill && !api._pageStill(el)) return 'podcast';
  if (!all.length) { el.innerHTML = '<h2>Verse Out Loud</h2><p>No episode yet: the first one is made by the weekly podcast workflow.</p>'; return 'podcast'; }
  const show = (n) => {
    const ep = all.find((e) => e.n === n) || all[all.length - 1];
    el.innerHTML = cardHtml(ep, all, esc);
    const audio = el.querySelector('.vpod-audio'), link = location.origin + '/podcast/?ep=' + ep.n;
    const share = async (u, title) => { try { if (navigator.share) { await navigator.share({ title, url: u }); return; } } catch (_) { return; } try { await navigator.clipboard.writeText(u); api.toast ? api.toast('Link copied') : 0; } catch (_) {} };
    el.querySelector('[data-act="share"]').onclick = () => share(link, 'Verse Out Loud: ' + ep.title);
    el.querySelector('[data-act="moment"]').onclick = () => share(location.origin + '/podcast/' + ep.file + '#t=' + Math.floor(audio.currentTime || 0), 'Verse Out Loud at ' + mmss(audio.currentTime || 0));
    el.querySelectorAll('.vpod-line[data-t]').forEach((p) => { p.onclick = () => { audio.currentTime = +p.dataset.t; audio.play().catch(() => {}); }; });
    audio.ontimeupdate = () => { let cur = null; el.querySelectorAll('.vpod-line[data-t]').forEach((p) => { if (+p.dataset.t <= audio.currentTime) cur = p; p.style.opacity = ''; }); if (cur) cur.style.opacity = '1'; el.querySelectorAll('.vpod-line[data-t]').forEach((p) => { if (p !== cur && !audio.paused) p.style.opacity = '.7'; }); };
    el.querySelectorAll('[data-ep]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); show(+a.dataset.ep); }; });
  };
  show(want || all[all.length - 1].n);
  return 'podcast';
}

export default {
  name: 'podcast',
  examples: ['play the podcast', 'latest episode', 'verse podcast', 'verse out loud', "play verse's podcast", 'listen to your podcast', 'episode 1', 'podcast rss', 'does verse have a podcast'],
  nearMisses: ['best podcasts about history', 'start a podcast', 'make me a podcast about cats', 'latest episode of the office'],
  match(lower) { return wantsPodcast(lower); },
  run,
};
