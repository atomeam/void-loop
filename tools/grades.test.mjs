// tools/grades.test.mjs: the grades skill's category-weighted class grade and the grade a final left you with (pure, no browser)
import assert from 'node:assert/strict';
const g = await import(new URL('../void-live-deploy/skills/grades.js', import.meta.url).href);
const c = g.gradesOf('homework 95 worth 20%, tests 78 worth 50%, quizzes 88 worth 30%');
assert.equal(c.kind, 'cats'); assert.equal(c.cats.length, 3);
assert.ok(Math.abs(g.catsMath(c.cats).grade - 84.4) < 1e-9); // 19 + 39 + 26.4
const c2 = g.gradesOf('what is my grade with homework 20% 95, tests 50% 78 and quizzes 30% 88');
assert.deepEqual(c2.cats.map((x) => [x.name, x.score, x.weight]), [['homework', 95, 20], ['tests', 78, 50], ['quizzes', 88, 30]]);
const part = g.gradesOf('hw 90 (25%), labs 80 (25%)'); assert.equal(g.catsMath(part.cats).grade, 85); assert.equal(g.catsMath(part.cats).sum, 50);
assert.equal(g.gradesOf('homework 90 worth 60%, tests 80 worth 60%'), null); // weights over 100 are not a class
const f = g.gradesOf('i had an 85 and got a 92 on my final worth 20%, what is my grade now');
assert.deepEqual(f, { kind: 'finalResult', current: 85, final: 92, weight: 20 });
assert.equal(g.gradesOf('i have an 85 and my final is worth 20% what do i need to get a 90').kind, 'final'); // the forward ask is unchanged
for (const a of ['remind me to do homework at 5', 'i scored 90 on my final', 'what is the gpa of 3.5 and 4.0', 'when is my final exam']) assert.equal(g.gradesOf(a), null, a);
console.log('grades: ok');
