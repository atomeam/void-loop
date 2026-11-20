// lib/ask-shapes.js names one skill file for each family of asks with no fixed words. The page loads that file at once, so the ask is never
// answered before it arrives. That is only safe if no skill ranked above that file takes any ask of the shape: proved here with the real skills.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { shapeFile } from '../void-live-deploy/lib/ask-shapes.js';
import { sureLanding } from './first-asks.mjs';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../void-live-deploy/skills');
const names = JSON.parse(readFileSync(resolve(dir, 'index.json'), 'utf8'));
const mods = []; for (const n of names) mods.push((await import(pathToFileURL(resolve(dir, n + '.js')).href)).default);

const CITIES = ['Lakeland Florida', 'Lakeland', 'Tokyo', 'Paris', 'New York', 'Denver', 'Lisbon', 'Bergen', 'Sydney', 'Mumbai', 'Cairo', 'Mexico City', 'Toronto', 'Berlin', 'Oslo', "St. John's", 'San Francisco', 'Tampa', 'Orlando', 'Miami'];
const DISHES = ['chocolate chip cookies', 'lasagna', 'pancakes', 'guacamole', 'chicken soup', 'banana bread', 'pasta carbonara', 'shakshuka', 'beef stew', 'apple pie', 'fried rice', 'tomato soup'];

test('weather shapes: every ask lands on the time file, with no skill above it taking it', () => {
  for (const c of CITIES) for (const a of [`weather in ${c}`, `what's the weather in ${c}`, `${c} weather`, `forecast for ${c}`, `temperature in ${c}`]) {
    assert.equal(shapeFile(a.toLowerCase()), 'time', a);
    assert.equal(sureLanding(mods, names, a), 'time', 'a skill above time takes: ' + a);
  }
});
test('recipe shapes: every ask lands on the recipe file, with no skill above it taking it', () => {
  for (const d of DISHES) for (const a of [`give me a recipe for ${d}`, `recipe for ${d}`, `${d} recipe`, `how do i make ${d}`, `how to make ${d}`]) {
    assert.equal(shapeFile(a.toLowerCase()), 'recipe', a);
    assert.equal(sureLanding(mods, names, a), 'recipe', 'a skill above recipe takes: ' + a);
  }
});
test('asks of no shape name no file', () => {
  for (const a of ['', 'how do i change a flat tire', 'weather', 'recipe', 'play snake', 'x'.repeat(200) + ' recipe']) assert.equal(shapeFile(a), '', a);
});
