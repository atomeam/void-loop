/**
 * local-stations skill: "local radio", "radio stations near me", "local tv stations", "tv stations in denver", "radio in boston" (owner,
 * 2026-10-30: "Verse should pick up local tv and radio"). A card of the radio stations nearest the visitor (or the place named), from Radio
 * Browser through /api/local, each with a Play button that plays the station's own stream right on the card, and a link to the full page
 * /local/ with TV as well. Nothing is restreamed: the browser plays each station from its own server.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { linkOf, placeName, localAsk } from '../lib/local-media.js';

export { localAsk };

async function run(text, api) {
  const { showPage, esc } = api, ask = localAsk(text) || { kind: 'radio', place: '' };
  const page = linkOf({ place: ask.place, tab: ask.kind === 'tv' ? 'tv' : '' });
  const el = showPage((p) => { p.dataset.cardKind = 'Local TV and radio'; p.innerHTML = '<h2>' + esc(ask.kind === 'tv' ? 'Local TV' : 'Local radio') + '</h2><div class="sub">Finding stations near you</div>'; });
  const fail = (msg) => { if (api._pageStill && !api._pageStill(el)) return; el.innerHTML = '<h2>Local TV and radio</h2><p>' + esc(msg) + '</p><p><a href="' + esc(page) + '">Open the full page</a></p>'; };
  try {
    const where = await fetch(ask.place ? '/api/local?place=' + encodeURIComponent(ask.place) : '/api/local').then((r) => r.json());
    if (!where || !where.ok) return fail(where && where.say || 'I could not tell where you are. Say a town, like "radio stations in Boston".'), 'local-stations';
    const p = where.place, q = new URLSearchParams({ lat: p.lat, lon: p.lon, cc: p.country }); if (p.region) q.set('region', p.region);
    const out = p.lat == null ? null : await fetch('/api/local?' + q).then((r) => r.json());
    if (api._pageStill && !api._pageStill(el)) return 'local-stations';
    const list = out && out.ok ? out.stations.filter((s) => s.play).slice(0, 6) : [];
    const full = linkOf({ place: ask.place ? p.city || ask.place : '', tab: ask.kind === 'tv' ? 'tv' : '' });
    el.innerHTML = '<h2>' + esc((ask.kind === 'tv' ? 'Local TV and radio near ' : 'Radio near ') + placeName(p)) + '</h2>' // void-review: ok (every value escaped)
      + (ask.kind === 'tv' ? '<p>The TV stations near you, with the free live streams that play, are on the full page.</p>' : '')
      + (list.length ? '<ul class="ls-list" style="list-style:none;padding:0;margin:0">' + list.map((s, i) => '<li style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:6px 0"><button type="button" data-i="' + i + '" style="min-height:32px">Play</button> <span><b>' + esc(s.name) + '</b> <small>' + esc([s.tags.slice(0, 2).join(', '), s.km != null ? s.km + ' km' : ''].filter(Boolean).join(' · ')) + '</small></span></li>').join('') + '</ul>'
        : '<p>No radio stream near ' + esc(placeName(p)) + ' plays here yet. The full page lists every station and its own site.</p>')
      + '<p><a href="' + esc(full) + '">Open the full page</a> <span class="ls-msg" role="status"></span></p>'
      + '<div class="src">Radio from Radio Browser, the open station directory; each stream plays from the station itself.</div>';
    for (const ev of ['pointerdown', 'keydown']) for (const b of el.querySelectorAll('button,a')) b.addEventListener(ev, (e) => e.stopPropagation());
    let audio = null; const msg = el.querySelector('.ls-msg');
    for (const b of el.querySelectorAll('button[data-i]')) b.addEventListener('click', () => {
      const s = list[+b.dataset.i]; if (!audio) audio = new Audio();
      if (b.textContent === 'Stop') { audio.pause(); b.textContent = 'Play'; msg.textContent = ''; return; }
      for (const o of el.querySelectorAll('button[data-i]')) o.textContent = 'Play';
      audio.src = s.play; b.textContent = 'Stop'; msg.textContent = 'Connecting to ' + s.name;
      audio.onplaying = () => { msg.textContent = 'Playing ' + s.name; }; audio.onerror = () => { b.textContent = 'Play'; msg.textContent = s.name + ' did not play here; the full page links its own site.'; };
      audio.play().catch(() => {});
    });
  } catch (_) { fail('The station directory did not answer just now.'); }
  return 'local-stations';
}

export default {
  name: 'local-stations',
  examples: ['local radio', 'radio stations near me', 'local tv stations', 'tv stations in denver', 'local radio in boston', 'what radio stations are near me', 'boston radio stations'],
  nearMisses: ['what is a radio', 'radio button', 'play the radio edit of hey ya', 'local news', 'tv shows', 'internet radio stations'],
  match(lower, text) { return localAsk(text || lower) !== null; },
  run,
  suite() {
    const ok = localAsk('local radio').kind === 'radio' && localAsk('tv stations in denver').place === 'denver' && localAsk('local tv').kind === 'tv'
      && localAsk('what radio stations are near me').place === '' && localAsk('boston radio stations').place === 'boston' && localAsk('what is a radio') === null && localAsk('radio button') === null;
    return { ok, got: 'match works' };
  },
};
