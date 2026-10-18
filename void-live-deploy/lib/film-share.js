// Every Verse film and ad clip is its own ad, and anyone may repost it (owner, 2026-10-15: "put an upload to youtube button in
// Verse Films so that anyone can easily uplad each vid"; "anyone can upload them ... the more the better"). No API, no token:
// download the MP4, copy the words, open the platform's own upload page signed in as yourself. Pure; used by /films/ and tests.
export const SITE = 'https://a-to-mind.com';
export const PLATFORMS = {
  youtube: { name: 'YouTube', upload: 'https://www.youtube.com/upload', tags: ['#Shorts', '#AI', '#Verse'], max: 5000, title: 100 },
  tiktok: { name: 'TikTok', upload: 'https://www.tiktok.com/upload', tags: ['#AI', '#tech', '#fyp', '#Verse'], max: 2200 },
  instagram: { name: 'Reels', upload: 'https://www.instagram.com/', tags: ['#AI', '#reels', '#tech', '#Verse'], max: 2200 },
  x: { name: 'X', upload: 'https://x.com/compose/post', tags: ['#AI', '#Verse'], max: 280 },
};
export const CTA = 'Try Verse free: it builds, plays and answers anything, right in your browser.';
export const SHARE = 'Share this ad: repost it anywhere, every upload helps Verse grow. Get the file free at a-to-mind.com/films/';
const CLIP_RE = /^[0-9]{8}-[a-z0-9-]{2,60}$/;
/** the tracked link for one uploader on one platform: /c/<id> counts it (functions/c/[clip].js), else the films page */
export function shareLink(id, platform) {
  const q = 'p=' + (PLATFORMS[platform] ? platform : 'other') + '&by=share';
  return CLIP_RE.test(String(id || '')) ? `${SITE}/c/${id}?${q}` : `${SITE}/?${q}&src=film`;
}
const tagList = (t) => (Array.isArray(t) ? t : String(t || '').split(/[,\s]+/)).map((x) => String(x).trim()).filter(Boolean).map((x) => (x[0] === '#' ? x : '#' + x.replace(/[^\w]/g, '')));
/** the words one uploader pastes: title, description with the tracked a-to-mind.com link, the call to action and the share line */
export function shareWords(film, platform = 'youtube') {
  const P = PLATFORMS[platform] || PLATFORMS.youtube, link = shareLink(film.id, platform);
  const seen = new Set(), tags = [...P.tags, ...tagList(film.tags)].filter((t) => !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, platform === 'x' ? 3 : 12);
  const base = String(film.title || 'Verse').replace(/\s*#Shorts\b/gi, '').trim();
  const title = (base + (/v01d|void|verse/i.test(base) ? '' : ' | Verse') + (platform === 'youtube' ? ' #Shorts' : '')).slice(0, P.title || 150);
  const body = String(film.description || '').replace(/https?:\/\/(?:www\.)?a-to-mind\.com\S*/gi, link).trim();
  let description;
  if (platform === 'x') description = [base, link, tags.join(' ')].join('\n');
  else description = [`${CTA} ${link}`, '', body, '', SHARE, '', tags.join(' ')].join('\n').replace(/\n{3,}/g, '\n\n').slice(0, P.max);
  return { title, description, tags: tags.join(' '), link, upload: P.upload, all: (platform === 'x' ? description : title + '\n\n' + description) };
}

/** the name a downloaded film is saved under: its own title, so YouTube's default title is the experiment's question and not
 *  the raw id (owner, 2026-10-15: titles came out as "20261015 attention 7 r19"). "?" becomes the full-width "？" (YouTube shows a
 *  question mark), "|" becomes "-", the other characters a file name cannot hold on common systems are dropped, at most 100
 *  characters before ".mp4". No title (or nothing left of it): the id. Pure. */
export function fileName(film) {
  const f = film || {};
  const t = String(f.title || '').replace(/\s+/g, ' ').replace(/\?/g, '\uFF1F').replace(/\|/g, '-').replace(/[<>:"/\\*\u0000-\u001f\u007f]/g, '')
    .replace(/ {2,}/g, ' ').trim();
  const cut = Array.from(t).slice(0, 100).join('').trim().replace(/[. ]+$/, ''); // whole characters; no trailing dot or space (Windows drops them)
  return (cut || String(f.id || 'Verse film')) + '.mp4';
}
