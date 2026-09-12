import { Surface } from '../lib/registry';

interface HoldSurfaceProps {
  surface: Surface;
}

export function HoldSurface({ surface }: HoldSurfaceProps) {
  const payload = surface.payload as any;
  const holdId = payload?.hold_id || surface.id;
  const status = payload?.status || 'ALLOWED';
  const kind = payload?.kind || 'score';
  const reason = payload?.reason || 'NO_HUMAN_GATE';
  const caseId = payload?.case_id || payload?.subject_id || 'unknown';
  const decidedBy = payload?.decided_by || 'policy:auto';
  const decidedAt = payload?.decided_at;
  const createdAt = payload?.created_at || Date.now();

  const formatTime = (ts: number | string) =>
    new Date(ts).toISOString().replace('T', ' ').slice(0, 19);

  return (
    <div className="surface-hold">
      <div className="hold__seal" data-status="allowed">
        <div className="hold__seal-ring" style={{ borderColor: 'var(--allowed)' }} />
        <div className="hold__seal-core" style={{ background: 'var(--allowed)' }} />
        <span className="hold__seal-text">{String(status).toUpperCase()}</span>
      </div>

      <dl className="hold__details">
        <div><dt>hold_id</dt><dd>{holdId}</dd></div>
        <div><dt>case_id</dt><dd>{caseId}</dd></div>
        <div><dt>kind</dt><dd>{kind}</dd></div>
        <div><dt>decided_by</dt><dd>{decidedBy}</dd></div>
        <div><dt>created</dt><dd>{formatTime(createdAt)}</dd></div>
        {decidedAt && <div><dt>decided_at</dt><dd>{formatTime(decidedAt)}</dd></div>}
      </dl>

      <div className="hold__reason">
        <dt>reason</dt>
        <dd>{reason}</dd>
      </div>

      <p className="hold__note">Human allow/deny removed. Policy auto-releases on insert.</p>
    </div>
  );
}
