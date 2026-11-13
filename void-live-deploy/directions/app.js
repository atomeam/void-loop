import { GEOCODER, geoOf, placeOf, routeOf, routeUrl } from '/lib/drive.js';
import { tripFields, tripLine } from '/lib/directions-page.js';

const from = document.querySelector('#from');
const to = document.querySelector('#to');
const out = document.querySelector('#out');
const err = document.querySelector('#err');

async function readJson(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('status');
  return r.json();
}

async function locate(raw) {
  const place = placeOf(raw);
  if (!place) return null;
  if (place.lat != null) return place;
  return geoOf(await readJson(GEOCODER + encodeURIComponent(place.name)), place.name);
}

function draw(trip) {
  out.replaceChildren();
  const h = document.createElement('h2');
  h.textContent = trip.from.name + ' to ' + trip.to.name;
  const p = document.createElement('p');
  p.textContent = tripLine(trip);
  out.append(h, p);
}

async function show(fields) {
  err.textContent = 'Looking…';
  out.replaceChildren();
  try {
    const [a, b] = await Promise.all([locate(fields.from), locate(fields.to)]);
    if (!a || !b) {
      err.textContent = (!a ? fields.from : fields.to) + ' is not on the map.';
      return;
    }
    const route = routeOf(await readJson(routeUrl(a, b)));
    if (!route) {
      err.textContent = 'No driving route between those places.';
      return;
    }
    err.textContent = '';
    draw({ ok: true, from: a, to: b, ...route });
  } catch (_) {
    err.textContent = 'The map did not answer just now. Try again in a moment.';
  }
}

document.querySelector('form').addEventListener('submit', (e) => {
  const fields = tripFields(from.value, to.value);
  if (!fields.ok) {
    e.preventDefault();
    err.textContent = fields.reason === 'long' ? 'That place name is too long.' : 'Type where you start and where you are going.';
    return;
  }
  from.value = fields.from;
  to.value = fields.to;
  const u = new URL(location.href);
  u.searchParams.set('from', fields.from);
  u.searchParams.set('to', fields.to);
  history.replaceState(null, '', u);
  e.preventDefault();
  show(fields);
});

const start = tripFields(new URLSearchParams(location.search).get('from') || '', new URLSearchParams(location.search).get('to') || '');
if (start.ok && !out.querySelector('h2')) {
  from.value = start.from;
  to.value = start.to;
  show(start);
}
