// Starboard (a-to-mind.com/starboard/): the race measured live, the weather, the news wire and the hand-offs. Same-origin only.
  import { mountRelated } from '/lib/toolkit.js';
  import { both, words } from '/lib/weather.js';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const kb = (b) => (Number.isFinite(b) ? (b >= 1048576 ? (b / 1048576).toFixed(2) + ' MB' : Math.round(b / 1024) + ' KB') : 'not measured');
  const store = { get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private window */ } } };
  let topStory = null, shownPlace = '';

  // the race: both rows come from /api/sitebench, measured when the page asks; a number it did not measure shows as not measured
  async function race(fresh) {
    const body = $('bench').tBodies[0];
    try {
      const r = await fetch('/api/sitebench?site=dalyfeds.com' + (fresh ? '&fresh=' + Date.now() : ''), { cache: fresh ? 'no-store' : 'default' });
      const j = await r.json();
      const rows = (j && j.rows) || [];
      const best = (k) => { const v = rows.filter((x) => x && x.ok && Number.isFinite(x[k])).map((x) => x[k]); return v.length > 1 ? Math.min(...v) : null; };
      const lo = { ms: best('ms'), bytes: best('bytes'), requests: best('requests'), scripts: best('scripts'), tp: best('third_party_count') };
      body.innerHTML = rows.map((x) => {
        if (!x || !x.ok) return '<tr><td>' + esc(x && x.name) + '</td><td colspan="5" class="note">Could not be measured now' + (x && x.error ? ': ' + esc(x.error) : '') + '</td></tr>';
        const cell = (v, k, txt) => '<td class="n' + (lo[k] != null && v === lo[k] ? ' win' : '') + '">' + txt + '</td>';
        const tp = (x.third_party || []).length; x.third_party_count = tp;
        return '<tr><td>' + esc(x.name) + '</td>' + cell(x.ms, 'ms', x.ms + ' ms') + cell(x.bytes, 'bytes', kb(x.bytes)) + cell(x.requests, 'requests', x.requests) + cell(x.scripts, 'scripts', x.scripts)
          + '<td class="n">' + (tp ? tp + ': ' + esc(x.third_party.join(', ')) : '0') + '</td></tr>';
      }).join('') || '<tr><td colspan="6" class="note">No rows came back.</td></tr>';
      $('benchHow').textContent = j && j.at ? 'Measured ' + new Date(j.at).toLocaleString() + ', ' + (j.how || '') + (r.headers.get('x-bench') === 'cached' ? ' (the last 10 minutes\' result)' : '') + '.' : '';
    } catch (_) { body.innerHTML = '<tr><td colspan="6" class="note">The benchmark did not answer. Try Load the latest.</td></tr>'; }
  }
  // the Tower's own rendered run of dalyfeds.com, with its date (tower.size.json, written by tools/tower-size.mjs on the runner)
  fetch('/tower.size.json').then((r) => r.json()).then((d) => { const s = d && d.sites && d.sites['dalyfeds.com']; if (!s) return;
    $('runner').hidden = false; $('runner').textContent = 'The Tower\'s browser run of dalyfeds.com on ' + s.at + ': ' + kb(s.bytes) + ', ' + s.scripts + ' scripts, ' + s.controls + ' controls on the page.'; }).catch(() => {});
  $('rerun').addEventListener('click', () => race(true));
  race(false);

  // weather: Verse's own /api/weather; the place is kept on this device only
  async function weather(place) {
    place = String(place || '').trim(); if (!place) return;
    $('wxNote').textContent = 'Looking up ' + place + '…';
    try {
      const j = await (await fetch('/api/weather?q=' + encodeURIComponent(place))).json();
      const c = j && j.ok && j.w && j.w.current; if (!c) throw new Error('none');
      shownPlace = (j.loc && j.loc.name) || place; store.set('starboard_place', place);
      $('wxTemp').textContent = both(c.temperature_2m); $('wxWords').textContent = words(c.weather_code) + ' in ' + shownPlace;
      $('wxMore').textContent = 'Feels like ' + both(c.apparent_temperature) + '.';
      $('wx').hidden = false; $('wxNote').innerHTML = '<a href="/weather/?q=' + encodeURIComponent(shownPlace) + '">The next 24 hours and 7 days for ' + esc(shownPlace) + '</a>';
    } catch (_) { $('wx').hidden = true; $('wxNote').textContent = 'No forecast found for ' + place + '.'; }
  }
  $('wxForm').addEventListener('submit', (e) => { e.preventDefault(); weather($('place').value); });
  const q = new URLSearchParams(location.search).get('place') || store.get('starboard_place');
  if (q) { $('place').value = q; weather(q); }

  // news wire: Verse's own /api/news, the top 8 stories
  fetch('/api/news?sec=top&lang=en').then((r) => r.json()).then((j) => {
    const s = ((j && j.stories) || []).filter((x) => x && x.title && /^https?:\/\//.test(x.link || '')).slice(0, 8); topStory = s[0] || null;
    $('wire').innerHTML = s.length ? s.map((x) => '<li><a href="' + esc(x.link) + '" rel="noopener">' + esc(x.title) + '</a> <small>' + esc(x.src || '') + '</small></li>').join('') : '<li class="note">No stories came back just now.</li>';
  }).catch(() => { $('wire').innerHTML = '<li class="note">The news wire did not answer.</li>'; });

  mountRelated($('related'), '/starboard/', [
    { label: 'Full forecast for this place', href: () => (shownPlace ? '/weather/?q=' + encodeURIComponent(shownPlace) : null) },
    { label: 'The time in this place', href: () => (shownPlace ? '/time/?c=' + encodeURIComponent(shownPlace.split(',')[0]) : null) },
    { label: 'Translate the top headline', href: () => (topStory ? '/translate/?q=' + encodeURIComponent(topStory.title) + '&to=es' : null) },
  ]);
