import { Surface } from '../lib/registry';
import { useState } from 'react';

interface CodeSurfaceProps {
  surface: Surface;
}

export function CodeSurface({ surface }: CodeSurfaceProps) {
  const [content, setContent] = useState<string>('');

  return (
    <div className="surface-code">
      <div className="code__bar">
        <span className="code__filename">{surface.title}</span>
        <span className="code__status">local buffer</span>
      </div>
      <textarea
        className="code__editor"
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="// local buffer — not persisted to D1"
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />
      <div className="code__footer">
        <kbd>Ctrl+S</kbd> save to file · <kbd>Esc</kbd> close
      </div>
    </div>
  );
}