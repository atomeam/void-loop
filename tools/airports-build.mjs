// Builds void-live-deploy/flights/airports.json, the compact airport index of the flights pages (owner, 2026-10-26: "need a flights page"), from OurAirports' open
// data (https://ourairports.com/data/, public domain: airports.csv and countries.csv). Only airports with an IATA code and scheduled service are kept (about 4,000), as
// small arrays so the whole index is a file the page reads once and keeps offline. OurAirports has no time zone, so each airport's IANA zone is worked out here
// from its country, its region (US states, Canadian provinces, Australian states, Brazilian and Mexican states) and, where a country spans several zones, its
// longitude (`approx` marks those; the page says so). Nothing else is stored; no key is needed.
//   node tools/airports-build.mjs <airports.csv> <countries.csv>      write the index
// The file is committed; the script is how it is made again. Test: tools/flights.test.mjs.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const ZONE = Object.fromEntries(('AE Asia/Dubai|AF Asia/Kabul|AG America/Antigua|AI America/Anguilla|AL Europe/Tirane|AM Asia/Yerevan|AO Africa/Luanda|AR America/Argentina/Buenos_Aires|AS Pacific/Pago_Pago|AT Europe/Vienna|AW America/Aruba|AZ Asia/Baku|BA Europe/Sarajevo|BB America/Barbados|BD Asia/Dhaka|BE Europe/Brussels|BF Africa/Ouagadougou|BG Europe/Sofia|BH Asia/Bahrain|BI Africa/Bujumbura|BJ Africa/Porto-Novo|BL America/St_Barthelemy|BM Atlantic/Bermuda|BN Asia/Brunei|BO America/La_Paz|BQ America/Kralendijk|BS America/Nassau|BT Asia/Thimphu|BW Africa/Gaborone|BY Europe/Minsk|BZ America/Belize|CC Indian/Cocos|CF Africa/Bangui|CG Africa/Brazzaville|CH Europe/Zurich|CI Africa/Abidjan|CK Pacific/Rarotonga|CM Africa/Douala|CN Asia/Shanghai|CO America/Bogota|CR America/Costa_Rica|CU America/Havana|CV Atlantic/Cape_Verde|CW America/Curacao|CX Indian/Christmas|CY Asia/Nicosia|CZ Europe/Prague|DE Europe/Berlin|DJ Africa/Djibouti|DK Europe/Copenhagen|DM America/Dominica|DO America/Santo_Domingo|DZ Africa/Algiers|EE Europe/Tallinn|EG Africa/Cairo|EH Africa/El_Aaiun|ER Africa/Asmara|ET Africa/Addis_Ababa|FI Europe/Helsinki|FJ Pacific/Fiji|FK Atlantic/Stanley|FO Atlantic/Faroe|FR Europe/Paris|GA Africa/Libreville|GB Europe/London|GD America/Grenada|GE Asia/Tbilisi|GF America/Cayenne|GG Europe/Guernsey|GH Africa/Accra|GI Europe/Gibraltar|GM Africa/Banjul|GN Africa/Conakry|GP America/Guadeloupe|GQ Africa/Malabo|GR Europe/Athens|GT America/Guatemala|GU Pacific/Guam|GW Africa/Bissau|GY America/Guyana|HK Asia/Hong_Kong|HN America/Tegucigalpa|HR Europe/Zagreb|HT America/Port-au-Prince|HU Europe/Budapest|IE Europe/Dublin|IL Asia/Jerusalem|IM Europe/Isle_of_Man|IN Asia/Kolkata|IQ Asia/Baghdad|IR Asia/Tehran|IS Atlantic/Reykjavik|IT Europe/Rome|JE Europe/Jersey|JM America/Jamaica|JO Asia/Amman|JP Asia/Tokyo|KE Africa/Nairobi|KG Asia/Bishkek|KH Asia/Phnom_Penh|KM Indian/Comoro|KN America/St_Kitts|KP Asia/Pyongyang|KR Asia/Seoul|KW Asia/Kuwait|KY America/Cayman|KZ Asia/Almaty|LA Asia/Vientiane|LB Asia/Beirut|LC America/St_Lucia|LK Asia/Colombo|LR Africa/Monrovia|LS Africa/Maseru|LT Europe/Vilnius|LU Europe/Luxembourg|LV Europe/Riga|LY Africa/Tripoli|MA Africa/Casablanca|MD Europe/Chisinau|ME Europe/Podgorica|MF America/Marigot|MG Indian/Antananarivo|MH Pacific/Majuro|MK Europe/Skopje|ML Africa/Bamako|MM Asia/Yangon|MO Asia/Macau|MP Pacific/Saipan|MQ America/Martinique|MR Africa/Nouakchott|MS America/Montserrat|MT Europe/Malta|MU Indian/Mauritius|MV Indian/Maldives|MW Africa/Blantyre|MY Asia/Kuala_Lumpur|MZ Africa/Maputo|NA Africa/Windhoek|NC Pacific/Noumea|NE Africa/Niamey|NF Pacific/Norfolk|NG Africa/Lagos|NI America/Managua|NL Europe/Amsterdam|NO Europe/Oslo|NP Asia/Kathmandu|NR Pacific/Nauru|NU Pacific/Niue|OM Asia/Muscat|PA America/Panama|PE America/Lima|PH Asia/Manila|PK Asia/Karachi|PL Europe/Warsaw|PM America/Miquelon|PR America/Puerto_Rico|PW Pacific/Palau|PY America/Asuncion|QA Asia/Qatar|RE Indian/Reunion|RO Europe/Bucharest|RS Europe/Belgrade|RW Africa/Kigali|SA Asia/Riyadh|SB Pacific/Guadalcanal|SC Indian/Mahe|SD Africa/Khartoum|SE Europe/Stockholm|SG Asia/Singapore|SH Atlantic/St_Helena|SI Europe/Ljubljana|SK Europe/Bratislava|SL Africa/Freetown|SN Africa/Dakar|SO Africa/Mogadishu|SR America/Paramaribo|SS Africa/Juba|ST Africa/Sao_Tome|SV America/El_Salvador|SX America/Lower_Princes|SY Asia/Damascus|SZ Africa/Mbabane|TC America/Grand_Turk|TD Africa/Ndjamena|TG Africa/Lome|TH Asia/Bangkok|TJ Asia/Dushanbe|TL Asia/Dili|TM Asia/Ashgabat|TN Africa/Tunis|TO Pacific/Tongatapu|TR Europe/Istanbul|TT America/Port_of_Spain|TV Pacific/Funafuti|TW Asia/Taipei|TZ Africa/Dar_es_Salaam|UG Africa/Kampala|UM Pacific/Wake|UY America/Montevideo|UZ Asia/Tashkent|VC America/St_Vincent|VE America/Caracas|VG America/Tortola|VI America/St_Thomas|VN Asia/Ho_Chi_Minh|VU Pacific/Efate|WF Pacific/Wallis|WS Pacific/Apia|XK Europe/Belgrade|YE Asia/Aden|YT Indian/Mayotte|ZA Africa/Johannesburg|ZM Africa/Lusaka|ZW Africa/Harare').split('|').map((x) => x.split(' ')));
// US state -> zone (the few states split by a zone line are settled by longitude below)
const US = { AL: 'C', AK: 'America/Anchorage', AZ: 'America/Phoenix', AR: 'C', CA: 'P', CO: 'M', CT: 'E', DE: 'E', DC: 'E', FL: 'E', GA: 'E', HI: 'Pacific/Honolulu', ID: 'M', IL: 'C', IN: 'E', IA: 'C', KS: 'C', KY: 'E', LA: 'C', ME: 'E', MD: 'E', MA: 'E', MI: 'E', MN: 'C', MS: 'C', MO: 'C', MT: 'M', NE: 'C', NV: 'P', NH: 'E', NJ: 'E', NM: 'M', NY: 'E', NC: 'E', ND: 'C', OH: 'E', OK: 'C', OR: 'P', PA: 'E', RI: 'E', SC: 'E', SD: 'C', TN: 'C', TX: 'C', UT: 'M', VT: 'E', VA: 'E', WA: 'P', WV: 'E', WI: 'C', WY: 'M' };
const USZ = { E: 'America/New_York', C: 'America/Chicago', M: 'America/Denver', P: 'America/Los_Angeles' };
const CA = { BC: 'America/Vancouver', AB: 'America/Edmonton', SK: 'America/Regina', MB: 'America/Winnipeg', ON: 'America/Toronto', QC: 'America/Toronto', NB: 'America/Halifax', NS: 'America/Halifax', PE: 'America/Halifax', NL: 'America/St_Johns', NT: 'America/Edmonton', YT: 'America/Whitehorse' };
const AU = { NSW: 'Australia/Sydney', VIC: 'Australia/Melbourne', QLD: 'Australia/Brisbane', SA: 'Australia/Adelaide', WA: 'Australia/Perth', TAS: 'Australia/Hobart', NT: 'Australia/Darwin', ACT: 'Australia/Sydney' };
const BR = { AC: 'America/Rio_Branco', AM: 'America/Manaus', RO: 'America/Porto_Velho', RR: 'America/Boa_Vista', MT: 'America/Cuiaba', MS: 'America/Campo_Grande' };

