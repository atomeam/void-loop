// The /sports/ page (void-live-deploy/sports/index.html): its sport grid, search, born-on-this-day and API note are the scores page's Sports tab (scores/sports.js),
// drawn here on a page of its own. Imported once the load event has fired. Followed teams are read from the scores page's key on this device.
import { mountRelated } from '/lib/toolkit.js';
import * as S from '/lib/scores.js';
import { view } from '/scores/sports.js';

const h = (tag, a, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(a || {})) { if (v === false || v == null) continue; if (k === 'text') e.textContent = v; else if (/^on[a-z]+$/.test(k) && typeof v === 'function') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null) e.append(c); return e; };
const lang = navigator.language || 'en', W = S.wordsFor(lang);
let mem = {}; try { mem = JSON.parse(localStorage.getItem('a2m.void.scores.v1')) || {}; } catch (_) {}
const out = document.getElementById('out'), note = document.getElementById('note');
// Share link: the page's own address (a search in it too), by the device's share sheet when it has one, else copied
document.getElementById('share').addEventListener('click', async () => { const u = location.href; try { if (navigator.share) await navigator.share({ title: document.title, url: u }); else { await navigator.clipboard.writeText(u); note.textContent = 'Link copied.'; } } catch (_) { note.textContent = u; } });
await view({ S, h, out, say: (t, bad) => { note.textContent = t || ''; note.classList.toggle('bad', !!bad); }, W, lang, mem, q: new URLSearchParams(location.search).get('q') || '', open: (id) => { location.href = '/scores/?league=' + id; } });
mountRelated(document.getElementById('related'), '/sports/', []);
