import { auth } from './firebase';
import { recordApiMetric } from './devMetrics';

export type StoryApiOptions = {
  auth?: boolean;
  timeoutMs?: number;
  stage?: string;
};

export class StoryApiError extends Error {
  action: string;
  stage: string;
  code: string;
  requestId: string;
  status?: number;

  constructor(args: {
    action: string;
    stage: string;
    code: string;
    requestId: string;
    message: string;
    status?: number;
  }) {
    super(args.message);
    this.name = 'StoryApiError';
    this.action = args.action;
    this.stage = args.stage;
    this.code = args.code;
    this.requestId = args.requestId;
    this.status = args.status;
  }
}

const STORY_API_TIMEOUT_MS = 12000;
const OPTIONAL_AUTH_TOKEN_TIMEOUT_MS = 2500;
const REQUIRED_AUTH_TOKEN_TIMEOUT_MS = 7000;
const inFlightReadRequests = new Map<string, Promise<any>>();

// Cache the Firebase ID token to avoid calling getIdToken() on every request.
// Firebase tokens are valid for 1 hour; we refresh 2 minutes early.
let cachedIdToken: { uid: string; value: string; expiresAt: number } | null = null;
const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000;

async function getCachedIdToken(user: { uid: string; getIdToken: (force?: boolean) => Promise<string> }, timeoutMs: number): Promise<string> {
  const now = Date.now();
  if (cachedIdToken && cachedIdToken.uid === user.uid && cachedIdToken.expiresAt - TOKEN_REFRESH_BUFFER_MS > now) {
    return cachedIdToken.value;
  }
  const token = await withAuthTimeout(user.getIdToken(), timeoutMs);
  // Firebase tokens are valid for 60 minutes from issuance. We don't know when they were issued,
  // so cache for 30 minutes from when we fetched — safe margin regardless of token age.
  cachedIdToken = { uid: user.uid, value: token, expiresAt: now + 30 * 60 * 1000 };
  return token;
}
const DEDUPE_READ_ACTIONS = new Set([
  'getAppSettings',
  'getAuthorFollowState',
  'getPushConfig',
  'getSeriesWorld',
  'getSharedStoryRecord',
  'getStoryCartridge',
  'getStoryMeta',
  'getUserProgress',
  'listAuthorStories',
  'listContinuityNodes',
  'listFollowedAuthors',
  'listMySeriesWorlds',
  'listMySharedStories',
  'listMyStories',
  'listNotifications',
  'listPublicStories',
]);

const createRequestId = () => (
  `story-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
);

const stablePayloadKey = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stablePayloadKey).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stablePayloadKey(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const friendlyStoryApiError = (stage: string, code: string, rawMessage: string) => {
  const message = String(rawMessage || '');
  if (code === 'TIMEOUT' || /abort|timeout|timed out/i.test(message)) return `${stage}: 连接超时。`;
  if (code === 'QUOTA_EXHAUSTED' || /quota|RESOURCE_EXHAUSTED|exceeded/i.test(message)) return `${stage}: 服务器额度暂时不足。`;
  if (code === 'AUTH_REQUIRED' || /permission|insufficient|unauthorized|forbidden/i.test(message)) {
    return `${stage}: 权限不足或登录状态已过期。`;
  }
  return message || `${stage}失败`;
};

const withAuthTimeout = async <T,>(promise: Promise<T>, timeoutMs: number) => {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error('Auth token timeout')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

export async function storyApi<T = any>(
  action: string,
  payload: Record<string, any> = {},
  options: StoryApiOptions = {}
) {
  const canDedupe = DEDUPE_READ_ACTIONS.has(action);
  const dedupeKey = canDedupe
    ? `${action}|${options.auth ? 'auth' : 'optional'}|${stablePayloadKey(payload)}`
    : '';
  if (dedupeKey && inFlightReadRequests.has(dedupeKey)) {
    return inFlightReadRequests.get(dedupeKey) as Promise<T>;
  }

  const executeRequest = async () => {
  const stage = options.stage || action;
  const requestId = createRequestId();
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let metricRecorded = false;
  const recordMetric = (args: { ok: boolean; status?: number; code?: string }) => {
    if (metricRecorded) return;
    metricRecorded = true;
    const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    recordApiMetric({
      kind: 'story',
      endpoint: '/api/story-store',
      action,
      stage,
      ok: args.ok,
      status: args.status,
      code: args.code,
      durationMs: endedAt - startedAt,
    });
  };
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client-request-id': requestId,
  };
  const currentUser = auth?.currentUser;
  if (options.auth || currentUser) {
    try {
      const token = currentUser
        ? await getCachedIdToken(
          currentUser,
          options.auth ? REQUIRED_AUTH_TOKEN_TIMEOUT_MS : OPTIONAL_AUTH_TOKEN_TIMEOUT_MS
        )
        : '';
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      if (options.auth) {
        recordMetric({ ok: false, code: 'AUTH_REQUIRED' });
        throw new StoryApiError({
          action,
          stage,
          code: 'AUTH_REQUIRED',
          requestId,
          message: friendlyStoryApiError(stage, 'AUTH_REQUIRED', error instanceof Error ? error.message : String(error || '')),
        });
      }
      console.warn('storyApi optional auth skipped:', { action, stage, requestId, error });
    }
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || STORY_API_TIMEOUT_MS);
  try {
    const response = await fetch('/api/story-store', {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const code = data?.code || (response.status === 401 ? 'AUTH_REQUIRED' : 'STORY_API_FAILED');
      recordMetric({ ok: false, status: response.status, code });
      throw new StoryApiError({
        action,
        stage,
        code,
        requestId: data?.requestId || requestId,
        status: response.status,
        message: friendlyStoryApiError(stage, code, data?.error || data?.message || `story-store ${action} failed`),
      });
    }
    recordMetric({ ok: true, status: response.status });
    return data as T;
  } catch (error) {
    if (error instanceof StoryApiError) {
      recordMetric({ ok: false, status: error.status, code: error.code });
      console.error('storyApi failed:', {
        action: error.action,
        stage: error.stage,
        code: error.code,
        requestId: error.requestId,
        status: error.status,
        error,
      });
      throw error;
    }
    const isAbort = error instanceof DOMException && error.name === 'AbortError';
    const code = isAbort ? 'TIMEOUT' : 'NETWORK_ERROR';
    const rawMessage = error instanceof Error ? error.message : String(error || '');
    const wrapped = new StoryApiError({
      action,
      stage,
      code,
      requestId,
      message: friendlyStoryApiError(stage, code, rawMessage),
    });
    recordMetric({ ok: false, code });
    console.error('storyApi failed:', { action, stage, code, requestId, error });
    throw wrapped;
  } finally {
    window.clearTimeout(timeout);
  }
  };

  if (!dedupeKey) return executeRequest();

  const request = executeRequest();
  inFlightReadRequests.set(dedupeKey, request);
  try {
    return await request;
  } finally {
    inFlightReadRequests.delete(dedupeKey);
  }
}
