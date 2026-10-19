// Video: the pure part of Verse's video skill (skills/video.js) and its search route (functions/api/video.js). Owner, 2026-10-15:
// "it should master youtube and easily pull up any video, rumble and other free platforms too. Verse should be the only site you need."
// Embed only: every player is the platform's own official embed (YouTube through youtube-nocookie.com), so nothing is downloaded or
// rehosted, the platform's terms are kept and the creator's ads and counts stay theirs. Nothing here touches the network.

export const PLATFORMS = {
  youtube: { label: 'YouTube', search: (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q) },
  rumble: { label: 'Rumble', search: (q) => 'https://rumble.com/search/video?q=' + encodeURIComponent(q) },
  vimeo: { label: 'Vimeo', search: (q) => 'https://vimeo.com/search?q=' + encodeURIComponent(q) },
  dailymotion: { label: 'Dailymotion', search: (q) => 'https://www.dailymotion.com/search/' + encodeURIComponent(q) + '/videos' },
  archive: { label: 'Internet Archive', search: (q) => 'https://archive.org/search?query=' + encodeURIComponent(q) + '&and[]=mediatype%3A%22movies%22' },
  peertube: { label: 'PeerTube', search: (q) => 'https://sepiasearch.org/search?search=' + encodeURIComponent(q) },
  odysee: { label: 'Odysee', search: (q) => 'https://odysee.com/$/search?q=' + encodeURIComponent(q) },
  twitch: { label: 'Twitch', search: (q) => 'https://www.twitch.tv/search?term=' + encodeURIComponent(q) },
};
// which platforms the route can search without anyone's key (public, documented APIs); YouTube needs YOUTUBE_API_KEY
export const OPEN_SEARCH = ['dailymotion', 'archive', 'peertube', 'odysee'];

