// Which asks the weather skill takes (skills/weather.js match): the forecast phrasings people type, and the look-alikes it leaves
// to the calculator, the calendar and the kitchen. Run: node --test tools/weather-match.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import weather, { weatherPlace, askedDays, askedDayLabel, weatherPageOf } from '../void-live-deploy/skills/weather.js';

const takes = (a) => weather.match(a.toLowerCase(), a);

test('weather: forecast phrasings people type', () => {
  for (const a of ['how cold will it be tonight', 'how hot will it get tomorrow', 'should i wear a jacket today', 'chance of rain today',
    "what's the high today", 'the low tonight', 'is there a storm coming', 'dew point today', 'what to wear in london tomorrow',
    'is it freezing tonight', 'is it going to be foggy tomorrow', 'chance of snow this weekend', 'wind chill today', 'heat index',
    'weather in Tokyo', 'will it rain tomorrow', 'do i need an umbrella today'])
    assert.ok(takes(a), a);
});

test('weather: look-alikes it leaves alone', () => {
  for (const a of ['what to wear to a wedding', 'what to wear for an interview', 'freezing point of water', 'chance of winning the lottery',
    'high school near me', 'temperature to cook chicken', 'medium rare steak temperature', 'well done steak temp', 'pollen count today', 'is there a meeting today', 'what is the dew point definition of',
    'the high road', 'storm area 51', 'should i wear a tie to the interview'])
    assert.ok(!takes(a), a);
});

// The actionable prompt (asked by Verse): rain, snow, frost or heat in the next hours offers one ask the timer skill takes.
import { weatherPrompt } from '../void-live-deploy/skills/weather.js';
import { wantsCreate } from '../void-live-deploy/skills/timer.js';
const H = (over) => ({ time: Array.from({ length: 8 }, (_, i) => '2026-10-16T' + String(13 + i).padStart(2, '0') + ':00'), temperature_2m: Array(8).fill(12), precipitation_probability: Array(8).fill(5), weather_code: Array(8).fill(1), ...over });
const NOW = Date.parse('2026-10-16T12:40:00'); // twenty to one, in the forecast's own clock
test('weather prompt: rain, snow, frost and heat, timed to the hour before; a dry mild day offers nothing', () => {
  const rain = weatherPrompt(H({ precipitation_probability: [5, 10, 70, 80, 60, 20, 5, 5], weather_code: [1, 1, 61, 63, 61, 2, 1, 1] }), NOW);
  assert.equal(rain.kind, 'rain'); assert.equal(rain.minutes, 80); assert.equal(rain.ask, 'remind me to bring an umbrella in 80 minutes'); assert.match(rain.why, /Rain from 3pm \(70% chance\)/); assert.equal(rain.at, '2pm');
  assert.equal(weatherPrompt(H({ precipitation_probability: [60, 60, 5, 5, 5, 5, 5, 5] }), NOW).ask, 'remind me to bring an umbrella in 20 minutes', 'rain in the first hour: the minutes to that hour');
  assert.equal(weatherPrompt(H({ precipitation_probability: [60, 60, 5, 5, 5, 5, 5, 5] }), Date.parse('2026-10-16T13:30:00')).minutes, 5, 'already raining: five minutes, never a past time');
  assert.equal(weatherPrompt(H({ weather_code: [1, 1, 1, 73, 73, 1, 1, 1] }), NOW).kind, 'snow');
  assert.equal(weatherPrompt(H({ temperature_2m: [3, 1, -1, -2, -2, 0, 2, 3] }), NOW).ask, 'remind me to cover the plants, frost tonight in 80 minutes');
  assert.equal(weatherPrompt(H({ temperature_2m: [28, 31, 33, 34, 33, 30, 28, 26] }), NOW).ask, 'remind me to drink water and find shade in 80 minutes');
  assert.equal(weatherPrompt(H({}), NOW), null); assert.equal(weatherPrompt(null, NOW), null);
  assert.equal(weatherPrompt(H({ precipitation_probability: [5, 5, 5, 5, 5, 5, 5, 5, 90] }), NOW), null, 'past the hours shown is not a prompt');
  for (const p of [rain, weatherPrompt(H({ weather_code: [1, 1, 1, 73, 73, 1, 1, 1] }), NOW), weatherPrompt(H({ temperature_2m: [3, 1, -1, -2, -2, 0, 2, 3] }), NOW)]) assert.ok(wantsCreate(p.ask.toLowerCase()), p.ask + ' is an ask the timer skill takes');
});

