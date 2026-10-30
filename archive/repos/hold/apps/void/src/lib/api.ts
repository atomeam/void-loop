const BRIDGE_BASE = 'https://bridge.a-to-mind.com';

function getSessionToken(): string | null {
  return localStorage.getItem('hold.session');
}

function getHumanKey(): string | null {
  return localStorage.getItem('hold.human_key');
}

async function fetchWithAuth<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const session = getSessionToken();
  if (session) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${session}`;
  }

  try {
    const res = await fetch(`${BRIDGE_BASE}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 204) {
      return { data: null, error: null, status: res.status };
    }

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { data: null, error: body.error || `HTTP ${res.status}`, status: res.status };
    }

    return { data: body as T, error: null, status: res.status };
  } catch (e) {
    return { data: null, error: 'Network error', status: 0 };
  }
}

export const api = {
  // Health
  health: () => fetchWithAuth<{ ok: boolean; service: string }>('/health'),

  // Cases
  getCase: (caseId: string) => fetchWithAuth(`/v1/cra/cases/${caseId}`),
  openCase: (productId: string, type: 'aev' | 'incident', awareAt: string) =>
    fetchWithAuth('/v1/cra/cases', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, type, aware_at: awareAt }),
    }),

  // Holds
  getHold: (holdId: string) => fetchWithAuth(`/v1/holds/${holdId}`),
  allowHold: (holdId: string, decision: 'allowed' | 'denied', reason?: string) => {
    const humanKey = getHumanKey();
    if (!humanKey) throw new Error('No human key set. Use "session set <human_key>" first.');
    return fetchWithAuth(`/v1/holds/${holdId}/allow`, {
      method: 'POST',
      headers: { 'x-hold-human-key': humanKey },
      body: JSON.stringify({ decision, reason }),
    });
  },

  // AlphaGenome
  createAGRun: (caseId: string, interval: string) =>
    fetchWithAuth('/v1/ag/runs', {
      method: 'POST',
      body: JSON.stringify({ case_id: caseId, interval }),
    }),
  getAGRun: (runId: string) => fetchWithAuth(`/v1/ag/runs/${runId}`),
  scoreAGRun: (runId: string) => fetchWithAuth(`/v1/ag/runs/${runId}/score`, { method: 'POST' }),
  getAGScores: (runId: string, limit = 100, offset = 0) =>
    fetchWithAuth(`/v1/ag/runs/${runId}/scores?limit=${limit}&offset=${offset}`),

  // Evidence
  getEvidence: (objectId: string) => fetchWithAuth(`/v1/evidence/${objectId}`),

  // Session management
  setSessionToken: (token: string) => localStorage.setItem('hold.session', token),
  clearSession: () => localStorage.removeItem('hold.session'),
  setHumanKey: (key: string) => localStorage.setItem('hold.human_key', key),
  clearHumanKey: () => localStorage.removeItem('hold.human_key'),
  getSessionToken,
  getHumanKey,
};