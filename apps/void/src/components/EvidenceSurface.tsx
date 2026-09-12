import { Surface } from '../lib/registry';

interface EvidenceSurfaceProps {
  surface: Surface;
}

export function EvidenceSurface({ surface }: EvidenceSurfaceProps) {
  const payload = surface.payload as any;
  const objectId = payload?.object_id || 'unknown';
  const caseId = payload?.case_id || 'unknown';
  const kind = payload?.kind || 'unknown';
  const r2Key = payload?.r2_key || 'unknown';
  const sha256 = payload?.sha256 || 'unknown';
  const bytes = payload?.bytes || 0;
  const uploadedBy = payload?.uploaded_by || 'unknown';
  const uploadedAt = payload?.uploaded_at || Date.now();

  const formatTime = (ts: number) => new Date(ts).toISOString().replace('T', ' ').slice(0, 19);
  const formatBytes = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="surface-evidence">
      <dl className="evidence__details">
        <div><dt>object_id</dt><dd>{objectId}</dd></div>
        <div><dt>case_id</dt><dd>{caseId}</dd></div>
        <div><dt>kind</dt><dd>{kind}</dd></div>
        <div><dt>r2_key</dt><dd>{r2Key}</dd></div>
        <div><dt>sha256</dt><dd>{sha256}</dd></div>
        <div><dt>size</dt><dd>{formatBytes(bytes)}</dd></div>
        <div><dt>uploaded_by</dt><dd>{uploadedBy}</dd></div>
        <div><dt>uploaded_at</dt><dd>{formatTime(uploadedAt)}</dd></div>
      </dl>

      <div className="evidence__actions">
        <code>pack {objectId}</code>
        <span>→ signed R2 URL (TTL 1h)</span>
      </div>
    </div>
  );
}