test('the weather card: hours from the hour now, visibility as people read it, and a seven-day graph with a line, bars and the days named', async () => {
  const { hourlyFrom, visText, graph } = await import('../void-live-deploy/skills/weather.js');
  assert.deepEqual(hourlyFrom({ time: ['a', 'b', 'c'], temperature_2m: [1, 2, 3], units: 'x' }, 1), { time: ['b', 'c'], temperature_2m: [2, 3], units: 'x' });
  assert.equal(visText(24140), '24 km'); assert.equal(visText(2500), '2.5 km'); assert.equal(visText(800), '800 m'); assert.equal(visText(24140, true), '15 mi');
  const time = Array.from({ length: 168 }, (_, i) => { const d = new Date(Date.UTC(2026, 9, 26) + i * 36e5); return d.toISOString().slice(0, 13) + ':00'; });
  const g = graph({ time, temperature_2m: time.map((_, i) => 10 + (i % 24)), precipitation_probability: time.map((_, i) => (i < 10 ? 50 : 0)) }, 5, false);
  assert.match(g, /Hour by hour to 7 days/); assert.equal((g.match(/<rect /g) || []).length, 10); assert.equal((g.match(/>(Sun|Mon|Tue|Wed|Thu|Fri|Sat)</g) || []).length, 7);
  assert.equal(g.match(/points="([^"]+)"/)[1].split(' ').length, 168); assert.match(g, />33°</); assert.match(g, />10°</);
  assert.equal(graph({ time: ['x'], temperature_2m: [1] }, 0, false), '', 'one hour is no graph');
});

// the miss board, 2026-10-29: "chance of rain today" was taken, then answered 'I couldn't find "chance of"' (203 asks): every ask match() takes
// with no place in it is a forecast for here, and a place named with or without "in" is still the place
test('weather: an ask it takes names a place only when it has one', () => {
  for (const a of ['chance of rain today', 'chance of snow this weekend', 'chance of thunderstorms tonight', 'is there a storm coming',
    'is there a hurricane on the way', "what's the high today", 'the low tonight', "tomorrow's high", 'what is the high temperature today',
    'dew point today', 'wind chill right now', 'heat index outside', 'what should i wear', 'should i bring a jacket', 'is it going to be foggy',
    'how cold will it get tonight', 'will it freeze tonight', 'is it going to rain tomorrow', 'weather tomorrow', 'will it snow this week', 'weather here'])
    assert.equal(weatherPlace(a), '', a);
  for (const [a, place] of [['chance of rain in London', 'London'], ['do i need an umbrella today in seattle', 'seattle'], ['humidity in Miami', 'Miami'],
    ['weather in Tokyo', 'Tokyo'], ['Tokyo weather', 'Tokyo'], ['temperature Paris', 'Paris'], ['weather New York City', 'New York City'],
    ['what is the weather like in Cape Town today', 'Cape Town'], ['High Point weather', 'High Point'], ['Wind Gap forecast', 'Wind Gap'], ['Low Moor weather', 'Low Moor']])
    assert.equal(weatherPlace(a), place, a);
});

test('weather: a weekday in the ask is a day, not part of the place (2026-10-30: live, "weather in paris on saturday" looked for "paris on saturday")', () => {
  for (const [a, place] of [['weather in paris on saturday', 'paris'], ['weather in paris saturday', 'paris'], ['forecast for Tokyo on Sunday', 'Tokyo'],
    ['weather in Rome next monday', 'Rome'], ['weather on friday', ''], ['weather in paris this weekend', 'paris']]) {
    assert.ok(takes(a), a);
    assert.equal(weatherPlace(a), place, a);
  }
});

test('weather: the days an ask names get their own line (2026-10-30: live, "weather in paris this weekend" showed today only)', () => {
  const fri = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
  const sun = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
  assert.deepEqual(askedDays('weather in paris this weekend', fri), [1, 2]);
  assert.deepEqual(askedDays('weather this weekend', sun), [], 'on a Sunday the weekend is today, which has its own line');
  assert.deepEqual(askedDays('will it rain tomorrow', fri), [1]);
  assert.deepEqual(askedDays('weather in tokyo on tuesday', fri), [4]);
  assert.deepEqual(askedDays('weather on friday', fri), [], 'today');
  assert.deepEqual(askedDays('weather in paris', fri), []);
  assert.equal(askedDayLabel(1, fri[1]), 'Saturday (tomorrow)');
  assert.equal(askedDayLabel(2, fri[2]), 'Sunday');
});

test("weather: the card's full page keeps the place (2026-10-30: live, \"weather in paris\" opened the bare /weather/)", async () => {
  const { pageOfCard } = await import('../void-live-deploy/lib/card-frame.js');
  const paris = weatherPageOf({ name: 'Paris, Île-de-France Region, France', latitude: 48.85341, longitude: 2.3488 }, 'paris');
  assert.equal(paris, '/weather/?q=Paris%2C%20%C3%8Ele-de-France%20Region%2C%20France&ll=48.85341%2C2.3488');
  assert.deepEqual(pageOfCard('weather', paris), [paris, 'Weather']);
  const apos = weatherPageOf({ name: "Côte d'Ivoire", latitude: 7.5, longitude: -5.5 }, "cote d'ivoire");
  assert.equal(pageOfCard('weather', apos)[0], apos, 'an apostrophe is escaped, so the link keeps the place');
  const long = weatherPageOf({ name: 'X'.repeat(190), latitude: 1, longitude: 2 }, 'x town');
  assert.equal(long, '/weather/?q=x%20town');
  const page = new URLSearchParams(paris.slice(paris.indexOf('?')));
  assert.equal(page.get('q'), 'Paris, Île-de-France Region, France'); assert.equal(page.get('ll'), '48.85341,2.3488');
});
