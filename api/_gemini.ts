const GEMINI_PLACEHOLDERS = new Set([
  'MY_API_KEY',
  'YOUR_API_KEY',
  'GEMINI_API_KEY',
  'API_KEY',
  'CHANGE_ME',
]);

function isLikelyGeminiKey(value: string) {
  return /^[A-Za-z0-9_-]{20,}$/.test(value);
}

export function isGeminiMisconfiguredError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Missing valid Gemini API key.') ||
    message.includes('API key not valid') ||
    message.includes('API_KEY_INVALID')
  );
}

export function getGeminiApiKey() {
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

  return apiKeys[Math.floor(Math.random() * apiKeys.length)];
}

export function getGeminiModelCandidates() {
  const configuredModels = (process.env.GEMINI_MODEL || process.env.GEMINI_MODELS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set([
    ...configuredModels,
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
  ]));
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
