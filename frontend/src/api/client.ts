const BASE = (import.meta.env.VITE_API_BASE as string) || '';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// JWT injection. The auth store sets this on login/refresh.
let currentToken: string | null = null;
export function setAuthToken(t: string | null) { currentToken = t; }

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    let code: string | undefined;
    try {
      const payload = await res.json();
      if (payload?.error) msg = payload.error;
      code = payload?.code;
    } catch {
      try { msg = await res.text(); } catch { /* ignore */ }
    }
    throw new ApiError(msg, res.status, code);
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, body?: unknown) => request<T>('POST', p, body),
  patch: <T>(p: string, body?: unknown) => request<T>('PATCH', p, body),
  del: <T>(p: string) => request<T>('DELETE', p),
};
