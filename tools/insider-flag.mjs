// The insider flag (owner, 2026-10-28, rule 11 of docs/WIDER-USE.md, "broaden the niche"): a page that only makes sense to fans of one game,
// show or scene is flagged, so Verse's version can open to anyone while the fan depth stays. A page is flagged when any of these holds:
//  (a) a franchise name, acronym or slang word comes in its first 15 words before the plain-English job is said;
//  (b) its labels put a scene's words on plain arithmetic (eliminations, mana, drops, ticks: two or more, with no "any game" style framing);
//  (c) its default example is the scene's own, with no one-click everyday example beside it.
// Pure functions plus a command that reads every page's own HTML (no browser, no network):
//   node tools/insider-flag.mjs            every void-live-deploy/**/index.html, flagged first
//   node tools/insider-flag.mjs --json     the same as JSON
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

// franchise names and scene slang a newcomer cannot be expected to know (names are plain text only, as comparisons)
export const FRANCHISE = ['fortnite', 'fncs', 'tilted towers', 'pleasant park', 'minecraft', 'pokemon', 'pokémon', 'mtg', 'magic: the gathering', 'gwent', 'd&d', 'dnd', 'dungeon master', 'dungeons', 'valorant', 'league of legends', 'dota', 'cs2', 'warzone', 'apex', 'roblox', 'zelda', 'warhammer', 'yunite', 'cpan', 'perl', 'n8n', 'zapier', 'power automate', 'make.com', 'exif', 'kanban', 'scrum', 'imageboard', 'textboard', 'chan', 'tripcode', 'greentext', 'anime', 'waifu', 'vtuber', 'gacha', 'speedrun', 'iloveimg', 'photopea', 'tinypng', 'squoosh', 'exifeditor', 'gist', 'gists'];
export const SLANG = ['scrim', 'scrims', 'elims', 'pvp', 'pve', 'dps', 'elo', 'mmr', 'npc', 'rng', 'poi', 'pois', 'kda', 'k/d', 'meta', 'nerf', 'buff', 'gg', 'op', 'sage', 'bump', 'kek', 'based', 'lurk', 'dms', 'smurf', 'aggro', 'loot', 'respawn', 'frag', 'frags', 'crit', 'xp', 'hp', 'grind', 'proc', 'bpm', 'hex', 'cmyk', 'ci', 'npm', 'oauth', 'cve'];
// a scene's names on plain counting: kills are a count, mana is a budget, a drop is a starting spot, a tick is a timer step
export const DOMAIN_LABELS = ['eliminations', 'elims', 'kills', 'mana', 'drop spot', 'drop spots', 'drops', 'tick', 'ticks', 'loot', 'spawn', 'respawn', 'hp', 'xp', 'dps', 'gold', 'crit', 'aggro', 'placement points', 'victory royale', 'lobby', 'heat', 'heats', 'k/d', 'frags', 'buy-in', 'rake', 'blinds'];
// words that say the plain job
const JOB = /\b(?:calculat\w*|count\w*|convert\w*|track\w*|score\w*|keep\w*|make\w*|find\w*|plan\w*|time\w*|timer|clock|pick\w*|flip\w*|roll\w*|random|draw\w*|write\w*|read\w*|listen\w*|watch\w*|search\w*|compare\w*|check\w*|merge\w*|resize\w*|compress\w*|edit\w*|translate\w*|notes?|list\w*|board\w*|tasks?|shows?|tells?|turns?|weather|news|recipes?|jobs?|flights?|photos?|music|tune\w*|learn\w*|play\w*|share\w*|save\w*|build\w*|fix\w*|post\w*|generat\w*|names?|password\w*|colou?rs?|standings|leaderboards?|calendar|events?)\b/i;
// framing that opens a scene's page to anyone
const ANY = /\b(?:any (?:game|sport|contest|team|league|topic|club|class|event|tournament)|for anyone|whatever you play|works for|board games?, sports|office|classroom|family)\b/i;
const EVERYDAY = /\b(?:example|try|sample|preset|demo|everyday|e\.g\.)\b/i;
const words = (t) => String(t || '').replace(/[^\p{L}\p{N}&:/.'+-]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
const has = (list, t) => { const s = ' ' + String(t || '').toLowerCase().replace(/[^\p{L}\p{N}&:/.'+-]+/gu, ' ') + ' '; return list.filter((w) => s.includes(' ' + w + ' ')); };
// an acronym a reader may not know: 2 to 5 capitals, not one everyone reads
const KNOWN = new Set(['PDF', 'URL', 'USA', 'UK', 'EU', 'AI', 'ID', 'CSV', 'JSON', 'PNG', 'JPG', 'JPEG', 'OK', 'FAQ', 'TV', 'US', 'AM', 'PM', 'UTC', 'GMT', 'ET', 'CO2', 'HTML', 'CSS', 'API', 'VERSE', 'NEW', 'FREE', 'GO', 'DIY', 'QR', 'GPS', 'NASA', 'BBC', 'NPR', 'AP', 'ABC', 'RSS', 'SVG', 'GIF', 'MP3', 'MP4', 'ZIP', 'IP', 'DNS', 'SSL', 'HTTPS', 'HTTP', 'WWW', 'OR', 'AND', 'THE', 'TO', 'A', 'I', 'ON', 'OFF', 'MENU', 'HOME', 'BACK', 'COPY', 'SAVE', 'RESET', 'START', 'STOP', 'C', 'F', 'K', 'KM', 'MI', 'KG', 'LB', 'CM', 'MM', 'DE', 'EN', 'ES', 'FR', '2D', '3D', 'SPIN', 'FLIP', 'ROLL', 'DRAW', 'PLAY', 'MP', 'HD', 'FM', 'PIN', 'FAQS']);

/** the reasons a page reads as insider-only, from what it shows first: { text, labels, defaults, examples }. Pure. */
export function insiderFlags({ text = '', labels = '', defaults = '', examples = 0 } = {}) {
  const reasons = [], w = words(text).slice(0, 40);
  // (a) the first 15 words after any site name or nav ("Verse", "Back"): jargon before the job
  const first = w.filter((x) => !/^(?:verse|a-to-mind|back|home|menu|·|skip|to|content)$/i.test(x)).slice(0, 15), lead = first.join(' ');
  const jobAt = first.findIndex((x) => JOB.test(x));
  const jarg = first.map((x, i) => ({ x, i })).filter(({ x }) => has(FRANCHISE.concat(SLANG), x).length || (/^[A-Z0-9]{2,5}s?$/.test(x) && /[A-Z]/.test(x) && !KNOWN.has(x.replace(/s$/, ''))));
  const twoWord = has(FRANCHISE, lead).filter((n) => n.includes(' ')).map((x) => ({ x, i: first.findIndex((y) => y.toLowerCase() === x.split(' ')[0]) }));
  const early = jarg.concat(twoWord).filter(({ i }) => jobAt < 0 || i < jobAt);
  if (early.length && !ANY.test(lead)) reasons.push({ code: 'a', why: '"' + early.map((e) => e.x).join('", "') + '" comes before the plain job in the first 15 words' + (jobAt < 0 ? ' (the job is never said there)' : '') });
  // (b) a scene's words on plain arithmetic
  const dl = [...new Set(has(DOMAIN_LABELS, labels + ' ' + text).map((x) => x.replace(/s$/, '')))];
  if (dl.length >= 2 && !ANY.test(text + ' ' + labels)) reasons.push({ code: 'b', why: 'scene labels on plain counting: ' + dl.slice(0, 5).join(', ') });
  // (c) the default example is the scene's own, with no everyday one a click away
  const dj = [...new Set(has(FRANCHISE.concat(SLANG, DOMAIN_LABELS), defaults))];
  if (dj.length && !examples && !EVERYDAY.test(labels)) reasons.push({ code: 'c', why: 'the default example is insider (' + dj.slice(0, 4).join(', ') + ') with no one-click everyday example' });
  return { flagged: reasons.length > 0, reasons, lead };
}

/** what a page's own HTML shows, without running it: { text, labels, defaults, examples }. Pure. */
export function htmlFacts(html) {
  const body = String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  const main = (body.match(/<body[\s\S]*$/i) || [body])[0];
  const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const attr = (re) => [...main.matchAll(re)].map((m) => m[1]).join(' | ');
  const tagText = (tags) => [...main.matchAll(new RegExp('<(' + tags + ')\\b[^>]*>([\\s\\S]*?)</\\1>', 'gi'))].map((m) => strip(m[2])).join(' | ');
  const labels = tagText('label|th|legend|button|option|summary') + ' | ' + attr(/aria-label="([^"]*)"/gi);
  const defaults = attr(/placeholder="([^"]*)"/gi) + ' | ' + attr(/<input[^>]*\bvalue="([^"]*)"/gi) + ' | ' + tagText('textarea');
  const examples = (labels.match(/\b(?:example|try|sample|preset|demo)\b/gi) || []).length + (main.match(/data-(?:example|preset)\b/g) || []).length;
  return { text: strip(main.replace(/<(nav|header)\b[\s\S]*?<\/\1>/i, (m) => m.replace(/<a\b[\s\S]*?<\/a>/gi, ' '))), labels, defaults, examples };
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), site = path.join(root, 'void-live-deploy');
/** every page of the site: [{ path, file }], each void-live-deploy/**\/index.html outside vendor and skills, and the root pages */
export function allPages(dir = site) {
  const out = [];
  const walk = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) { if (!/^(?:vendor|skills|functions|lib|node_modules|tower\.shots|tower\.icons|og|data|\.)/.test(e.name)) walk(path.join(d, e.name), rel + e.name + '/'); } else if (e.name === 'index.html') out.push({ path: rel || '/', file: path.join(d, e.name) }); } };
  walk(dir, '/'); return out.sort((a, b) => a.path.localeCompare(b.path));
}
export const SKIP = ['/tournaments/']; // being reworked by another run (2026-10-28)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rows = allPages().filter((p) => !SKIP.includes(p.path)).map((p) => ({ path: p.path, ...insiderFlags(htmlFacts(fs.readFileSync(p.file, 'utf8'))) }));
  rows.sort((a, b) => b.reasons.length - a.reasons.length || a.path.localeCompare(b.path));
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
  else { for (const r of rows.filter((r) => r.flagged)) console.log(r.path.padEnd(34), r.reasons.map((x) => '(' + x.code + ') ' + x.why).join('; ')); console.log(rows.filter((r) => r.flagged).length + ' of ' + rows.length + ' pages flagged'); }
}
