// Reverse engineering of every tower site, for feature parity (owner, 2026-10-26: "make sure you reverse-engineer each site so we dont miss any
// hidden features"). Marketing pages and searches name the features a site sells; its own client code also holds the ones it does not: keyboard
// shortcuts, URL parameters, settings, export and import formats, API paths, offline and share support, embeds, hidden routes, flags, languages.
// This opens a site like dev tools do and writes down what a browser receives, nothing else: one polite visit per site (two page loads, phone and
// desktop width, no clicks, no sign-in, no form, no consent or paywall or anti-bot step worked around: a wall is recorded as `blocked`), robots.txt
// respected for anything beyond the page's own assets (robots.txt and sitemap.xml themselves), only short facts kept: names, counts, paths, an
// evidence coordinate (file@char offset or a selector) and a tag (read = in the code, observed = seen in the loaded page, inferred = guessed from
// a signal). Never their code, text beyond feature names, query values, or tokens. Method: the reverse-engineering skill (triage the artifact, JS and
// web-API playbooks, endpoints and hosts, cite coordinates, tag every claim), redone in Node.
// Output: domains/features/re/<id>.json per floor or lane site (small, facts only), folded by --merge into the floor's features file as
// "unbuilt (found by reverse engineering)" rows under "re" (people's sections and the feature scan's "auto" are never touched; tools/feature-scan.mjs
// nextJobs queues them like any gap). Playbook: docs/playbooks/site-re.md. Workflow: .github/workflows/site-re.yml.
//   node tools/site-re.mjs "<floor id>[,<floor id>]"   scan these tower entries (a floor or a lane site, as the gate names them), write, merge
//   node tools/site-re.mjs --which [N]                 the N (6) entries never scanned or scanned 30+ days ago, smallest site first
//   node tools/site-re.mjs --list                      every entry with its address and when it was last scanned
//   node tools/site-re.mjs --merge                     fold every re/ file into the features files (offline, idempotent)
// Needs CHROME_PATH for the browser (a GitHub runner; the session container cannot reach the sites).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { FLOORS, hostOf } from '../void-live-deploy/lib/tower.js';
import { bySize, regDomain } from '../void-live-deploy/lib/tower-rank.js';
import { probeFor, featureSlug } from './tower-probes.mjs';
import { siteOf, UA } from './tower-gate.mjs';
import { robotsAllows } from './feature-scan.mjs';
import { secretsIn } from './secret-scan.mjs';
import { redactPersonal } from '../void-live-deploy/lib/privacy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FEATURES = path.join(root, 'domains', 'features'), RE_DIR = path.join(FEATURES, 're');
export const STALE_DAYS = 30, UA_DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
export const ROW_NOTE = 'unbuilt (found by reverse engineering)';
const today = () => new Date().toISOString().slice(0, 10);

// ---- small pure helpers ----
/** personal data taken out of a string (owner's rule: no contact detail is ever stored): mailto:, tel: and sms: links, emails, phone numbers, IPs, card-like
 *  numbers, street addresses, contact lines ("Email: ...", "Call us ..."), and any query value shaped like an address. What is left is the feature's words. */