/** "2:30", "1:02:03", "90", "90s", "2m30s", "1h2m3s" -> seconds, or null. Pure. */
export function secondsOf(s) {
  s = String(s == null ? '' : s).trim().toLowerCase();
  if (!s) return null;
  let m = s.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/); if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  m = s.match(/^(\d{1,4}):(\d{1,2})$/); if (m) return +m[1] * 60 + +m[2];
  m = s.match(/^(?:(\d+)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?\s*(?:(\d+)\s*s(?:ec(?:ond)?s?)?)?$/);
  if (m && (m[1] || m[2] || m[3])) return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  m = s.match(/^(\d{1,6})$/); if (m) return +m[1];
  return null;
}
/** seconds -> "2:30" / "1:02:03". Pure. */
export function clockOf(n) {
  n = Math.max(0, Math.round(+n || 0)); const h = Math.floor(n / 3600), m = Math.floor(n / 60) % 60, s = n % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
/** a pasted url -> { platform, id, start?, needsOembed? } for any platform Verse can play, or null. Pure. */
export function parseVideoUrl(raw) {
  let u; try { u = new URL(String(raw || '').trim()); } catch (_) { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/^(?:www|m|music)\./, ''), path = u.pathname, start = secondsOf(u.searchParams.get('t') || u.searchParams.get('start') || (u.hash.match(/t=([\dhms:]+)/) || [])[1]);
  const out = (o) => (start ? Object.assign(o, { start }) : o);
  if (host === 'youtu.be') { const id = path.slice(1).split('/')[0]; return YT_ID.test(id) ? out({ platform: 'youtube', id }) : null; }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = u.searchParams.get('v'); if (v && YT_ID.test(v)) return out({ platform: 'youtube', id: v });
    const m = path.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/); if (m) return out({ platform: 'youtube', id: m[1] });
    const l = u.searchParams.get('list'); if (l && /^[A-Za-z0-9_-]{10,64}$/.test(l)) return { platform: 'youtube', list: l, id: null };
    return null;
  }
  if (host === 'rumble.com') {
    let m = path.match(/^\/embed\/(v[a-z0-9]+)\/?/i); if (m) return out({ platform: 'rumble', id: m[1] });
    m = path.match(/^\/(v[a-z0-9]+)-[^/]*\.html$/i); if (m) return out({ platform: 'rumble', page: u.origin + path, id: null, needsOembed: true }); // the page id is not the embed id: Rumble's oEmbed gives it
    return null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') { const m = path.match(/(?:^|\/)(\d{5,12})(?:\/([0-9a-f]{6,20}))?\/?$/); return m ? out({ platform: 'vimeo', id: m[1], hash: m[2] || u.searchParams.get('h') || null }) : null; }
  if (host === 'dailymotion.com' || host === 'dai.ly' || host === 'geo.dailymotion.com') {
    const m = host === 'dai.ly' ? path.match(/^\/(x[a-z0-9]+)/i) : path.match(/\/video\/(x[a-z0-9]+)/i) || [null, u.searchParams.get('video')];
    return m && m[1] && /^x[a-z0-9]+$/i.test(m[1]) ? out({ platform: 'dailymotion', id: m[1] }) : null;
  }
  if (host === 'archive.org') { const m = path.match(/^\/(?:details|embed)\/([A-Za-z0-9._-]+)/); return m ? out({ platform: 'archive', id: m[1] }) : null; }
  if (host === 'odysee.com') { const m = path.match(/^\/(?:\$\/embed\/)?(@[^/]+\/[^/]+|[^@$/][^/]*)$/); return m ? out({ platform: 'odysee', id: decodeURIComponent(m[1]) }) : null; }
  if (host === 'clips.twitch.tv') { const id = path.slice(1).split('/')[0]; return /^[A-Za-z0-9_-]{4,100}$/.test(id) ? { platform: 'twitch', clip: id, id } : null; }
  if (host === 'twitch.tv') {
    let m = path.match(/^\/videos\/(\d+)/); if (m) return out({ platform: 'twitch', video: m[1], id: m[1] });
    m = path.match(/^\/[A-Za-z0-9_]{3,25}\/clip\/([A-Za-z0-9_-]{4,100})/); if (m) return { platform: 'twitch', clip: m[1], id: m[1] };
    m = path.match(/^\/([A-Za-z0-9_]{3,25})\/?$/); if (m && !/^(?:search|directory|videos|settings|downloads|p)$/i.test(m[1])) return { platform: 'twitch', channel: m[1], id: m[1] };
    return null;
  }
  // PeerTube runs on many hosts; its watch paths are its own
  const p = path.match(/^\/(?:w|videos\/watch|videos\/embed)\/([A-Za-z0-9-]{8,40})\/?$/);
  if (p) return out({ platform: 'peertube', host: u.host, id: p[1] });
  return null;
}

