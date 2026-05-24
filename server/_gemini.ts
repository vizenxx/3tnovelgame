import { GoogleGenAI } from '@google/genai';

const GEMINI_PLACEHOLDERS = new Set([
  'MY_API_KEY',
  'YOUR_API_KEY',
  'GEMINI_API_KEY',
  'API_KEY',
  'CHANGE_ME',
]);

const GEMINI_TEXT_MODEL_ALLOWLIST = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
];

type GeminiLogContext = { flow: string; requestId: string };
type GeminiLogInfo = (context: GeminiLogContext, event: string, metadata?: Record<string, unknown>) => void;
type GeminiLogError = (context: GeminiLogContext, event: string, error: unknown, metadata?: Record<string, unknown>) => void;

export function stripGeneratedMarkup(value: unknown) {
  return String(value ?? '')
    .replace(/&lt;\s*\/?\s*mark\s*&gt;/gi, '')
    .replace(/&lt;\s*\/?\s*(?:span|strong|em|b|i|u|p|div|br|code|pre|section|article|aside|font|small|big|center|ruby|rt|rp)(?:\s+[^&]*?)?\s*&gt;/gi, '')
    .replace(/<\s*\/?\s*mark\s*>/gi, '')
    .replace(/<\/?(?:span|strong|em|b|i|u|p|div|br|code|pre|section|article|aside|font|small|big|center|ruby|rt|rp)(?:\s+[^<>]*?)?>/gi, '')
    .replace(/<\/?[a-z][a-z0-9:-]*(?:\s+[^<>]*?)?>/gi, '')
    .replace(/```(?:json|html|xml|markdown|md)?/gi, '')
    .replace(/```/g, '')
    .replace(/\[\/?(?:focus|highlight|mark|changed?|diff|insert|delete)\]/gi, '')
    .replace(/(?:【|「|\[)?(?:高亮|标记|变化标记|highlight|markup)(?:】|」|\])?[：:]/gi, '')
    .replace(/\u200b|\u200c|\u200d|\ufeff/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function sanitizeGeneratedPayload<T>(value: T): T {
  if (typeof value === 'string') {
    return stripGeneratedMarkup(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeGeneratedPayload(item)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sanitizeGeneratedPayload(item)])
    ) as T;
  }
  return value;
}

