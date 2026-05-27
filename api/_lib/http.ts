export type ApiRequest = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};

export type ApiResponse = {
  status: (code: number) => ApiResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
  end: () => void;
};

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:19006',
];

function allowedOrigins() {
  const configured = process.env.ALLOWED_ORIGINS;
  if (!configured) return DEFAULT_ALLOWED_ORIGINS;
  return configured.split(',').map((origin: string) => origin.trim()).filter(Boolean);
}

export function applyCors(req: ApiRequest, res: ApiResponse) {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  const allowed = allowedOrigins();
  const allowOrigin = allowed.includes('*') || allowed.includes(origin)
    ? origin || '*'
    : allowed[0];

  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function handleOptions(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

export function readJsonBody<T>(req: ApiRequest): T {
  if (typeof req.body === 'string') return JSON.parse(req.body) as T;
  return (req.body || {}) as T;
}

export function sendError(res: ApiResponse, status: number, message: string, code = 'REQUEST_FAILED') {
  res.status(status).json({ error: { code, message } });
}
