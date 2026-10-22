import { ClockSurface } from './ClockSurface';
import { HoldSurface } from './HoldSurface';
import { ScienceSurface } from './ScienceSurface';
import { EvidenceSurface } from './EvidenceSurface';
import { RunSurface } from './RunSurface';
import { CodeSurface } from './CodeSurface';
import { DataSurface } from './DataSurface';
import { DocSurface } from './DocSurface';
import { CmdSurface } from './CmdSurface';
import { type Surface } from '../lib/registry';
import { useState, useRef, useEffect } from 'react';

interface SurfaceStageProps {
  surfaces: Surface[];
  onClose: (id: string) => void;
}

export function SurfaceStage({ surfaces, onClose }: SurfaceStageProps) {
  const [mountedSurfaces, setMountedSurfaces] = useState<Surface[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    surfaces.forEach(surface => {
      if (!mountedSurfaces.find(s => s.id === surface.id)) {
        setMountedSurfaces(prev => [...prev, surface]);
      }
    });
  }, [surfaces]);

  return (
    <div className="surface-stage" ref={stageRef}>
      {mountedSurfaces.map(surface => (
        <SurfaceWrapper key={surface.id} surface={surface} onClose={onClose} />
      ))}
    </div>
  );
}

function SurfaceWrapper({ surface, onClose }: { surface: Surface; onClose: (id: string) => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const renderSurface = () => {
    switch (surface.kind) {
      case 'clock': return <ClockSurface surface={surface} />;
      case 'hold': return <HoldSurface surface={surface} />;
      case 'science': return <ScienceSurface surface={surface} />;
      case 'evidence': return <EvidenceSurface surface={surface} />;
      case 'run': return <RunSurface surface={surface} />;
      case 'code': return <CodeSurface surface={surface} />;
      case 'data': return <DataSurface surface={surface} />;
      case 'doc': return <DocSurface surface={surface} />;
      default: return <CmdSurface surface={surface} />;
    }
  };

  return (
    <section
      className={`surface surface--${surface.kind} ${surface.wired ? 'wired' : 'unwired'}`}
      data-surface-id={surface.id}
      data-kind={surface.kind}
      style={{ animationDelay: '0ms' }}
    >
      <header className="surface__header">
        <h3 className="surface__title">{surface.title}</h3>
        <div className="surface__badges">
          {!surface.wired && <span className="badge badge--unwired">UNWIRED</span>}
          <button className="surface__close" onClick={() => onClose(surface.id)} aria-label="Close surface">✕</button>
        </div>
      </header>
      <div className="surface__body">
        {renderSurface()}
      </div>
    </section>
  );
}