function isLikelyGeminiKey(value: string) {
  return /^[A-Za-z0-9_-]{20,}$/.test(value);
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

function parseGeminiErrorInfo(error: unknown) {
  const message = safeErrorMessage(error);
  try {
    const parsed = JSON.parse(message);
    const geminiError = parsed?.error || parsed;
    return {
      status: Number(geminiError?.code || (error as any)?.status || 0),
      code: String(geminiError?.status || (error as any)?.code || ''),
      message: String(geminiError?.message || message),
    };
  } catch {
    return {
      status: Number((error as any)?.status || 0),
      code: String((error as any)?.code || ''),
      message,
    };
  }
}

export function isGeminiMisconfiguredError(error: unknown) {
  const info = parseGeminiErrorInfo(error);
  return (
    info.message.includes('Missing valid Gemini API key.') ||
    info.message.includes('API key not valid') ||
    info.message.includes('API_KEY_INVALID') ||
    info.code === 'API_KEY_INVALID'
  );
}

export function isGeminiQuotaError(error: unknown) {
  const info = parseGeminiErrorInfo(error);
  return (
    info.status === 429 ||
    info.code === 'RESOURCE_EXHAUSTED' ||
    /quota|rate.?limit|resource_exhausted/i.test(info.message)
  );
}

export function getGeminiApiKeys() {
  const rawValue = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  const apiKeys = rawValue
    .replace(/['"]/g, '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => !GEMINI_PLACEHOLDERS.has(value))
    .filter(isLikelyGeminiKey);

  if (apiKeys.length === 0) {
    throw new Error('Missing valid Gemini API key.');
  }

  return apiKeys;
}

export function getGeminiApiKey() {
  const apiKeys = getGeminiApiKeys();
  return apiKeys[Math.floor(Math.random() * apiKeys.length)];
}

export function getRotatedGeminiApiKeys() {
  const apiKeys = getGeminiApiKeys();
  const startIndex = Math.floor(Math.random() * apiKeys.length);
  return apiKeys.map((_, offset) => {
    const keyIndex = (startIndex + offset) % apiKeys.length;
    return { apiKey: apiKeys[keyIndex], keyIndex };
  });
}

export function createGeminiClient(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

export function getGeminiModelCandidates() {
  const configuredModels = (process.env.GEMINI_MODEL || process.env.GEMINI_MODELS || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => GEMINI_TEXT_MODEL_ALLOWLIST.includes(value));

  const candidates = configuredModels.length > 0 ? configuredModels : GEMINI_TEXT_MODEL_ALLOWLIST;
  return Array.from(new Set(candidates));
}

export async function generateGeminiTextWithFallback(options: {
  contents: string;
  config?: any;
  logContext?: GeminiLogContext;
  logInfo?: GeminiLogInfo;
  logError?: GeminiLogError;
  metadata?: Record<string, unknown>;
}) {
  const models = getGeminiModelCandidates();
  const keyEntries = getRotatedGeminiApiKeys();
  let lastError: unknown = null;
  let quotaFailures = 0;

  for (const model of models) {
    let modelQuotaFailures = 0;
    for (const { apiKey, keyIndex } of keyEntries) {
      try {
        options.logInfo?.(options.logContext!, 'gemini-attempt', {
          ...options.metadata,
          model,
          keyIndex,
        });
        const ai = createGeminiClient(apiKey);
        const response = await ai.models.generateContent({
          model,
          contents: options.contents,
          config: options.config,
        });
        options.logInfo?.(options.logContext!, 'gemini-success', {
          ...options.metadata,
          model,
          keyIndex,
        });
        return { response, model, keyIndex };
      } catch (error) {
        lastError = error;
        const quota = isGeminiQuotaError(error);
        if (quota) {
          quotaFailures += 1;
          modelQuotaFailures += 1;
        }
        options.logError?.(options.logContext!, quota ? 'gemini-key-quota-failed' : 'gemini-attempt-failed', error, {
          ...options.metadata,
          model,
          keyIndex,
        });
      }
    }

    if (modelQuotaFailures >= keyEntries.length) {
      options.logInfo?.(options.logContext!, 'gemini-model-quota-exhausted', {
        ...options.metadata,
        model,
        keyCount: keyEntries.length,
      });
    }
  }

  if (quotaFailures >= models.length * keyEntries.length) {
    throw new Error('GEMINI_QUOTA_EXHAUSTED: all Gemini API keys exceeded quota for all configured text models.');
  }

  throw lastError instanceof Error ? lastError : new Error('GEMINI_MODEL_FAILED: Gemini text generation failed.');
}

export async function generateGeminiJsonWithFallback<T>(options: {
  contents: string;
  config?: any;
  parseResponse: (rawText: string | undefined) => T;
  logContext?: GeminiLogContext;
  logInfo?: GeminiLogInfo;
  logError?: GeminiLogError;
  metadata?: Record<string, unknown>;
}) {
  const models = getGeminiModelCandidates();
  const keyEntries = getRotatedGeminiApiKeys();
  let lastError: unknown = null;
  let quotaFailures = 0;

  for (const model of models) {
    let modelQuotaFailures = 0;
    for (const { apiKey, keyIndex } of keyEntries) {
      try {
        options.logInfo?.(options.logContext!, 'gemini-attempt', {
          ...options.metadata,
          model,
          keyIndex,
        });
        const ai = createGeminiClient(apiKey);
        const response = await ai.models.generateContent({
          model,
          contents: options.contents,
          config: options.config,
        });
        const data = sanitizeGeneratedPayload(options.parseResponse(response.text));
        options.logInfo?.(options.logContext!, 'gemini-success', {
          ...options.metadata,
          model,
          keyIndex,
        });
        return { data, response, model, keyIndex };
      } catch (error) {
        lastError = error;
        const quota = isGeminiQuotaError(error);
        if (quota) {
          quotaFailures += 1;
          modelQuotaFailures += 1;
        }
        options.logError?.(options.logContext!, quota ? 'gemini-key-quota-failed' : 'gemini-attempt-failed', error, {
          ...options.metadata,
          model,
          keyIndex,
        });
      }
    }

    if (modelQuotaFailures >= keyEntries.length) {
      options.logInfo?.(options.logContext!, 'gemini-model-quota-exhausted', {
        ...options.metadata,
        model,
        keyCount: keyEntries.length,
      });
    }
  }

  if (quotaFailures >= models.length * keyEntries.length) {
    throw new Error('GEMINI_QUOTA_EXHAUSTED: all Gemini API keys exceeded quota for all configured text models.');
  }

  throw lastError instanceof Error ? lastError : new Error('GEMINI_MODEL_FAILED: Gemini JSON generation failed.');
}

export function parseGeminiJson<T = any>(rawText: string | undefined): T {
  const raw = String(rawText || '').trim();
  if (!raw) {
    throw new Error('Gemini returned an empty response.');
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fencedMatch?.[1]?.trim() || raw.match(/\{[\s\S]*\}/)?.[0];
    if (!candidate) {
      throw new Error('Gemini response did not contain valid JSON.');
    }
    return JSON.parse(candidate) as T;
  }
}
