import { Surface } from '../lib/registry';
import { useState } from 'react';

interface DocSurfaceProps {
  surface: Surface;
}

export function DocSurface({ surface }: DocSurfaceProps) {
  const [content, setContent] = useState<string>('');

  return (
    <div className="surface-doc">
      <div className="doc__bar">
        <span className="doc__filename">{surface.title}</span>
        <span className="doc__status">markdown buffer</span>
      </div>
      <textarea
        className="doc__editor"
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="# note\n\nlocal buffer — not persisted"
        spellCheck={true}
      />
      <div className="doc__preview">
        <div className="doc__rendered" dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>') }} />
      </div>
    </div>
  );
}