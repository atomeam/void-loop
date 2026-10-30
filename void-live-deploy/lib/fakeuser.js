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
  // randomuser.me's other nationalities (2026-10-25: all 21 of them, with Japan kept). Canada shares the US 555-01xx range for fiction;
  // Australia has ACMA's numbers for creative works, (0X) 5550 xxxx (acma.gov.au/phone-numbers-use-tv-shows-films-and-creative-works)
  au: { safePhone: true, country: 'Australia', f: ['Charlotte', 'Olivia', 'Amelia', 'Isla', 'Mia', 'Ava', 'Grace', 'Willow', 'Harper', 'Chloe'], m: ['Oliver', 'Noah', 'Jack', 'Henry', 'William', 'Leo', 'Lucas', 'Thomas', 'Charlie', 'James'],
    last: ['Smith', 'Jones', 'Williams', 'Brown', 'Wilson', 'Taylor', 'Johnson', 'White', 'Martin', 'Anderson', 'Thompson', 'Nguyen'],
    cities: [['Brisbane', 'Queensland', -27.47, 153.03], ['Perth', 'Western Australia', -31.95, 115.86], ['Adelaide', 'South Australia', -34.93, 138.6], ['Hobart', 'Tasmania', -42.88, 147.33], ['Geelong', 'Victoria', -38.15, 144.36], ['Newcastle', 'New South Wales', -32.93, 151.78]],
    street: ['George St', 'King St', 'Queen St', 'Station St', 'Church St', 'Beach Rd', 'Victoria St', 'High St'], post: (r) => String(2000 + Math.floor(r() * 5000)), phone: (r) => '(0' + pick(r, ['2', '3', '7', '8']) + ') 5550 ' + digits(r, 4), tz: 'Australia/Sydney' },
  ca: { safePhone: true, country: 'Canada', f: ['Olivia', 'Emma', 'Charlotte', 'Amelia', 'Sophia', 'Chloé', 'Léa', 'Ava', 'Maya', 'Evelyn'], m: ['Noah', 'Liam', 'William', 'Benjamin', 'Lucas', 'Thomas', 'Jacob', 'Logan', 'Félix', 'Nathan'],
    last: ['Smith', 'Brown', 'Tremblay', 'Martin', 'Roy', 'Wilson', 'MacDonald', 'Gagnon', 'Johnson', 'Taylor', 'Côté', 'Campbell'],
    cities: [['Calgary', 'Alberta', 51.05, -114.07], ['Halifax', 'Nova Scotia', 44.65, -63.57], ['Winnipeg', 'Manitoba', 49.9, -97.14], ['Québec', 'Québec', 46.81, -71.21], ['Victoria', 'British Columbia', 48.43, -123.37], ['Ottawa', 'Ontario', 45.42, -75.7]],
    street: ['Main St', 'King St', 'Queen St', 'Maple Ave', 'Park Ave', 'Elm St', 'Lakeshore Rd', 'Wellington St'], post: (r) => { const L = 'ABCEGHJKLMNPRSTVXY'.split(''); return pick(r, L) + digits(r, 1) + pick(r, L) + ' ' + digits(r, 1) + pick(r, L) + digits(r, 1); },
    phone: (r) => '(' + pick(r, ['403', '902', '204', '418', '250', '613']) + ') 555-01' + digits(r, 2), tz: 'America/Toronto' },
  ch: { after: true, country: 'Switzerland', f: ['Mia', 'Emma', 'Lina', 'Mila', 'Elena', 'Sofia', 'Lara', 'Laura', 'Léa', 'Giulia'], m: ['Noah', 'Liam', 'Matteo', 'Luca', 'Leon', 'Elias', 'Gabriel', 'Louis', 'Nico', 'Leandro'],
    last: ['Müller', 'Meier', 'Schmid', 'Keller', 'Weber', 'Huber', 'Schneider', 'Meyer', 'Steiner', 'Fischer', 'Gerber', 'Brunner'],
    cities: [['Zürich', 'Zürich', 47.37, 8.54], ['Bern', 'Bern', 46.95, 7.45], ['Basel', 'Basel-Stadt', 47.56, 7.59], ['Lausanne', 'Vaud', 46.52, 6.63], ['Luzern', 'Luzern', 47.05, 8.31], ['Lugano', 'Ticino', 46.0, 8.95]],
    street: ['Bahnhofstrasse', 'Dorfstrasse', 'Hauptstrasse', 'Kirchweg', 'Rue du Lac', 'Seestrasse'], post: (r) => String(1000 + Math.floor(r() * 9000)), phone: (r) => '07' + pick(r, ['6', '7', '8', '9']) + ' ' + digits(r, 3) + ' ' + digits(r, 2) + ' ' + digits(r, 2), tz: 'Europe/Zurich' },
  dk: { after: true, country: 'Denmark', f: ['Alma', 'Emma', 'Clara', 'Ella', 'Freja', 'Ida', 'Agnes', 'Karla', 'Sofia', 'Olivia'], m: ['William', 'Oscar', 'Noah', 'Carl', 'Alfred', 'Valdemar', 'Aksel', 'Emil', 'Lucas', 'Arthur'],
    last: ['Nielsen', 'Jensen', 'Hansen', 'Pedersen', 'Andersen', 'Christensen', 'Larsen', 'Sørensen', 'Rasmussen', 'Jørgensen', 'Petersen', 'Madsen'],
    cities: [['København', 'Hovedstaden', 55.68, 12.57], ['Aarhus', 'Midtjylland', 56.16, 10.2], ['Odense', 'Syddanmark', 55.4, 10.39], ['Aalborg', 'Nordjylland', 57.05, 9.92], ['Esbjerg', 'Syddanmark', 55.48, 8.46], ['Roskilde', 'Sjælland', 55.64, 12.08]],
    street: ['Østergade', 'Vestergade', 'Nørregade', 'Søndergade', 'Kirkevej', 'Skolevej'], post: (r) => String(1000 + Math.floor(r() * 9000)), phone: (r) => '2' + digits(r, 1) + ' ' + digits(r, 2) + ' ' + digits(r, 2) + ' ' + digits(r, 2), tz: 'Europe/Copenhagen' },
  fi: { after: true, country: 'Finland', f: ['Aino', 'Aada', 'Eevi', 'Sofia', 'Helmi', 'Olivia', 'Lilja', 'Emma', 'Ella', 'Venla'], m: ['Väinö', 'Eino', 'Leo', 'Oliver', 'Elias', 'Onni', 'Eeli', 'Toivo', 'Lenni', 'Veeti'],
    last: ['Korhonen', 'Virtanen', 'Mäkinen', 'Nieminen', 'Mäkelä', 'Hämäläinen', 'Laine', 'Heikkinen', 'Koskinen', 'Järvinen', 'Lehtonen', 'Lehtinen'],
    cities: [['Helsinki', 'Uusimaa', 60.17, 24.94], ['Tampere', 'Pirkanmaa', 61.5, 23.76], ['Turku', 'Varsinais-Suomi', 60.45, 22.27], ['Oulu', 'Pohjois-Pohjanmaa', 65.01, 25.47], ['Jyväskylä', 'Keski-Suomi', 62.24, 25.75], ['Kuopio', 'Pohjois-Savo', 62.89, 27.68]],
    street: ['Mannerheimintie', 'Hämeenkatu', 'Kauppakatu', 'Rantatie', 'Koulukatu', 'Puistokatu'], post: (r) => digits(r, 5), phone: (r) => '040 ' + digits(r, 3) + ' ' + digits(r, 4), tz: 'Europe/Helsinki' },
  ie: { country: 'Ireland', f: ['Grace', 'Fiadh', 'Emily', 'Sophie', 'Ellie', 'Amelia', 'Ava', 'Lily', 'Mia', 'Aoife'], m: ['Jack', 'Noah', 'James', 'Rían', 'Charlie', 'Tadhg', 'Cillian', 'Oisín', 'Fionn', 'Darragh'],
    last: ['Murphy', 'Kelly', "O'Sullivan", 'Walsh', 'Smith', "O'Brien", 'Byrne', 'Ryan', "O'Connor", "O'Neill", 'Doyle', 'McCarthy'],
    cities: [['Dublin', 'Leinster', 53.35, -6.26], ['Cork', 'Munster', 51.9, -8.47], ['Galway', 'Connacht', 53.27, -9.05], ['Limerick', 'Munster', 52.66, -8.63], ['Waterford', 'Munster', 52.26, -7.11], ['Sligo', 'Connacht', 54.27, -8.47]],
    street: ['Main Street', 'Church Street', 'Bridge Street', 'Mill Road', 'Green Lane', 'Castle Street'], post: (r) => pick(r, ['D02', 'T12', 'H91', 'V94', 'X91', 'F91']) + ' ' + Array.from({ length: 4 }, () => pick(r, 'ACDEFHKNPRTVWXY0123456789'.split(''))).join(''),
    phone: (r) => '08' + pick(r, ['3', '5', '6', '7']) + ' ' + digits(r, 3) + ' ' + digits(r, 4), tz: 'Europe/Dublin' },
  ir: { after: true, country: 'Iran', f: ['Fatemeh', 'Zahra', 'Maryam', 'Narges', 'Zeynab', 'Sara', 'Leila', 'Mahsa', 'Parisa', 'Nazanin'], m: ['Mohammad', 'Ali', 'Hossein', 'Reza', 'Amir', 'Mehdi', 'Hamid', 'Saeed', 'Arash', 'Kian'],
    last: ['Mohammadi', 'Hosseini', 'Ahmadi', 'Rezaei', 'Moradi', 'Karimi', 'Jafari', 'Rahimi', 'Sadeghi', 'Hashemi', 'Ebrahimi', 'Kazemi'],
    cities: [['Tehran', 'Tehran', 35.69, 51.39], ['Isfahan', 'Isfahan', 32.65, 51.67], ['Shiraz', 'Fars', 29.59, 52.58], ['Tabriz', 'East Azerbaijan', 38.08, 46.29], ['Mashhad', 'Razavi Khorasan', 36.3, 59.6], ['Yazd', 'Yazd', 31.9, 54.37]],
    street: ['Valiasr St', 'Azadi St', 'Enghelab St', 'Ferdowsi St', 'Hafez St', 'Shariati St'], post: (r) => digits(r, 5) + '-' + digits(r, 5), phone: (r) => '09' + pick(r, ['12', '13', '19', '35', '36']) + ' ' + digits(r, 3) + ' ' + digits(r, 4), tz: 'Asia/Tehran' },
  mx: { after: true, country: 'Mexico', f: ['Sofía', 'Valentina', 'Regina', 'Camila', 'María José', 'Ximena', 'Valeria', 'Renata', 'Victoria', 'Natalia'], m: ['Santiago', 'Mateo', 'Sebastián', 'Leonardo', 'Emiliano', 'Diego', 'Miguel Ángel', 'Daniel', 'Alexander', 'Iker'],
    last: ['Hernández', 'García', 'Martínez', 'López', 'González', 'Pérez', 'Rodríguez', 'Sánchez', 'Ramírez', 'Cruz', 'Flores', 'Gómez'],
    cities: [['Guadalajara', 'Jalisco', 20.67, -103.35], ['Monterrey', 'Nuevo León', 25.69, -100.32], ['Puebla', 'Puebla', 19.04, -98.21], ['Mérida', 'Yucatán', 20.97, -89.62], ['Oaxaca', 'Oaxaca', 17.07, -96.73], ['Querétaro', 'Querétaro', 20.59, -100.39]],
    street: ['Avenida Juárez', 'Calle Hidalgo', 'Avenida Reforma', 'Calle Morelos', 'Calle Allende', 'Avenida Insurgentes'], post: (r) => digits(r, 5), phone: (r) => pick(r, ['33', '81', '55']) + ' ' + digits(r, 4) + ' ' + digits(r, 4), tz: 'America/Mexico_City' },
  nl: { after: true, country: 'Netherlands', f: ['Emma', 'Julia', 'Mila', 'Tess', 'Sophie', 'Zoë', 'Sara', 'Nora', 'Yara', 'Eva'], m: ['Noah', 'Luca', 'Liam', 'Lucas', 'Sem', 'Finn', 'Daan', 'Levi', 'Milan', 'Bram'],
    last: ['de Jong', 'Jansen', 'de Vries', 'van den Berg', 'van Dijk', 'Bakker', 'Janssen', 'Visser', 'Smit', 'Meijer', 'de Boer', 'Mulder'],
    cities: [['Utrecht', 'Utrecht', 52.09, 5.12], ['Groningen', 'Groningen', 53.22, 6.57], ['Eindhoven', 'Noord-Brabant', 51.44, 5.48], ['Haarlem', 'Noord-Holland', 52.38, 4.64], ['Leiden', 'Zuid-Holland', 52.16, 4.49], ['Maastricht', 'Limburg', 50.85, 5.69]],
    street: ['Kerkstraat', 'Dorpsstraat', 'Schoolstraat', 'Molenweg', 'Stationsweg', 'Julianastraat'], post: (r) => String(1000 + Math.floor(r() * 9000)) + ' ' + pick(r, 'ABCDEGHJKLMNPRTVWXZ'.split('')) + pick(r, 'ABCDEGHJKLMNPRTVWXZ'.split('')),
    phone: (r) => '06 ' + digits(r, 8), tz: 'Europe/Amsterdam' },
  no: { after: true, country: 'Norway', f: ['Nora', 'Emma', 'Olivia', 'Ella', 'Sofie', 'Leah', 'Frida', 'Ingrid', 'Maja', 'Sara'], m: ['Jakob', 'Emil', 'Noah', 'Oliver', 'Filip', 'William', 'Lucas', 'Liam', 'Henrik', 'Aksel'],
    last: ['Hansen', 'Johansen', 'Olsen', 'Larsen', 'Andersen', 'Pedersen', 'Nilsen', 'Kristiansen', 'Jensen', 'Karlsen', 'Johnsen', 'Pettersen'],
    cities: [['Oslo', 'Oslo', 59.91, 10.75], ['Bergen', 'Vestland', 60.39, 5.32], ['Trondheim', 'Trøndelag', 63.43, 10.4], ['Stavanger', 'Rogaland', 58.97, 5.73], ['Tromsø', 'Troms', 69.65, 18.96], ['Kristiansand', 'Agder', 58.15, 8.0]],
    street: ['Storgata', 'Kirkegata', 'Skolegata', 'Parkveien', 'Strandveien', 'Kongens gate'], post: (r) => digits(r, 4), phone: (r) => pick(r, ['4', '9']) + digits(r, 2) + ' ' + digits(r, 2) + ' ' + digits(r, 3), tz: 'Europe/Oslo' },
  nz: { country: 'New Zealand', f: ['Isla', 'Charlotte', 'Amelia', 'Olivia', 'Mia', 'Ava', 'Lily', 'Harper', 'Aria', 'Mila'], m: ['Oliver', 'Noah', 'Leo', 'Jack', 'George', 'Luca', 'Lucas', 'Nikau', 'Arlo', 'Mason'],
    last: ['Smith', 'Wilson', 'Williams', 'Brown', 'Taylor', 'Jones', 'Singh', 'Walker', 'Thompson', 'Ngata', 'Anderson', 'Campbell'],
    cities: [['Auckland', 'Auckland', -36.85, 174.76], ['Wellington', 'Wellington', -41.29, 174.78], ['Christchurch', 'Canterbury', -43.53, 172.64], ['Dunedin', 'Otago', -45.87, 170.5], ['Hamilton', 'Waikato', -37.79, 175.28], ['Napier', "Hawke's Bay", -39.49, 176.91]],
    street: ['Queen St', 'Victoria St', 'High St', 'Beach Rd', 'Church St', 'Great North Rd'], post: (r) => digits(r, 4), phone: (r) => '021 ' + digits(r, 3) + ' ' + digits(r, 4), tz: 'Pacific/Auckland' },
  rs: { after: true, country: 'Serbia', f: ['Milica', 'Jelena', 'Ana', 'Jovana', 'Marija', 'Teodora', 'Sofija', 'Katarina', 'Mila', 'Nina'], m: ['Luka', 'Stefan', 'Nikola', 'Marko', 'Lazar', 'Vuk', 'Aleksa', 'Filip', 'Nemanja', 'Petar'],
    last: ['Jovanović', 'Petrović', 'Nikolić', 'Marković', 'Đorđević', 'Stojanović', 'Ilić', 'Stanković', 'Pavlović', 'Milošević', 'Popović', 'Kovačević'],
    cities: [['Beograd', 'Beograd', 44.79, 20.45], ['Novi Sad', 'Vojvodina', 45.25, 19.84], ['Niš', 'Nišavski', 43.32, 21.9], ['Kragujevac', 'Šumadija', 44.01, 20.91], ['Subotica', 'Vojvodina', 46.1, 19.67], ['Čačak', 'Moravički', 43.89, 20.35]],
    street: ['Kralja Petra', 'Bulevar oslobođenja', 'Njegoševa', 'Karađorđeva', 'Svetog Save', 'Cara Dušana'], post: (r) => digits(r, 5), phone: (r) => '06' + pick(r, ['0', '1', '2', '3', '4', '5']) + ' ' + digits(r, 3) + ' ' + digits(r, 4), tz: 'Europe/Belgrade' },
  tr: { after: true, country: 'Turkey', f: ['Zeynep', 'Elif', 'Defne', 'Eylül', 'Azra', 'Asel', 'Ecrin', 'Nehir', 'Yaren', 'Ayşe'], m: ['Yusuf', 'Alparslan', 'Eymen', 'Ömer', 'Mustafa', 'Göktuğ', 'Miraç', 'Kerem', 'Aras', 'Emir'],
    last: ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Yıldırım', 'Öztürk', 'Aydın', 'Özdemir', 'Arslan', 'Doğan'],
    cities: [['İzmir', 'İzmir', 38.42, 27.14], ['Ankara', 'Ankara', 39.93, 32.86], ['Bursa', 'Bursa', 40.19, 29.06], ['Antalya', 'Antalya', 36.9, 30.7], ['Eskişehir', 'Eskişehir', 39.78, 30.52], ['Trabzon', 'Trabzon', 41.0, 39.72]],
    street: ['Atatürk Cd.', 'Cumhuriyet Cd.', 'İstiklal Cd.', 'Gazi Bulvarı', 'Okul Sk.', 'Çarşı Sk.'], post: (r) => digits(r, 5), phone: (r) => '05' + pick(r, ['30', '32', '42', '44', '55']) + ' ' + digits(r, 3) + ' ' + digits(r, 2) + ' ' + digits(r, 2), tz: 'Europe/Istanbul' },
  ua: { after: true, country: 'Ukraine', f: ['Sofiia', 'Anna', 'Mariia', 'Solomiia', 'Viktoriia', 'Anastasiia', 'Daryna', 'Zlata', 'Polina', 'Oleksandra'], m: ['Oleksandr', 'Maksym', 'Artem', 'Mykhailo', 'Dmytro', 'Andrii', 'Ivan', 'Bohdan', 'Taras', 'Yurii'],
    last: ['Melnyk', 'Shevchenko', 'Boiko', 'Kovalenko', 'Bondarenko', 'Tkachenko', 'Kravchenko', 'Oliinyk', 'Shevchuk', 'Koval', 'Polishchuk', 'Lysenko'],
    cities: [['Lviv', 'Lvivska', 49.84, 24.03], ['Kyiv', 'Kyiv', 50.45, 30.52], ['Odesa', 'Odeska', 46.48, 30.72], ['Dnipro', 'Dnipropetrovska', 48.46, 35.05], ['Kharkiv', 'Kharkivska', 49.99, 36.23], ['Vinnytsia', 'Vinnytska', 49.23, 28.47]],
    street: ['vul. Shevchenka', 'vul. Franka', 'vul. Sadova', 'vul. Lesi Ukrainky', 'prosp. Svobody', 'vul. Hrushevskoho'], post: (r) => digits(r, 5), phone: (r) => '+380 ' + pick(r, ['50', '67', '63', '93']) + ' ' + digits(r, 3) + ' ' + digits(r, 4), tz: 'Europe/Kyiv' },
});
export const FIELDS = Object.freeze(['gender', 'title', 'name', 'email', 'username', 'password', 'phone', 'cell', 'safePhone', 'dob', 'age', 'registered', 'registeredAge', 'street', 'city', 'state', 'postcode', 'country', 'latitude', 'longitude', 'timezone', 'nat', 'id', 'picture']);
const ascii = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[øØ]/g, 'o').replace(/[æÆ]/g, 'ae').replace(/[ıİ]/g, 'i').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');
const WORDS = ['blue', 'quiet', 'river', 'maple', 'comet', 'sunny', 'brave', 'pixel', 'cedar', 'lucky', 'amber', 'swift', 'lemon', 'stone', 'tiger', 'cloud'];

