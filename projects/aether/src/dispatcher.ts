/**
 * Aether Dispatcher: Cloudflare Worker
 * Runs on a scheduled cron trigger to fetch unanswered asks from /api/misses,
 * apply strict redaction, and format into the job queue structure.
 *
 * Bindings required (wrangler.toml):
 * - VOID_API_TOKEN: Bearer token for /api/misses (= Pages READ_TOKEN)
 * - VOID_API_URL: Base URL (e.g., https://a-to-mind.com)
 *
 * Output: Formats rows as { id, ask, kind: 'miss', count, last, state: 'queued', queued: ISO8601 }
 * and forwards to the job queue bridge.
 */

interface Env {
  VOID_API_TOKEN: string;
  VOID_API_URL: string;
}

interface MissRow {
  ask: string;
  count?: number;
  first?: string;
  last?: string;
  fallback?: string;
}

interface QueuedJob {
  id: string;
  ask: string;
  kind: 'miss';
  count: number;
  last: string;
  state: 'queued';
  queued: string;
}

/**
 * Redaction logic: replicates tools/misses.mjs exactly.
 * Drops asks that look like they carry secrets, masks emails and digit runs.
 */
function redact(ask: string | null | undefined): string | null {
  const a = String(ask || '');

  // Key-like pattern: 16+ chars mixing letters/digits/underscore/dash
  // AND contains both letters and digits
  const KEYLIKE = /(?=[A-Za-z0-9_-]{16,})(?=[A-Za-z_-]*\d)(?=[\d_-]*[A-Za-z])[A-Za-z0-9_-]{16,}/;

  // Drop if it starts with "unlock" or contains a key-like string
  if (/^\s*unlock\b/i.test(a) || a.split(/\s+/).some((w) => KEYLIKE.test(w))) {
    return null;
  }

  // Mask emails: user@domain.com -> [email]
  let redacted = a.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]');

  // Mask digit runs: phone/credit card patterns -> [number]
  // Pattern: digit followed by 7+ chars of digits/spaces/dashes/parens, ending in digit
  redacted = redacted.replace(/\d[\d\s().-]{7,}\d/g, '[number]');

  // Trim to 200 chars (normalize to ask length limit)
  return redacted.slice(0, 200);
}

/**
 * Hash an ask string to create a stable job ID.
 * Replicates the sha256(ask).slice(0, 24) from /api/miss.js.
 */
async function jobIdFromAsk(ask: string): Promise<string> {
  const encoded = new TextEncoder().encode(ask);
  const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = [...new Uint8Array(hashBuf)];
  const hashHex = hashArray.map((x) => x.toString(16).padStart(2, '0')).join('');
  return hashHex.slice(0, 24);
}

/**
 * Fetch the miss board from /api/misses.
 * Returns the raw rows; caller applies filtering and redaction.
 */
async function fetchMissBoard(env: Env): Promise<MissRow[]> {
  const url = `${env.VOID_API_URL}/api/misses`;
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${env.VOID_API_TOKEN}`,
      'user-agent': 'aether-dispatcher/1.0',
    },
  });

  if (!res.ok) {
    throw new Error(`GET ${url}: HTTP ${res.status}`);
  }

  const rows: MissRow[] = await res.json();
  return rows;
}

/**
 * Transform a miss row into a queued job.
 * Applies redaction and creates the strict job queue shape.
 */
async function rowToQueuedJob(row: MissRow): Promise<QueuedJob | null> {
  const redacted = redact(row.ask);
  if (redacted === null) {
    // Ask was dropped (likely a secret); skip it
    return null;
  }

  const id = await jobIdFromAsk(redacted);
  return {
    id,
    ask: redacted,
    kind: 'miss',
    count: row.count || 1,
    last: row.last || new Date().toISOString(),
    state: 'queued',
    queued: new Date().toISOString(),
  };
}

/**
 * Main cron handler: fetch misses, redact, format into job queue shape.
 */
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    try {
      console.log('[aether] Dispatcher starting...');

      // 1. Fetch the miss board
      const rows = await fetchMissBoard(env);
      console.log(`[aether] Fetched ${rows.length} rows from /api/misses`);

      // 2. Redact and transform into queued jobs
      const jobs: QueuedJob[] = [];
      for (const row of rows) {
        const job = await rowToQueuedJob(row);
        if (job) {
          jobs.push(job);
        }
      }
      console.log(`[aether] Redacted to ${jobs.length} valid jobs (${rows.length - jobs.length} dropped)`);

      // 3. Format and output
      // In a full implementation, this would:
      // - Write to KV, D1, or a message queue for the bridge to consume
      // - Send webhook to void-loop with the job payload
      // - Store heartbeat/state in D1
      //
      // For now, log the payload structure and return success.
      const payload = {
        timestamp: new Date().toISOString(),
        jobCount: jobs.length,
        jobs: jobs.slice(0, 10), // First 10 for logging
      };

      console.log(`[aether] Job payload:\n${JSON.stringify(payload, null, 2)}`);

      // Signal success to Cloudflare Cron
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    } catch (err: any) {
      console.error(`[aether] Dispatcher failed: ${err.message}`);
      return new Response(
        JSON.stringify({
          error: err.message,
          timestamp: new Date().toISOString(),
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
  },
} satisfies ExportedHandler<Env>;
