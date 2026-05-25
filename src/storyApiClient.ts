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

const createRequestId = () => (
  `story-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
);

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
        ? await withAuthTimeout(
          currentUser.getIdToken(),
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
}
