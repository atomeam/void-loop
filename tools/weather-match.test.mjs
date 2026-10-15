// Which asks the weather skill takes (skills/weather.js match): the forecast phrasings people type, and the look-alikes it leaves
// to the calculator, the calendar and the kitchen. Run: node --test tools/weather-match.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import weather from '../void-live-deploy/skills/weather.js';

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
