import { TranscriptEntry } from '../lib/history';

interface TranscriptProps {
  entries: TranscriptEntry[];
}

export function Transcript({ entries }: TranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldScroll = useRef(true);

  return (
    <div
      className="transcript"
      ref={containerRef}
      onMouseEnter={() => { shouldScroll.current = false; }}
      onMouseLeave={() => { shouldScroll.current = true; }}
    >
      {entries.map(entry => (
        <TranscriptLine key={entry.id} entry={entry} />
      ))}
      <div className="transcript__anchor" />
    </div>
  );
}

function TranscriptLine({ entry }: { entry: TranscriptEntry }) {
  const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const prefix = entry.type === 'input' ? '▸' : entry.type === 'error' ? '✗' : entry.type === 'system' ? '◆' : '·';

  return (
    <div className={`transcript__line transcript__line--${entry.type}`} data-id={entry.id}>
      <span className="transcript__time">{time}</span>
      <span className="transcript__prefix">{prefix}</span>
      <span className="transcript__content">{entry.content}</span>
    </div>
  );
}

import { useRef } from 'react';