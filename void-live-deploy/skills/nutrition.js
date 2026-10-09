/**
 * nutrition skill - daily calories, protein and water, worked out for you the way the best calculators do it (no key; pure math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Calories: "how many calories should i eat a day", "calories for a 30 year old male 5'10 180 lbs moderately active",
 *   "how many calories should i eat to lose weight", "tdee calculator", "what is my bmr 25 female 165 cm 60 kg".
 *   Mifflin-St Jeor resting rate (the equation the Academy of Nutrition and Dietetics review found most often within 10%
 *   of measured, Frankenfield 2005) x the usual activity factors (1.2 to 1.9), then maintenance, lose and gain rows,
 *   with a floor so a "lose 2 lb a week" row never drops under 1,500 (men) / 1,200 (women). With no body stats it shows
 *   the Dietary Guidelines' calorie ranges by age and sex and a live form.
 * Protein: "how much protein do i need", "how much protein should i eat if i weigh 180 pounds", "protein to build muscle 80kg".
 *   RDA 0.8 g/kg (46 g women, 56 g men with no weight), exercising people 1.4-2.0 g/kg (ISSN 2017), the 1.6 g/kg point where
 *   muscle gains level off (Morton 2018 meta-analysis), 1.0-1.2 g/kg past 65 (PROT-AGE 2013), split across meals.
 * Water: "how much water should i drink a day", "how many glasses of water a day", "how much water should a pregnant woman drink".
 *   National Academies adequate intake (3.7 L men, 2.7 L women in all, about 80% of it from drinks: 13 and 9 cups),
 *   pregnancy, breastfeeding and children, plus more for each hour of sweaty exercise.
 * Leaves food lookups ("calories in a banana"), exercise burns ("calories burned running"), BMI (calc) and
 * "how many calories to lose a pound" (calc: 3,500) to the skills that already answer them.
 */
