import { forwardRef, useImperativeHandle, useState, useEffect, useRef } from 'react';

interface CommandBarProps {
  onSubmit: (raw: string) => void;
  onHistoryNavigate: (dir: 'up' | 'down') => void;
  historyIndex: number;
  sessionToken: string | null;
  humanKey: string | null;
}

export const CommandBar = forwardRef<HTMLDivElement, CommandBarProps>(
  ({ onSubmit, onHistoryNavigate, historyIndex, sessionToken, humanKey }, ref) => {
    const [input, setInput] = useState('');
    const [showHint, setShowHint] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const hintTimeout = useRef<number>();

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      getValue: () => input,
      setValue: setInput,
    }));

    useEffect(() => {
      if (historyIndex >= 0) return;
      inputRef.current?.focus();
    }, [historyIndex]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (input.trim()) {
          onSubmit(input.trim());
          setInput('');
          setShowHint(false);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        onHistoryNavigate('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onHistoryNavigate('down');
      } else if (e.key === 'Escape') {
        setInput('');
        setShowHint(false);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setShowHint(true);
        clearTimeout(hintTimeout.current);
        hintTimeout.current = window.setTimeout(() => setShowHint(false), 3000);
      }
    };

    const handleHistoryChange = () => {
      // This would be called when historyIndex changes externally
    };

    return (
      <div className="command-bar" data-active={historyIndex >= 0}>
        <div className="command-bar__status">
          <span className={`status-dot ${sessionToken ? 'connected' : 'disconnected'}`} />
          <span className="status-text">
            {sessionToken ? `session: ${sessionToken.slice(0, 8)}...` : 'no session'}
          </span>
          {humanKey && (
            <>
              <span className="status-sep">|</span>
              <span className="status-dot human" />
              <span className="status-text human">human key loaded</span>
            </>
          )}
        </div>
        <div className="command-bar__input-wrapper">
          <span className="command-bar__caret">▸</span>
          <input
            ref={inputRef}
            type="text"
            className="command-bar__input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sessionToken ? 'command' : 'session set <token> to begin'}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
        {showHint && (
          <div className="command-bar__hint">
            <kbd>Tab</kbd> hints · <kbd>↑↓</kbd> history · <kbd>Esc</kbd> clear
          </div>
        )}
      </div>
    );
  }
);

CommandBar.displayName = 'CommandBar';