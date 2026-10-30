// /local/: the free channels beyond the local ones (owner, 2026-10-30: "also find all free channels worldwide and add", "keep local as the first
// options"). The local lists stay first; under each, this module lists the rest: the visitor's own country first, then any country, topic or
// name they pick. TV comes from /local/tv/world/ (tools/world-tv.mjs): one small index, then one file per country or topic, read only when it
// is picked, and names.json only when someone searches every country. Radio comes from /api/local?world (Radio Browser, a page at a time).
// Rows show PAGE at a time with a Show more button. Every stream plays through app.js's own player (playTv, playRadio), from its own server.
const PAGE = 50;
const RADIO_TOPICS = ['news', 'talk', 'music', 'pop', 'rock', 'jazz', 'classical', 'country', 'dance', 'electronic', 'hip hop', 'oldies', 'hits',
  'sports', 'public radio', 'culture', 'religion', 'christian', 'folk', 'world music', 'ambient', 'chillout', 'kids'];

/** the rows a TV list shows for a filter: a country file, a topic file or the search list, narrowed by topic and name. Pure. */
export function pickTv({ rows, topic = '', q = '' }) {
  const words = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((r) => (!topic || (r.c || []).includes(topic)) && words.every((w) => (r.t + ' ' + (r.n || '')).toLowerCase().includes(w)));
}
/** the countries in the order the picker lists them: the visitor's own first, then by name. Pure. */
export function countryOrder(countries, own) {
  return Object.entries(countries || {}).sort(([a, x], [b, y]) => (b === own) - (a === own) || x.name.localeCompare(y.name)).map(([cc, x]) => ({ cc, name: x.name, n: x.n }));
}

