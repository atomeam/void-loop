/**
 * rap skill - a rap written for your topic, rhymes shown, performed over its own beat.
 * Asks: "rap about pizza", "write me a rap", "a trap rap about mondays", "spit some bars about coffee", "drop a verse about my dog", "freestyle
 * about the moon", "can you rap" (owner, 2026-10-29: "Verse should learn to rap for those who hear the name and think thats what it is"). The rap is
 * written for the ask by the free answer model (/api/answer mode 'rap', lib/rap.js), never picked from a list; the card shows it bar by bar with its
 * rhyme scheme, performs it over a beat made for its style in the browser (lib/rap-stage.js), takes another take, and opens on /rap/ with the whole
 * rap in the link, where the style, mood, flow and point of view can be changed. The card's reply section is added by the stage (lib/card-reply.js).
 * Evidence: experiment, a new skill (tools/families.mjs rates it from its tests; nothing here claims more).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { rapAskOf, settingsOf, linkOf } from '../lib/rap.js';
import { mountRap } from '../lib/rap-stage.js';

// a word longer than a phone screen breaks inside the card instead of pushing it past the edge (2026-10-30)
const CSS = '.rp-card{overflow-wrap:anywhere}.rp-card .rp-t{min-width:0}.rp-card .rp-meta,.rp-card .rp-msg{color:var(--ink-3,#9a97ab);font-size:13px;margin:6px 0}.rp-card .rp-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}'
  + '.rp-card .rp-btn,.rp-card .rp-voice,.rp-card a.rp-btn{font:inherit;font-size:14px;min-height:40px;padding:6px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);color:inherit;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}'
  + '.rp-card .rp-btn.go{background:#a58bff;color:#120f1d;border-color:#a58bff;font-weight:600}.rp-card .rp-vol{accent-color:#a58bff;min-width:90px}.rp-card .rp-sec{margin:12px 0 4px}.rp-card .rp-name{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#a58bff;margin:0 0 4px}'
  + '.rp-card .rp-bars{list-style:none;margin:0;padding:0}.rp-card .rp-bar{display:flex;gap:10px;align-items:baseline;padding:3px 6px;border-radius:8px;font-size:17px;line-height:1.45;transition:background .12s}.rp-card .rp-bar.on{background:rgba(165,139,255,.2)}'
  + '.rp-card .rp-l{flex:0 0 1.2em;font:600 12px ui-monospace,monospace;opacity:.75;text-align:center}.rp-card mark.rp-r{background:none;color:inherit;border-bottom:2px solid currentColor;font-weight:600}'
  + [...'ABCDEFGHIJ'].map((c, i) => '.rp-card .rp-' + c + '{color:hsl(' + (i * 47 + 260) % 360 + ' 80% 72%)}').join('');

const ensureCss = (doc) => { if (doc.getElementById('rp-style')) return; const st = doc.createElement('style'); st.id = 'rp-style'; st.textContent = CSS; doc.head.appendChild(st); };

async function fetchRap(s) {
  try {
    const r = await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'rap', ...s }) });
    const j = await r.json().catch(() => ({})); return j && j.rap ? { rap: j.rap } : { say: (j && j.say) || 'I could not write it just now. Try again in a minute.' };
  } catch (_) { return { say: 'I could not reach my pen: check the connection and try again.' }; }
}

function run(text, api) {
  const { showPage, esc } = api, ask = rapAskOf(text) || { topic: '', style: '', mood: '' };
  let s = settingsOf({ topic: ask.topic, style: ask.style || undefined, mood: ask.mood || undefined }), cur = null;
  const head = (t) => '<h2>' + esc(t) + '</h2>';
  const el = showPage((p) => {
    p.dataset.cardKind = 'Rap'; p.classList.add('rp-card');
    p.innerHTML = head(s.topic ? 'A rap about ' + s.topic : 'A rap from Verse') + '<p class="rp-msg" role="status">Writing it now: a ' + esc(s.style) + ' rap, ' + esc(s.mood) + ', made for your words.</p><div class="rp-box"></div>'
      + '<div class="src">Written for your ask by Verse on its free model (Gemma on Workers AI); the beat is composed and the voice is your browser\'s own, made here. Evidence: experiment, a new skill.</div>';
  });
  ensureCss(document);
  const draw = async () => {
    if (cur) cur.stop();
    const box = el.querySelector('.rp-box'), msg = el.querySelector('.rp-msg'); if (!box) return;
    const got = await fetchRap(s);
    if (!api._pageStill || api._pageStill(el)) {
      if (!got.rap) { if (msg) msg.textContent = got.say; return; }
      const h = el.querySelector('h2'); if (h) h.textContent = got.rap.title || (s.topic ? 'A rap about ' + s.topic : 'A rap from Verse');
      if (msg) msg.remove();
      const again = document.createElement('button'); again.className = 'rp-btn'; again.textContent = 'Another take';
      const open = document.createElement('a'); open.className = 'rp-btn'; open.textContent = 'Change the style, mood or flow'; open.href = linkOf(s, got.rap);
      again.addEventListener('click', () => { s = { ...s, seed: s.seed + 1 }; box.textContent = ''; const m = document.createElement('p'); m.className = 'rp-msg'; m.setAttribute('role', 'status'); m.textContent = 'Writing take ' + (s.seed + 1) + ' now.'; box.append(m); draw(); });
      // the rap's own link: the whole rap rides in it, so whoever opens it gets these bars with the beat on /rap/, not a new rap
      const link = document.createElement('button'); link.type = 'button'; link.className = 'rp-btn'; link.textContent = 'Copy its link';
      const rap = got.rap, at = s; link.addEventListener('click', async () => { const u = location.origin + linkOf(at, rap); try { await navigator.clipboard.writeText(u); cur && cur.say('Copied the link to this rap.'); } catch (_) { cur && cur.say('Copy this link: ' + u); } });
      cur = mountRap(box, got.rap, s, { extra: [again, link, open] });
    }
  };
  draw();
  return 'rap';
}

export default {
  name: 'rap',
  examples: ['write me a rap about pizza', 'rap about my dog', 'spit some bars about mondays', 'drop a verse about coffee', 'freestyle about the moon', 'a trap rap about rainy days', 'can you rap', 'rap battle me'],
  nearMisses: ['rap music', 'who is the best rapper', 'wrap a present', 'bible verse', 'write a poem about love', 'make me a song', 'rap lyrics to lose yourself by eminem', 'history of rap'],
  match(lower, text) { return !!rapAskOf(text || lower); },
  run
};
