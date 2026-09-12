import { Surface } from '../lib/registry';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface DataSurfaceProps {
  surface: Surface;
}

export function DataSurface({ surface }: DataSurfaceProps) {
  const [query, setQuery] = useState('SELECT * FROM cra_cases LIMIT 10');
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const executeQuery = async () => {
    setLoading(true);
    setError(null);
    try {
      // This would need a D1 query endpoint - for now show placeholder
      setResults([{ message: 'D1 read endpoint not yet implemented', query }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeQuery();
  }, [query]);

  return (
    <div className="surface-data">
      <div className="data__bar">
        <span className="data__title">{surface.title}</span>
      </div>
      <div className="data__editor">
        <textarea
          className="data__query"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="SELECT * FROM cra_cases WHERE org_id = '...' LIMIT 10"
          rows={3}
          spellCheck={false}
        />
        <button className="data__run" onClick={executeQuery} disabled={loading}>
          {loading ? 'EXECUTING...' : 'RUN'}
        </button>
      </div>
      {error && <div className="data__error">{error}</div>}
      <div className="data__results">
        {results.map((row, i) => (
          <pre key={i} className="data__row">{JSON.stringify(row, null, 2)}</pre>
        ))}
      </div>
    </div>
  );
}