import { Surface } from '../lib/registry';

interface HoldSurfaceProps {
  surface: Surface;
}

export function HoldSurface({ surface }: HoldSurfaceProps) {
  const payload = surface.payload as any;
  const holdId = payload?.hold_id || surface.id;
  const status = payload?.status || 'pending';
  const kind = payload?.kind || 'unknown';
  const reason = payload?.reason || 'No reason provided';
  const caseId = payload?.case_id || 'unknown';
  const requestedBy = payload?.requested_by || 'unknown';
  const decidedBy = payload?.decided_by;
  const decidedAt = payload?.decided_at;
  const createdAt = payload?.created_at || Date.now();

  const formatTime = (ts: number) => new Date(ts).toISOString().replace('T', ' ').slice(0, 19);

  const statusColors: Record<string, string> = {
    pending: 'var(--pending)',
    allowed: 'var(--allowed)',
    denied: 'var(--denied)',
  };

  return (
    <div className="surface-hold">
      <div className="hold__seal" data-status={status}>
        <div className="hold__seal-ring" style={{ borderColor: statusColors[status] }} />
        <div className="hold__seal-core" style={{ background: statusColors[status] }} />
        <span className="hold__seal-text">{status.toUpperCase()}</span>
      </div>

      <dl className="hold__details">
        <div><dt>hold_id</dt><dd>{holdId}</dd></div>
        <div><dt>case_id</dt><dd>{caseId}</dd></div>
        <div><dt>kind</dt><dd>{kind}</dd></div>
        <div><dt>requested_by</dt><dd>{requestedBy}</dd></div>
        <div><dt>created</dt><dd>{formatTime(createdAt)}</dd></div>
        {decidedBy && <div><dt>decided_by</dt><dd>{decidedBy}</dd></div>}
        {decidedAt && <div><dt>decided_at</dt><dd>{formatTime(decidedAt)}</dd></div>}
      </dl>

      <div className="hold__reason">
        <dt>reason</dt>
        <dd>{reason}</dd>
      </div>

      {status === 'pending' && (
        <div className="hold__actions">
          <code>allow {holdId}</code>
          <span>or</span>
          <code>deny {holdId}</code>
          <span className="hold__note">(requires human key: session set <human_key>)</span>
        </div>
      )}
    </div>
  );
}