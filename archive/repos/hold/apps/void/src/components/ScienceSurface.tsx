import { Surface } from '../lib/registry';

interface ScienceSurfaceProps {
  surface: Surface;
}

export function ScienceSurface({ surface }: ScienceSurfaceProps) {
  const payload = surface.payload as any;
  const runId = payload?.run_id || 'unknown';
  const status = payload?.status || 'queued';
  const variantCount = payload?.variant_count || 0;
  const caseId = payload?.case_id || 'unknown';
  const orgId = payload?.org_id || 'unknown';
  const createdAt = payload?.created_at || Date.now();
  const startedAt = payload?.started_at;
  const finishedAt = payload?.finished_at;
  const scores = payload?.scores || [];

  const formatTime = (ts: number) => new Date(ts).toISOString().replace('T', ' ').slice(0, 19);

  const statusColors: Record<string, string> = {
    queued: 'var(--text-dim)',
    awaiting_allow: 'var(--pending)',
    scoring: 'var(--accent)',
    completed: 'var(--allowed)',
    failed: 'var(--danger)',
  };

  const showScores = status === 'completed' && scores.length > 0;

  return (
    <div className="surface-science">
      <div className="science__header">
        <div className="science__meta">
          <span className="science__run">Run: {runId}</span>
          <span className="science__case">Case: {caseId}</span>
          <span className="science__org">Org: {orgId}</span>
        </div>
        <div className="science__status" style={{ color: statusColors[status] }}>
          {status.toUpperCase().replace('_', ' ')}
        </div>
      </div>

      <div className="science__glyphs">
        <span className="glyph glyph--clinical" data-value="0">CLINICAL_USE=0</span>
        <span className="glyph glyph--fetch" data-value="0">FETCH=0</span>
        <span className="glyph glyph--tos">{payload?.AG_TOS_OK === '1' ? 'AG_TOS_OK=1' : 'AG_TOS_OK=0'}</span>
      </div>

      <dl className="science__details">
        <div><dt>variants</dt><dd>{variantCount}</dd></div>
        <div><dt>created</dt><dd>{formatTime(createdAt)}</dd></div>
        {startedAt && <div><dt>started</dt><dd>{formatTime(startedAt)}</dd></div>}
        {finishedAt && <div><dt>finished</dt><dd>{formatTime(finishedAt)}</dd></div>}
      </dl>

      {showScores && (
        <div className="science__scores">
          <h4>Top Variants (AVI Score)</h4>
          <table className="science__table">
            <thead>
              <tr>
                <th>chr</th>
                <th>pos</th>
                <th>ref</th>
                <th>alt</th>
                <th>gene</th>
                <th>AVI</th>
                <th>expr</th>
                <th>splic</th>
                <th>chrom</th>
                <th>tf</th>
              </tr>
            </thead>
            <tbody>
              {scores.slice(0, 20).map((s: any, i: number) => {
                const effect = s.effect_json ? JSON.parse(s.effect_json) : {};
                return (
                  <tr key={s.score_id || i}>
                    <td>{s.chrom}</td>
                    <td>{s.pos.toLocaleString()}</td>
                    <td>{s.ref}</td>
                    <td>{s.alt}</td>
                    <td>{s.gene || '—'}</td>
                    <td className="avi-score" style={{ color: s.avi_score > 0.8 ? 'var(--danger)' : s.avi_score > 0.5 ? 'var(--warn)' : 'var(--allowed)' }}>
                      {s.avi_score.toFixed(4)}
                    </td>
                    <td>{(effect.expression * 100).toFixed(0)}%</td>
                    <td>{(effect.splicing * 100).toFixed(0)}%</td>
                    <td>{(effect.chromatin * 100).toFixed(0)}%</td>
                    <td>{(effect.tf_binding * 100).toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {scores.length > 20 && <p className="science__more">... {scores.length - 20} more variants</p>}
        </div>
      )}

      {status === 'awaiting_allow' && (
        <div className="science__blocked">
          <span className="blocked-icon">⛔</span>
          <span>Blocked by hold — <code>allow <hold_id></code> required</span>
        </div>
      )}

      {status === 'queued' && (
        <div className="science__hint">
          Awaiting hold creation. Run <code>hold <hold_id></code> to inspect.
        </div>
      )}
    </div>
  );
}