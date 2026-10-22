import { Surface } from '../lib/registry';

interface CmdSurfaceProps {
  surface: Surface;
}

export function CmdSurface({ surface }: CmdSurfaceProps) {
  return (
    <div className="surface-cmd">
      <p className="cmd__hint">
        This is the default command surface. Type commands in the bar below.
      </p>
      <ul className="cmd__verbs">
        <li><code>case open</code> — open Article 14 case</li>
        <li><code>clock</code> — show deadline horizon</li>
        <li><code>hold</code> — inspect hold gate</li>
        <li><code>allow</code> — human allow (requires key)</li>
        <li><code>ag run</code> — queue AlphaGenome dry-run</li>
        <li><code>score</code> — execute scoring</li>
        <li><code>session set</code> — set desk session token</li>
      </ul>
    </div>
  );
}