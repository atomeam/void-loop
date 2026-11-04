// Weights after the visible-progress rule. tools/will.py calls this once per gather. stdin: candidates. stdout: weights.
import { adjustWeights } from '../void-live-deploy/lib/visible.js';

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const text = Buffer.concat(chunks).toString('utf8').trim();
const cands = text ? JSON.parse(text) : [];
process.stdout.write(JSON.stringify(adjustWeights(cands)));