/** the official embed url for a parsed video. opts: { start, captions, parent (Twitch needs the page's host), autoplay }. Pure. */
export function embedUrl(v, opts = {}) {
  if (!v) return null;
  const start = Math.max(0, Math.floor(opts.start != null ? opts.start : v.start || 0)), ap = opts.autoplay ? 1 : 0;
  switch (v.platform) {
    case 'youtube': {
      const q = new URLSearchParams({ enablejsapi: '1', rel: '0', playsinline: '1', modestbranding: '1' });
      if (ap) q.set('autoplay', '1'); if (start) q.set('start', String(start));
      if (opts.captions) { q.set('cc_load_policy', '1'); q.set('cc_lang_pref', opts.lang || 'en'); }
      if (opts.origin) q.set('origin', opts.origin);
      if (!v.id && v.list) { q.set('list', v.list); return 'https://www.youtube-nocookie.com/embed/videoseries?' + q; }
      return 'https://www.youtube-nocookie.com/embed/' + v.id + '?' + q;
    }
    case 'rumble': return v.id ? 'https://rumble.com/embed/' + v.id + '/?pub=4' + (ap ? '&autoplay=2' : '') + (start ? '&start=' + start : '') : null;
    case 'vimeo': { const q = new URLSearchParams({ dnt: '1' }); if (v.hash) q.set('h', v.hash); if (ap) q.set('autoplay', '1'); if (opts.captions) q.set('texttrack', opts.lang || 'en');
      return 'https://player.vimeo.com/video/' + v.id + '?' + q + (start ? '#t=' + start + 's' : ''); }
    case 'dailymotion': return 'https://www.dailymotion.com/embed/video/' + v.id + '?' + new URLSearchParams(Object.assign({}, ap ? { autoplay: '1' } : {}, start ? { start: String(start) } : {}, opts.captions ? { 'subtitles-default': opts.lang || 'en' } : {}));
    case 'archive': return 'https://archive.org/embed/' + v.id + (start ? '?start=' + start : '');
    case 'peertube': return 'https://' + v.host + '/videos/embed/' + v.id + '?' + new URLSearchParams(Object.assign({ warningTitle: '0' }, ap ? { autoplay: '1' } : {}, start ? { start: start + 's' } : {}, opts.captions ? { subtitle: opts.lang || 'en' } : {}));
    case 'odysee': return 'https://odysee.com/$/embed/' + String(v.id).split('/').map(encodeURIComponent).join('/').replace(/%40/g, '@').replace(/%3A/gi, ':') + (start ? '?t=' + start : '');
    case 'twitch': { const parent = opts.parent || 'a-to-mind.com', base = 'parent=' + encodeURIComponent(parent) + '&autoplay=' + (ap ? 'true' : 'false');
      if (v.clip) return 'https://clips.twitch.tv/embed?clip=' + encodeURIComponent(v.clip) + '&' + base;
      if (v.video) return 'https://player.twitch.tv/?video=v' + v.video + '&' + base + (start ? '&time=' + Math.floor(start / 3600) + 'h' + (Math.floor(start / 60) % 60) + 'm' + (start % 60) + 's' : '');
      return 'https://player.twitch.tv/?channel=' + encodeURIComponent(v.channel) + '&' + base; }
    default: return null;
  }
}
/** the platform's own page for a parsed video (the "open on …" link that credits the creator). Pure. */
export function watchUrl(v) {
  if (!v) return null;
  switch (v.platform) {
    case 'youtube': return v.id ? 'https://www.youtube.com/watch?v=' + v.id : 'https://www.youtube.com/playlist?list=' + v.list;
    case 'rumble': return v.page || 'https://rumble.com/embed/' + v.id + '/';
    case 'vimeo': return 'https://vimeo.com/' + v.id + (v.hash ? '/' + v.hash : '');
    case 'dailymotion': return 'https://www.dailymotion.com/video/' + v.id;
    case 'archive': return 'https://archive.org/details/' + v.id;
    case 'peertube': return 'https://' + v.host + '/w/' + v.id;
    case 'odysee': return 'https://odysee.com/' + v.id;
    case 'twitch': return v.clip ? 'https://clips.twitch.tv/' + v.clip : v.video ? 'https://www.twitch.tv/videos/' + v.video : 'https://www.twitch.tv/' + v.channel;
    default: return null;
  }
}
/** what each embed can do from Verse's controls: seek in place, speed, captions. Pure data. */
export const CAN = {
  youtube: { seek: 'api', speed: true, captions: true }, vimeo: { seek: 'api', speed: true, captions: true },
  dailymotion: { seek: 'reload', speed: false, captions: true }, peertube: { seek: 'reload', speed: false, captions: true },
  rumble: { seek: 'reload', speed: false, captions: false }, archive: { seek: 'reload', speed: false, captions: false },
  odysee: { seek: 'reload', speed: false, captions: false }, twitch: { seek: 'reload', speed: false, captions: false },
};