/** one made-up person from a seeded generator, for a country (nat) and gender ('female', 'male' or '' for either). Pure over r. */
export function person(r, nat = 'us', gender = '', today = new Date(Date.UTC(2026, 9, 24))) {
  const N = NATS[nat] || NATS.us, g = gender === 'female' || gender === 'male' ? gender : r() < 0.5 ? 'female' : 'male';
  const first = pick(r, g === 'female' ? N.f : N.m), last = pick(r, N.last), [city, state, lat, lon] = pick(r, N.cities);
  const age = 18 + Math.floor(r() * 62), born = new Date(Date.UTC(today.getUTCFullYear() - age - 1, 0, 1) + Math.floor(r() * 365) * 864e5); // a birthday in the year that makes this age
  const realAge = today.getUTCFullYear() - born.getUTCFullYear() - ((today.getUTCMonth() < born.getUTCMonth() || (today.getUTCMonth() === born.getUTCMonth() && today.getUTCDate() < born.getUTCDate())) ? 1 : 0);
  const user = ascii(first) + '.' + ascii(last) + digits(r, 2), pw = pick(r, WORDS) + '-' + pick(r, WORDS) + '-' + digits(r, 3);
  const house = 1 + Math.floor(r() * 220), street = N.after || nat === 'de' || nat === 'fr' || nat === 'es' || nat === 'br' ? pick(r, N.street) + ' ' + house : nat === 'jp' ? pick(r, N.street) + ' ' + (1 + Math.floor(r() * 9)) + '-' + house : house + ' ' + pick(r, N.street);
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
  const hue = Math.floor(r() * 360), t = ((first[0] || '') + (last.replace(/^(?:(?:de|van|den|der|von|da)\s+)+/i, '')[0] || '')).toUpperCase();
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="hsl(' + hue + ',55%,45%)"/><text x="48" y="60" font-family="system-ui,sans-serif" font-size="36" font-weight="700" text-anchor="middle" fill="#fff">' + t.replace(/[<&>]/g, '') + '</text></svg>');
}
/** `n` people (1 to 5000) from a seed, nationalities picked evenly from `nats`, one gender or both. The same arguments give the same people. Pure. */
export function people({ seed = 'verse', n = 10, nats = ['us'], gender = '', page = 1, pw = null, today = new Date(Date.UTC(2026, 9, 24)) } = {}) {
  // page 1 is the seed itself (the same people as ever); page k is the next batch from the same seed, as randomuser.me's page= is
  const k = Math.max(1, Math.floor(page) || 1), key = k === 1 ? String(seed) : seed + '#' + k;
  const r = rng(key), x = rng(key + '#more'), w = rng(key + '#pw'), list = nats.filter((c) => NATS[c]); if (!list.length) list.push('us');
  return Array.from({ length: Math.min(5000, Math.max(1, Math.floor(n) || 1)) }, () => {
    const nat = pick(r, list), p = person(r, nat, gender, today);
    // what randomuser.me adds, drawn from their own generators so the fields above stay the same for a seed
    const title = p.gender === 'male' ? 'Mr' : pick(x, ['Ms', 'Mrs', 'Miss']), cell = NATS[nat].phone(x);
    const from = Math.max(Date.parse(p.dob) + 18 * 365.25 * 864e5, today.getTime() - 20 * 365.25 * 864e5), reg = new Date(from + Math.floor(x() * Math.max(1, (today.getTime() - from) / 864e5)) * 864e5);
    return { ...p, title, cell, registered: reg.toISOString().slice(0, 10), registeredAge: Math.floor((today - reg) / (365.25 * 864e5)), ...(pw ? { password: password(w, pw) } : {}) };
  });
}
/** randomuser.me's password option: the character sets ('upper', 'lower', 'number', 'special') and a length range; at least one of each set
 *  chosen, the rest from all of them, shuffled. { sets, min, max }; none chosen is all four. Pure over r. */
