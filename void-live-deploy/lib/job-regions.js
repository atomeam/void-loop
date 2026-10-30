/**
 * job-regions: a country (ISO 3166 two-letter code) as the narrowest region the remote job listings name, so another page can open the remote jobs open to
 * people there (/jobs/?cc=). Kept apart from lib/jobs-core.js, which re-exports it, so a page that only links to /jobs/ (/time/) can ask whether a country has a
 * region without loading the listings code. Pure. Tests: tools/job-board.test.mjs.
 */
// a country (ISO 3166 two-letter code, as /local/ and /flights/ know a place) as the narrowest region the listings name, so another page can open
// the remote jobs open to people there; a country no region here covers gives ''. Austria and Switzerland are Europe, not Germany: a listing open in
// Germany is not open in them.
const COUNTRY_REGION = { US: 'usa', CA: 'canada', GB: 'uk', DE: 'germany', AU: 'oceania', NZ: 'oceania' };
for (const [region, codes] of Object.entries({ latam: 'MX GT BZ SV HN NI CR PA CU DO HT JM PR TT BS BB CO VE EC PE BO BR PY UY AR CL GY SR',
  europe: 'IE FR ES PT NL BE LU AT CH IT MT PL CZ SK HU SI HR RO BG GR CY DK SE NO FI IS EE LV LT RS BA ME MK AL MD UA LI MC SM AD',
  emea: 'TR IL AE SA QA KW BH OM JO LB IQ IR YE', asia: 'IN SG JP PH ID VN CN KR PK MY TH HK TW BD LK NP KH MM LA MN',
  africa: 'NG KE EG ZA GH MA DZ TN ET TZ UG RW SN CI CM ZW ZM BW NA MU' })) for (const c of codes.split(' ')) COUNTRY_REGION[c] = region;
/** the region of a two-letter country code: regionOfCountry('GB') → 'uk', regionOfCountry('PT') → 'europe', an unknown code → ''. Pure. */
export const regionOfCountry = (cc) => (/^[a-z]{2}$/i.test(String(cc || '')) && COUNTRY_REGION[String(cc).toUpperCase()]) || '';