const PLAT_WORD = { youtube: /\b(?:youtube|yt)\b/, rumble: /\brumble\b/, vimeo: /\bvimeo\b/, dailymotion: /\bdaily\s?motion\b/, archive: /\b(?:internet\s+archive|archive\.org|the\s+archive)\b/, peertube: /\bpeer\s?tube\b/, odysee: /\bodysee\b/, twitch: /\btwitch\b/ };
const PLAT_STRIP = /\s*\b(?:on|from|in|at|over\s+on)\s+(?:the\s+)?(?:youtube|yt|rumble|vimeo|daily\s?motion|internet\s+archive|archive\.org|archive|peer\s?tube|odysee|twitch)\b\s*/g;
export function platformIn(t) { for (const [k, re] of Object.entries(PLAT_WORD)) if (re.test(t)) return k; return null; }
// "play" asks that belong to the page's games, music boxes and the rest: never a video search
const NOT_VIDEO = /^(?:a\s+|the\s+|some\s+)?(?:game|games|chess|checkers|go|othello|reversi|connect\s*4|connect\s+four|tic\s*tac\s*toe|noughts|mancala|monopoly|battleship|poker|sorry|aggravation|ringer|marbles|cards?|solitaire|blackjack|pool|8\s*ball|eight\s*ball|dice|a\s+round|again|music|a\s+song|songs?|sound|sounds|noise|white\s+noise|rain|fireworks|with\s+me|with\s+you|it|this|that|next|pause|stop|resume|nice|fair|dead|catch|tag|hide\s+and\s+seek|rock\s+paper\s+scissors|20\s+questions|twenty\s+questions|trivia|quiz|a\s+quiz|hangman|wordle|sudoku|snake|pong|break\s?out|brick\s+breaker|(?:void|verse)\s+breaker|minesweeper|null\s+sweep|merge\s+(?:void|verse)|dim\s+the\s+(?:void|verse)|lights?\s+out|2048(?=\s*(?:game)?$)|tetris|voidquest|(?:verse|void)\s*quest)\b/;

/** what an ask wants from the video skill, or null. Pure. Kinds: play (url|query), search, seek, speed, captions, queue, next,
 * prev, list, recent, close, clear-recent, platform. `hasCard` lets the watch tools ("skip to 2:30") take bare asks only while a
 * video is up. `late` is the last-chance pass: a bare "play <anything>" no other skill took. */
