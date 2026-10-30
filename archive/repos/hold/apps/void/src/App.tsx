import { useState, useEffect, useRef, useCallback } from 'react';
import { CommandBar } from './components/CommandBar';
import { SurfaceStage } from './components/SurfaceStage';
import { Transcript } from './components/Transcript';
import { resolveIntent, generateSurfaceId, type Surface } from './lib/registry';
import { parseCommand, formatUsage } from './lib/parse';
import { createTranscriptEntry, formatTimestamp } from './lib/history';
import { api } from './lib/api';

function App() {
  const [transcript, setTranscript] = useState<ReturnType<typeof createTranscriptEntry>[]>([]);
  const [surfaces, setSurfaces] = useState<Surface[]>([]);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [humanKey, setHumanKey] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const commandBarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = api.getSessionToken();
    const hkey = api.getHumanKey();
    if (token) setSessionToken(token);
    if (hkey) setHumanKey(hkey);
    if (token) {
      addTranscript('system', `Session restored: ${token.slice(0, 12)}...`);
    }
    addTranscript('system', 'A-to-Mind void desk. Type "help" for commands.');
  }, []);

  const addTranscript = useCallback((
    type: 'input' | 'output' | 'error' | 'surface_spawned' | 'surface_closed' | 'system',
    content: string,
    extras?: { command?: any; surfaceId?: string }
  ) => {
    setTranscript(prev => [...prev, createTranscriptEntry(type, content, extras)]);
  }, []);

  const executeCommand = useCallback(async (raw: string) => {
    const parsed = parseCommand(raw);
    addTranscript('input', `> ${raw}`, { command: parsed });

    if (!parsed.valid) {
      if (parsed.error === 'unknown_verb') {
        addTranscript('error', `unknown_verb: "${parsed.verb}" — type "help"`);
      }
      return;
    }

    const { verb, args } = parsed;

    try {
      switch (verb) {
        case 'help': {
          const cmds = [
            'case open <product_id> aev|incident aware <ISO-8601>',
            'clock <case_id>',
            'hold <hold_id>',
            'allow <hold_id>',
            'deny <hold_id>',
            'ag run <interval>',
            'score <run_id>',
            'session set <token>',
            'clear',
            'close <surface_id>',
          ];
          addTranscript('output', cmds.map(c => `  ${c}`).join('\n'));
          break;
        }

        case 'clear': {
          setTranscript([]);
          break;
        }

        case 'close': {
          const surfaceId = args[0];
          if (!surfaceId) {
            addTranscript('error', 'usage: close <surface_id>');
            break;
          }
          setSurfaces(prev => prev.filter(s => s.id !== surfaceId));
          addTranscript('surface_closed', `closed ${surfaceId}`);
          break;
        }

        case 'session': {
          if (args[0] === 'set' && args[1]) {
            api.setSessionToken(args[1]);
            setSessionToken(args[1]);
            addTranscript('output', `session set: ${args[1].slice(0, 12)}...`);
          } else if (args[0] === 'clear') {
            api.clearSession();
            setSessionToken(null);
            addTranscript('output', 'session cleared');
          } else {
            addTranscript('error', 'usage: session set <token> | session clear');
          }
          break;
        }

        case 'case': {
          if (args[0] === 'open' && args.length >= 4) {
            const [, productId, type, , awareAt] = args;
            if (!['aev', 'incident'].includes(type)) {
              addTranscript('error', 'type must be "aev" or "incident"');
              break;
            }
            const res = await api.openCase(productId, type as 'aev' | 'incident', awareAt);
            if (res.error) {
              addTranscript('error', res.error);
            } else {
              addTranscript('output', `case opened: ${res.data?.case_id}`);
              const surfaceId = generateSurfaceId('clock');
              setSurfaces(prev => [...prev, {
                id: surfaceId,
                kind: 'clock',
                title: `Case ${res.data?.case_id}`,
                wired: !!res.data,
                payload: res.data,
              }]);
              addTranscript('surface_spawned', `clock ${surfaceId}`, { surfaceId });
            }
          } else {
            addTranscript('error', `usage: ${formatUsage('case')}`);
          }
          break;
        }

        case 'clock': {
          if (args[0]) {
            const caseId = args[0];
            const res = await api.getCase(caseId);
            if (res.error) {
              addTranscript('error', res.error);
            } else {
              const surfaceId = generateSurfaceId('clock');
              setSurfaces(prev => [...prev, {
                id: surfaceId,
                kind: 'clock',
                title: `Clock ${caseId}`,
                wired: !!res.data,
                payload: res.data,
              }]);
              addTranscript('surface_spawned', `clock ${surfaceId}`, { surfaceId });
            }
          } else {
            addTranscript('error', `usage: ${formatUsage('clock')}`);
          }
          break;
        }

        case 'hold': {
          if (args[0]) {
            const holdId = args[0];
            const res = await api.getHold(holdId);
            if (res.error) {
              addTranscript('error', res.error);
            } else {
              const surfaceId = generateSurfaceId('hold');
              setSurfaces(prev => [...prev, {
                id: surfaceId,
                kind: 'hold',
                title: `Hold ${holdId}`,
                wired: !!res.data,
                payload: res.data,
              }]);
              addTranscript('surface_spawned', `hold ${surfaceId}`, { surfaceId });
            }
          } else {
            addTranscript('error', `usage: ${formatUsage('hold')}`);
          }
          break;
        }

        case 'allow': {
          if (args[0]) {
            const holdId = args[0];
            if (!humanKey) {
              addTranscript('error', 'human key required: session set <human_key>');
              break;
            }
            const res = await api.allowHold(holdId, 'allowed', args.slice(1).join(' '));
            if (res.error) {
              addTranscript('error', res.error);
            } else {
              addTranscript('output', `hold ${holdId} → ALLOWED`);
              setSurfaces(prev => prev.map(s =>
                s.kind === 'hold' && s.payload && typeof s.payload === 'object' && 'hold_id' in s.payload && s.payload.hold_id === holdId
                  ? { ...s, wired: true, payload: { ...s.payload, status: 'allowed' } }
                  : s
              ));
            }
          } else {
            addTranscript('error', `usage: ${formatUsage('allow')}`);
          }
          break;
        }

        case 'deny': {
          if (args[0]) {
            const holdId = args[0];
            if (!humanKey) {
              addTranscript('error', 'human key required: session set <human_key>');
              break;
            }
            const res = await api.allowHold(holdId, 'denied', args.slice(1).join(' '));
            if (res.error) {
              addTranscript('error', res.error);
            } else {
              addTranscript('output', `hold ${holdId} → DENIED`);
              setSurfaces(prev => prev.map(s =>
                s.kind === 'hold' && s.payload && typeof s.payload === 'object' && 'hold_id' in s.payload && s.payload.hold_id === holdId
                  ? { ...s, wired: true, payload: { ...s.payload, status: 'denied' } }
                  : s
              ));
            }
          } else {
            addTranscript('error', `usage: ${formatUsage('deny')}`);
          }
          break;
        }

        case 'ag': {
          if (args[0] === 'run' && args[1]) {
            const interval = args[1];
            // Need a case_id - for now prompt or use latest clock surface
            const clockSurface = surfaces.find(s => s.kind === 'clock');
            const caseId = clockSurface?.payload && typeof clockSurface.payload === 'object' && 'case_id' in clockSurface.payload
              ? clockSurface.payload.case_id as string
              : null;
            if (!caseId) {
              addTranscript('error', 'no active case — open a case first or specify case_id');
              break;
            }
            const res = await api.createAGRun(caseId, interval);
            if (res.error) {
              addTranscript('error', res.error);
            } else {
              addTranscript('output', `ag run queued: ${res.data?.run_id}`);
              const surfaceId = generateSurfaceId('science');
              setSurfaces(prev => [...prev, {
                id: surfaceId,
                kind: 'science',
                title: `AG Run ${res.data?.run_id}`,
                wired: !!res.data,
                payload: res.data,
              }]);
              addTranscript('surface_spawned', `science ${surfaceId}`, { surfaceId });
            }
          } else {
            addTranscript('error', `usage: ${formatUsage('ag')}`);
          }
          break;
        }

        case 'score': {
          if (args[0]) {
            const runId = args[0];
            const res = await api.scoreAGRun(runId);
            if (res.error) {
              addTranscript('error', res.error);
            } else {
              addTranscript('output', `scored ${res.data?.variants_scored} variants`);
              setSurfaces(prev => prev.map(s =>
                s.kind === 'science' && s.payload && typeof s.payload === 'object' && 'run_id' in s.payload && s.payload.run_id === runId
                  ? { ...s, wired: true, payload: { ...s.payload, ...res.data, status: 'completed' } }
                  : s
              ));
            }
          } else {
            addTranscript('error', `usage: ${formatUsage('score')}`);
          }
          break;
        }

        default:
          addTranscript('error', `unhandled: ${verb}`);
      }
    } catch (e) {
      addTranscript('error', e instanceof Error ? e.message : 'execution failed');
    }
  }, [humanKey, surfaces, addTranscript]);

  const handleCommandSubmit = (raw: string) => {
    if (!raw.trim()) return;
    setCommandHistory(prev => [raw, ...prev].slice(0, 100));
    setHistoryIndex(-1);
    executeCommand(raw);
  };

  const handleHistoryNavigate = (dir: 'up' | 'down') => {
    if (commandHistory.length === 0) return;
    if (dir === 'up') {
      setHistoryIndex(prev => Math.min(prev + 1, commandHistory.length - 1));
    } else {
      setHistoryIndex(prev => Math.max(prev - 1, -1));
    }
  };

  return (
    <div className="void-app">
      <SurfaceStage surfaces={surfaces} onClose={id => setSurfaces(s => s.filter(s => s.id !== id))} />
      <Transcript entries={transcript} />
      <CommandBar
        ref={commandBarRef}
        onSubmit={handleCommandSubmit}
        onHistoryNavigate={handleHistoryNavigate}
        historyIndex={historyIndex}
        sessionToken={sessionToken}
        humanKey={humanKey}
      />
    </div>
  );
}

export default App;