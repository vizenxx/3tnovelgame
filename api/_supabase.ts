const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

function requireSupabaseConfig() {
  if (!hasSupabaseConfig()) {
    throw new Error('Missing Supabase server environment variables.');
  }
}

function toQuery(params?: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (typeof value !== 'undefined') search.set(key, String(value));
  });
  const suffix = search.toString();
  return suffix ? `?${suffix}` : '';
}

export async function supabaseRequest<T = any>(
  table: string,
  options: {
    method?: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    prefer?: string;
  } = {}
) {
  requireSupabaseConfig();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${toQuery(options.query)}`, {
    method: options.method || 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: typeof options.body === 'undefined' ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    throw new Error(`Supabase ${table} ${options.method || 'GET'} failed: ${response.status} ${await response.text()}`);
  }
  if (response.status === 204) return null as T;
  const text = await response.text();
  return text ? JSON.parse(text) as T : null as T;
}

export async function supabaseRpc<T = any>(fn: string, body: unknown = {}) {
  requireSupabaseConfig();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Supabase rpc ${fn} failed: ${response.status} ${await response.text()}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) as T : null as T;
}

export async function supabaseUpsert<T = any>(table: string, rows: unknown[], onConflict: string) {
  return supabaseRequest<T>(table, {
    method: 'POST',
    query: { on_conflict: onConflict },
    prefer: 'resolution=merge-duplicates,return=representation',
    body: rows,
  });
}

export async function supabaseInsert<T = any>(table: string, rows: unknown[]) {
  return supabaseRequest<T>(table, {
    method: 'POST',
    prefer: 'return=representation',
    body: rows,
  });
}