export function mountWorld({ el, getJson, host, playTv, playRadio, markPlaying, localRadio }) {
  const $ = (id) => document.getElementById(id);
  let own = '', index = null, names = null; const files = new Map();
  const langName = (() => { let D = null; try { D = new Intl.DisplayNames(['en'], { type: 'language' }); } catch (_) {} return (c) => { try { return (D && D.of(c)) || c; } catch (_) { return c; } }; })();
  const regionName = (() => { let D = null; try { D = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (_) {} return (c) => (index && index.countries[c] && index.countries[c].name) || (() => { try { return (D && D.of(c)) || c; } catch (_) { return c; } })(); })();
  const file = (p) => { if (!files.has(p)) files.set(p, getJson('/local/tv/world/' + p).catch((e) => { files.delete(p); throw e; })); return files.get(p); };

  // ---- the shared frame: a heading, three filters, a note, a list and a Show more button
  function frame(kind) {
    const country = el('select', { 'aria-label': 'Country' }), topic = el('select', { 'aria-label': 'Topic' });
    const q = el('input', { type: 'search', placeholder: kind === 'tv' ? 'Channel name' : 'Station name', 'aria-label': 'Name', maxLength: 60, autocomplete: 'off' });
    const note = el('p', { className: 'note' }), list = el('ul', { className: 'list' }), more = el('button', { type: 'button', textContent: 'Show more', hidden: true });
    const head = el('h2', { textContent: kind === 'tv' ? 'More TV channels' : 'More radio stations' });
    const form = el('form', { className: 'box world-filters', role: 'search' }, country, topic, q, el('button', { type: 'submit', textContent: 'Show' }));
    $(kind + '-world').replaceChildren(head, el('p', { className: 'hint', textContent: kind === 'tv' ? 'Free channels from your country first, then any country or topic, from the open iptv-org list. Only channels with a stream that plays here are listed.' : 'Stations from your country first, then any country or topic, from Radio Browser. Only stations that play here are listed.' }), form, note, list, more);
    return { head, country, topic, q, note, list, more, form };
  }
  const tvf = frame('tv'), rf = frame('radio');
  const fill = (sel, opts) => { const keep = sel.value; sel.replaceChildren(...opts.map(([v, t]) => el('option', { value: v, textContent: t }))); if (opts.some(([v]) => v === keep)) sel.value = keep; };
  const countryOpts = (any, withOwn) => {
    const list = countryOrder(index ? index.countries : {}, own).map((c) => [c.cc, c.name + (c.cc === own ? ' (yours)' : '')]);
    if (withOwn && own && !list.some(([v]) => v === own)) list.unshift([own, regionName(own) + ' (yours)']); // radio reaches countries the TV list has none for
    return [['', any], ...list];
  };

  // ---- TV
  let tvRows = [], tvShown = 0, tvToken = 0;
  function tvRow(r) {
    const g = { t: r.t }, s = { n: r.n || '', w: r.w || '', s: r.s || [] };
    const sub = [r.n, (r.c || []).join(', '), r.cc ? regionName(r.cc) : '', (r.l || []).slice(0, 2).map(langName).join(', ')].filter(Boolean).join(' · ');
    return el('li', { dataset: { id: r.t, kind: 'tv' } },
      el('div', { className: 'st' }, el('span', { className: 'ph', textContent: '📺' }), el('div', {}, el('b', { textContent: r.t }), el('small', { textContent: sub }))),
      el('div', { className: 'acts' }, el('button', { type: 'button', className: 'go', textContent: 'Play', onclick: () => playFromRow(r, g, s) }),
        r.w ? el('a', { className: 'btn', href: r.w, target: '_blank', rel: 'noopener', textContent: host(r.w) || 'Site' }) : null));
  }
  // a search row (names.json) has no streams yet: its country's file holds them
  async function playFromRow(r, g, s) {
    if (s.s.length) { playTv(g, s); return; }
    try { const f = await file(r.cc + '.json'); const full = f.channels.find((x) => x.id === r.id); if (full) playTv({ t: full.t }, { n: full.n || '', w: full.w || '', s: full.s }); } catch (_) { tvf.note.className = 'note bad'; tvf.note.textContent = 'That channel did not load just now. Try again in a minute.'; }
  }
  function drawTv(append) {
    const next = tvRows.slice(tvShown, tvShown + PAGE); tvShown += next.length;
    if (append) tvf.list.append(...next.map(tvRow)); else tvf.list.replaceChildren(...next.map(tvRow));
    tvf.more.hidden = tvShown >= tvRows.length; markPlaying();
  }
  async function loadTv() {
    const token = ++tvToken, cc = tvf.country.value, topic = tvf.topic.value, q = tvf.q.value.trim(); tvf.note.className = 'note';
    if (!cc && !topic && !q) { tvRows = []; tvShown = 0; drawTv(); tvf.note.textContent = 'Pick a country or a topic, or type a channel name.'; return; }
    tvf.note.textContent = 'Finding channels…';
    try {
      let rows;
      if (cc) rows = (await file(cc + '.json')).channels.map((r) => ({ ...r, cc }));
      else if (topic) rows = (await file('topic/' + topic + '.json')).channels;
      else { names = names || await file('names.json'); rows = names.map(([id, t, n, c]) => ({ id, t, n, cc: c })); }
      if (token !== tvToken) return;
      tvRows = pickTv({ rows, topic, q }); tvShown = 0; drawTv();
      const where = [cc ? regionName(cc) : 'every country', topic && index.topics[topic] ? index.topics[topic].name.toLowerCase() : ''].filter(Boolean).join(', ');
      tvf.note.textContent = tvRows.length ? tvRows.length + ' channel' + (tvRows.length === 1 ? '' : 's') + ' (' + where + (q ? ', named "' + q + '"' : '') + ') with a free stream that plays here.' : 'No channel with a stream that plays here matches that.';
    } catch (_) { if (token === tvToken) { tvf.note.className = 'note bad'; tvf.note.textContent = 'The channel list did not load just now. Try again in a minute.'; } }
  }
  tvf.more.addEventListener('click', () => drawTv(true));
  tvf.form.addEventListener('submit', (e) => { e.preventDefault(); loadTv(); });
  tvf.country.addEventListener('change', loadTv); tvf.topic.addEventListener('change', loadTv);

  // ---- radio
  let rNext = null, rToken = 0, rSeen = new Set();
  function radioRow(r) {
    const sub = [r.tags.join(', '), [r.codec, r.kbps ? r.kbps + ' kbps' : ''].filter(Boolean).join(' '), r.where].filter(Boolean).join(' · ');
    return el('li', { dataset: { id: r.id, kind: 'radio' } },
      el('div', { className: 'st' }, r.icon ? el('img', { src: r.icon, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer', onerror() { this.replaceWith(el('span', { className: 'ph', textContent: '📻' })); } }) : el('span', { className: 'ph', textContent: '📻' }),
        el('div', {}, el('b', { textContent: r.name }), el('small', { textContent: sub }))),
      el('div', { className: 'acts' }, el('button', { type: 'button', className: 'go', textContent: 'Play', onclick: () => playRadio(r) }),
        r.home ? el('a', { className: 'btn', href: r.home, target: '_blank', rel: 'noopener', textContent: host(r.home) || 'Station site' }) : null));
  }
  async function loadRadio(append) {
    const token = append ? rToken : ++rToken, cc = rf.country.value, tag = rf.topic.value, q = rf.q.value.trim(); rf.note.className = 'note';
    if (!append) { rf.list.replaceChildren(); rNext = 0; rSeen = new Set((localRadio() || []).map((r) => r.id)); }
    if (rNext == null) return;
    rf.more.disabled = true; if (!append) rf.note.textContent = 'Finding stations…';
    try {
      const p = new URLSearchParams({ world: '', offset: String(rNext) }); if (cc) p.set('country', cc); if (tag) p.set('tag', tag); if (q) p.set('q', q);
      const j = await getJson('/api/local?' + p); if (token !== rToken) return; if (!j.ok) throw new Error(j.say);
      const fresh = (j.stations || []).filter((r) => !rSeen.has(r.id)); fresh.forEach((r) => rSeen.add(r.id));
      rf.list.append(...fresh.map(radioRow)); rNext = j.next; rf.more.hidden = j.next == null; markPlaying();
      const n = rf.list.children.length, where = [cc ? regionName(cc) : 'every country', tag].filter(Boolean).join(', ');
      rf.note.textContent = n ? n + ' station' + (n === 1 ? '' : 's') + ' (' + where + (q ? ', named "' + q + '"' : '') + ') that play here, most listened first' + (j.next != null ? '; more below.' : '.') : 'No station that plays here matches that.';
    } catch (_) { if (token === rToken) { rf.note.className = 'note bad'; rf.note.textContent = 'The radio directory did not answer just now. Try again in a minute.'; } }
    rf.more.disabled = false;
  }
  rf.more.addEventListener('click', () => loadRadio(true));
  rf.form.addEventListener('submit', (e) => { e.preventDefault(); loadRadio(); });
  rf.country.addEventListener('change', () => loadRadio()); rf.topic.addEventListener('change', () => loadRadio());
  fill(rf.topic, [['', 'Any topic'], ...RADIO_TOPICS.map((t) => [t, t[0].toUpperCase() + t.slice(1)])]);

  // ---- the start: the small index, then the visitor's own country in both lists
  const ready = getJson('/local/tv/world/index.json').then((j) => { index = j; }).catch(() => { tvf.note.className = 'note bad'; tvf.note.textContent = 'The channel list did not load just now. Try again in a minute.'; });
  async function setCountry(cc) {
    own = /^[A-Z]{2}$/.test(String(cc || '').toUpperCase()) ? String(cc).toUpperCase() : '';
    await ready;
    fill(tvf.country, countryOpts('Any country')); fill(rf.country, countryOpts('Any country', true));
    if (index) fill(tvf.topic, [['', 'Any topic'], ...Object.entries(index.topics).map(([k, x]) => [k, x.name + ' (' + x.n + ')'])]);
    tvf.country.value = index && index.countries[own] ? own : ''; rf.country.value = own && [...rf.country.options].some((o) => o.value === own) ? own : '';
    tvf.head.textContent = own && index && index.countries[own] ? 'More TV channels, starting with ' + regionName(own) : 'More TV channels';
    rf.head.textContent = own ? 'More radio stations, starting with ' + regionName(own) : 'More radio stations';
    loadTv(); loadRadio();
  }
  return { setCountry };
}
