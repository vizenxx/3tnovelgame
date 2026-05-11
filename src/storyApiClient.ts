import { auth } from './firebase';

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

export async function storyApi<T = any>(
  action: string,
  payload: Record<string, any> = {},
  options: StoryApiOptions = {}
) {
  const stage = options.stage || action;
  const requestId = createRequestId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client-request-id': requestId,
  };
  const currentUser = auth?.currentUser;
  if (options.auth || currentUser) {
    const token = await currentUser?.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
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
      throw new StoryApiError({
        action,
        stage,
        code,
        requestId: data?.requestId || requestId,
        status: response.status,
        message: friendlyStoryApiError(stage, code, data?.error || data?.message || `story-store ${action} failed`),
      });
    }
    return data as T;
  } catch (error) {
    if (error instanceof StoryApiError) {
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
    console.error('storyApi failed:', { action, stage, code, requestId, error });
    throw wrapped;
  } finally {
    window.clearTimeout(timeout);
  }
}