export function scrubPersonal(s) {
  let t = String(s == null ? '' : s).replace(/\b(?:mailto|tel|sms|callto|whatsapp):[^\s"'<>]*/gi, '').replace(/\b\d{1,5}\s+(?:[A-Z][\w.'-]*\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct|Place|Pl|Strasse|Straße|Str)\b\.?/g, '')
    .replace(/\b(?:p\.?o\.? box|postfach)\s*\d+/gi, '');
  const before = t; t = t.replace(/\+?\(?\d[\d\s().-]{6,}\d/g, (m) => (m.replace(/\D/g, '').length >= 7 ? '' : m)); // a phone number in any grouping
  const wasPhone = t !== before;
  t = redactPersonal(t).replace(/\[(?:email|phone|ip|number|redacted)\]/g, '');
  if (wasPhone && /^\s*(?:call|phone|tel|telephone|text|whatsapp|contact|reach|dial)\b[\w\s]{0,12}$/i.test(t)) return '';
  if (/^\s*(?:e-?mail|mail|phone|tel|telephone|call(?: us)?|contact(?: us)?|fax|address|attn|whatsapp)\s*[:\-]/i.test(t)) return '';
  return t.replace(/\s+/g, ' ').trim();
}
/** a short, safe string: personal data removed, whitespace folded, long token-like runs replaced, cut to n characters */
export const clip = (s, n = 60) => scrubPersonal(s).replace(/[A-Za-z0-9_+/=-]{32,}/g, '[token]').slice(0, n);
/** the file name of an asset url: host kept only when it is not the page's own, no query, cut */
export function fileOf(u, own) {
  try { const x = new URL(u), name = decodeURIComponent(x.pathname.split('/').filter(Boolean).pop() || x.pathname || '/'); return clip((own && x.hostname === own ? '' : x.hostname + '/') + name, 70); } catch (_) { return clip(u, 70); }
}
/** a request url as facts: origin + path + the names of its query parameters, never their values */
export function bareUrl(u) {
  try { const x = new URL(u); if (/\/cdn-cgi\/|@/.test(x.pathname + x.search) || /\d{8,}/.test(x.pathname)) return ''; const keys = [...new Set([...x.searchParams.keys()])].filter((k) => !/@/.test(k)).sort().slice(0, 8); return clip(x.origin + x.pathname + (keys.length ? '?' + keys.join('&') : ''), 120); } catch (_) { return ''; }
}
function hits(re, text, limit = 40) { const out = []; re.lastIndex = 0; let m; while ((m = re.exec(text)) && out.length < limit) { out.push({ m, at: m.index }); if (m[0] === '') re.lastIndex++; } return out; }
const uniq = (a) => [...new Set(a)];
/** the first sighting of each value: [{ v, at }] */
const first = (list, f) => { const seen = new Map(); for (const h of list) { const k = f(h); if (k && !seen.has(k)) seen.set(k, h.at); } return [...seen].map(([v, at]) => ({ v, at })); };

// ---- code: what a script or style file says ----
const NOISE_HOSTS = /(?:^|\.)(?:w3\.org|schemas\.[a-z.]+|reactjs\.org|react\.dev|fb\.me|github\.com|githubusercontent\.com|mozilla\.org|mozilla\.com|developer\.mozilla\.org|wikipedia\.org|npmjs\.com|npmjs\.org|jquery\.com|example\.com|example\.org|localhost|googleapis\.com\/schemas|goo\.gl|stackoverflow\.com|apache\.org|creativecommons\.org|tc39\.es|mathiasbynens\.be|json-schema\.org|ietf\.org|whatwg\.org|chromium\.org|webkit\.org|bugs\.[a-z.]+|crbug\.com|sentry\.io\/docs)$/i;
const SERVICES = [[/google-analytics|googletagmanager|gtag\/js|analytics\.google/i, 'Google Analytics'], [/sentry\.io|ingest\.sentry/i, 'Sentry'], [/stripe\.com|js\.stripe/i, 'Stripe'], [/paypal\.com/i, 'PayPal'], [/firebase|firebaseio|googleapis\.com\/identitytoolkit/i, 'Firebase'], [/supabase\.(?:co|io)/i, 'Supabase'],
  [/openai\.com|anthropic\.com|generativelanguage|huggingface\.co/i, 'AI model API'], [/youtube(?:-nocookie)?\.com|youtu\.be/i, 'YouTube'], [/maps\.googleapis|maps\.google|mapbox\.com|openstreetmap\.org|tile\.openstreetmap|leaflet/i, 'Maps'], [/cloudflare(?:insights|stream)?\.com|challenges\.cloudflare/i, 'Cloudflare'],
  [/hotjar|clarity\.ms|mixpanel|segment\.(?:com|io)|amplitude|plausible\.io|posthog|fullstory|umami/i, 'Product analytics'], [/doubleclick|googlesyndication|adsbygoogle|adnxs|taboola|outbrain|media\.net|carbonads|ethicalads|buysellads/i, 'Ads'], [/recaptcha|hcaptcha|turnstile/i, 'Captcha'],
  [/intercom|crisp\.chat|zendesk|drift\.com|tawk\.to|helpscout/i, 'Chat widget'], [/disqus\.com|giscus/i, 'Comments'], [/fonts\.googleapis|fonts\.gstatic|use\.typekit|fontawesome/i, 'Web fonts'], [/auth0\.com|clerk\.|okta\.com|accounts\.google\.com\/gsi/i, 'Sign-in provider'],
  [/algolia|typesense|meilisearch/i, 'Hosted search'], [/pusher|ably\.io|socket\.io|livekit|twilio/i, 'Live updates'], [/transloadit|cloudinary|imgix|uploadcare|filestack/i, 'Image or file service'], [/wasm|emscripten/i, 'WebAssembly']];
/** third-party service names for a text (urls or hosts). Pure. */
export const servicesOf = (text) => SERVICES.filter(([re]) => re.test(text)).map(([, n]) => n);
const WEB_APIS = [[/navigator\.share\b/, 'Share through the system share sheet', 'share'], [/\.canShare\(/, 'Share files through the system share sheet', 'share'], [/showSaveFilePicker|showOpenFilePicker|showDirectoryPicker/, 'Save and open files in place (File System Access)', 'import'], [/navigator\.clipboard/, 'Copy and paste through the clipboard', 'setting'], [/ClipboardItem/, 'Copy images to the clipboard', 'export'],
  [/getUserMedia/, 'Use the camera or microphone', 'input'], [/\bEyeDropper\b/, 'Eyedropper to pick a colour from the screen', 'input'], [/BarcodeDetector/, 'Scan barcodes and QR codes', 'input'], [/launchQueue|file_handlers/, 'Opens files handed to the installed app', 'pwa'], [/setAppBadge/, 'App icon badge', 'pwa'],
  [/Notification\.requestPermission|pushManager\.subscribe/, 'Notifications', 'service'], [/navigator\.vibrate/, 'Haptic feedback', 'setting'], [/speechSynthesis/, 'Reads text aloud', 'a11y'], [/SpeechRecognition/, 'Voice input', 'input'], [/WebAssembly\.(?:instantiate|compile)/, 'WebAssembly engine (heavy work runs in the browser)', 'service'],
  [/OffscreenCanvas/, 'Off-thread image drawing', 'service'], [/new (?:Shared)?Worker\(/, 'Background worker threads', 'service'], [/wakeLock/, 'Keeps the screen awake', 'setting'], [/deviceorientation|DeviceMotionEvent/, 'Tilt and motion input', 'input'], [/navigator\.geolocation/, 'Uses the location', 'input'],
  [/addEventListener\(["'`]drop["'`]|ondrop\b/, 'Drag and drop files or items', 'import'], [/addEventListener\(["'`]paste["'`]|onpaste\b/, 'Paste images or text straight in', 'import'], [/window\.print\(/, 'Print button', 'export'], [/matchMedia\(["'`]\(prefers-color-scheme/, 'Follows the system dark mode', 'a11y'],
  [/prefers-reduced-motion/, 'Respects the reduced-motion setting', 'a11y'], [/prefers-contrast|forced-colors/, 'Respects high-contrast settings', 'a11y'], [/MediaRecorder/, 'Records audio or video', 'export'], [/CompressionStream|DecompressionStream/, 'Compresses data in the browser', 'service'], [/createImageBitmap/, 'Fast image decoding', 'service'],
  [/BroadcastChannel/, 'Syncs between tabs', 'service'], [/storage\.persist\(/, 'Asks to keep saved data permanently', 'storage'], [/requestFullscreen/, 'Full screen mode', 'setting'], [/PictureInPicture/, 'Picture in picture', 'setting'], [/getContext\(["'`]webgl/, 'WebGL graphics', 'service'], [/isSecureContext.*credentials|PublicKeyCredential|navigator\.credentials/, 'Passkeys and credentials', 'service']];
const KEYMAP = { 8: 'Backspace', 9: 'Tab', 13: 'Enter', 27: 'Escape', 32: 'Space', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 46: 'Delete' };
/** what one script or style file says, with the char offset of each first sighting. `name` is the file; `own` says whether it is the page's own. Pure. */
export function codeFacts(text, name = '') {
  text = String(text || ''); const f = { file: name };
  const vars = uniq(hits(/\b([A-Za-z_$][\w$]{0,20})\s*=\s*new URLSearchParams\(/g, text, 20).map((h) => h.m[1]).concat(['searchParams', 'params', 'urlParams', 'query', 'qs'])).map((x) => x.replace(/\$/g, '\\$'));
  f.params = first(hits(new RegExp('(?:\\b(?:' + vars.join('|') + ')|new URLSearchParams\\([^)]{0,60}\\))\\s*\\.\\s*(?:get|has|getAll)\\(\\s*["\'`]([A-Za-z_][\\w-]{0,28})["\'`]\\s*\\)', 'g'), text), (h) => h.m[1]);
  f.usesLocationSearch = /location\.(?:search|hash)\b/.test(text);
  const chords = hits(/["'`]((?:(?:ctrl|control|cmd|command|meta|shift|alt|option|mod)\s*\+\s*)+[a-z0-9/?.,[\]\\-]{1,12}|(?:Mod|Ctrl|Cmd|Alt|Shift)(?:-(?:Mod|Ctrl|Cmd|Alt|Shift))*-[A-Za-z0-9])["'`]/gi, text, 80);
  f.chords = first(chords, (h) => clip(h.m[1], 24).toLowerCase().replace(/\s+/g, ''));
  const keys = hits(/\b(?:key|code)\s*[!=]==?\s*["'`]([A-Za-z][A-Za-z0-9 ]{0,14}|[^\w\s])["'`]/g, text, 120).filter((h) => !/^(?:string|number|object|function|boolean|undefined|symbol|div|span|input|script|button|a|p|li|ul|td|tr)$/.test(h.m[1]));
  const kc = hits(/keyCode\s*[!=]==?\s*(\d{1,2})\b/g, text, 40).filter((h) => KEYMAP[h.m[1]]);
  f.keys = first([...keys.map((h) => ({ m: [0, h.m[1]], at: h.at })), ...kc.map((h) => ({ m: [0, KEYMAP[h.m[1]]], at: h.at }))], (h) => clip(h.m[1], 16));
  f.keyHandlers = hits(/addEventListener\(\s*["'`]key(?:down|up|press)["'`]|\bon[Kk]ey(?:[Dd]own|[Uu]p)\b|onkeydown\s*=/g, text, 3).map((h) => h.at);
  f.hotkeyLib = (/\b(hotkeys-js|Mousetrap|tinykeys|react-hotkeys|useHotkeys|keymaster)\b/.exec(text) || [])[1] || null;
  const urls = hits(/\b(?:https?|wss?):\/\/[^\s"'`<>\\\])},;]{4,}/g, text, 400), hosts = new Map();
  for (const h of urls) { let u; try { u = new URL(h.m[0].replace(/[.)]+$/, '')); } catch (_) { continue; } if (NOISE_HOSTS.test(u.hostname) || /^[0-9.]+$/.test(u.hostname) || /[{}$]/.test(u.hostname) || !u.hostname.includes('.')) continue; if (!hosts.has(u.hostname)) hosts.set(u.hostname, { at: h.at, ws: /^wss?:/.test(u.protocol) }); }
  f.hosts = [...hosts].map(([host, v]) => ({ host: clip(host, 60), at: v.at, ...(v.ws ? { ws: true } : {}) }));
  f.apiPaths = first(hits(/["'`](\/(?:api|v\d{1,2}|rest|graphql|gql|trpc|rpc|ws|socket\.io|oauth2?|auth|export|import|download|upload|share|embed|feed|rss|webhook|callback|public|data)(?:\/[A-Za-z0-9_\-{}.:$]+)*)\/?["'`?]/g, text, 80), (h) => clip(h.m[1], 60));
  f.graphql = /gql`|graphql\s*\(|__typename|query\s+[A-Z]\w+\s*[({]/.test(text); f.websocket = /new WebSocket\(/.test(text);
  f.flags = first(hits(/["']?\b((?:enable|disable|show|allow|use)[A-Z][A-Za-z]{3,30}|[a-z]{2,15}(?:Flag|Enabled|Experiment|Beta)[A-Za-z]{0,12}|(?:feature|flag|experiment|beta)_[a-z_]{3,24}|FEATURE_[A-Z_]{3,24})["']?\s*:\s*(?:!?[01]|true|false|!0|!1)\b/g, text, 60), (h) => clip(h.m[1], 40));
  f.storage = first(hits(/(?:local|session)Storage\s*\.\s*(?:getItem|setItem|removeItem)\(\s*["'`]([^"'`]{1,40})["'`]/g, text, 80), (h) => clip(h.m[1], 40));
  f.idb = first(hits(/indexedDB\.open\(\s*["'`]([^"'`]{1,40})["'`]/g, text, 10), (h) => clip(h.m[1], 40));
  f.caches = first(hits(/caches\.open\(\s*["'`]([^"'`]{1,40})["'`]/g, text, 10), (h) => clip(h.m[1], 40));
  f.downloads = first(hits(/\bdownload\s*=\s*["'`]([^"'`${}]{1,40})["'`]|saveAs\([^,)]{1,60},\s*["'`]([^"'`${}]{1,40})["'`]/g, text, 30), (h) => clip(h.m[1] || h.m[2], 40));
  f.blobTypes = first(hits(/(?:toBlob|toDataURL|convertToBlob)\([^)]{0,40}?["'`](image\/[a-z0-9.+-]{2,12})["'`]/g, text, 30), (h) => h.m[1]);
  f.mimes = first(hits(/["'`]((?:image|application|text|audio|video)\/[a-z0-9.+-]{2,30})["'`]/g, text, 200), (h) => h.m[1]).filter((x) => !/^(?:application\/(?:json|javascript|x-www-form-urlencoded|octet-stream|xml|ld\+json)|text\/(?:html|plain|css|javascript|xml)|image\/svg\+xml)$/.test(x.v)).slice(0, 40);
  f.extLists = first(hits(/(?:["'`]\.[a-z0-9]{2,5}["'`]\s*,\s*){2,}["'`]\.[a-z0-9]{2,5}["'`]/g, text, 6), (h) => clip(h.m[0].replace(/["'`\s]/g, ''), 120));
  f.apis = WEB_APIS.map(([re, label, kind]) => { const m = re.exec(text); return m ? { label, kind, at: m.index } : null; }).filter(Boolean);
  f.sw = (() => { const m = /serviceWorker\.register\(\s*["'`]([^"'`]{1,80})["'`]/.exec(text); return m ? { url: clip(m[1], 80), at: m.index } : null; })();
  f.install = /beforeinstallprompt/.test(text); f.share = /share_target/.test(text);
  const langs = hits(/(?:["'`](?:[a-z]{2}|[a-z]{2}-[A-Za-z]{2,4})["'`]\s*,\s*){4,}["'`](?:[a-z]{2}|[a-z]{2}-[A-Za-z]{2,4})["'`]/g, text, 4);
  f.langs = uniq(langs.flatMap((h) => h.m[0].match(/[a-z]{2}(?:-[A-Za-z]{2,4})?(?=["'`])/g) || [])).slice(0, 80); f.langsAt = langs.length ? langs[0].at : null;
  f.localeFiles = uniq(hits(/\/(?:locales?|i18n|lang|translations?|messages)\/([a-z]{2}(?:[-_][A-Za-z]{2,4})?)(?:\/[\w.-]+)?\.json/g, text, 60).map((h) => h.m[1])).slice(0, 60);
  f.routes = first(hits(/\b(?:path|route|to|href)\s*:\s*["'`](\/[A-Za-z0-9_\-/:.*]{1,50})["'`]|pathname\s*[!=]==?\s*["'`](\/[A-Za-z0-9_\-/]{1,50})["'`]/g, text, 120), (h) => clip(h.m[1] || h.m[2], 50)).filter((r) => r.v !== '/');
  f.media = { print: /@media\s*print/.test(text), dark: /prefers-color-scheme\s*:\s*dark/.test(text), reduced: /prefers-reduced-motion/.test(text) };
  f.sourceMap = /\/[/*][#@]\s*sourceMappingURL=/.test(text.slice(-400));
  return f;
}

// ---- the page: what its HTML says ----
const strip = (s) => clip(String(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#?\w+;/g, ' '), 40);
const attr = (tag, name) => { const m = new RegExp('\\b' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(tag); return m ? (m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]) : null; };
/** what a page's HTML (the loaded DOM) says: head tags, scripts, styles, inputs, labels, accessibility hooks. Pure. */
export function htmlFacts(html, pageUrl = 'https://x.test/') {
  html = String(html || ''); const tags = (name) => (html.match(new RegExp('<' + name + '\\b[^>]*>', 'gi')) || []), f = {};
  let base; try { base = new URL(pageUrl); } catch (_) { base = new URL('https://x.test/'); }
  const abs = (u) => { try { return new URL(u, base).href; } catch (_) { return null; } };
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html); f.title = title ? strip(title[1]) : '';
  f.lang = clip(attr((/<html\b[^>]*>/i.exec(html) || [''])[0], 'lang') || '', 12);
  const links = tags('link'), metas = tags('meta');
  f.manifest = (() => { const l = links.find((t) => /rel\s*=\s*["']?manifest/i.test(t)); return l ? abs(attr(l, 'href')) : null; })();
  f.hreflang = uniq(links.filter((t) => /hreflang/i.test(t)).map((t) => clip(attr(t, 'hreflang'), 12))).slice(0, 80);
  f.feeds = links.filter((t) => /type\s*=\s*["']application\/(?:rss|atom)\+xml/i.test(t)).length;
  f.opensearch = links.some((t) => /opensearchdescription/i.test(t)); f.oembed = links.some((t) => /oembed/i.test(t));
  f.canonical = links.some((t) => /rel\s*=\s*["']canonical/i.test(t)); f.appleTouch = links.some((t) => /apple-touch-icon/i.test(t));
  const meta = (n) => { const t = metas.find((x) => new RegExp('(?:name|property)\\s*=\\s*["\']' + n + '["\']', 'i').test(x)); return t ? clip(attr(t, 'content') || '', 40) : null; };
  f.share = { og: metas.filter((t) => /property\s*=\s*["']og:/i.test(t)).length, twitter: !!meta('twitter:card'), themeColor: !!meta('theme-color'), appleCapable: !!(meta('apple-mobile-web-app-capable') || meta('mobile-web-app-capable')) };
  f.scripts = tags('script').map((t) => ({ src: attr(t, 'src') && abs(attr(t, 'src')), module: /type\s*=\s*["']?module/i.test(t) })).filter((s) => s.src);
  f.styles = links.filter((t) => /rel\s*=\s*["']?stylesheet/i.test(t)).map((t) => abs(attr(t, 'href'))).filter(Boolean);
  f.iframes = tags('iframe').map((t) => { const s = attr(t, 'src'); try { return new URL(s, base).hostname; } catch (_) { return ''; } }).filter(Boolean);
  f.inputs = tags('input').map((t) => ({ type: (attr(t, 'type') || 'text').toLowerCase(), accept: attr(t, 'accept'), multiple: /\bmultiple\b/i.test(t), capture: /\bcapture\b/i.test(t), dir: /webkitdirectory/i.test(t) }));
  f.accepts = uniq(f.inputs.filter((i) => i.accept).map((i) => clip(i.accept, 100))).slice(0, 8);
  f.inputTypes = Object.fromEntries(Object.entries(f.inputs.reduce((m, i) => (m[i.type] = (m[i.type] || 0) + 1, m), {})).filter(([t]) => !/^(?:hidden|submit|button)$/.test(t)).sort());
  f.selects = tags('select').length; f.textareas = tags('textarea').length; f.forms = tags('form').length; f.dialogs = tags('dialog').length; f.details = tags('details').length;
  f.accesskeys = uniq(html.match(/\baccesskey\s*=\s*["'][^"']{1,3}["']/gi) || []).map((s) => clip(attr(s, 'accesskey'), 3)).slice(0, 20);
  f.keyshortcuts = uniq((html.match(/aria-keyshortcuts\s*=\s*["'][^"']{1,30}["']/gi) || []).map((s) => clip(attr(s, 'aria-keyshortcuts'), 30))).slice(0, 20);
  f.ariaLabels = uniq((html.match(/\baria-label\s*=\s*"[^"]{1,60}"/gi) || []).map((s) => clip(attr(s, 'aria-label'), 40))).sort().slice(0, 60);
  f.roles = Object.fromEntries(['menu', 'menuitem', 'tab', 'dialog', 'switch', 'slider', 'combobox', 'listbox', 'tree', 'grid', 'status', 'alert', 'search', 'toolbar'].map((r) => [r, (html.match(new RegExp('role\\s*=\\s*["\']' + r + '["\']', 'gi')) || []).length]).filter(([, n]) => n));
  f.live = /aria-live\s*=/i.test(html); f.skipLink = /<a\b[^>]*href\s*=\s*["']#(?:main|content|maincontent|skip)[^"']*["']/i.test(html);
  f.draggable = /draggable\s*=\s*["']true["']/i.test(html); f.editable = /contenteditable\s*=\s*["'](?:true|plaintext-only|)["']/i.test(html);
  f.downloadAttrs = tags('a').filter((t) => /\bdownload\b/i.test(t)).length;
  f.noscript = /<noscript/i.test(html);
  return f;
}
/** the visible controls of the rendered page at two widths, merged: [{ l: label, w: 'm'|'d'|'md' }] sorted by label. rows are what the page reported. Pure. */
export function controlsOf(mobile = [], desktop = [], max = 80) {
  const m = new Map(), put = (rows, w) => { for (const r of rows || []) { const l = clip(r, 40); if (!l) continue; m.set(l, (m.get(l) || '') + (m.get(l) && m.get(l).includes(w) ? '' : w)); } };
  put(mobile, 'm'); put(desktop, 'd');
  return [...m].map(([l, w]) => ({ l, w: w.length > 1 ? 'md' : w })).sort((a, b) => (a.l < b.l ? -1 : a.l > b.l ? 1 : 0)).slice(0, max);
}
/** the web app manifest as facts. Pure. */
export function manifestFacts(m) {
  if (!m || typeof m !== 'object') return null;
  const n = (a) => (Array.isArray(a) ? a : []), st = m.share_target && typeof m.share_target === 'object' ? m.share_target : null;
  return { name: clip(m.name || m.short_name, 40), display: clip(m.display, 20), displayOverride: n(m.display_override).map((x) => clip(x, 20)).slice(0, 6), orientation: clip(m.orientation, 20), scope: clip(m.scope, 40), icons: n(m.icons).length, screenshots: n(m.screenshots).length, categories: n(m.categories).map((x) => clip(x, 20)).slice(0, 6),
    shortcuts: n(m.shortcuts).map((s) => clip(s && (s.name || s.short_name), 40)).filter(Boolean).slice(0, 10),
    shareTarget: st ? { method: clip(st.method || 'GET', 6), enctype: clip(st.enctype, 40), params: Object.keys(st.params || {}).sort().slice(0, 8), files: n(st.params && st.params.files).flatMap((x) => n(x && x.accept)).map((x) => clip(x, 20)).slice(0, 12) } : null,
    fileHandlers: n(m.file_handlers).flatMap((h) => Object.values(h && h.accept || {}).flat()).map((x) => clip(x, 12)).slice(0, 20), protocolHandlers: n(m.protocol_handlers).map((p) => clip(p && p.protocol, 20)).slice(0, 6),
    launchHandler: !!m.launch_handler, widgets: n(m.widgets).length, relatedApps: n(m.related_applications).length, lang: clip(m.lang, 10) };
}
/** a service worker script as facts. Pure. */
export function swFacts(text) {
  text = String(text || ''); if (!text) return null;
  return { bytes: text.length, workbox: /workbox|__WB_MANIFEST/.test(text), precache: /precache|__WB_MANIFEST|precacheAndRoute/.test(text), fetchHandler: /addEventListener\(\s*["'`]fetch["'`]|onfetch/.test(text), skipWaiting: /skipWaiting/.test(text), sync: /["'`]sync["'`]/.test(text) && /addEventListener/.test(text),
    periodicSync: /periodicsync/.test(text), push: /addEventListener\(\s*["'`]push["'`]/.test(text), notificationClick: /notificationclick/.test(text), cacheNames: uniq(hits(/caches\.open\(\s*["'`]([^"'`]{1,40})["'`]/g, text, 6).map((h) => clip(h.m[1], 40))) };
}
/** robots.txt as facts: the paths the page's group disallows, sitemap lines, crawl delay. Pure. */
export function robotsFacts(txt) {
  txt = String(txt || ''); const out = { disallow: [], sitemaps: [], crawlDelay: null }; let star = false, seenGroup = false, inGroup = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(), m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line); if (!m) continue; const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { if (!inGroup) star = false; inGroup = true; if (v === '*') { star = true; seenGroup = true; } continue; }
    inGroup = false;
    if (k === 'sitemap') { try { out.sitemaps.push(clip(new URL(v).origin + new URL(v).pathname, 100)); } catch (_) {} }
    else if (star && k === 'disallow' && v) out.disallow.push(clip(v, 60)); else if (star && k === 'crawl-delay') out.crawlDelay = clip(v, 6);
  }
  out.disallow = uniq(out.disallow).slice(0, 25); out.sitemaps = uniq(out.sitemaps).slice(0, 5); return out;
}
/** a sitemap.xml as facts: how many pages, the top-level sections, the languages. Pure. */
export function sitemapFacts(xml) {
  xml = String(xml || ''); if (!xml) return null;
  const locs = (xml.match(/<loc>\s*([^<\s]+)\s*<\/loc>/gi) || []).map((s) => s.replace(/<\/?loc>/gi, '').trim()), index = /<sitemapindex/i.test(xml), sec = new Map();
  for (const u of locs) { try { const seg = new URL(u).pathname.split('/').filter(Boolean)[0] || '/'; sec.set(seg, (sec.get(seg) || 0) + 1); } catch (_) {} }
  const langs = uniq((xml.match(/hreflang\s*=\s*"([^"]{2,12})"/gi) || []).map((s) => attr(s, 'hreflang'))).filter((l) => l !== 'x-default').slice(0, 80);
  return { urls: locs.length, index, sections: [...sec].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 15).map(([s, n]) => ({ s: clip(s, 30), n })), langs };
}
/** a wall the page put up, recorded and never worked around, or null. `view` = { status, title, text, hasPassword, controls, challenge }. Pure. */
export function blockedOf(view) {
  const v = view || {}, text = String(v.text || '').slice(0, 4000), title = String(v.title || '');
  if (v.robots) return { kind: 'robots', why: 'robots.txt disallows the page for every crawler' };
  if (v.status === 401 || v.status === 403 || v.status === 429) return { kind: v.status === 429 ? 'rate-limit' : 'refused', why: 'the site answered ' + v.status };
  if (v.status >= 500) return { kind: 'down', why: 'the site answered ' + v.status };
  if (/just a moment|attention required|checking your browser|verify you are (?:a )?human|are you a robot|access denied|request blocked|ddos protection/i.test(title + ' ' + text.slice(0, 600)) || v.challenge) return { kind: 'anti-bot', why: 'a bot challenge stood in front of the page' };
  if (text.replace(/\s+/g, ' ').length < 400 && (v.controls || 0) < 12 && (/\b(?:sign in|log in|login|sign up)\b/i.test(text) && v.hasPassword)) return { kind: 'login', why: 'the page asks for a sign-in before it shows anything' };
  if (/we value your privacy|manage (?:cookie )?(?:preferences|consent)|accept (?:all )?cookies/i.test(text.slice(0, 600)) && text.replace(/\s+/g, ' ').length < 700 && (v.controls || 0) < 10) return { kind: 'consent', why: 'a consent wall covered the page' };
  return null;
}

// ---- the report ----
const MAX_CAND = 60;
/** a candidate that is advertising, tracking or a one-page section, not a feature of the site: ad frames and captchas, ad and analytics storage keys, sections of one page. Pure. */
export const noiseOf = (c, site = '') => /^Embeds (?:[\w.-]*(?:doubleclick|googlesyndication|googleads|adsystem|adnxs|recaptcha|hcaptcha|challenges\.cloudflare|facebook|twitter|google\.com)[\w.-]*|\w[\w.-]*)$/.test(c.name) && (!site || c.name === 'Embeds ' + site || /(?:doubleclick|googlesyndication|googleads|adsystem|adnxs|recaptcha|hcaptcha|challenges\.cloudflare|facebook|twitter|google\.com)/.test(c.name)) || /^Remembers a setting in the browser: (?:google_|__lsa__|_ga|__gads|__gpi|ajs_|amplitude|mp_|_fbp|cf_|__cf|_hj|ph_|__stripe)/i.test(c.name) || /^Section \/.+\/ \(1 pages\)$/.test(c.name);
/** the candidate hidden features from the facts, each { name, kind, tag, evidence }, deduplicated by name, sorted, at most MAX_CAND. Pure. */
export function candidatesOf(r) {
  const out = new Map(), add = (name, kind, tag, evidence) => { const k = name.toLowerCase(); if (!out.has(k)) out.set(k, { name: clip(name, 80), kind, tag, evidence: clip(evidence, 80) }); };
  const codes = (r.code || []).filter((c) => c.own); // a third party's script (analytics, ads, a tag manager) says nothing about this site's features
  for (const c of codes) {
    for (const p of c.params) add('URL parameter ?' + p.v, 'url-param', 'read', c.file + '@' + p.at);
    for (const k of c.chords) add('Keyboard shortcut ' + k.v, 'shortcut', 'read', c.file + '@' + k.at);
    for (const a of c.apis) add(a.label, a.kind, 'read', c.file + '@' + a.at);
    for (const p of c.apiPaths) add('API path ' + p.v, 'api', 'read', c.file + '@' + p.at);
    for (const p of c.flags) add('Feature flag ' + p.v, 'flag', 'inferred', c.file + '@' + p.at);
    for (const p of c.downloads) add('Exports a file named like ' + p.v, 'export', 'read', c.file + '@' + p.at);
    for (const p of c.blobTypes) add('Exports as ' + p.v, 'export', 'read', c.file + '@' + p.at);
    for (const p of c.extLists) add('Accepts the file types ' + p.v.slice(0, 50), 'import', 'read', c.file + '@' + p.at);
    for (const p of c.routes.slice(0, 25)) add('Route ' + p.v, 'route', 'read', c.file + '@' + p.at);
    for (const p of c.idb) add('Keeps a database in the browser: ' + p.v, 'storage', 'read', c.file + '@' + p.at);
    if (c.keys.length >= 3) add('Keys handled: ' + c.keys.slice(0, 8).map((k) => k.v).join(', '), 'shortcut', 'read', c.file + '@' + c.keys[0].at);
    if (c.hotkeyLib) add('Hotkey library ' + c.hotkeyLib, 'shortcut', 'read', c.file);
    if (c.graphql) add('GraphQL API', 'api', 'inferred', c.file);
    if (c.websocket) add('Live updates over a WebSocket', 'service', 'read', c.file);
    if (c.install) add('Install prompt (beforeinstallprompt)', 'pwa', 'read', c.file);
    if (c.langs.length >= 5) add('Interface languages: ' + c.langs.length + ' (' + c.langs.slice(0, 6).join(', ') + ')', 'i18n', 'read', c.file + '@' + c.langsAt);
    if (c.localeFiles.length >= 2) add('Translation files: ' + c.localeFiles.length + ' (' + c.localeFiles.slice(0, 6).join(', ') + ')', 'i18n', 'read', c.file);
    if (c.media.print) add('Print layout', 'export', 'read', c.file); if (c.media.dark) add('Dark mode', 'a11y', 'read', c.file);
  }
  const h = r.html || {}; for (const d of [h.mobile, h.desktop]) if (d) {
    for (const a of d.accepts) add('Opens files: ' + a.slice(0, 60), 'import', 'observed', 'input[type=file][accept]');
    if (d.inputs.some((i) => i.multiple && i.type === 'file')) add('Several files at once', 'import', 'observed', 'input[type=file][multiple]');
    if (d.inputs.some((i) => i.dir)) add('Whole folders', 'import', 'observed', 'input[webkitdirectory]'); if (d.inputs.some((i) => i.capture)) add('Take a photo with the camera', 'input', 'observed', 'input[capture]');
    for (const [t, n] of Object.entries(d.inputTypes)) if (/^(?:color|range|date|datetime-local|time|week|month|number|search|email|tel|url)$/.test(t)) add('Input of type ' + t, 'input', 'observed', 'input[type=' + t + '] x' + n);
    for (const k of d.accesskeys) add('Access key ' + k, 'shortcut', 'observed', '[accesskey=' + k + ']'); for (const k of d.keyshortcuts) add('Keyboard shortcut ' + k, 'shortcut', 'observed', '[aria-keyshortcuts]');
    if (d.skipLink) add('Skip to content link', 'a11y', 'observed', 'a[href^="#main"]'); if (d.live) add('Screen reader announcements (aria-live)', 'a11y', 'observed', '[aria-live]');
    if (d.draggable) add('Draggable items', 'input', 'observed', '[draggable=true]'); if (d.editable) add('Edit in place', 'input', 'observed', '[contenteditable]');
    if (d.feeds) add('RSS or Atom feed', 'share', 'observed', 'link[type$=xml]'); if (d.opensearch) add('Browser search integration (OpenSearch)', 'service', 'observed', 'link[rel=search]'); if (d.oembed) add('oEmbed for embedding links', 'embed', 'observed', 'link[type*=oembed]');
    if (d.hreflang.length >= 2) add('Language versions: ' + d.hreflang.length + ' (' + d.hreflang.slice(0, 6).join(', ') + ')', 'i18n', 'observed', 'link[hreflang]');
    for (const i of d.iframes) add('Embeds ' + i, 'embed', 'observed', 'iframe'); if (d.downloadAttrs) add('Download links', 'export', 'observed', 'a[download] x' + d.downloadAttrs);
    for (const [role, n] of Object.entries(d.roles)) if (/^(?:menu|switch|slider|combobox|tree|grid|toolbar)$/.test(role)) add('Widget ' + role, 'setting', 'observed', '[role=' + role + '] x' + n);
  }
  const m = r.manifest; if (m) {
    add('Installable web app (' + (m.display || 'standalone') + ')', 'pwa', 'observed', 'manifest'); for (const s of m.shortcuts) add('App shortcut ' + s, 'pwa', 'observed', 'manifest.shortcuts');
    if (m.shareTarget) add('Receives shared ' + (m.shareTarget.files.length ? 'files' : 'links and text') + ' (share target)', 'share', 'observed', 'manifest.share_target'); if (m.fileHandlers.length) add('Opens as an app for ' + m.fileHandlers.slice(0, 6).join(', '), 'import', 'observed', 'manifest.file_handlers');
    if (m.protocolHandlers.length) add('Opens ' + m.protocolHandlers.join(', ') + ' links', 'pwa', 'observed', 'manifest.protocol_handlers'); if (m.widgets) add('Home screen widgets', 'pwa', 'observed', 'manifest.widgets');
  }
  const sw = r.serviceWorker; if (sw) {
    if (sw.precache || sw.fetchHandler) add('Works offline (service worker' + (sw.precache ? ' with a precache' : '') + ')', 'pwa', 'observed', 'service worker ' + (sw.url || ''));
    if (sw.push) add('Push notifications', 'service', 'observed', 'service worker'); if (sw.sync || sw.periodicSync) add('Background sync', 'service', 'observed', 'service worker');
  }
  for (const k of (r.storage && r.storage.local) || []) add('Remembers a setting in the browser: ' + k, 'storage', 'observed', 'localStorage');
  for (const k of (r.storage && r.storage.idb) || []) add('Keeps a database in the browser: ' + k, 'storage', 'observed', 'indexedDB');
  for (const w of r.websockets || []) add('Live updates over a WebSocket', 'service', 'observed', w);
  for (const q of (r.requests || []).filter((x) => /\/(?:api|graphql|v\d)\b/.test(x)).slice(0, 8)) add('API call ' + q.replace(/^https?:\/\//, ''), 'api', 'observed', 'network');
  for (const s of r.services || []) if (/^(?:Stripe|PayPal|Firebase|Supabase|AI model API|Maps|YouTube|Hosted search|Live updates|Image or file service|Sign-in provider|Comments)$/.test(s)) add('Uses ' + s, 'service', 'read', 'script hosts');
  const sm = r.sitemap; if (sm) { for (const s of sm.sections.slice(0, 8)) if (s.s !== '/') add('Section /' + s.s + '/ (' + s.n + ' pages)', 'route', 'observed', 'sitemap.xml'); if (sm.langs.length >= 2) add('Language versions in the sitemap: ' + sm.langs.length, 'i18n', 'observed', 'sitemap.xml'); }
  for (const p of (r.robots && r.robots.disallow) || []) if (!/^\/(?:\*|\?|$)/.test(p) && !/\*|\.(?:js|css|json)$/.test(p) && p.length > 2) add('Path kept from crawlers ' + p, 'route', 'observed', 'robots.txt');
  const order = ['url-param', 'shortcut', 'import', 'export', 'pwa', 'share', 'embed', 'api', 'flag', 'setting', 'input', 'storage', 'i18n', 'service', 'a11y', 'route'], rank = (k) => (order.indexOf(k) < 0 ? 99 : order.indexOf(k));
  return [...out.values()].filter((c) => !noiseOf(c, r.site)).sort((a, b) => rank(a.kind) - rank(b.kind) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)).slice(0, MAX_CAND);
}
/** the whole report for one site from what was collected. `got` = { url, final, status, date, blocked, html: { mobile, desktop } (html strings), controls: { mobile, desktop } (label lists), assets: [{ url, kind, bytes, text, headers }],
 *  manifest (parsed json), sw: { url, text }, robots (text), sitemap (xml), requests: [urls], websockets: [urls], storage: { local, session, idb }, consent }. Deterministic: no clock but `date`. Pure. */
export function reportOf(got) {
  const own = (() => { try { return new URL(got.final || got.url).hostname; } catch (_) { return ''; } })(), page = got.final || got.url;
  const assets = (got.assets || []).slice().sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0)), code = [], list = [];
  for (const a of assets) {
    const name = fileOf(a.url, own), isOwn = (() => { try { const h = new URL(a.url).hostname; return h === own || (!!regDomain(h) && regDomain(h) === regDomain(own)); } catch (_) { return false; } })();
    list.push({ f: name, t: a.kind, b: a.bytes || 0, ...(isOwn ? {} : { ext: true }), ...(a.text && codeFacts(a.text, name).sourceMap ? { map: true } : {}) });
    if (a.text && isOwn && (a.kind === 'js' || a.kind === 'css')) code.push({ ...codeFacts(a.text, name), own: isOwn });
  }
  const html = {}, hosts = new Map();
  for (const w of ['mobile', 'desktop']) if (got.html && got.html[w]) html[w] = htmlFacts(got.html[w], page);
  for (const c of code) for (const h of c.hosts) if (!hosts.has(h.host)) hosts.set(h.host, { host: h.host, file: c.file, at: h.at, ...(h.ws ? { ws: true } : {}) });
  const reqHosts = uniq((got.requests || []).map((u) => { try { return new URL(u).hostname; } catch (_) { return ''; } }).filter(Boolean));
  const third = uniq([...hosts.keys(), ...reqHosts, ...assets.map((a) => { try { return new URL(a.url).hostname; } catch (_) { return ''; } })].filter((h) => h && h !== own && !h.endsWith('.' + own.replace(/^www\./, '')))).sort();
  const services = uniq(servicesOf(third.join(' ') + ' ' + code.map((c) => c.file).join(' '))).sort();
  const sw = got.sw && got.sw.text ? { url: fileOf(got.sw.url, own), ...swFacts(got.sw.text) } : (got.sw && got.sw.url ? { url: fileOf(got.sw.url, own), registered: true } : null);
  const r = { site: own, url: clip(page, 120), scanned: got.date || today(), status: got.status || null, ...(got.blocked ? { blocked: got.blocked } : {}), ...(got.consent ? { consentBanner: true } : {}),
    assets: list.slice(0, 80), assetCount: list.length, bytes: list.reduce((n, a) => n + a.b, 0),
    html: { mobile: html.mobile || null, desktop: html.desktop || null },
    controls: controlsOf(got.controls && got.controls.mobile, got.controls && got.controls.desktop),
    manifest: manifestFacts(got.manifest), serviceWorker: sw, robots: robotsFacts(got.robots), sitemap: sitemapFacts(got.sitemap),
    code: code.map((c) => ({ ...c, hosts: undefined })), hosts: [...hosts.values()].sort((a, b) => (a.host < b.host ? -1 : 1)).slice(0, 60), thirdParty: third.slice(0, 60), services,
    requests: uniq((got.requests || []).map(bareUrl).filter(Boolean)).sort().slice(0, 40), websockets: uniq((got.websockets || []).map(bareUrl).filter(Boolean)).sort().slice(0, 6),
    storage: { local: uniq((got.storage && got.storage.local) || []).map((k) => clip(k, 40)).sort().slice(0, 40), session: uniq((got.storage && got.storage.session) || []).map((k) => clip(k, 40)).sort().slice(0, 20), idb: uniq((got.storage && got.storage.idb) || []).map((k) => clip(k, 40)).sort().slice(0, 10) } };
  r.candidates = candidatesOf(r);
  return compact(r);
}
/** the report as it is stored: per-file lists cut down to what carries a fact, empty things dropped, the facts' words clipped. Pure. */
export function compact(r) {
  const keepCode = r.code.map((c) => {
    const o = { file: c.file, own: c.own }; for (const k of ['params', 'chords', 'keys', 'apiPaths', 'flags', 'storage', 'idb', 'downloads', 'blobTypes', 'extLists', 'routes']) if (c[k] && c[k].length) o[k] = c[k].slice(0, 30).map((x) => x.v + '@' + x.at);
    if (c.apis && c.apis.length) o.apis = c.apis.map((a) => a.label).sort(); if (c.langs && c.langs.length >= 5) o.langs = c.langs.length; if (c.localeFiles && c.localeFiles.length >= 2) o.localeFiles = c.localeFiles.length; if (c.mimes && c.mimes.length) o.mimes = c.mimes.slice(0, 20).map((x) => x.v);
    for (const k of ['graphql', 'websocket', 'install', 'usesLocationSearch']) if (c[k]) o[k] = true; if (c.hotkeyLib) o.hotkeyLib = c.hotkeyLib; if (c.keyHandlers && c.keyHandlers.length) o.keydownHandlers = c.keyHandlers.length; if (c.sw) o.registersWorker = c.sw.url;
    const media = Object.entries(c.media || {}).filter(([, v]) => v).map(([k]) => k); if (media.length) o.media = media; return Object.keys(o).length > 2 ? o : null;
  }).filter(Boolean);
  const strip = (h) => (h ? Object.fromEntries(Object.entries(h).filter(([k, v]) => !['scripts', 'styles', 'inputs'].includes(k) && v !== false && v !== 0 && !(Array.isArray(v) && !v.length) && !(v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length))) : null);
  const out = { ...r, code: keepCode, html: { mobile: strip(r.html.mobile), desktop: strip(r.html.desktop) } };
  if (!out.html.mobile && !out.html.desktop) delete out.html; else for (const w of ['mobile', 'desktop']) if (!out.html[w]) delete out.html[w];
  if (out.html && out.html.desktop && out.html.mobile) { for (const k of Object.keys(out.html.desktop)) if (JSON.stringify(out.html.desktop[k]) === JSON.stringify(out.html.mobile[k])) delete out.html.desktop[k]; }
  for (const k of Object.keys(out)) if (out[k] == null || (Array.isArray(out[k]) && !out[k].length)) delete out[k];
  return out;
}

// ---- folding into the features files ----
/** a candidate as a features-file row. */
export const rowOf = (c) => ({ name: c.name, detail: c.kind + ', ' + c.tag, paid: false, verse: 'missing', verse_evidence: ROW_NOTE, found_by: 're', tag: c.tag, evidence: c.evidence });
/** a floor's features file with the reverse-engineering rows of one site folded in under "re": a row a builder already moved off "missing" keeps its
 *  state, the site's rows are replaced by this scan's, every other section stays as it was. A floor with no file gets a minimal one the feature scan
 *  may later fill. The inputs are not changed. Pure. */
export function mergeRe(file, floor, host, report) {
  const prevRe = (file && file.re) || {}, prevRows = new Map((((prevRe.sites || {})[host] || {}).features || []).map((r) => [r.name.toLowerCase(), r]));
  const rows = (report.candidates || []).filter((c) => !noiseOf(c, host)).map((c) => { const old = prevRows.get(c.name.toLowerCase()); return old && old.verse !== 'missing' ? { ...rowOf(c), verse: old.verse, verse_evidence: old.verse_evidence } : rowOf(c); });
  const sites = { ...(prevRe.sites || {}), [host]: { url: report.url, scanned: report.scanned, ...(report.blocked ? { blocked: report.blocked } : {}), features: rows } };
  const re = { scanned: report.scanned > (prevRe.scanned || '') ? report.scanned : prevRe.scanned, sites: Object.fromEntries(Object.entries(sites).sort(([a], [b]) => (a < b ? -1 : 1))) };
  if (!file) return { floor: floor.id, verse_page: floor.page || null, researched: null, source: 'auto', method: 'tools/site-re.mjs: the sites\' client code and loaded pages, facts only (no feature scan yet)', sites: {}, gaps: [], verse_extra: [], re };
  return { ...file, re };
}

// ---- files ----
export const slugOf = (id) => String(id).replace(/[^a-z0-9.]+/gi, '-').replace(/^-|-$/g, '');
const readJson = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return d; } };
export const reFile = (id, dir = RE_DIR) => path.join(dir, slugOf(id) + '.json');
export function writeReport(id, report, dir = RE_DIR) {
  const text = JSON.stringify(report, null, 1) + '\n', bad = text.split('\n').filter((l) => secretsIn(l).length);
  if (bad.length) throw new Error('the report for ' + id + ' holds a secret-shaped string; not written (' + bad.length + ' lines)');
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(reFile(id, dir), text);
}
/** the tower entries as { id, floor, url, host, slug, file } in the order a scan takes them: smallest site first (Tranco rank, hand order), leaders last among ties */
export function entriesOf(floors = FLOORS, ranks = {}, order = {}) {
  return bySize(floors, ranks, order).map((f) => { const url = siteOf(f, f.lane ? null : probeFor(f.id)); return { id: f.id, floor: f.lane || f.id, url, host: hostOf(url) || hostOf(f.url), slug: slugOf(f.id), featSlug: featureSlug(f.id), page: f.page || null }; });
}
/** the entries to scan: never scanned, or scanned `stale` days ago or more, in size order, at most n. `scannedOf(entry)` is the stored date or null. Pure. */
export function dueOf(entries, scannedOf, { stale = STALE_DAYS, n = 6, now = Date.now() } = {}) {
  return entries.filter((e) => { const d = scannedOf(e); const t = d ? Date.parse(d) : NaN; return !Number.isFinite(t) || now - t >= stale * 86400000; }).slice(0, n);
}
const sizeData = () => ({ ranks: (readJson(path.join(root, 'void-live-deploy', 'tower.rank.json'), {}) || {}).ranks || {}, order: readJson(path.join(root, 'domains', 'tower.order.json'), {}) || {} });
const allEntries = () => { const { ranks, order } = sizeData(); return entriesOf(FLOORS, ranks, order); };
const scannedDate = (e) => (readJson(reFile(e.id), {}) || {}).scanned || null;
/** fold every re/ file into the features files; returns how many files changed */
export function mergeAll({ dir = RE_DIR, features = FEATURES, entries = allEntries() } = {}) {
  let n = 0; const files = new Map();
  for (const e of entries) {
    const rep = readJson(reFile(e.id, dir)); if (!rep) continue;
    const p = path.join(features, e.featSlug + '.json'); const cur = files.has(p) ? files.get(p) : readJson(p);
    files.set(p, mergeRe(cur, { id: e.floor, page: e.page }, e.host, rep));
  }
  for (const [p, v] of files) { const text = JSON.stringify(v, null, 1) + '\n'; let old = ''; try { old = fs.readFileSync(p, 'utf8'); } catch (_) {} if (old !== text) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); n++; } }
  return n;
}

// ---- the browser ----
const CAP_FILE = 4e6, CAP_TOTAL = 12e6, SITE_MS = 120000;
const kindOf = (type, url) => (type === 'script' ? 'js' : type === 'stylesheet' ? 'css' : type === 'document' ? 'html' : type === 'manifest' ? 'manifest' : /\.(?:js|mjs)(?:\?|$)/.test(url) ? 'js' : /\.css(?:\?|$)/.test(url) ? 'css' : null);
/** run in the page: labels of what a person can press or read as navigation at this width */
const CONTROLS_JS = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const rows = [...document.querySelectorAll('button, [role=button], [role=menuitem], [role=tab], summary, nav a, header a, footer a, [role=switch], label, select, option')].filter(vis);
  const lab = (e) => (e.getAttribute('aria-label') || e.innerText || e.value || e.title || '').trim().replace(/\s+/g, ' ');
  return { rows: rows.map(lab).filter((t) => t && t.length <= 40).slice(0, 400), password: !!document.querySelector('input[type=password]'), text: document.body ? document.body.innerText.slice(0, 4000) : '', title: document.title,
    consent: !!document.querySelector('#onetrust-banner-sdk, .cc-window, #CybotCookiebotDialog, [class*="cookie-banner" i], [id*="cookie-banner" i], [aria-label*="cookie" i]'),
    challenge: !!document.querySelector('#challenge-form, #cf-challenge-running, .g-recaptcha, .h-captcha, iframe[src*="challenges.cloudflare"]') };
};
const STORAGE_JS = async () => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), idb: indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : [], regs: navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).map((r) => (r.active || r.waiting || r.installing || {}).scriptURL).filter(Boolean) : [] });
/** one polite visit: robots.txt, then the page at phone and desktop width (no clicks), the assets the browser itself received, the manifest, the
 *  service worker, sitemap.xml when robots allows. Returns what reportOf takes. */
export async function visit(browser, url, { date = today() } = {}) {
  const got = { url, date, assets: [], requests: [], websockets: [], html: {}, controls: {}, storage: {}, blocked: null };
  const origin = new URL(url).origin, plain = await browser.newContext({ userAgent: UA_DESKTOP }), ask = (u, ms = 12000) => plain.request.get(u, { timeout: ms, maxRedirects: 3, failOnStatusCode: false }).catch(() => null);
  try {
    const rr = await ask(origin + '/robots.txt'); got.robots = rr && rr.ok() ? (await rr.text()).slice(0, 200000) : '';
    const path0 = new URL(url).pathname + new URL(url).search;
    if (got.robots && !robotsAllows(got.robots, path0)) { got.blocked = blockedOf({ robots: true }); return got; }
    let total = 0;
    for (const w of [{ name: 'mobile', width: 390, ua: UA }, { name: 'desktop', width: 1280, ua: UA_DESKTOP }]) {
      const ctx = await browser.newContext({ viewport: { width: w.width, height: 800 }, userAgent: w.ua, locale: 'en-US', serviceWorkers: 'allow' }), page = await ctx.newPage(), bodies = [];
      page.on('websocket', (ws) => got.websockets.push(ws.url()));
      page.on('request', (rq) => { if (/^(?:fetch|xhr|eventsource)$/.test(rq.resourceType())) got.requests.push(rq.url()); });
      page.on('response', (rs) => {
        const type = rs.request().resourceType(), kind = kindOf(type, rs.url()); if (!kind || kind === 'html' && rs.request().frame() !== page.mainFrame()) return;
        const h = rs.headers(); if (kind === 'html') { got.status = got.status || rs.status(); return; }
        if (w.name !== 'desktop' || got.assets.some((a) => a.url === rs.url())) return;
        let mine = false; try { const hh = new URL(rs.url()).hostname, oh = new URL(url).hostname; mine = hh === oh || regDomain(hh) === regDomain(oh); } catch (_) {} // a third party's script is counted, not read
        bodies.push(rs.body().then((b) => { total += b.length; got.assets.push({ url: rs.url(), kind, bytes: b.length, text: mine && b.length <= CAP_FILE && total <= CAP_TOTAL ? b.toString('utf8') : '', headers: { frame: h['x-frame-options'] || null } }); }).catch(() => {}));
      });
      try {
        const resp = await page.goto(url, { waitUntil: 'load', timeout: 40000 }); if (resp) { got.status = got.status || resp.status(); got.final = got.final || page.url(); }
        await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {}); await page.waitForTimeout(800); await Promise.all(bodies);
        got.html[w.name] = (await page.content()).slice(0, 2e6); const c = await page.evaluate(CONTROLS_JS).catch(() => null);
        if (c) { got.controls[w.name] = c.rows; got.consent = got.consent || c.consent; if (w.name === 'desktop') got.view = { status: got.status, title: c.title, text: c.text, hasPassword: c.password, controls: c.rows.length, challenge: c.challenge }; }
        if (w.name === 'desktop') {
          const st = await page.evaluate(STORAGE_JS).catch(() => null); if (st) { got.storage = { local: st.local, session: st.session, idb: st.idb.filter(Boolean) }; const sw = st.regs[0] || (ctx.serviceWorkers()[0] && ctx.serviceWorkers()[0].url()); if (sw) { const r = await ask(sw); got.sw = { url: sw, text: r && r.ok() ? (await r.text()).slice(0, CAP_FILE) : '' }; } }
        }
      } finally { await ctx.close().catch(() => {}); }
      if (w.name === 'mobile') await new Promise((r) => setTimeout(r, 1500)); // one site, two loads, not a burst
    }
    got.blocked = blockedOf(got.view || { status: got.status }); if (got.blocked && got.blocked.kind === 'consent') got.consent = true;
    const man = got.html.desktop && htmlFacts(got.html.desktop, got.final || url).manifest;
    if (man) { const r = await ask(man); if (r && r.ok()) { try { got.manifest = JSON.parse((await r.text()).slice(0, 200000)); } catch (_) {} } }
    const sm = (robotsFacts(got.robots).sitemaps[0]) || origin + '/sitemap.xml'; let smPath = '/sitemap.xml'; try { smPath = new URL(sm).pathname; } catch (_) {}
    if (!got.robots || robotsAllows(got.robots, smPath)) { const r = await ask(sm.startsWith('http') ? sm : origin + sm); if (r && r.ok() && /xml/i.test(r.headers()['content-type'] || '')) got.sitemap = (await r.text()).slice(0, 1.5e6); }
    return got;
  } finally { await plain.close().catch(() => {}); }
}
/** one entry scanned and written; a site that cannot be read is written as blocked/unreachable, never skipped silently */
export async function scanEntry(browser, e, { dir = RE_DIR } = {}) {
  let got, timer; try { got = await Promise.race([visit(browser, e.url), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('stopped after ' + SITE_MS / 1000 + ' seconds')), SITE_MS); })]); }
  catch (err) { got = { url: e.url, date: today(), assets: [], html: {}, controls: {}, storage: {}, blocked: { kind: 'unreachable', why: clip(err && err.message || err, 100) } }; } finally { clearTimeout(timer); }
  const report = reportOf(got); writeReport(e.id, report, dir); return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), entries = allEntries();
  const flag = (n) => argv.indexOf(n), words = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && /^--(?:which)$/.test(argv[i - 1]) && /^\d+$/.test(a)));
  if (flag('--list') >= 0) { for (const e of entries) console.log(e.id.padEnd(34) + (scannedDate(e) || 'never').padEnd(12) + e.url); process.exit(0); }
  if (flag('--merge') >= 0) { console.log(mergeAll({ entries }) + ' features file(s) updated'); process.exit(0); }
  if (flag('--which') >= 0) { const n = Number(argv[flag('--which') + 1]) || 6; console.log(dueOf(entries, scannedDate, { n }).map((e) => e.id).join('\n')); process.exit(0); }
  const ids = words.join(' ').split(',').map((s) => s.trim()).filter(Boolean);
  if (!ids.length) { console.error('usage: site-re.mjs "<floor id>[,<floor id>]" | --which [N] | --list | --merge (see the header)'); process.exit(2); }
  const todo = ids.map((id) => entries.find((e) => e.id === id) || (console.error('no tower entry ' + id), null)).filter(Boolean);
  if (!todo.length) process.exit(2);
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try { for (const e of todo) { const r = await scanEntry(b, e); console.log(e.id + ': ' + (r.blocked ? 'BLOCKED ' + r.blocked.kind + ' (' + r.blocked.why + ')' : r.assetCount + ' assets, ' + (r.candidates || []).length + ' candidates')); } } finally { await b.close(); }
  console.log(mergeAll({ entries }) + ' features file(s) updated');
}