/** [IANA zone, approx] for an airport; approx is true when a country with several zones was settled by position alone. Pure. */
export function zoneOf(cc, region, lat, lon) {
  const st = String(region || '').split('-')[1] || '';
  switch (cc) {
    case 'US': {
      const z = US[st]; if (!z) return ['America/New_York', true];
      if (z.length > 1) return [z, false];
      let k = z;
      if (st === 'FL' && lon < -85) k = 'C'; if (st === 'ID' && lat > 45.6) k = 'P'; if (st === 'KS' && lon < -101.4) k = 'M'; if (st === 'KY' && lon < -85.4) k = 'C';
      if (st === 'IN' && lon < -86.9) k = 'C'; if (st === 'MI' && lon < -87.5) k = 'C'; if (st === 'NE' && lon < -101) k = 'M'; if (st === 'ND' && lon < -100.9) k = 'M';
      if (st === 'OR' && lon > -117.4) k = 'M'; if (st === 'SD' && lon < -100.4) k = 'M'; if (st === 'TN' && lon > -85.4) k = 'E'; if (st === 'TX' && lon < -104) k = 'M';
      return [USZ[k], false];
    }
    case 'CA': {
      if (st === 'NU') return [lon > -85 ? 'America/Toronto' : lon > -102 ? 'America/Winnipeg' : 'America/Edmonton', true];
      if (st === 'NL' && lat > 52 && lon > -61.5) return ['America/Halifax', false]; if (st === 'ON' && lon < -89.6) return ['America/Winnipeg', false];
      if (st === 'QC' && lon > -63.5 && lat > 49.5) return ['America/Halifax', false]; if (st === 'BC' && lon > -121 && lat > 54) return ['America/Edmonton', false];
      return [CA[st] || 'America/Toronto', !CA[st]];
    }
    case 'AU': return [lat < -31 && lon > 141 && lon < 142 && st === 'NSW' ? 'Australia/Broken_Hill' : AU[st] || 'Australia/Sydney', !AU[st]];
    case 'BR': { if (lon > -33) return ['America/Noronha', false]; if (st === 'AM' && lon < -69) return ['America/Rio_Branco', false]; return [BR[st] || 'America/Sao_Paulo', false]; }
    case 'MX': {
      if (st === 'BCN') return ['America/Tijuana', false]; if (st === 'BCS' || st === 'SIN' || st === 'NAY') return ['America/Mazatlan', false]; if (st === 'SON') return ['America/Hermosillo', false];
      if (st === 'ROO') return ['America/Cancun', false]; return ['America/Mexico_City', false];
    }
    case 'RU': {
      if (lon < 27) return ['Europe/Kaliningrad', true]; if (lat > 58 && lon > 147 && lon < 162) return ['Asia/Magadan', true];
      if (lon < 45.5) return ['Europe/Moscow', true]; if (lon < 54) return ['Europe/Samara', true]; if (lon < 69) return ['Asia/Yekaterinburg', true]; if (lon < 79) return ['Asia/Omsk', true];
      if (lon < 99) return ['Asia/Krasnoyarsk', true]; if (lon < 112) return ['Asia/Irkutsk', true]; if (lon < 130.8) return ['Asia/Yakutsk', true];
      if (lon < 141) return ['Asia/Vladivostok', true]; if (lon < 150 && lat > 46 && lat < 55 && lon > 141) return ['Asia/Sakhalin', true]; if (lon < 158) return ['Asia/Vladivostok', true]; return ['Asia/Kamchatka', true];
    }
    case 'ID': return [lon < 114 ? 'Asia/Jakarta' : lon < 125 ? 'Asia/Makassar' : 'Asia/Jayapura', false];
    case 'MN': return [lon < 96 ? 'Asia/Hovd' : 'Asia/Ulaanbaatar', false];
    case 'CD': return [lon > 22 ? 'Africa/Lubumbashi' : 'Africa/Kinshasa', true];
    case 'GL': return [lat > 76 ? 'America/Thule' : lon > -30 ? 'America/Scoresbysund' : 'America/Nuuk', false];
    case 'PT': return [lon < -24.5 ? 'Atlantic/Azores' : lon < -16 ? 'Atlantic/Madeira' : 'Europe/Lisbon', false];
    case 'ES': return [lon < -13 ? 'Atlantic/Canary' : 'Europe/Madrid', false];
    case 'EC': return [lon < -85 ? 'Pacific/Galapagos' : 'America/Guayaquil', false];
    case 'CL': return [lon < -100 ? 'Pacific/Easter' : lat < -52 ? 'America/Punta_Arenas' : 'America/Santiago', false];
    case 'NZ': return [lon < -170 ? 'Pacific/Chatham' : 'Pacific/Auckland', false];
    case 'PF': return [lon < -138 && lat > -12 ? 'Pacific/Marquesas' : 'Pacific/Tahiti', false];
    case 'KI': return [lon < -150 ? 'Pacific/Kiritimati' : lon < 0 ? 'Pacific/Kanton' : 'Pacific/Tarawa', false];
    case 'FM': return [lon > 162.5 ? 'Pacific/Kosrae' : lon > 157 ? 'Pacific/Pohnpei' : 'Pacific/Chuuk', false];
    case 'PG': return [lon > 154.5 ? 'Pacific/Bougainville' : 'Pacific/Port_Moresby', false];
    default: return [ZONE[cc] || 'UTC', !ZONE[cc]];
  }
}
export const SIZE = { large_airport: 2, medium_airport: 1, small_airport: 0 };

