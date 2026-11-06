// brain-par: the brain tests run their independent brains at once, each in its own worker thread. The merge bot runs at most 12 test files
// in one `node --test` call with a time limit (tools/skill-safety.mjs), and node runs 3 files at once on a 4-core runner, so a test file
// that builds its brains one after another held one core for its whole run (2026-10-30, #1985).
// The work and the numbers are the same: a worker runs the same function with the same seed, or the same test body with every assertion
// in it, and gives back plain numbers or the first failure.
// A test file that is loaded in a worker must not register its tests there: it imports `test` from here, which is node:test on the main
// thread and does nothing in a worker.
import nodeTest from 'node:test';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread } from 'node:worker_threads';

export const test = isMainThread ? nodeTest : () => {};

// at most one worker a core for each test file, so the 3 files node runs at once do not hold dozens of brains in memory together
const LIMIT = Math.max(2, availableParallelism()), queue = [];
let active = 0;
function slot(job) {
  return new Promise((resolve, reject) => {
    const go = () => { active++; job().then(resolve, reject).finally(() => { active--; const next = queue.shift(); if (next) next(); }); };
    if (active < LIMIT) go(); else queue.push(go);
  });
}
function work(code, data, what) {
  return slot(() => new Promise((resolve, reject) => {
    const w = new Worker(code, { eval: true, workerData: data });
    w.once('message', (m) => {
      if (m && m.failed) { const e = new Error(m.failed.message); e.stack = m.failed.stack; e.name = m.failed.name; reject(e); } else resolve(m && m.value);
    });
    w.once('error', reject);
    w.once('exit', (code) => { if (code) reject(new Error(what + ' worker exit ' + code)); });
  }));
}

/** calls the exported function fn of the module at url once for each list of arguments, each call in its own worker thread, and gives
 *  back the results in the same order. The module is the test file itself (import.meta.url). */
export function par(url, fn, argsList) {
  return Promise.all(argsList.map((args) => work(CALL, { url, fn, args }, fn)));
}

// the test bodies a worker can run, by name (filled only in a worker)
const bodies = new Map(), waiting = [];
/** a test whose body runs in its own worker thread. When the first of a file's ptests is reached, all of them start at once, so the
 *  independent tests of one file run together; a timing test placed before the first ptest runs before the workers start, as it did.
 *  The body keeps all its assertions: the worker runs it whole and the test fails with the body's first failure. url is the test file
 *  (import.meta.url). Only for a body that builds its own state and needs nothing from the page (no BroadcastChannel, no timing). */
export function ptest(url, name, body) {
  if (!isMainThread) { bodies.set(name, body); return; }
  let done = null;
  const start = () => { if (!done) { done = work(BODY, { url, par: import.meta.url, name }, name); done.catch(() => {}); } return done; }; // the test reports a failure
  waiting.push(start);
  nodeTest(name, () => { for (const s of waiting.splice(0)) s(); return start(); });
}
/** runs a registered body in a worker. */
export async function runBody(name) {
  const body = bodies.get(name);
  if (!body) throw new Error('no test body named ' + name);
  await body();
}

const SEND = "const send = (p) => (r) => p.postMessage({ value: r }), fail = (p) => (e) => p.postMessage({ failed: { message: String(e && e.message), stack: e && e.stack, name: e && e.name } });";
// what a worker runs: it loads the test file (whose tests do nothing there), calls the function or the body, and posts the result
const CALL = "const { parentPort, workerData: d } = require('node:worker_threads'); " + SEND + " import(d.url).then((m) => m[d.fn](...d.args)).then(send(parentPort), fail(parentPort));";
const BODY = "const { parentPort, workerData: d } = require('node:worker_threads'); " + SEND + " import(d.par).then((P) => import(d.url).then(() => P.runBody(d.name))).then(send(parentPort), fail(parentPort));";