export const PW_SETS = Object.freeze({ upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lower: 'abcdefghijklmnopqrstuvwxyz', number: '0123456789', special: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~' });
export function password(r, { sets = [], min = 8, max = 16 } = {}) {
  const on = sets.filter((k) => PW_SETS[k]); if (!on.length) on.push(...Object.keys(PW_SETS));
  const lo = Math.max(on.length, Math.min(64, Math.floor(min) || 8)), hi = Math.max(lo, Math.min(64, Math.floor(max) || lo)), n = lo + Math.floor(r() * (hi - lo + 1)), all = on.map((k) => PW_SETS[k]).join('');
  const out = on.map((k) => pick(r, PW_SETS[k].split(''))); while (out.length < n) out.push(pick(r, all.split('')));
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join('');
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
const COUNTRY = { us: /\b(?:american|us|usa|united states)\b/, gb: /\b(?:british|uk|english|united kingdom|britain)\b/, fr: /\b(?:french|france)\b/, de: /\b(?:german|germany)\b/, es: /\b(?:spanish|spain)\b/, br: /\b(?:brazilian|brazil)\b/, in: /\b(?:indian|india)\b/, jp: /\b(?:japanese|japan)\b/,
  au: /\b(?:australian|australia|aussie)\b/, ca: /\b(?:canadian|canada)\b/, ch: /\b(?:swiss|switzerland)\b/, dk: /\b(?:danish|denmark)\b/, fi: /\b(?:finnish|finland)\b/, ie: /\b(?:irish|ireland)\b/, ir: /\b(?:iranian|iran|persian)\b/,
  mx: /\b(?:mexican|mexico)\b/, nl: /\b(?:dutch|netherlands|holland)\b/, no: /\b(?:norwegian|norway)\b/, nz: /\b(?:new zealand|kiwi)\b/, rs: /\b(?:serbian|serbia)\b/, tr: /\b(?:turkish|turkey|t\u00fcrkiye)\b/, ua: /\b(?:ukrainian|ukraine)\b/ };
/** what an ask wants: { n, nats, gender } (and seed, when the ask ends ", seed <seed>": the page's card names its own people) or null. Pure. */
export function askFake(text) {
  const raw = String(text || ''), sm = /(?:,\s*|\s)seed[ :]+([A-Za-z0-9_-]{1,40})\s*[?.!]*\s*$/i.exec(raw), seed = sm ? sm[1] : '';
  const t = (sm ? raw.slice(0, sm.index) : raw).trim().toLowerCase().replace(/[?.!]+$/, '').replace(/\s+/g, ' ');
  if (t.length > 120 || !/\b(?:fake|random|made[- ]up|test|dummy|sample|mock)\b/.test(t) || !/\b(?:users?|people|persons?|names?|identit(?:y|ies)|profiles?|contacts?|customers?|wom[ae]n|men|girls?|boys?)\b/.test(t)) return null;
  if (!/^(?:(?:please\s+)?(?:generate|make|create|give me|get me|show me)\s+)?(?:an?\s+|some\s+|\d{1,4}\s+)?/.test(t)) return null;
  if (/\b(?:pick|picker|choose|draw|wheel|spin|rows?|data|dataset)\b|\bfrom (?:alice|a list)|\bname a\b|\bwho\b/.test(t)) return null; // "pick a random name from ..." is the wheel or a pick
  if (/\b(?:fantasy|elf|elven|dwarf|dragon|town|city|band|pet|dog|cat|business|company|brand|superhero|hero|villain|potion|planet|product|palette|album|book|team|ship)\s+names?\b/.test(t)) return null; // "random band name" is a made-up thing's name (skills/textgen.js), not a made-up person
  // nats in the order asked: the order picks who is from where, so the page's card gets the page's people
  const n = (/\b(\d{1,4})\b/.exec(t) || [])[1], nats = Object.keys(COUNTRY).map((k) => [k, t.search(COUNTRY[k])]).filter((x) => x[1] >= 0).sort((a, b) => a[1] - b[1]).map((x) => x[0]), gender = /\b(?:female|women|woman|girls?)\b/.test(t) ? 'female' : /\b(?:male|men|man|boys?)\b/.test(t) ? 'male' : '';
  return { n: n ? Math.min(5000, +n) : 10, nats: nats.length ? nats : ['us'], gender, ...(seed ? { seed } : {}) };
}