/** one CSV text into rows of objects (quoted fields, doubled quotes, newlines inside quotes). Pure. */
export function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f); f = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; } else if (c !== '\r') f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift() || []; return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] == null ? '' : r[i]])));
}
/** the index from the two CSV texts. Pure. */
export function build(airportsCsv, countriesCsv) {
  const names = Object.fromEntries(parseCsv(countriesCsv).map((c) => [c.code, c.name])), tzs = [], tzIx = new Map(), a = [];
  for (const r of parseCsv(airportsCsv)) {
    if (!r.iata_code || r.scheduled_service !== 'yes' || !(r.type in SIZE)) continue;
    const lat = +r.latitude_deg, lon = +r.longitude_deg; if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const [tz, approx] = zoneOf(r.iso_country, r.iso_region, lat, lon); if (!tzIx.has(tz)) { tzIx.set(tz, tzs.length); tzs.push(tz); }
    a.push([r.iata_code, r.icao_code || r.ident, r.name, r.municipality || r.name, r.iso_country, Math.round(lat * 1e4) / 1e4, Math.round(lon * 1e4) / 1e4, tzIx.get(tz), SIZE[r.type] + (approx ? 4 : 0)]);
  }
  a.sort((x, y) => (y[8] & 3) - (x[8] & 3) || x[0].localeCompare(y[0]));
  const cc = {}; for (const r of a) cc[r[4]] = names[r[4]] || r[4];
  return { v: 1, source: 'OurAirports (ourairports.com/data), public domain', fields: ['iata', 'icao', 'name', 'city', 'country', 'lat', 'lon', 'tz', 'size+4 if the zone is approximate'], tz: tzs, countries: cc, a };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [ap, co] = process.argv.slice(2); if (!ap || !co) { console.error('usage: node tools/airports-build.mjs airports.csv countries.csv'); process.exit(2); }
  const out = build(fs.readFileSync(ap, 'utf8'), fs.readFileSync(co, 'utf8'));
  const dest = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'flights', 'airports.json'); fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out)); console.log('wrote ' + out.a.length + ' airports, ' + out.tz.length + ' zones, ' + (fs.statSync(dest).size / 1024 | 0) + ' KB');
}
