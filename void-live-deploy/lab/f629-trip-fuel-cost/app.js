const $ = id => document.getElementById(id);
const KEY = 'verse-f629-fuel';
const MI_KM = 1.609344;
const GAL_L = 3.785411784;

function load() {
  try {
    const h = location.hash.slice(1);
    if (h) {
      const p = new URLSearchParams(h);
      ['dist','eff','price','people','name'].forEach(k => { if (p.has(k)) $(k).value = p.get(k); });
      ['distUnit','effUnit','priceUnit','round'].forEach(k => { if (p.has(k)) $(k).value = p.get(k); });
    } else {
      const s = localStorage.getItem(KEY);
      if (s) {
        const d = JSON.parse(s);
        Object.keys(d).forEach(k => { if ($(k)) $(k).value = d[k]; });
      }
    }
  } catch (e) { console.debug("lab f629-trip-fuel-cost:", e); }
  calc();
}

function save() {
  const d = {
    dist: $('dist').value, distUnit: $('distUnit').value,
    eff: $('eff').value, effUnit: $('effUnit').value,
    price: $('price').value, priceUnit: $('priceUnit').value,
    people: $('people').value, round: $('round').value,
    name: $('name').value
  };
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { console.debug("lab f629-trip-fuel-cost:", e); }
  const p = new URLSearchParams(d);
  history.replaceState(null, '', '#' + p.toString());
}

function toMiles(dist, unit) { return unit === 'km' ? dist / MI_KM : dist; }
function toGallons(volL) { return volL / GAL_L; }

function calc() {
  const dist = +$('dist').value || 0;
  const du = $('distUnit').value;
  const eff = +$('eff').value || 0;
  const eu = $('effUnit').value;
  const price = +$('price').value || 0;
  const pu = $('priceUnit').value;
  const people = Math.max(1, +$('people').value || 1);
  const rt = $('round').value === '1';
  const name = $('name').value.trim();

  let note = '';
  if (dist <= 0 || eff <= 0 || price <= 0) {
    note = 'Enter positive distance, fuel use and price.';
  }

  const miles = toMiles(dist, du) * (rt ? 2 : 1);
  let gallons = 0;
  if (eu === 'mpg') gallons = miles / eff;
  else if (eu === 'kml') gallons = (miles / MI_KM) / eff / GAL_L;
  else { // L/100km
    const km = miles * MI_KM;
    gallons = (km / 100 * eff) / GAL_L;
  }
  const liters = gallons * GAL_L;
  const pricePerGal = pu === 'l' ? price * GAL_L : price;
  const total = gallons * pricePerGal;
  const each = total / people;

  const summary = [
    name ? name + ': ' : '',
    dist.toFixed(1) + ' ' + (du === 'mi' ? 'mi' : 'km') + (rt ? ' (round trip)' : ''),
    ' at ' + eff + ' ' + (eu === 'mpg' ? 'mpg' : eu === 'l100' ? 'L/100km' : 'km/L'),
    ', $' + price.toFixed(2) + '/' + (pu === 'gal' ? 'gal' : 'L'),
    ' → ' + (note ? '—' : gallons.toFixed(2) + ' gal / ' + liters.toFixed(1) + ' L'),
    note ? '' : ', $' + total.toFixed(2) + ' total',
    note ? '' : ', $' + each.toFixed(2) + ' each for ' + people
  ].join('');

  $('out').innerHTML = note
    ? '<span style="color:#f4212e">' + note + '</span>'
    : '<strong>$' + total.toFixed(2) + '</strong> total · <strong>$' + each.toFixed(2) + '</strong> each · ' + gallons.toFixed(2) + ' gal (' + liters.toFixed(1) + ' L)';

  draw(miles, gallons, total, note);
  save();
  window._summary = summary;
  window._data = { name, dist, du, eff, eu, price, pu, people, rt, gallons, liters, total, each, summary };
}

function draw(miles, gallons, total, note) {
  const c = $('dash');
  const ctx = c.getContext('2d');
  const w = c.width, h = c.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#15202b';
  ctx.fillRect(0, 0, w, h);

  // Road
  ctx.strokeStyle = '#38444d';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(40, 140);
  ctx.lineTo(w - 40, 140);
  ctx.stroke();
  // Car marker
  const maxM = Math.max(miles, 100);
  const x = 40 + (miles / maxM) * (w - 80);
  ctx.fillStyle = '#1d9bf0';
  ctx.beginPath();
  ctx.arc(x, 140, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '12px system-ui';
  ctx.fillText(miles.toFixed(0) + ' mi', x - 18, 125);

  // Fuel gauge arc
  const cx = 160, cy = 70, r = 40;
  ctx.strokeStyle = '#38444d';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25);
  ctx.stroke();
  const pct = Math.min(1, gallons / Math.max(gallons, 10));
  ctx.strokeStyle = '#00ba7c';
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 0.75 + pct * Math.PI * 1.5);
  ctx.stroke();
  ctx.fillStyle = '#e7e9ea';
  ctx.font = 'bold 14px system-ui';
  ctx.fillText(note ? '—' : gallons.toFixed(1) + ' gal', cx - 28, cy + 5);

  // Cost bar
  ctx.fillStyle = '#38444d';
  ctx.fillRect(320, 50, 200, 20);
  const barW = Math.min(200, (total / Math.max(total, 50)) * 200);
  ctx.fillStyle = '#1d9bf0';
  ctx.fillRect(320, 50, barW, 20);
  ctx.fillStyle = '#e7e9ea';
  ctx.fillText(note ? '—' : '$' + total.toFixed(0), 330, 65);
}

['dist','eff','price','people','name','distUnit','effUnit','priceUnit','round'].forEach(id => {
  $(id).addEventListener('input', calc);
  $(id).addEventListener('change', calc);
});

$('copy').onclick = () => {
  navigator.clipboard.writeText(window._summary || '').then(() => {
    const t = $('toast');
    t.textContent = 'Copied';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1500);
  });
};

function download(ext, content, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = (window._data.name || 'trip-fuel') + '.' + ext;
  a.click();
  URL.revokeObjectURL(a.href);
}

$('txt').onclick = () => download('txt', window._summary || '', 'text/plain');
$('csv').onclick = () => {
  const d = window._data;
  const csv = 'name,distance,unit,efficiency,effUnit,price,priceUnit,people,roundTrip,gallons,liters,total,each\n' +
    [d.name, d.dist, d.du, d.eff, d.eu, d.price, d.pu, d.people, d.rt, d.gallons.toFixed(3), d.liters.toFixed(2), d.total.toFixed(2), d.each.toFixed(2)].join(',');
  download('csv', csv, 'text/csv');
};

load();
