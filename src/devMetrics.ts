export type ApiMetricKind = 'story' | 'ai' | 'other';

export type ApiMetric = {
  id: string;
  at: number;
  kind: ApiMetricKind;
  endpoint: string;
  action?: string;
  stage?: string;
  ok: boolean;
  status?: number;
  code?: string;
  durationMs: number;
};

export type ApiMetricSnapshot = {
  total: number;
  failures: number;
  averageMs: number;
  byKind: Record<ApiMetricKind, number>;
  recent: ApiMetric[];
};

const MAX_METRICS = 80;
const listeners = new Set<() => void>();
let metrics: ApiMetric[] = [];

const safeWindow = () => (typeof window === 'undefined' ? null : window);

export const isDevMetricsEnabled = () => {
  const win = safeWindow();
  if (!win) return false;
  return import.meta.env.VITE_SHOW_DEV_METRICS === '1' || win.localStorage.getItem('3t-dev-metrics') === '1';
};

const exposeMetricsForConsole = () => {
  const win = safeWindow();
  if (!win || !isDevMetricsEnabled()) return;
  win.__THREE_T_DEV_METRICS__ = {
    snapshot: getApiMetricsSnapshot,
    reset: resetApiMetrics,
    enable: () => win.localStorage.setItem('3t-dev-metrics', '1'),
    disable: () => win.localStorage.removeItem('3t-dev-metrics'),
  };
};

export const recordApiMetric = (metric: Omit<ApiMetric, 'id' | 'at'>) => {
  if (!isDevMetricsEnabled()) return;
  const id = `metric-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  metrics = [
    {
      ...metric,
      id,
      at: Date.now(),
      durationMs: Math.max(0, Math.round(metric.durationMs || 0)),
    },
    ...metrics,
  ].slice(0, MAX_METRICS);
  exposeMetricsForConsole();
  listeners.forEach((listener) => listener());
};

export const getApiMetricsSnapshot = (): ApiMetricSnapshot => {
  const total = metrics.length;
  const failures = metrics.filter((metric) => !metric.ok).length;
  const averageMs = total
    ? Math.round(metrics.reduce((sum, metric) => sum + metric.durationMs, 0) / total)
    : 0;
  const byKind: Record<ApiMetricKind, number> = { story: 0, ai: 0, other: 0 };
  metrics.forEach((metric) => {
    byKind[metric.kind] += 1;
  });
  return {
    total,
    failures,
    averageMs,
    byKind,
    recent: metrics.slice(0, 12),
  };
};

export const subscribeApiMetrics = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const resetApiMetrics = () => {
  metrics = [];
  listeners.forEach((listener) => listener());
};

declare global {
  interface Window {
    __THREE_T_DEV_METRICS__?: {
      snapshot: typeof getApiMetricsSnapshot;
      reset: typeof resetApiMetrics;
      enable: () => void;
      disable: () => void;
    };
  }
}

exposeMetricsForConsole();
