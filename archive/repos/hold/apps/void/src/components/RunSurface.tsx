import { Surface } from '../lib/registry';

interface RunSurfaceProps {
  surface: Surface;
}

export function RunSurface({ surface }: RunSurfaceProps) {
  const payload = surface.payload as any;
  const runId = payload?.run_id || 'unknown';
  const status = payload?.status || 'unknown';
  const caseId = payload?.case_id || 'unknown';
  const variantCount = payload?.variant_count || 0;
  const startedAt = payload?.started_at;
  const finishedAt = payload?.finished_at;
  const usdCents = payload?.usd_cents || 0;

  const formatTime = (ts: number) => new Date(ts).toISOString().replace('T', ' ').slice(0, 19);

  return (
    <div className="surface-run">
      <dl className="run__details">
        <div><dt>run_id</dt><dd>{runId}</dd></div>
        <div><dt>case_id</dt><dd>{caseId}</dd></div>
        <div><dt>status</dt><dd>{status}</dd></div>
        <div><dt>variants</dt><dd>{variantCount}</dd></div>
        <div><dt>cost</dt><dd>${(usdCents / 100).toFixed(2)}</dd></div>
        {startedAt && <div><dt>started</dt><dd>{formatTime(startedAt)}</dd></div>}
        {finishedAt && <div><dt>finished</dt><dd>{formatTime(finishedAt)}</dd></div>}
      </dl>
    </div>
  );
}