const LB = 0.45359237, CUP = 0.236588;
const fmt = (x, d) => Number(x).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d });
const r10 = (x) => Math.round(x / 10) * 10;
const ACT = [
  { k: 'sedentary', f: 1.2, label: 'sedentary (desk job, little exercise)', re: /\b(?:sedentary|desk\s+job|office\s+job|inactive|no\s+exercise|not\s+active|don'?t\s+exercise|little\s+(?:or\s+no\s+)?exercise|couch)\b/ },
  { k: 'light', f: 1.375, label: 'lightly active (exercise 1\u20133 days a week)', re: /\b(?:light(?:ly)?\s+active|light\s+exercise|lightly|1\s*(?:-|to)\s*3\s+(?:days|times)|once\s+or\s+twice\s+a\s+week|walk\s+(?:a\s+lot|daily))\b/ },
  { k: 'moderate', f: 1.55, label: 'moderately active (exercise 3\u20135 days a week)', re: /\b(?:moderate(?:ly)?(?:\s+active)?|active|3\s*(?:-|to)\s*5\s+(?:days|times)|work\s*out\s+(?:3|4|three|four)|(?:3|4|three|four)\s+times\s+a\s+week|gym\s+(?:3|4))\b/ },
  { k: 'very', f: 1.725, label: 'very active (hard exercise 6\u20137 days a week)', re: /\b(?:very\s+active|highly\s+active|6\s*(?:-|to)\s*7\s+(?:days|times)|every\s+day|daily\s+(?:exercise|workouts?)|work\s*out\s+(?:daily|every\s+day))\b/ },
  { k: 'extra', f: 1.9, label: 'extra active (athlete or a physical job)', re: /\b(?:extra(?:emely)?\s+active|athlete|physical\s+job|manual\s+labou?r|construction\s+worker|twice\s+a\s+day|train(?:ing)?\s+twice)\b/ }
];
// Dietary Guidelines for Americans 2020-2025, Appendix 2: estimated calorie needs a day (sedentary to active)
const DGA = [
  ['Women 19\u201330', '1,800\u20132,400'], ['Women 31\u201359', '1,600\u20132,200'], ['Women 60+', '1,600\u20132,000'],
  ['Men 19\u201330', '2,400\u20133,000'], ['Men 31\u201359', '2,200\u20133,000'], ['Men 60+', '2,000\u20132,600'],
  ['Girls 14\u201318', '1,800\u20132,400'], ['Boys 14\u201318', '2,000\u20133,200']
];
// National Academies 2004 adequate intake of water a day: total (food + drinks), drinks alone, cups of drinks
const WATER = [
  { re: /\bbreast-?\s?feeding|nursing|lactating\b/, who: 'Breastfeeding', total: 3.8, drinks: 3.1, cups: 13 },
  { re: /\bpregnan(?:t|cy)\b/, who: 'Pregnant', total: 3.0, drinks: 2.3, cups: 10 },
  { re: /\b(?:toddler|[1-3]\s*(?:-\s*)?(?:year|yr)s?(?:\s*-?\s*old)?)\b/, who: 'Children 1\u20133', total: 1.3, drinks: 0.9, cups: 4 },
  { re: /\b(?:[4-8]\s*(?:-\s*)?(?:year|yr)s?(?:\s*-?\s*old)?|kids?|child(?:ren)?)\b/, who: 'Children 4\u20138', total: 1.7, drinks: 1.2, cups: 5 },
  { re: /\b(?:teen(?:age)?\s+(?:boys?|guys?)|(?:boys?)\s+(?:1[4-8])|1[4-8]\s*(?:-\s*)?(?:year|yr)s?(?:\s*-?\s*old)?\s+(?:boys?|males?))\b/, who: 'Teen boys 14\u201318', total: 3.3, drinks: 2.6, cups: 11 },
  { re: /\b(?:teen(?:age)?\s+(?:girls?)|girls?\s+(?:1[4-8])|1[4-8]\s*(?:-\s*)?(?:year|yr)s?(?:\s*-?\s*old)?\s+(?:girls?|females?))\b/, who: 'Teen girls 14\u201318', total: 2.3, drinks: 1.8, cups: 8 },
  { re: /\bteen(?:ager)?s?\b|\b1[3-8]\s*(?:-\s*)?(?:year|yr)s?(?:\s*-?\s*old)?\b/, who: 'Teens 14\u201318', total: 2.3, drinks: 1.8, cups: 8, both: 'boys 3.3 L in all (about 11 cups to drink), girls 2.3 L (about 8 cups)' },
  { re: /\b(?:women|woman|female|lady|ladies|girl)\b/, who: 'Women', total: 2.7, drinks: 2.2, cups: 9 },
  { re: /\b(?:men|man|male|guy|boy)\b/, who: 'Men', total: 3.7, drinks: 3.0, cups: 13 }
];
const SRC_CAL = '<div class="src">Method: <a href="https://pubmed.ncbi.nlm.nih.gov/15883556/" target="_blank" rel="noopener">Mifflin-St Jeor (Frankenfield 2005 review)</a> \u00b7 ranges: <a href="https://www.dietaryguidelines.gov/sites/default/files/2020-12/Dietary_Guidelines_for_Americans_2020-2025.pdf" target="_blank" rel="noopener">Dietary Guidelines 2020\u20132025, Appendix 2</a> \u00b7 not medical advice</div>';
const SRC_PRO = '<div class="src">Sources: RDA 0.8 g/kg (<a href="https://nap.nationalacademies.org/catalog/10490" target="_blank" rel="noopener">National Academies DRI</a>) \u00b7 <a href="https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0177-8" target="_blank" rel="noopener">ISSN position stand 2017</a> \u00b7 <a href="https://bjsm.bmj.com/content/52/6/376" target="_blank" rel="noopener">Morton 2018 meta-analysis</a> \u00b7 PROT-AGE 2013 \u00b7 not medical advice</div>';
const SRC_H2O = '<div class="src">Source: <a href="https://nap.nationalacademies.org/catalog/10925" target="_blank" rel="noopener">National Academies, DRI for Water (2004)</a> \u00b7 sweat rates: ACSM position stand 2007 \u00b7 1 cup = 8 fl oz (237 mL) \u00b7 not medical advice</div>';

function clean(text) {
  return String(text || '').toLowerCase().replace(/[\u2019\u2032]/g, "'").replace(/[\u201c\u201d\u2033]/g, '"')
    .replace(/[?!]+$/, '').replace(/\s+/g, ' ').trim().replace(/\.$/, '');
}

// body stats from plain words: weight (kg), height (cm), age, sex, activity, goal, pregnancy
function statsOf(t) {
  const s = {};
  let m;
  if ((m = t.match(/(?<!(?:lose|gain|drop|lost|shed|put\s+on)\s+)(\d{2,3}(?:\.\d+)?)\s*(?:lbs?|pounds?)\b/))) s.kg = +m[1] * LB, s.lb = +m[1];
  else if ((m = t.match(/(?<!(?:lose|gain|drop|lost|shed|put\s+on)\s+)(\d{2,3}(?:\.\d+)?)\s*(?:kg|kgs|kilos?|kilograms?)\b/))) s.kg = +m[1], s.metric = true;
  else if ((m = t.match(/\bi\s+(?:weigh|am\s+weighing)\s+(\d{2,3}(?:\.\d+)?)\b/))) s.kg = +m[1] * LB, s.lb = +m[1];
  if ((m = t.match(/\b([4-7])\s*(?:'|ft\.?|foot|feet)(?:\s*(1[01]|\d(?:\.\d)?)(?![\d.])\s*(?:"|''|in\.?|inch(?:es)?)?)?/))) s.cm = (+m[1] * 12 + +(m[2] || 0)) * 2.54, s.ftin = m[1] + "'" + (m[2] || 0) + '"';
  else if ((m = t.match(/\b(1[2-9]\d|2[0-2]\d)\s*(?:cm|centimet(?:er|re)s?)\b/))) s.cm = +m[1], s.metric = true;
  else if ((m = t.match(/\b([12][.,]\d{1,2})\s*(?:m|met(?:er|re)s?)\b/))) s.cm = parseFloat(m[1].replace(',', '.')) * 100, s.metric = true;
  if ((m = t.match(/\b(1[3-9]|[2-9]\d)\s*(?:-\s*)?(?:years?|yrs?|y\/?o)\b/)) || (m = t.match(/\bage(?:d)?\s*(1[3-9]|[2-9]\d)\b/)) || (m = t.match(/\b(1[3-9]|[2-9]\d)\s+(?:female|male|woman|man|guy|girl|lady)\b/))
    || (m = t.match(/\bi\s*(?:am|'m|m)\s+(?:a\s+)?(1[3-9]|[2-9]\d)\b(?!\s*(?:lbs?|pounds?|kg|kilos?|cm|'|ft|foot|feet|percent|%))/))) s.age = +m[1];
  if (/\b(?:male|man|men|guy|boy|dude|he|husband|son|father|dad)\b/.test(t) && !/\bfemale\b/.test(t)) s.sex = 'm';
  if (/\b(?:female|woman|women|girl|lady|she|wife|daughter|mother|mom|mum|pregnant|breast-?\s?feeding)\b/.test(t)) s.sex = 'f';
  const a = [...ACT].reverse().find((x) => x.re.test(t)); if (a) s.act = a;
  if (/\b(?:lose|losing|lost|cut(?:ting)?|deficit|weight\s+loss|slim\s+down|drop|shed|diet(?:ing)?|fat\s+loss|lean\s+out)\b/.test(t)) s.goal = 'lose';
  else if (/\b(?:gain|gaining|bulk(?:ing)?|surplus|put\s+on\s+weight|build\s+muscle|weight\s+gain)\b/.test(t)) s.goal = 'gain';
  else if (/\bmaintain|maintenance|stay\s+the\s+same\b/.test(t)) s.goal = 'keep';
  if (!s.goal && /\bkeep\s+(?:my\s+|the\s+same\s+)?weight\b/.test(t)) s.goal = 'keep';
  if ((m = t.match(/\b(0?\.25|a\s+quarter\s+(?:of\s+)?a|0?\.5|half\s+(?:a|of\s+a)|1|one|a|2|two)\s*(lbs?|pounds?|kgs?|kilos?|kilograms?)\s*(?:a|per|each|every)\s+week\b/))) {
    const n = /quarter|25/.test(m[1]) ? 0.25 : /half|5/.test(m[1]) ? 0.5 : /2|two/.test(m[1]) ? 2 : 1;
    s.rate = { n, kg: /^k/.test(m[2]) };
  }
  if (/\bpregnan(?:t|cy)\b/.test(t)) s.preg = 'preg';
  if (/\bbreast-?\s?feeding|nursing|lactating\b/.test(t)) s.preg = 'bf';
  if (/\b(?:build(?:ing)?\s+muscle|muscle\s+(?:gain|growth|building)|bulk(?:ing)?|lift(?:ing)?|weight\s*lifting|gym|bodybuild(?:ing|er)|strength\s+train(?:ing)?)\b/.test(t)) s.lift = true;
  if (/\b(?:seniors?|elderly|older\s+adults?|retirees?)\b/.test(t) || (s.age && s.age >= 65)) s.old = true;
  return s;
}

const FOOD = /\b(?:in|of)\s+(?:an?\s+|one\s+|\d+\s+)?(?!(?:a|the)\s+day\b|(?:a|the)\s+(?:male|female|man|woman|teen|pregnant|\d))(?:banana|apple|egg|eggs|chicken|beef|steak|rice|bread|milk|tofu|beans?|fish|tuna|salmon|peanut|nuts?|cheese|yogh?urt|pizza|burger|cup|slice|serving|gram|ounce|oz|pound\s+of|tablespoon|spoon|scoop|shake|bar|can|bottle)\b/;
const OFFC = /\b(?:burn(?:ed|t)?\s+(?:by|from|when|while|during|running|walking|swimming|cycling|biking|doing|in\s+an?\s+hour)|running|walking|swimming|cycling|jogging|steps|calories\s+in|in\s+a\s+pound\s+of\s+fat|kj|kilojoules?|joules?|to\s+lose\s+(?:a|one|1)\s+(?:pound|lb|kg)$)\b/;

function askOf(text) {
  const t = clean(text);
  if (!t || t.length > 200) return null;
  // calculators by name
  if (/^(?:a\s+|open\s+(?:a\s+|the\s+)?|show\s+(?:me\s+)?(?:a\s+|the\s+)?)?(?:calorie|calories|tdee|bmr|maintenance\s+calories?|daily\s+calorie|macro|macros)\s+calculator$/.test(t)) return { kind: 'cal', s: {}, form: true };
  if (/^(?:a\s+|open\s+(?:a\s+|the\s+)?|show\s+(?:me\s+)?(?:a\s+|the\s+)?)?(?:protein(?:\s+intake)?)\s+calculator$/.test(t)) return { kind: 'pro', s: {}, form: true };
  if (/^(?:a\s+|open\s+(?:a\s+|the\s+)?|show\s+(?:me\s+)?(?:a\s+|the\s+)?)?(?:water(?:\s+intake)?|hydration)\s+calculator$/.test(t)) return { kind: 'h2o', s: {}, form: true };
  const s = statsOf(t);
  // water: how much to drink
  if (/\bwater\b/.test(t) && !/\b(?:in\s+(?:a|the|an)\s+(?!day\b)|ocean|sea|earth|planet|pool|tank|bath|tub|rice|pasta|cook|boil|bottle\s+of|gallon\s+of\s+water\s+in|liters?\s+of\s+water\s+in|litres?\s+of\s+water\s+in|weigh(?:s)?\s+a|plants?|lawn|grass|garden|dog|cat|fish|tree|ratio|heater|bill|filter|translate|spanish|french|meaning)\b/.test(t)
    && (/^(?:how\s+much|how\s+many\s+(?:glasses|cups|bottles|liters|litres|ounces|oz|gallons|ml)(?:\s+of)?)\s+water\s+(?:should|do|does|must|to|can|would)\b.*\b(?:drink|have|need|consume|take\s+in|intake)\b/.test(t)
      || /^(?:how\s+much|how\s+many\s+(?:glasses|cups|bottles|liters|litres|ounces|oz))(?:\s+of)?\s+water\s+(?:a|per|each)\s+day\b/.test(t)
      || /^(?:recommended|daily|ideal|average|normal)\s+(?:daily\s+)?water\s+intake\b/.test(t)
      || /^water\s+intake\s+(?:a|per)\s+day\b/.test(t)
      || /^how\s+much\s+(?:should|do|does|must)\s+(?:i|you|a\s+.+|an?\s+.+|.+)\s+drink\s+(?:a|per|each)\s+day$/.test(t) && /water/.test(t)
      || /^(?:how\s+much|how\s+many\s+(?:glasses|cups|liters|litres|ounces|oz))(?:\s+of)?\s+water\s+(?:is\s+)?(?:enough|too\s+much|recommended)\b/.test(t)
      || /^am\s+i\s+drinking\s+enough\s+water$/.test(t)
      || /^is\s+(?:8|eight)\s+(?:glasses|cups)\s+(?:of\s+water\s+)?(?:a\s+day\s+)?(?:enough|right|true|a\s+myth)$/.test(t)))
    return { kind: 'h2o', s, t };
  // protein: how much a day
  if (/\bprotein\b/.test(t) && !FOOD.test(t) && !/\b(?:does\s+(?:an?\s+)?(?!(?:a|an)\s+(?:man|woman|male|female|teen|person|athlete|runner|lifter|bodybuilder|pregnant|\d))\w+\s+have|is\s+in|shake\s+recipe|powder\s+(?:brand|best)|structure|synthesis\s+in\s+biology|meaning|define|translate|bar\s+recipe|foods?\s+(?:high|rich)|sources?\s+of|high\s+protein\s+(?:foods?|meals?|snacks?|recipes?))\b/.test(t)
    && (/^(?:how\s+much|how\s+many\s+(?:grams|g)(?:\s+of)?)\s+protein\b/.test(t)
      || /^(?:recommended|daily|ideal)\s+(?:daily\s+)?protein\s+(?:intake|needs?|requirement)\b/.test(t)
      || /^protein\s+(?:intake|needs?|requirement)s?\s+(?:a|per|for|to)\b/.test(t)
      || /^protein\s+(?:to|for)\s+(?:build|gain|grow|lose)\b/.test(t)))
    return { kind: 'pro', s, t };
  // calories: how many a day
  if (/\bcalor(?:ie|ies|ic)\b|\btdee\b|\bbmr\b|\bmetabolic\s+rate\b/.test(t) && !FOOD.test(t) && !OFFC.test(t)
    && (/(?:^|[,.;]\s*|\b(?:so|and|then)\s+)how\s+many\s+calories\s+(?:should|do|does|must|can|would)\s+(?:i|you|a\s+.+|an?\s+.+|.+)\s+(?:eat|have|consume|need|take\s+in|be\s+eating|burn)\b/.test(t)
      || /^how\s+many\s+calories\s+(?:a|per)\s+day\s+(?:should|do|to|for)\b/.test(t)
      || /^how\s+many\s+calories\s+(?:to|for)\s+(?:lose|gain|maintain|bulk|cut|build)\b.*\b(?:a|per|each)\s+(?:week|day|month)\b/.test(t)
      || /^how\s+many\s+calories\s+(?:to|for)\s+(?:lose\s+weight|gain\s+weight|maintain(?:\s+(?:my\s+)?weight)?|bulk|cut|build\s+muscle)$/.test(t)
      || /^(?:what\s+(?:is|are|'s)\s+|whats\s+|calculate\s+|work\s+out\s+|find\s+)?(?:my\s+)?(?:daily\s+)?(?:calorie\s+(?:needs?|intake|goal|target|budget)|maintenance\s+calories|tdee|bmr|basal\s+metabolic\s+rate|resting\s+metabolic\s+rate|total\s+daily\s+energy\s+expenditure)\b/.test(t)
      || /^(?:daily\s+)?calories?\s+(?:for|to)\s+(?:a\s+|an\s+)?(?:\d+|lose|gain|maintain|bulk|cut|male|female|man|woman|men|women|teen|my)\b/.test(t)
      || /^(?:recommended|daily|average|ideal)\s+(?:daily\s+)?calori(?:e|es)\s+(?:intake|needs?|for)\b/.test(t)
      || /^calories?\s+(?:a|per)\s+day\s+(?:to|for)\b/.test(t)))
    return { kind: 'cal', s, t };
  return null;
}

function bmr(s, sex) { return 10 * s.kg + 6.25 * s.cm - 5 * (s.age || 30) + (sex === 'f' ? -161 : 5); }
function calRows(tdee, sex, metric) {
  const floor = sex === 'f' ? 1200 : 1500;
  const steps = metric
    ? [['Lose 1 kg a week', -1100], ['Lose 0.5 kg a week', -550], ['Lose 0.25 kg a week', -275], ['Keep your weight', 0], ['Gain 0.25 kg a week', 275], ['Gain 0.5 kg a week', 550]]
    : [['Lose 2 lb a week', -1000], ['Lose 1 lb a week', -500], ['Lose 0.5 lb a week', -250], ['Keep your weight', 0], ['Gain 0.5 lb a week', 250], ['Gain 1 lb a week', 500]];
  return steps.map(([label, d]) => { const raw = tdee + d; return { label, kcal: r10(Math.max(raw, d < 0 ? floor : 0)), floored: d < 0 && raw < floor, d }; });
}
function calc(s) {
  const act = s.act || ACT[1];
  const one = (sex) => { const b = bmr(s, sex); return { sex, bmr: r10(b), tdee: r10(b * act.f), rows: calRows(b * act.f, sex, s.metric || (s.rate && s.rate.kg)) }; };
  return { act, out: s.sex ? [one(s.sex)] : [one('m'), one('f')] };
}

const BIG = '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">';
const GREY = '<p style="color:#8a8a8a">';
function calHtml(s, esc) {
  const { act, out } = calc(s), main = out[0];
  const who = [s.age ? s.age + ' years' : 'age 30 (assumed)', s.sex === 'm' ? 'male' : s.sex === 'f' ? 'female' : null,
    s.ftin || Math.round(s.cm) + ' cm', s.lb ? fmt(s.lb) + ' lb' : fmt(s.kg, 1) + ' kg'].filter(Boolean).join(', ');
  const want = s.rate && s.goal !== 'keep' ? (s.goal === 'gain' ? 'Gain ' : 'Lose ') + s.rate.n + (s.rate.kg ? ' kg' : ' lb') + ' a week' : null;
  const goal = want && main.rows.some((r) => r.label === want) ? want
    : s.goal === 'lose' || (s.rate && !s.goal) ? (s.metric ? 'Lose 0.5 kg a week' : 'Lose 1 lb a week') : s.goal === 'gain' ? (s.metric ? 'Gain 0.25 kg a week' : 'Gain 0.5 lb a week') : 'Keep your weight';
  const pick = (o) => o.rows.find((r) => r.label === goal);
  const head = out.length === 1 ? fmt(pick(main).kcal) : fmt(pick(out[0]).kcal) + ' / ' + fmt(pick(out[1]).kcal);
  const table = (o) => '<ul>' + o.rows.map((r) => '<li>' + (r.label === goal ? '<b>' : '') + esc(r.label) + ': ' + fmt(r.kcal) + ' calories a day'
    + (r.label === goal ? '</b>' : '') + (r.floored ? ' <span style="color:#8a8a8a">(held at the ' + fmt(r.kcal) + ' floor; go slower instead)</span>' : '') + '</li>').join('') + '</ul>';
  const protein = Math.round(s.kg * 1.2) + '\u2013' + Math.round(s.kg * 1.6) + ' g';
  return '<h2>Daily calories</h2><div class="sub">' + esc(who) + ' \u00b7 ' + esc(act.label) + (s.act ? '' : ' (assumed; say how active you are)') + '</div>'
    + BIG + esc(head) + '<span style="font-size:18px"> calories a day</span></div>'
    + '<div class="sub">' + esc(goal.toLowerCase()) + (out.length === 2 ? ' \u00b7 man / woman (say which for one number)' : '') + '</div>'
    + out.map((o) => (out.length === 2 ? '<div class="sub" style="margin-top:10px">' + (o.sex === 'm' ? 'Man' : 'Woman') + '</div>' : '')
      + table(o) + GREY + 'Resting burn (BMR) ' + fmt(o.bmr) + ' \u00b7 with your activity (TDEE) ' + fmt(o.tdee) + ' calories a day.</p>').join('')
    + (s.age && s.age < 18 ? GREY + 'This equation is built for adults; teens still growing usually need more, so treat it as the low end and ask their doctor.</p>' : '')
    + GREY + 'Mifflin-St Jeor, the equation dietitians trust most for a quick estimate, is usually within about 10% of a measured burn. Each pound is roughly 3,500 calories, but loss slows as you get lighter, so recheck every few kilos. Aim for about ' + esc(protein) + ' of protein a day (1.2\u20131.6 g per kg) to hold on to muscle. Ask "calorie calculator" to try other numbers.</p>' + SRC_CAL;
}
function calGeneral(esc) {
  return '<h2>Daily calories</h2><div class="sub">what most people need a day</div>' + BIG + '1,600\u20133,000<span style="font-size:18px"> calories</span></div>'
    + '<ul>' + DGA.map(([w, r]) => '<li>' + esc(w) + ': <b>' + esc(r) + '</b></li>').join('') + '</ul>'
    + GREY + 'The low end is for sitting most of the day, the high end for an active day. Food labels use 2,000 as a round guide. For your own number, fill in the calculator below or ask "calories for a 30 year old male 5\'10 180 lbs moderately active".</p>';
}
function calForm(el, s, esc) {
  const box = el.querySelector('#nu-form');
  box.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0">'
    + '<select id="nu-sex" aria-label="sex"><option value="m">man</option><option value="f">woman</option></select>'
    + '<input id="nu-age" type="number" min="13" max="100" value="' + (s.age || 30) + '" style="width:64px" aria-label="age"> years'
    + '<select id="nu-u" aria-label="units"><option value="us">ft / lb</option><option value="m">cm / kg</option></select>'
    + '<span id="nu-hus"><input id="nu-ft" type="number" min="4" max="7" value="5" style="width:48px" aria-label="feet"> ft <input id="nu-in" type="number" min="0" max="11" value="9" style="width:48px" aria-label="inches"> in</span>'
    + '<span id="nu-hm" hidden><input id="nu-cm" type="number" min="120" max="230" value="175" style="width:64px" aria-label="height in cm"> cm</span>'
    + '<input id="nu-w" type="number" min="30" max="700" value="170" style="width:64px" aria-label="weight"> <span id="nu-wu">lb</span>'
    + '<select id="nu-act" aria-label="activity">' + ACT.map((a, i) => '<option value="' + i + '"' + (i === 1 ? ' selected' : '') + '>' + esc(a.label) + '</option>').join('') + '</select></div>'
    + '<div id="nu-out" aria-live="polite"></div>';
  const q = (id) => box.querySelector('#' + id), out = q('nu-out');
  if (s.sex) q('nu-sex').value = s.sex;
  if (s.kg) { if (s.metric) { q('nu-u').value = 'm'; q('nu-w').value = Math.round(s.kg); } else q('nu-w').value = Math.round(s.lb || s.kg / LB); }
  if (s.cm) { q('nu-cm').value = Math.round(s.cm); q('nu-ft').value = Math.floor(s.cm / 2.54 / 12); q('nu-in').value = Math.round(s.cm / 2.54 % 12) % 12; }
  if (s.act) q('nu-act').value = String(ACT.indexOf(s.act));
  const upd = () => {
    const metric = q('nu-u').value === 'm';
    q('nu-hus').hidden = metric; q('nu-hm').hidden = !metric; q('nu-wu').textContent = metric ? 'kg' : 'lb';
    const w = +q('nu-w').value, age = +q('nu-age').value;
    const cm = metric ? +q('nu-cm').value : (+q('nu-ft').value * 12 + +q('nu-in').value) * 2.54;
    if (!(w > 0) || !(cm > 0) || !(age >= 13)) { out.textContent = 'fill in each box'; return; }
    const st = { kg: metric ? w : w * LB, cm, age, sex: q('nu-sex').value, act: ACT[+q('nu-act').value], metric };
    const o = calc(st).out[0];
    out.innerHTML = '<div class="sub">to keep your weight</div>' + BIG + fmt(o.tdee) + '<span style="font-size:18px"> calories a day</span></div>'
      + '<ul>' + o.rows.map((r) => '<li>' + esc(r.label) + ': ' + fmt(r.kcal) + (r.floored ? ' (floor)' : '') + '</li>').join('') + '</ul>'
      + GREY + 'Resting burn (BMR) ' + fmt(o.bmr) + ' calories a day.</p>';
  };
  box.querySelectorAll('input,select').forEach((n) => n.addEventListener('input', upd));
  box.querySelectorAll('select').forEach((n) => n.addEventListener('change', upd));
  upd();
}

function proHtml(s, esc) {
  if (!s.kg) {
    return '<h2>Protein a day</h2><div class="sub">the minimum (RDA), with no weight given</div>' + BIG + '46\u201356 g</div>'
      + '<ul><li>Women: <b>46 g</b> a day \u00b7 men: <b>56 g</b> (0.8 g per kg, about 0.36 g per lb)</li>'
      + '<li>Pregnant or breastfeeding: <b>71 g</b></li><li>Exercising regularly: <b>1.4\u20132.0 g per kg</b> (ISSN)</li>'
      + '<li>Building muscle: gains level off around <b>1.6 g per kg</b> (Morton 2018)</li><li>65 and older: <b>1.0\u20131.2 g per kg</b> to keep muscle (PROT-AGE)</li></ul>'
      + GREY + 'Give your weight for your own numbers, like "how much protein do i need if i weigh 180 pounds".</p>' + SRC_PRO;
  }
  const kg = s.kg, w = s.lb ? fmt(s.lb) + ' lb' : fmt(kg, 1) + ' kg';
  const g = (x) => Math.round(kg * x);
  const target = s.lift ? [g(1.6), g(2.2)] : s.old ? [g(1.0), g(1.2)] : s.goal === 'lose' ? [g(1.2), g(1.6)] : s.act && s.act.f >= 1.55 ? [g(1.4), g(2.0)] : null;
  const why = s.lift ? 'to build muscle (1.6\u20132.2 g per kg)' : s.old ? 'past 65, to keep muscle (1.0\u20131.2 g per kg)' : s.goal === 'lose' ? 'while losing weight, to keep muscle (1.2\u20131.6 g per kg)' : target ? 'for regular exercise (1.4\u20132.0 g per kg)' : 'the minimum (RDA, 0.8 g per kg)';
  const head = target ? target[0] + '\u2013' + target[1] + ' g' : g(0.8) + ' g';
  const meal = target ? Math.round(target[0] / 4) : Math.round(g(0.8) / 3);
  return '<h2>Protein a day</h2><div class="sub">' + esc(w) + ' \u00b7 ' + esc(why) + '</div>' + BIG + esc(head) + '</div>'
    + '<ul><li>Minimum (RDA, 0.8 g/kg): <b>' + g(0.8) + ' g</b>' + (s.preg ? ' \u00b7 pregnant or breastfeeding: <b>' + Math.max(71, g(1.1)) + ' g</b>' : '') + '</li>'
    + '<li>Exercising regularly (1.4\u20132.0 g/kg): <b>' + g(1.4) + '\u2013' + g(2.0) + ' g</b></li>'
    + '<li>Building muscle: gains level off near 1.6 g/kg = <b>' + g(1.6) + ' g</b>, up to ' + g(2.2) + ' g</li>'
    + '<li>Losing weight (1.2\u20131.6 g/kg): <b>' + g(1.2) + '\u2013' + g(1.6) + ' g</b></li>'
    + '<li>65 and older (1.0\u20131.2 g/kg): <b>' + g(1.0) + '\u2013' + g(1.2) + ' g</b></li></ul>'
    + GREY + 'Spread it out: about ' + meal + ' g a meal. For a sense of size, 100 g of cooked chicken breast has about 31 g, an egg about 6 g, a cup of cooked lentils about 18 g. With kidney disease, ask your doctor before eating more protein.</p>' + SRC_PRO;
}

function h2oHtml(s, t, esc) {
  const row = WATER.find((r) => r.re.test(t || '')) || null;
  const oz = (l) => fmt(l / 0.0295735);
  const extra = '<li>Exercise or heat: add about 0.5\u20131 L (2\u20134 cups) for each hour you sweat (sweat runs 0.5\u20132 L an hour)</li>';
  const ruleW = s.lb || (s.kg ? s.kg / LB : 0);
  const rule = ruleW ? GREY + 'The "half your weight in ounces" rule would say ' + fmt(ruleW / 2) + ' oz (' + fmt(ruleW / 2 * 0.0295735, 1) + ' L) for ' + fmt(ruleW) + ' lb. It is a rule of thumb, not the official advice, but it lands close to the numbers above for most adults.</p>' : '';
  if (row) {
    return '<h2>Water a day</h2><div class="sub">' + esc(row.who) + '</div>' + BIG + esc(fmt(row.drinks, 1)) + ' L<span style="font-size:18px"> to drink (about ' + row.cups + ' cups, ' + oz(row.drinks) + ' fl oz)</span></div>'
      + '<ul><li>In all, food included: <b>' + fmt(row.total, 1) + ' L</b> a day' + (row.both ? ' (' + esc(row.both) + ')' : '') + '</li>' + extra + '</ul>'
      + GREY + 'About a fifth of the water you need comes from food. Coffee, tea and milk count toward it. Pale yellow pee means you are drinking enough.</p>' + rule + SRC_H2O;
  }
  return '<h2>Water a day</h2><div class="sub">adults, by the National Academies</div>' + BIG + '9\u201313 cups<span style="font-size:18px"> to drink</span></div>'
    + '<ul><li>Men: <b>3.0 L</b> to drink (about 13 cups, ' + oz(3.0) + ' fl oz), 3.7 L in all with food</li>'
    + '<li>Women: <b>2.2 L</b> to drink (about 9 cups, ' + oz(2.2) + ' fl oz), 2.7 L in all</li>'
    + '<li>Pregnant: 2.3 L to drink (10 cups) \u00b7 breastfeeding: 3.1 L (13 cups)</li>' + extra + '</ul>'
    + GREY + 'The old "8 glasses a day" is close for women and a little low for men. About a fifth of the water you need comes from food, and coffee, tea and milk count. Pale yellow pee means you are drinking enough; thirst is a fine guide for most healthy people.</p>' + rule + SRC_H2O;
}

// Page memory (30 min, this page only): the last body numbers, so follow-ups can change one thing and redo the card.
// "what if i'm very active", "to lose 2 pounds a week", "i'm a woman", "i weigh 200", "and protein", "and water".
// Other body skills (heart.js) read the same numbers with lastStatsOf() and share theirs with shareBody().
const FOLLOW_MS = 30 * 60 * 1000;
let last = null; // { s, kind, owner, at }
const BODY = ['kg', 'lb', 'cm', 'ftin', 'age', 'sex', 'metric', 'act', 'goal', 'rate', 'preg', 'lift', 'old'];
function hasBody(s) { return !!(s.kg || s.cm || s.age || s.sex); }
function remember(s, kind, owner) {
  const keep = {}; for (const k of BODY) if (s[k] != null) keep[k] = s[k];
  last = { s: keep, kind, owner: owner || 'nutrition', at: Date.now() };
}
export function lastStatsOf() { return last && Date.now() - last.at <= FOLLOW_MS ? last : null; }
export function shareBody(patch, owner, kind) { // another body skill adds what it learned (age, sex) and says it spoke last
  const prev = lastStatsOf(), s = Object.assign({}, prev ? prev.s : {}, patch || {});
  remember(s, kind || (prev ? prev.kind : null), owner);
}
function waterText(s) { return s.preg === 'preg' ? 'pregnant' : s.preg === 'bf' ? 'breastfeeding' : s.sex === 'f' ? 'women' : s.sex === 'm' ? 'men' : ''; }
const STRIP = [
  /\b(?:0?\.25|a\s+quarter\s+(?:of\s+)?a|0?\.5|half\s+(?:a|of\s+a)|1|one|a|2|two)\s*(?:lbs?|pounds?|kgs?|kilos?|kilograms?)\s*(?:a|per|each|every)\s+week\b/g,
  /\b\d{2,3}(?:\.\d+)?\s*(?:lbs?|pounds?|kgs?|kilos?|kilograms?)\b/g,
  /\b[4-7]\s*(?:'|ft\.?|foot|feet)(?:\s*(?:1[01]|\d(?:\.\d)?)(?![\d.])\s*(?:"|''|in\.?|inch(?:es)?)?)?/g,
  /\b(?:1[2-9]\d|2[0-2]\d)\s*(?:cm|centimet(?:er|re)s?)\b/g, /\b[12][.,]\d{1,2}\s*(?:m|met(?:er|re)s?)\b/g,
  /\b(?:1[3-9]|[2-9]\d)\s*(?:-\s*)?(?:years?|yrs?|y\/?o)(?:\s*-?\s*old)?\b/g, /\bage(?:d)?\s*(?:1[3-9]|[2-9]\d)\b/g,
  /\b(?:i\s*(?:am|'m|m)|im)\s+(?:a\s+)?(?:1[3-9]|[2-9]\d)\b/g, /\bweigh(?:ing)?\s+\d{2,3}(?:\.\d+)?\b/g,
  /\b(?:male|female|man|woman|men|women|guy|girl|lady|boy|dude)\b/g, /\b(?:pregnant|breast-?\s?feeding|nursing)\b/g,
  /\b(?:lose|losing|lost|cut(?:ting)?|deficit|weight\s+loss|slim\s+down|drop|shed|diet(?:ing)?|fat\s+loss|lean\s+out|gain|gaining|bulk(?:ing)?|surplus|put\s+on\s+weight|build\s+muscle|weight\s+gain|maintain|maintenance|keep\s+(?:my\s+|the\s+same\s+)?weight|stay\s+the\s+same|lift(?:ing)?|gym|strength\s+train(?:ing)?)\b/g
];
const FILL = /\b(?:i'm|i'd|im|what|how|about|if|and|but|so|now|ok|okay|then|instead|too|i|am|was|were|a|an|for|at|to|make|it|me|my|weight|weigh|want|wanna|like|would|be|is|say|let's|lets|please|actually|really|years?|old|tall|with|someone|who|person|the|same|numbers?|change|set|update|use|go|try|rather|just|only|do|exercise|work|out|active)\b/g;
function followOf(text) {
  const prev = lastStatsOf();
  if (!prev) return null;
  const t = clean(text).replace(/[,.;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 90) return null;
  let m;
  // another card for the same person
  if ((m = t.match(/^(?:(?:and|now|ok|okay|so|but)\s+)?(?:(?:what|how)\s+about\s+|and\s+|how\s+much\s+|how\s+many\s+|show\s+(?:me\s+)?)?(?:my\s+|the\s+)?(protein|water|calories|bmr|tdee)(?:\s+(?:too|then|for\s+me|a\s+day|intake|as\s+well|should\s+i\s+(?:eat|drink|have)(?:\s+a\s+day)?))?$/))) {
    const kind = m[1] === 'protein' ? 'pro' : m[1] === 'water' ? 'h2o' : 'cal';
    const s = Object.assign({}, prev.s);
    return { kind, s, t: kind === 'h2o' ? waterText(s) : '', follow: true };
  }
  if (prev.owner !== 'nutrition' || !prev.kind) return null; // stat-only follow-ups belong to whichever body card spoke last
  // one or more numbers changed: strip what we understand; anything left over means it is some other ask
  let rest = t; for (const re of STRIP) rest = rest.replace(re, ' ');
  for (const a of [...ACT].reverse()) rest = rest.replace(new RegExp(a.re.source, 'g'), ' ');
  rest = rest.replace(FILL, ' ').replace(/['"]/g, ' ').trim();
  if (rest) return null;
  const d = statsOf(t);
  if (!Object.keys(d).length) return null;
  const s = Object.assign({}, prev.s);
  if (d.kg) { s.kg = d.kg; delete s.lb; if (d.lb) s.lb = d.lb; s.metric = !!d.metric; }
  if (d.cm) { s.cm = d.cm; delete s.ftin; if (d.ftin) s.ftin = d.ftin; }
  for (const k of ['age', 'sex', 'act', 'goal', 'rate', 'preg', 'lift']) if (d[k] != null) s[k] = d[k];
  if (d.rate && !d.goal && !s.goal) s.goal = 'lose';
  if (d.goal && !d.rate) delete s.rate;
  if (d.sex === 'm') delete s.preg;
  s.old = !!(s.age && s.age >= 65);
  return { kind: prev.kind, s, t: prev.kind === 'h2o' ? waterText(s) : '', follow: true };
}

async function run(text, api) {
  const { showPage, esc } = api;
  let q = askOf(text);
  if (!q) q = followOf(text);
  if (!q) return 'none';
  const s = q.s; s.t = q.t;
  // "how much protein do i need" after giving your numbers uses them
  const prev = lastStatsOf(); let reused = '';
  if (!q.follow && !q.form && !hasBody(s) && prev && hasBody(prev.s) && /\b(?:i|my|me)\b/.test(clean(text))) {
    for (const k of BODY) if (s[k] == null && prev.s[k] != null) s[k] = prev.s[k];
    if (q.kind === 'h2o' && !WATER.some((r) => r.re.test(q.t || ''))) q.t = waterText(s);
    reused = 'your numbers from the last ask';
  }
  if (q.follow) reused = 'your last numbers with the change';
  const note = reused ? GREY + 'Worked out from ' + esc(reused) + '. Change one thing at a time, like "what if i\'m very active", "to lose 2 pounds a week", "i\'m a woman", "i weigh 200", or ask "and protein", "and water" or "my heart rate zones".</p>' : '';
  if (hasBody(s) || s.act || s.goal) remember(s, q.kind);
  if (q.kind === 'cal') {
    if (s.kg && s.cm) { showPage((el) => { el.innerHTML = calHtml(s, esc).replace(SRC_CAL, note + SRC_CAL); }); return 'nutrition'; }
    const el = showPage((p) => { p.innerHTML = (q.form ? '<h2>Calorie calculator</h2><div class="sub">your calories a day (Mifflin-St Jeor)</div>' : calGeneral(esc)) + '<div id="nu-form"></div>' + note + SRC_CAL; });
    calForm(el, s, esc);
    return 'nutrition';
  }
  if (q.kind === 'pro') { showPage((el) => { el.innerHTML = proHtml(s, esc).replace(SRC_PRO, note + SRC_PRO); }); return 'nutrition'; }
  showPage((el) => { el.innerHTML = h2oHtml(s, q.t, esc).replace(SRC_H2O, note + SRC_H2O); });
  return 'nutrition';
}

export { askOf, statsOf, calc, bmr, followOf, clean };
export default {
  name: 'nutrition',
  examples: [
    'how many calories should i eat a day',
    'calories for a 30 year old male 5\'10 180 lbs moderately active',
    'how many calories should a 25 year old woman 165 cm 60 kg eat to lose weight',
    'calorie calculator',
    'how much protein do i need if i weigh 180 pounds',
    'how much protein do i need',
    'how much water should i drink a day',
    'how many glasses of water should i drink a day'
  ],
  nearMisses: [
    'how many calories in a banana',
    'calories burned running 5 miles',
    'how many calories to lose a pound',
    'how much protein in an egg',
    'how much water is in the ocean',
    'what is my bmi 5 foot 10 180 pounds'
  ],
  match(lower, text) { return !!askOf(text) || !!followOf(text); },
  run
};
