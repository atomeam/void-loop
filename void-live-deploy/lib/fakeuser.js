/**
 * fakeuser: made-up people for testing a form, a database or a design (owner, 2026-10-24: "find the site to conquer and get to work now"; the
 * tower's frontier ranked randomuser.me, Tranco 66,893: an API of random people by count, gender and nationality, with a seed, chosen fields,
 * and JSON, CSV, YAML or XML). Here the same, worked out on the device from a seed (the same seed gives the same people, always), plus SQL
 * inserts, and contact details that cannot reach anyone where a reserved range exists: every email is at example.com (RFC 2606, reserved for
 * examples); US numbers are in 555-0100..0199, UK numbers in Ofcom's 07700 900xxx drama range and French ones in 01 99 00 (ranges reserved for
 * fiction); other countries have no such range that this file knows, so their numbers are made up and could exist: `safePhone` says which,
 * and the page says so. The picture is drawn initials, never a real face. Names and places are common real ones for each country, so the data looks right.
 * Pure. Tests: tools/fakeuser.test.mjs.
 */
// a tiny seeded generator (mulberry32 over a string hash): the same seed, the same people
export function rng(seed) {
  let h = 1779033703 ^ String(seed).length; for (const c of String(seed)) { h = Math.imul(h ^ c.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];
const digits = (r, n) => Array.from({ length: n }, () => Math.floor(r() * 10)).join('');
const pad = (n, w = 2) => String(n).padStart(w, '0');

// per country: first names (female, male), surnames, cities [city, region, lat, lon], street words, postcode, phone (a reserved or fiction range), time zone
export const NATS = Object.freeze({
  us: { safePhone: true, country: 'United States', f: ['Emma', 'Olivia', 'Ava', 'Sophia', 'Mia', 'Amelia', 'Harper', 'Evelyn', 'Abigail', 'Emily', 'Ella', 'Grace'], m: ['Liam', 'Noah', 'James', 'William', 'Benjamin', 'Lucas', 'Henry', 'Alexander', 'Mason', 'Michael', 'Ethan', 'Daniel'],
    last: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore'],
    cities: [['Springfield', 'Illinois', 39.8, -89.6], ['Portland', 'Oregon', 45.5, -122.7], ['Austin', 'Texas', 30.3, -97.7], ['Denver', 'Colorado', 39.7, -105.0], ['Columbus', 'Ohio', 40.0, -83.0], ['Raleigh', 'North Carolina', 35.8, -78.6]],
    street: ['Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln', 'Pine St', 'Elm St', 'Washington Ave', 'Lake Rd'], post: (r) => digits(r, 5), phone: (r) => '(' + pick(r, ['212', '312', '415', '512', '303', '614']) + ') 555-01' + digits(r, 2), tz: 'America/Chicago' },
  gb: { safePhone: true, country: 'United Kingdom', f: ['Olivia', 'Amelia', 'Isla', 'Ava', 'Ivy', 'Freya', 'Lily', 'Florence', 'Mia', 'Willow', 'Rosie', 'Sophia'], m: ['Muhammad', 'Noah', 'Oliver', 'George', 'Leo', 'Arthur', 'Oscar', 'Theodore', 'Freddie', 'Harry', 'Jack', 'Charlie'],
    last: ['Smith', 'Jones', 'Taylor', 'Brown', 'Williams', 'Wilson', 'Johnson', 'Davies', 'Patel', 'Wright', 'Robinson', 'Evans', 'Walker', 'Thompson', 'Hughes'],
    cities: [['Leeds', 'West Yorkshire', 53.8, -1.5], ['Bristol', 'Bristol', 51.5, -2.6], ['Manchester', 'Greater Manchester', 53.5, -2.2], ['Norwich', 'Norfolk', 52.6, 1.3], ['Cardiff', 'Wales', 51.5, -3.2], ['Glasgow', 'Scotland', 55.9, -4.3]],
    street: ['High Street', 'Station Road', 'Church Lane', 'Victoria Road', 'Mill Lane', 'Park Avenue', 'The Green', 'Kings Road'], post: (r) => pick(r, ['LS', 'BS', 'M', 'NR', 'CF', 'G']) + (1 + Math.floor(r() * 20)) + ' ' + Math.floor(r() * 10) + pick(r, 'ABDEFGHJLNPQRSTUWXYZ'.split('')) + pick(r, 'ABDEFGHJLNPQRSTUWXYZ'.split('')),
    phone: (r) => '07700 900' + digits(r, 3), tz: 'Europe/London' }, // 07700 900000-999: Ofcom's range for drama
  fr: { safePhone: true, country: 'France', f: ['Louise', 'Ambre', 'Alba', 'Jade', 'Emma', 'Rose', 'Alice', 'Romy', 'Anna', 'Lina', 'Chloé', 'Léa'], m: ['Gabriel', 'Raphaël', 'Léo', 'Louis', 'Maël', 'Noah', 'Jules', 'Arthur', 'Adam', 'Lucas', 'Hugo', 'Paul'],
    last: ['Martin', 'Bernard', 'Thomas', 'Petit', 'Robert', 'Richard', 'Durand', 'Dubois', 'Moreau', 'Laurent', 'Simon', 'Michel', 'Lefebvre', 'Leroy', 'Roux'],
    cities: [['Lyon', 'Rhône', 45.8, 4.8], ['Nantes', 'Loire-Atlantique', 47.2, -1.6], ['Lille', 'Nord', 50.6, 3.1], ['Bordeaux', 'Gironde', 44.8, -0.6], ['Toulouse', 'Haute-Garonne', 43.6, 1.4], ['Strasbourg', 'Bas-Rhin', 48.6, 7.8]],
    street: ['rue de la République', 'avenue Jean Jaurès', 'rue Victor Hugo', 'place de la Mairie', 'rue des Écoles', 'boulevard Pasteur'], post: (r) => pick(r, ['69', '44', '59', '33', '31', '67']) + digits(r, 3),
    phone: (r) => '01 99 00 ' + digits(r, 2) + ' ' + digits(r, 2), tz: 'Europe/Paris' }, // 01 99 00 xx xx: ARCEP's range for fiction
  de: { country: 'Germany', f: ['Sophia', 'Emilia', 'Hannah', 'Emma', 'Mia', 'Lina', 'Ella', 'Clara', 'Lea', 'Marie', 'Lena', 'Anna'], m: ['Noah', 'Matteo', 'Elias', 'Luca', 'Finn', 'Leon', 'Theo', 'Paul', 'Henry', 'Felix', 'Jonas', 'Ben'],
    last: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch', 'Richter', 'Klein', 'Wolf', 'Neumann'],
    cities: [['Leipzig', 'Sachsen', 51.3, 12.4], ['Köln', 'Nordrhein-Westfalen', 50.9, 6.96], ['Hamburg', 'Hamburg', 53.6, 10.0], ['Freiburg', 'Baden-Württemberg', 48.0, 7.85], ['Bremen', 'Bremen', 53.1, 8.8], ['Dresden', 'Sachsen', 51.05, 13.7]],
    street: ['Hauptstraße', 'Schulstraße', 'Gartenstraße', 'Bahnhofstraße', 'Dorfstraße', 'Bergstraße', 'Lindenstraße'], post: (r) => digits(r, 5), phone: (r) => '0151 ' + digits(r, 8), tz: 'Europe/Berlin' },
  es: { country: 'Spain', f: ['Lucía', 'Sofía', 'Martina', 'María', 'Julia', 'Paula', 'Valeria', 'Emma', 'Daniela', 'Carla', 'Alba', 'Noa'], m: ['Hugo', 'Martín', 'Lucas', 'Mateo', 'Leo', 'Daniel', 'Alejandro', 'Pablo', 'Manuel', 'Álvaro', 'Adrián', 'Mario'],
    last: ['García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín', 'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno'],
    cities: [['Valencia', 'Valencia', 39.5, -0.4], ['Sevilla', 'Andalucía', 37.4, -6.0], ['Zaragoza', 'Aragón', 41.65, -0.9], ['Bilbao', 'País Vasco', 43.3, -2.9], ['Málaga', 'Andalucía', 36.7, -4.4], ['Granada', 'Andalucía', 37.2, -3.6]],
    street: ['Calle Mayor', 'Calle Real', 'Avenida de la Constitución', 'Calle del Sol', 'Plaza de España', 'Calle Nueva'], post: (r) => pick(r, ['46', '41', '50', '48', '29', '18']) + digits(r, 3), phone: (r) => '6' + digits(r, 2) + ' ' + digits(r, 3) + ' ' + digits(r, 3), tz: 'Europe/Madrid' },
  br: { country: 'Brazil', f: ['Helena', 'Alice', 'Laura', 'Maria', 'Valentina', 'Heloísa', 'Cecília', 'Júlia', 'Sophia', 'Lívia', 'Isabella', 'Manuela'], m: ['Miguel', 'Arthur', 'Gael', 'Théo', 'Heitor', 'Ravi', 'Davi', 'Bernardo', 'Noah', 'Gabriel', 'Samuel', 'Pedro'],
    last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida'],
    cities: [['Curitiba', 'Paraná', -25.4, -49.3], ['Recife', 'Pernambuco', -8.05, -34.9], ['Salvador', 'Bahia', -12.97, -38.5], ['Fortaleza', 'Ceará', -3.7, -38.5], ['Belo Horizonte', 'Minas Gerais', -19.9, -43.9], ['Porto Alegre', 'Rio Grande do Sul', -30.0, -51.2]],
    street: ['Rua das Flores', 'Avenida Brasil', 'Rua São José', 'Rua Sete de Setembro', 'Avenida Paulista', 'Rua da Paz'], post: (r) => digits(r, 5) + '-' + digits(r, 3), phone: (r) => '(' + pick(r, ['41', '81', '71', '85', '31', '51']) + ') 9' + digits(r, 4) + '-' + digits(r, 4), tz: 'America/Sao_Paulo' },
  in: { country: 'India', f: ['Aadhya', 'Ananya', 'Diya', 'Saanvi', 'Pari', 'Anika', 'Ira', 'Myra', 'Kiara', 'Navya', 'Riya', 'Sara'], m: ['Aarav', 'Vihaan', 'Vivaan', 'Aditya', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Rohan', 'Kabir', 'Dhruv'],
    last: ['Sharma', 'Verma', 'Patel', 'Gupta', 'Singh', 'Kumar', 'Reddy', 'Iyer', 'Nair', 'Das', 'Joshi', 'Mehta', 'Rao', 'Banerjee', 'Kapoor'],
    cities: [['Pune', 'Maharashtra', 18.5, 73.9], ['Jaipur', 'Rajasthan', 26.9, 75.8], ['Kochi', 'Kerala', 9.9, 76.3], ['Lucknow', 'Uttar Pradesh', 26.85, 80.95], ['Bhopal', 'Madhya Pradesh', 23.25, 77.4], ['Mysuru', 'Karnataka', 12.3, 76.65]],
    street: ['MG Road', 'Station Road', 'Gandhi Nagar', 'Nehru Street', 'Park Street', 'Temple Road'], post: (r) => pick(r, ['4', '3', '6', '2', '1', '5']) + digits(r, 5), phone: (r) => '+91 9' + digits(r, 4) + ' ' + digits(r, 5), tz: 'Asia/Kolkata' },
  jp: { country: 'Japan', f: ['Himari', 'Mei', 'Rin', 'Yui', 'Sakura', 'Aoi', 'Hana', 'Yuna', 'Mio', 'Riko', 'Koharu', 'Tsumugi'], m: ['Haruto', 'Ren', 'Minato', 'Sota', 'Yuto', 'Hinata', 'Itsuki', 'Riku', 'Aoi', 'Yamato', 'Asahi', 'Sora'],
    last: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato', 'Yoshida', 'Yamada', 'Sasaki', 'Yamaguchi', 'Matsumoto'],
    cities: [['Sapporo', 'Hokkaido', 43.06, 141.35], ['Sendai', 'Miyagi', 38.27, 140.87], ['Nagoya', 'Aichi', 35.18, 136.9], ['Kyoto', 'Kyoto', 35.0, 135.77], ['Fukuoka', 'Fukuoka', 33.6, 130.4], ['Hiroshima', 'Hiroshima', 34.4, 132.46]],
    street: ['Chuo', 'Honcho', 'Sakaemachi', 'Midoricho', 'Asahicho', 'Showa-dori'], post: (r) => digits(r, 3) + '-' + digits(r, 4), phone: (r) => '090-' + digits(r, 4) + '-' + digits(r, 4), tz: 'Asia/Tokyo' },
});
export const FIELDS = Object.freeze(['gender', 'name', 'email', 'username', 'password', 'phone', 'safePhone', 'dob', 'age', 'street', 'city', 'state', 'postcode', 'country', 'latitude', 'longitude', 'timezone', 'nat', 'id', 'picture']);
const ascii = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').toLowerCase().replace(/[^a-z0-9]/g, '');
const WORDS = ['blue', 'quiet', 'river', 'maple', 'comet', 'sunny', 'brave', 'pixel', 'cedar', 'lucky', 'amber', 'swift', 'lemon', 'stone', 'tiger', 'cloud'];

/** one made-up person from a seeded generator, for a country (nat) and gender ('female', 'male' or '' for either). Pure over r. */
export function person(r, nat = 'us', gender = '', today = new Date(Date.UTC(2026, 9, 24))) {
  const N = NATS[nat] || NATS.us, g = gender === 'female' || gender === 'male' ? gender : r() < 0.5 ? 'female' : 'male';
  const first = pick(r, g === 'female' ? N.f : N.m), last = pick(r, N.last), [city, state, lat, lon] = pick(r, N.cities);
  const age = 18 + Math.floor(r() * 62), born = new Date(Date.UTC(today.getUTCFullYear() - age - 1, 0, 1) + Math.floor(r() * 365) * 864e5); // a birthday in the year that makes this age
  const realAge = today.getUTCFullYear() - born.getUTCFullYear() - ((today.getUTCMonth() < born.getUTCMonth() || (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() < born.getUTCDate())) ? 1 : 0);
  const user = ascii(first) + '.' + ascii(last) + digits(r, 2), pw = pick(r, WORDS) + '-' + pick(r, WORDS) + '-' + digits(r, 3);
  const house = 1 + Math.floor(r() * 220), street = nat === 'de' || nat === 'fr' || nat === 'es' || nat === 'br' ? pick(r, N.street) + ' ' + house : nat === 'jp' ? pick(r, N.street) + ' ' + (1 + Math.floor(r() * 9)) + '-' + house : house + ' ' + pick(r, N.street);
  return {
    gender: g, name: first + ' ' + last, first, last, email: user + '@example.com', username: user, password: pw, phone: N.phone(r), safePhone: !!N.safePhone,
    dob: born.toISOString().slice(0, 10), age: realAge, street, city, state, postcode: N.post(r), country: N.country,
    latitude: Math.round((lat + (r() - 0.5) * 0.2) * 10000) / 10000, longitude: Math.round((lon + (r() - 0.5) * 0.2) * 10000) / 10000, timezone: N.tz, nat: nat.toUpperCase(),
    id: uuid(r),
    picture: initials(first, last, r),
  };
}
/** a version-4 UUID from the seeded generator (the 4 and the variant digit where the standard puts them). Pure over r. */
export function uuid(r) {
  const h = Array.from({ length: 32 }, () => Math.floor(r() * 16).toString(16)); h[12] = '4'; h[16] = '89ab'[Math.floor(r() * 4)];
  return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].map((x) => x.join('')).join('-');
}
/** a picture of initials (SVG data URL), never a face. Pure over r. */
export function initials(first, last, r = Math.random) {
  const hue = Math.floor(r() * 360), t = (first[0] || '') + (last[0] || '');
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="hsl(' + hue + ',55%,45%)"/><text x="48" y="60" font-family="system-ui,sans-serif" font-size="36" font-weight="700" text-anchor="middle" fill="#fff">' + t.replace(/[<&>]/g, '') + '</text></svg>');
}
/** `n` people (1 to 5000) from a seed, nationalities picked evenly from `nats`, one gender or both. The same arguments give the same people. Pure. */
export function people({ seed = 'verse', n = 10, nats = ['us'], gender = '' } = {}) {
  const r = rng(seed), list = nats.filter((x) => NATS[x]); if (!list.length) list.push('us');
  return Array.from({ length: Math.min(5000, Math.max(1, Math.floor(n) || 1)) }, () => person(r, pick(r, list), gender));
}
/** only the chosen fields of each person, in FIELDS order. Pure. */
export const only = (rows, fields = FIELDS) => rows.map((p) => Object.fromEntries(FIELDS.filter((f) => fields.includes(f)).map((f) => [f, p[f]])));

const csvCell = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
/** the rows as JSON, CSV, YAML, XML or SQL inserts (table `people`). Pure. */
export function format(rows, kind = 'json') {
  const keys = rows.length ? Object.keys(rows[0]) : [];
  if (kind === 'csv') return [keys.join(','), ...rows.map((r) => keys.map((k) => csvCell(r[k])).join(','))].join('\n') + '\n';
  if (kind === 'yaml') return rows.map((r) => keys.map((k, i) => (i ? '  ' : '- ') + k + ': ' + (typeof r[k] === 'number' ? r[k] : JSON.stringify(String(r[k])))).join('\n')).join('\n') + '\n';
  if (kind === 'xml') { const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); return '<?xml version="1.0" encoding="UTF-8"?>\n<people>\n' + rows.map((r) => '  <person>' + keys.map((k) => '<' + k + '>' + x(r[k]) + '</' + k + '>').join('') + '</person>').join('\n') + '\n</people>\n'; }
  if (kind === 'sql') { const q = (v) => (typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'"); return 'CREATE TABLE IF NOT EXISTS people (' + keys.map((k) => k + (typeof (rows[0] || {})[k] === 'number' ? ' REAL' : ' TEXT')).join(', ') + ');\n' + rows.map((r) => 'INSERT INTO people (' + keys.join(', ') + ') VALUES (' + keys.map((k) => q(r[k])).join(', ') + ');').join('\n') + '\n'; }
  return JSON.stringify({ results: rows, info: { results: rows.length } }, null, 2) + '\n';
}

// the asks: "random user generator", "fake name generator", "generate 5 fake people", "10 random users from germany", "fake identity"
const COUNTRY = { us: /\b(?:american|us|usa|united states)\b/, gb: /\b(?:british|uk|english|united kingdom|britain)\b/, fr: /\b(?:french|france)\b/, de: /\b(?:german|germany)\b/, es: /\b(?:spanish|spain)\b/, br: /\b(?:brazilian|brazil)\b/, in: /\b(?:indian|india)\b/, jp: /\b(?:japanese|japan)\b/ };
/** what an ask wants: { n, nats, gender } or null. Pure. */
export function askFake(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?.!]+$/, '').replace(/\s+/g, ' ');
  if (t.length > 120 || !/\b(?:fake|random|made[- ]up|test|dummy|sample|mock)\b/.test(t) || !/\b(?:users?|people|persons?|names?|identit(?:y|ies)|profiles?|contacts?|customers?|wom[ae]n|men|girls?|boys?)\b/.test(t)) return null;
  if (!/^(?:(?:please\s+)?(?:generate|make|create|give me|get me|show me)\s+)?(?:an?\s+|some\s+|\d{1,4}\s+)?/.test(t)) return null;
  if (/\b(?:pick|picker|choose|draw|wheel|spin|rows?|data|dataset)\b|\bfrom (?:alice|a list)|\bname a\b|\bwho\b/.test(t)) return null; // "pick a random name from ..." is the wheel or a pick
  const n = (/\b(\d{1,4})\b/.exec(t) || [])[1], nats = Object.keys(COUNTRY).filter((k) => COUNTRY[k].test(t)), gender = /\b(?:female|women|woman|girls?)\b/.test(t) ? 'female' : /\b(?:male|men|man|boys?)\b/.test(t) ? 'male' : '';
  return { n: n ? Math.min(5000, +n) : 10, nats: nats.length ? nats : ['us'], gender };
}
