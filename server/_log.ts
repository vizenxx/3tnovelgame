import type { VercelRequest } from '@vercel/node';

export function getRequestLogContext(req: VercelRequest, flow: string) {
  const requestId = String(req.headers['x-vercel-id'] || req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  return { flow, requestId };
}

export function logGenerationInfo(context: { flow: string; requestId: string }, stage: string, data?: Record<string, unknown>) {
  console.info(`[${context.flow}:${stage}]`, { requestId: context.requestId, ...(data || {}) });
}

export function logGenerationError(context: { flow: string; requestId: string }, stage: string, error: unknown, data?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${context.flow}:${stage}]`, { requestId: context.requestId, message, ...(data || {}) }, error);
}
