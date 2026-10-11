/**
 * link skill — one link card on the stage: a pasted url ("https://example.org/guides/getting-started"), "add a link
 * https://...", "link card https://...", "remove the link"; "make the link blue" edges it through the page's shared colours.
 * The card is titled by the url's host and last path part and opens in a new tab. An image url stays an image (the page's
 * image code). Moved out of void.html in cleanup step 6. The page asks `ask` (create, remove, a bare url) at the place its
 * link code always ran (`askAt`); there is no `ensure`, since a link card means nothing without its url.
 */

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (_) { return url; }
}

/** "example.org/getting-started": the host and the last path part. Pure. */
export function titleOf(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const path = (u.pathname || '/').replace(/\/$/, '');
    if (path && path !== '/') {
      const parts = path.split('/').filter(Boolean);
      const snip = parts[parts.length - 1] || path;
      return host + '/' + decodeURIComponent(snip).slice(0, 48);
    }
    return host;
  } catch (_) { return url; }
}

export const isImageUrl = (url) => /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(url);

/** the first http(s) url in the text, without trailing punctuation (null when none). Pure. */
export function urlOf(text) {
  const m = String(text || '').match(/https?:\/\/[^\s]+/i);
  return m ? m[0].replace(/[),.!]+$/, '') : null;
}

const bareUrl = (raw) => /^https?:\/\/[^\s]+$/i.test(raw.trim()) && !isImageUrl(raw.trim());

/** the ask puts up a link card. Pure. */
export function wantsCreate(lower, raw = lower) {
  if (/\b(remove|delete|get rid|hide|clear)\b/.test(lower) && /\b(link|card|url)\b/.test(lower)) return false;
  const url = urlOf(raw);
  if (!url || isImageUrl(url)) return false;
  if (/\blink\s*card\b/.test(lower)) return true;
  if (/\b(show\s+this\s+link|put\s+a\s+link|show\s+link|add\s+a\s+link|drop\s+a\s+link)\b/.test(lower)) return true;
  if (/\b(make|add|create|show|spawn|put|place|drop)\b.*\blink\b/.test(lower)) return true;
  return bareUrl(raw);
}

export function wantsRemove(lower) {
  if (/\b(remove|delete|get\s+rid\s+of|hide|clear)\b.*\b(link|card)\b/.test(lower)) return true;
  if (/\b(link|card)\b.*\b(away|gone)\b/.test(lower)) return true;
  return /^(remove|delete|hide|clear)\s+(the\s+)?(link|card)(\s+please)?\s*[.!]?\s*$/.test(lower);
}

/** the plain asks the skill takes before the page's own parser: only "link card <url>" and "add a link <url>". A bare url is
 *  left to the page, so a skill that reads urls (a document, a watch) keeps them as before. Pure. */
export const plainLink = (lower, raw = lower) => {
  const url = urlOf(raw);
  if (!url || isImageUrl(url) || /\b(remove|delete|get\s+rid|hide|clear)\b/.test(lower)) return false;
  return /^(?:please\s+)?(?:(?:make|add|create|put|drop|show)\s+(?:me\s+)?(?:a\s+)?link(?:\s*card)?|link\s*card)\s*:?\s*https?:\/\/\S+\s*$/.test(lower);
};

/** the one link card, pointed at url (made when there is none); it is picked */
export function put(stageApi, url) {
  const things = stageApi.things(), st = stageApi.stage;
  let card = Object.values(things).find((t) => t && t.kind === 'link');
  if (!card) {
    card = { id: 'link_' + Math.random().toString(36).slice(2, 9), kind: 'link',
      x: Math.max(40, (st.clientWidth || 800) / 2 - 140), y: Math.max(40, (st.clientHeight || 600) / 2 - 20) };
    things[card.id] = card;
  }
  card.url = url; card.host = hostOf(url); card.title = titleOf(url);
  stageApi.select(card.id);
  return card;
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing link-card';
  el.dataset.id = th.id;
  el.style.left = th.x + 'px';
  el.style.top = th.y + 'px';
  if (th.color) el.style.borderColor = th.color;
  if (stageApi.selected() === th.id) el.style.outline = '1px solid rgba(255,255,255,0.25)';
  const a = document.createElement('a');
  a.href = th.url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = th.title || th.host || th.url;
  a.addEventListener('pointerdown', (e) => e.stopPropagation());
  const host = document.createElement('div');
  host.className = 'host';
  host.textContent = th.host || '';
  el.appendChild(a);
  if (th.host && th.title !== th.host) el.appendChild(host);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** create, remove, or a bare url, at the place the link code ran (in that order): what it did ('no link' when there is none
 *  to remove), or '' */
export function ask(lower, text, stageApi) {
  if (wantsCreate(lower, text)) {
    put(stageApi, urlOf(text));
    stageApi.save(); stageApi.render();
    return 'link';
  }
  if (wantsRemove(lower)) {
    const things = stageApi.things(), card = Object.values(things).find((t) => t && t.kind === 'link');
    if (!card) return 'no link'; // the page says so rather than handing the ask on
    delete things[card.id];
    if (stageApi.selected() === card.id) stageApi.select(null);
    stageApi.save(); stageApi.render();
    return 'link-removed';
  }
  return '';
}

export default {
  name: 'link',
  examples: ['add a link https://github.com/atomeam', 'link card https://example.org'],
  nearMisses: ['https://example.org/cat.png', 'remove the link'],
  match(lower, text) { return plainLink(lower, text); },
  async run(text, api) { const d = ask(String(text || '').toLowerCase(), text, api.stage); return d && d !== 'no link' ? 'link' : 'none'; },
  // askAt: the page asks this kind's ask at its own place, not in the early loop the counter and shape use
  stageKinds: { link: { mount, ask, askAt: 'link' } },
};
