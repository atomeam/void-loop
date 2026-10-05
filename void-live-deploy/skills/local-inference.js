/**
 * local-inference skill — offline Ollama/DeepSeek gate for D1 ledger commits
 * local-inference skill ΓÇö offline Ollama/DeepSeek gate for D1 ledger commits
 * Runs a local heuristic check on candidate draft commits before they hit CI.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Examples: "validate this diff", "check ledger drift", "run local inference on draft"
 * Near misses: "what is local inference", "how does ollama work", "deepseek docs"
 */

const OLLAMA_BASE = 'http://localhost:11434';
const MODEL = 'deepseek-coder:6.7b'; // default, can be overridden via env

const SYSTEM_PROMPT = `You are a strict schema validator for Cloudflare D1 ledger commits.
Given a git diff and the target D1 schema state, determine if the commit introduces:
1. Ledger collisions (duplicate approval_id, duplicate spend.id, conflicting kv keys)
2. Promotion bottlenecks (pending spends without standing approval, budget exceeded)
3. Schema drift (missing tables, wrong column types, constraint violations)

Output ONLY a JSON object: { "pass": true, "issues": [] } or { "pass": false, "issues": ["..."] }`;

export async function checkLedgerDiff(diff, schemaState, model = MODEL) {
  const prompt = `DIFF:\n${diff}\n\nTARGET D1 SCHEMA STATE:\n${JSON.stringify(schemaState, null, 2)}`;

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      stream: false,
      options: { temperature: 0, num_predict: 512 }
    })
  });

  if (!res.ok) {
    throw new Error(`Ollama request failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const content = data.message?.content || data.response || '';

  try {
    const parsed = JSON.parse(content.trim());
    return {
      pass: parsed.pass === true,
      issues: Array.isArray(parsed.issues) ? parsed.issues : ['parse error: invalid JSON from model'],
      raw: content
    };
  } catch {
    return {
      pass: false,
      issues: ['parse error: model did not return valid JSON', content.slice(0, 200)],
      raw: content
    };
  }
}

export function localInferenceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:validate|check)\s+(?:this\s+)?(?:diff|ledger|draft)/.test(t)) return { kind: 'local-inference', label: 'Local Inference' };
  if (/^(?:run\s+)?local\s+inference\s+(?:on|for)\s+(?:this\s+)?(?:diff|draft)/.test(t)) return { kind: 'local-inference', label: 'Local Inference' };
  if (/^check\s+ledger\s+drift/.test(t)) return { kind: 'local-inference', label: 'Local Inference' };
  if (/^(?:validate|check)\s+(?:this\s+)?(?:diff|ledger|draft)\b/.test(t)) return { kind: 'local-inference', label: 'Local Inference' };
  if (/^(?:run\s+)?local\s+inference\s+(?:on|for)\s+(?:this\s+)?(?:diff|draft)\b/.test(t)) return { kind: 'local-inference', label: 'Local Inference' };
  if (/^check\s+ledger\s+drift\b/.test(t)) return { kind: 'local-inference', label: 'Local Inference' };
  if (/^check\s+this\s+commit\s+against\s+d1\s+schema\b/.test(t)) return { kind: 'local-inference', label: 'Local Inference' };
  return null;
}

export default {
  name: 'local-inference',
  examples: [
    'validate this diff',
    'check ledger drift',
    'run local inference on draft',
    'check this commit against d1 schema'
  ],
  nearMisses: [
    'what is local inference',
    'how does ollama work',
    'deepseek docs',
    'local model setup',
    'offline ai validation'
  ],
  match(lower, text) { return !!localInferenceOf(text); },
  async run(text, api) {
    const q = localInferenceOf(text);
    if (!q) return 'none';

    const { showPage, esc } = api;
    const el = showPage((p) => {
      p.innerHTML = '<h2>' + esc(q.label) + '</h2><div class="sub">Paste a diff and schema state to validate locally via Ollama/DeepSeek</div><div class="vlocal"></div>';
    });

    const box = el.querySelector('.vlocal');
    box.innerHTML = `
      <style>
        .vlocal { display: grid; gap: 12px; font-family: ui-monospace, monospace; }
        .vlocal textarea { width: 100%; min-height: 180px; padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,.2); background: #0b0b13; color: #e6e6ea; font-family: inherit; font-size: 13px; resize: vertical; }
        .vlocal label { color: #9a9aa6; font-size: 12px; }
        .vlocal button { padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.06); color: #e6e6ea; cursor: pointer; }
        .vlocal button:hover { background: rgba(255,255,255,.12); }
        .vlocal .result { padding: 12px; border-radius: 8px; font-size: 13px; white-space: pre-wrap; }
        .vlocal .pass { background: rgba(80, 200, 120, .15); border: 1px solid #50c878; color: #50c878; }
        .vlocal .fail { background: rgba(235, 70, 70, .15); border: 1px solid #eb4646; color: #eb4646; }
        .vlocal .loading { opacity: .6; }
      </style>
      <label>Git Diff</label>
      <textarea id="diff" placeholder="git diff HEAD~1..HEAD -- void-live-deploy/..."></textarea>
      <label>Target D1 Schema State (JSON)</label>
      <textarea id="schema" placeholder='{"tables": {"void_ledger": {"columns": ["id", "kind", "approval_id", "amount"]}}, "kv": {"router:paid:total": "string"}}'></textarea>
      <button id="run">Validate Locally</button>
      <div id="out"></div>
    `;

    const diffEl = box.querySelector('#diff');
    const schemaEl = box.querySelector('#schema');
    const runBtn = box.querySelector('#run');
    const outEl = box.querySelector('#out');

    runBtn.onclick = async () => {
      runBtn.disabled = true;
      runBtn.classList.add('loading');
      runBtn.textContent = 'Validating…';
      runBtn.textContent = 'ValidatingΓÇª';
      outEl.textContent = '';
      outEl.className = 'result';

      try {
        const diff = diffEl.value.trim();
        const schemaText = schemaEl.value.trim();
        let schemaState = {};
        try { schemaState = JSON.parse(schemaText); } catch { schemaState = { error: 'invalid JSON' }; }

        const result = await checkLedgerDiff(diff, schemaState);
        outEl.className = 'result ' + (result.pass ? 'pass' : 'fail');
        outEl.textContent = JSON.stringify({ pass: result.pass, issues: result.issues }, null, 2);
      } catch (e) {
        outEl.className = 'result fail';
        outEl.textContent = 'Error: ' + e.message;
      } finally {
        runBtn.disabled = false;
        runBtn.classList.remove('loading');
        runBtn.textContent = 'Validate Locally';
      }
    };

    return 'local-inference';
  }
};
