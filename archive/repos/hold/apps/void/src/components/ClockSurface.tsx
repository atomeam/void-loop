import { Surface } from '../lib/registry';

interface ClockSurfaceProps {
  surface: Surface;
}

export function ClockSurface({ surface }: ClockSurfaceProps) {
  const payload = surface.payload as any;
  const caseId = payload?.case_id || 'unknown';
  const awareAt = payload?.aware_at;
  const deadlines = payload?.deadlines || [];

  const now = Date.now();

  const deadlineItems = [
    { kind: 'acknowledge', label: 'ACK', offset: 24 * 60 * 60 * 1000 },
    { kind: 'assess', label: 'ASSESS', offset: 72 * 60 * 60 * 1000 },
    { kind: 'notify_authority', label: 'NOTIFY AUTH', offset: 72 * 60 * 60 * 1000 },
    { kind: 'notify_affected', label: 'NOTIFY AFF', offset: 72 * 60 * 60 * 1000 },
    { kind: 'remediate', label: 'REMEDIATE', offset: 14 * 24 * 60 * 60 * 1000 },
  ];

  const getStatus = (dueAt: number) => {
    const diff = dueAt - now;
    if (diff < 0) return 'expired';
    if (diff < 60 * 60 * 1000) return 'urgent';
    if (diff < 24 * 60 * 60 * 1000) return 'soon';
    return 'ok';
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toISOString().replace('T', ' ').slice(0, 19);
  };

  return (
    <div className="surface-clock">
      <div className="clock__header">
        <div className="clock__meta">
          <span className="clock__case">Case: {caseId}</span>
          {awareAt && <span className="clock__aware">Aware: {formatTime(awareAt)}</span>}
        </div>
        <div className="clock__now">Now: {formatTime(now)}</div>
      </div>

      <div className="clock__horizon">
        {deadlineItems.map((item, i) => {
          const dueAt = awareAt ? awareAt + item.offset : 0;
          const matched = deadlines.find((d: any) => d.kind === item.kind);
          const actualDue = matched?.due_at || dueAt;
          const metAt = matched?.met_at;
          const status = metAt ? 'met' : getStatus(actualDue);

          return (
            <div key={item.kind} className={`clock__tick clock__tick--${status}`}>
              <div className="clock__tick-marker" />
              <div className="clock__tick-line" />
              <div className="clock__tick-content">
                <span className="clock__tick-label">{item.label}</span>
                <span className="clock__tick-time">{actualDue ? formatTime(actualDue) : '—'}</span>
                {metAt && <span className="clock__tick-met">✓ {formatTime(metAt)}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {deadlineItems.length > 0 && (
        <div className="clock__legend">
          <span>▸ met</span>
          <span>▸ ok</span>
          <span>▸ soon</span>
          <span>▸ urgent</span>
          <span>▸ expired</span>
        </div>
      )}
    </div>
  );
}