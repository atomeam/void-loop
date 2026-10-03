// Public Voids (a-to-mind.com/@name): a paid Void can put its look and kept cards on a public page.
// Only what is chosen for the page is stored: the look (colours, effects) and kept cards as plain text. Never the stage,
// calendar or notes, and never HTML: a page is served on this origin, so stored markup would be script on everyone's Void.
export const PAGE_TABLE = 'CREATE TABLE IF NOT EXISTS void_pages (handle TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, data TEXT NOT NULL, updated TEXT NOT NULL)';
export const HANDLE_RE = /^[a-z0-9_]{3,24}$/;
// crew and homebase are taken names for the deploy gate. Refuse them before a session exists, so a probe cannot claim them.
export const RESERVED = new Set(['api', 'admin', 'root', 'void', 'owner', 'atom', 'adam', 'a2m', 'atomind', 'a_to_mind', 'support', 'help', 'about', 'login', 'signin', 'signup', 'settings', 'billing', 'pay', 'store', 'shop', 'www', 'mail', 'static', 'assets', 'skills', 'tools', 'official', 'security', 'staff', 'mod', 'moderator', 'system', 'null', 'undefined', 'everyone', 'here', 'crew', 'homebase']);

const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);
const text = (v, n) => String(v == null ? '' : v).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

// Whatever the browser sends, this is all that can reach a public page.
export function cleanPage(d) {
  const look = (d && typeof d.look === 'object' && d.look) || {};
  const cards = Array.isArray(d && d.cards) ? d.cards : [];
  return {
    look: {
      bg: hex(look.bg, '#050505'), glow: hex(look.glow, '#0b0b10'),
      stars: ['off', 'on', 'slow'].includes(look.stars) ? look.stars : 'off',
      fx: ['off', 'nebula', 'swarm'].includes(look.fx) ? look.fx : 'off',
    },
    cards: cards.slice(0, 12).map((c) => ({ name: text(c && c.name, 80), ask: text(c && c.ask, 200), text: text(c && c.text, 1200) })).filter((c) => c.name || c.text),
  };
}
export async function ensurePages(env) { await env.DB.prepare(PAGE_TABLE).run(); }
export async function pageOf(env, handle) {
  try {
    await ensurePages(env);
    const row = await env.DB.prepare('SELECT data, updated FROM void_pages WHERE handle = ?').bind(handle).first();
    return row ? { ...cleanPage(JSON.parse(row.data)), updated: row.updated } : null;
  } catch (_) { return null; }
}