export function videoAskOf(text, { hasCard = false, late = false } = {}) {
  const raw = String(text || '').trim(), url = raw.match(/https?:\/\/\S+/);
  if (url) { const v = parseVideoUrl(url[0].replace(/[),.;!?]+$/, '')); if (v) { const queue = /^(?:queue|add|put)\b/i.test(raw) || /\b(?:to|in|on)\s+(?:the\s+|my\s+)?(?:queue|playlist)\b/i.test(raw); return { kind: queue ? 'queue' : 'play', video: v }; } return null; }
  let t = raw.toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').replace(/^(?:hey\s+)?(?:v01d|(?:verse|void)|verse)[,:]?\s+/, '').replace(/^(?:please|can\s+you|could\s+you|would\s+you)\s+/, '').replace(/\s+please$/, '').trim();
  if (!t) return null;
  if (/\b(?:your|(?:verse|v01d)'?s|(?:verse|void)'?s)\s+(?:own\s+)?(?:videos?|films?|movies?|clips?)\b/.test(t)) return null; // Verse's own films are the films skill's
  const vid = /\b(?:videos?|vids?|clips?|youtube|rumble|vimeo|dailymotion|peertube|odysee|twitch|trailer|music\s+video|documentary|livestream|vod)\b/;
  // the watch tools
  if (/^(?:close|stop|remove|hide|put\s+away|get\s+rid\s+of)\s+(?:the\s+|my\s+)?(?:video|player|youtube|video\s+player|video\s+card)$/.test(t) || (hasCard && /^stop\s+(?:watching|playing)$/.test(t))) return { kind: 'close' };
  if (/^(?:clear|forget|wipe|delete)\s+(?:my\s+)?(?:recently\s+watched|watch\s+history|video\s+history)$/.test(t)) return { kind: 'clear-recent' };
  if (/^(?:(?:show\s+)?(?:my\s+)?(?:recently\s+watched|watch\s+history|video\s+history)|what\s+did\s+i\s+(?:watch|just\s+watch)(?:\s+recently)?|recent\s+videos)$/.test(t)) return { kind: 'recent' };
  if (/^(?:(?:show\s+)?(?:my\s+|the\s+)?(?:video\s+)?(?:queue|playlist|watch\s+list|watchlist)|what(?:'s|\s+is)\s+(?:in\s+)?(?:my\s+|the\s+)?(?:queue|playlist|up\s+next))$/.test(t) && (hasCard || /video|watch/.test(t) || /^(?:show\s+)?my\s+(?:queue|playlist)$/.test(t))) return { kind: 'list' };
  if (/^(?:clear|empty)\s+(?:my\s+|the\s+)?(?:video\s+)?(?:queue|playlist)$/.test(t)) return { kind: 'clear-queue' };
  let m = t.match(/^(?:skip|jump|go|seek|fast\s+forward|rewind|scrub)\s+(?:ahead\s+|forward\s+|back\s+)?(?:to\s+)?(?:the\s+)?(\d[\d:hms ]*?)(?:\s+(?:mark|in))?$/) || t.match(/^(?:start|play)\s+(?:it\s+)?(?:from|at)\s+(\d[\d:hms ]*)$/);
  if (m && (hasCard || /\b(?:video|in)\b/.test(t) || /^(?:skip|jump)/.test(t))) { const s = secondsOf(m[1].replace(/\s+/g, '')); if (s != null) return { kind: 'seek', at: s }; }
  m = t.match(/^(?:skip|jump|go)\s+(forward|ahead|back|backward|backwards)\s+(\d+)\s*(s|sec|secs|seconds?|m|mins?|minutes?)?$/) || t.match(/^(?:rewind)\s+(\d+)\s*(s|sec|secs|seconds?|m|mins?|minutes?)?$/);
  if (m && hasCard) { const back = /^rewind/.test(t) || /back/.test(m[1]); const n = +(back && !/^rewind/.test(t) ? m[2] : /^rewind/.test(t) ? m[1] : m[2]); const unit = (/^rewind/.test(t) ? m[2] : m[3]) || 's'; return { kind: 'seek', by: (back ? -1 : 1) * n * (/^m/.test(unit) ? 60 : 1) }; }
  m = t.match(/^(?:(?:set\s+)?(?:the\s+)?(?:playback\s+)?speed\s+(?:to\s+)?|play\s+(?:it\s+)?(?:at\s+)?|watch\s+(?:it\s+)?at\s+)?(\d(?:\.\d+)?|0?\.\d+|half|normal|double)\s*(?:x|×|times)?(?:\s+speed)?$/);
  if (m && (hasCard || /speed|x$/.test(t)) && /speed|x|×|times|half|normal|double/.test(t)) { const r = m[1] === 'half' ? 0.5 : m[1] === 'normal' ? 1 : m[1] === 'double' ? 2 : +m[1]; if (r >= 0.25 && r <= 2) return { kind: 'speed', rate: r }; }
  if (hasCard && /^(?:speed\s+(?:it\s+)?up|faster)$/.test(t)) return { kind: 'speed', step: 0.25 };
  if (hasCard && /^(?:slow\s+(?:it\s+)?down|slower)$/.test(t)) return { kind: 'speed', step: -0.25 };
  m = t.match(/^(?:turn\s+)?(?:the\s+)?(?:captions|subtitles|subs|cc|closed\s+captions)\s+(on|off)$|^(?:turn\s+)?(on|off)\s+(?:the\s+)?(?:captions|subtitles|subs|cc)$|^(?:show|add|hide|remove)\s+(?:the\s+)?(?:captions|subtitles|subs|cc)$/);
  if (m && (hasCard || /caption|subtitle/.test(t))) return { kind: 'captions', on: (m[1] || m[2]) ? (m[1] || m[2]) === 'on' : /^(?:show|add)/.test(t) };
  if (hasCard && /^(?:next|next\s+(?:video|one|up)|skip(?:\s+(?:this|it|video))?|play\s+(?:the\s+)?next(?:\s+(?:video|one))?)$/.test(t)) return { kind: 'next' };
  if (hasCard && /^(?:previous|prev|back|previous\s+(?:video|one)|play\s+(?:the\s+)?previous(?:\s+(?:video|one))?)$/.test(t)) return { kind: 'prev' };
  // a platform switch on the card
  m = t.match(/^(?:switch|change)\s+(?:to|over\s+to)\s+(\w[\w .]*)$|^search\s+(?:on\s+)?(\w[\w .]*)\s+instead$/);
  if (m && hasCard) { const p = platformIn(m[1] || m[2]); if (p) return { kind: 'platform', platform: p }; }
  // queue: "queue lofi beats", "add the moon landing video to my queue"
  m = t.match(/^(?:queue(?:\s+up)?|add)\s+(.+?)(?:\s+to\s+(?:the\s+|my\s+)?(?:video\s+)?(?:queue|playlist|watch\s*list))$/) || t.match(/^queue(?:\s+up)?\s+(.+)$/);
  if (m) { const platform = platformIn(m[1]), q = cleanQuery(m[1]); if (q) return { kind: 'queue', query: q, platform }; }
  // search and play
  const platform = platformIn(t);
  m = t.match(/^(?:find|search(?:\s+for)?|look\s+up|look\s+for|get|pull\s+up|bring\s+up|show)\s+(?:me\s+)?(?:some\s+|a\s+few\s+)?(?:videos?|vids|clips?)\s+(?:about|of|on|for|with|from)\s+(.+)$/)
    || t.match(/^(?:find|search(?:\s+for)?|look\s+up|look\s+for)\s+(?:me\s+)?(?:an?\s+|some\s+)?(?:youtube|yt|rumble|vimeo|daily\s?motion|peer\s?tube|odysee|twitch|archive)\s+(?:videos?|vids|clips?)\s+(?:about|of|on|for|with)\s+(.+)$/)
    || t.match(/^(?:search|find)\s+(?:on\s+)?(?:youtube|yt|rumble|vimeo|daily\s?motion|peer\s?tube|odysee|twitch|the\s+internet\s+archive|archive\.org)\s+for\s+(.+)$/)
    || t.match(/^(?:youtube|yt|rumble|vimeo|dailymotion|peertube|odysee|twitch)\s+(?:search\s+)?(.+)$/)
    || t.match(/^(?:find|search(?:\s+for)?|look\s+up)\s+(.+?)\s+(?:videos?|clips?)(?:\s+on\s+\w+)?$/)
    || t.match(/^(.+?)\s+videos(?:\s+on\s+\w+)?$/);
  if (m) { const q = cleanQuery(m[1]); if (q && (vid.test(t) || platform)) return { kind: 'search', query: q, platform }; }
  m = t.match(/^(?:play|watch|show\s+me|show|pull\s+up|bring\s+up|put\s+on|open|find\s+me|find|get\s+me|i\s+want\s+to\s+(?:watch|see))\s+(?:me\s+)?(?:the\s+|a\s+|an\s+)?(?:(?:youtube|rumble|vimeo|music)\s+)?(?:videos?|vid|clip|trailer|livestream|vod)\s+(?:of|for|about|from|on|called|named)\s+(.+)$/)
    || t.match(/^(?:play|watch|show\s+me|pull\s+up|bring\s+up|put\s+on)\s+(.+?)\s+(?:on|from)\s+(?:youtube|yt|rumble|vimeo|daily\s?motion|peer\s?tube|odysee|twitch|the\s+internet\s+archive|archive\.org)$/)
    || t.match(/^(?:play|watch|show\s+me|pull\s+up|put\s+on)\s+(?:the\s+)?(.+?)\s+(trailer|music\s+video|video|clip|documentary)$/);
  if (m) { const q = cleanQuery(m[1] + (m[2] && /trailer|music video|documentary/.test(m[2]) ? ' ' + m[2] : '')); if (q) return { kind: 'play', query: q, platform }; }
  if (late) { m = t.match(/^(?:play|watch|put\s+on)\s+(.{2,120})$/); if (m && !NOT_VIDEO.test(m[1]) && !/\b(?:against|vs\.?|versus|with\s+(?:me|you|(?:verse|void))|a\s+game)\b/.test(m[1])) { const q = cleanQuery(m[1]); if (q) return { kind: 'play', query: q, platform }; } }
  return null;
}
function cleanQuery(q) { return String(q || '').replace(PLAT_STRIP, ' ').replace(/^(?:the\s+)?(?:videos?|vids?|clips?)\s+(?:of|about|for)\s+/, '').replace(/\s+/g, ' ').trim().slice(0, 120) || null; }

/** one search hit from each platform's public API, in Verse's own shape: { platform, id, title, channel, seconds, thumb, ... }. Pure. */
export function hitsOf(platform, j) {
  const s = (x) => String(x == null ? '' : x).slice(0, 200), n = (x) => (Number.isFinite(+x) && +x > 0 ? Math.round(+x) : null);
  try {
    if (platform === 'dailymotion') return (j.list || []).filter((v) => /^x[a-z0-9]+$/i.test(v.id)).map((v) => ({ platform, id: v.id, title: s(v.title), channel: s(v['owner.screenname']), seconds: n(v.duration), thumb: s(v.thumbnail_360_url) }));
    if (platform === 'archive') return ((j.response && j.response.docs) || []).filter((d) => /^[A-Za-z0-9._-]+$/.test(d.identifier)).map((d) => ({ platform, id: d.identifier, title: s(Array.isArray(d.title) ? d.title[0] : d.title), channel: s(Array.isArray(d.creator) ? d.creator[0] : d.creator), seconds: n(secondsOf(String(d.runtime || '').replace(/\s+/g, ''))), thumb: 'https://archive.org/services/img/' + d.identifier }));
    if (platform === 'peertube') return (j.data || []).map((v) => { let host = ''; try { host = new URL(v.embedUrl || v.url).host; } catch (_) {} const id = String(v.shortUUID || v.uuid || ''); return host && /^[A-Za-z0-9-]{8,40}$/.test(id) ? { platform, host, id, title: s(v.name), channel: s(v.channel && (v.channel.displayName || v.channel.name)), seconds: n(v.duration), thumb: s(v.thumbnailUrl) } : null; }).filter(Boolean);
    if (platform === 'odysee') return (Array.isArray(j) ? j : []).filter((v) => v.name && /^[0-9a-f]{40}$/.test(v.claimId)).map((v) => ({ platform, id: v.name + ':' + v.claimId, title: s(v.title || v.name), channel: s(v.channel), seconds: n(v.duration), thumb: s(v.thumbnail_url) }));
    if (platform === 'youtube') return (j.items || []).filter((v) => YT_ID.test(v.id)).map((v) => ({ platform, id: v.id, title: s(v.snippet && v.snippet.title), channel: s(v.snippet && v.snippet.channelTitle), seconds: n(isoSeconds(v.contentDetails && v.contentDetails.duration)), thumb: s(v.snippet && v.snippet.thumbnails && ((v.snippet.thumbnails.medium || v.snippet.thumbnails.default || {}).url)) }));
  } catch (_) {}
  return [];
}
export function isoSeconds(d) { const m = String(d || '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/); return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : null; }
