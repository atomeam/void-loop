import assert from 'node:assert/strict';
import skill from '../void-live-deploy/skills/summon-figure.js';
assert.ok(skill.summonFigureOf('summon a figure'));
assert.equal(skill.summonFigureOf('summon motelet'), null);
assert.equal(skill.match('summon a figure', 'summon a figure'), true);
console.log('summon-figure check ok');
