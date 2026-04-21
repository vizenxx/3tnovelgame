export function getGeminiApiKey() {
  const rawValue = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  const apiKeys = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (apiKeys.length === 0 || apiKeys[0] === 'MY_API_KEY') {
    throw new Error('Missing valid Gemini API key.');
  }

  // Randomize key selection to avoid hitting rate limits on a single key
  return apiKeys[Math.floor(Math.random() * apiKeys.length)];
}
