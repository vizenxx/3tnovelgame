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
