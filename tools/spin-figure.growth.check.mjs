import assert from 'node:assert/strict';
import skill from '../void-live-deploy/skills/spin-figure.js';
assert.ok(skill.spinFigureOf('spin the figure'));
assert.equal(skill.yawAfter(0, 180), Math.PI);
assert.equal(skill.spinFigureOf('spin motelet'), null);
console.log('spin-figure check ok');
