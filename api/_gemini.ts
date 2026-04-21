export function getGeminiApiKey() {
  const rawValue = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  const apiKey = rawValue
    .split(',')
    .map((value) => value.trim())
    .find(Boolean);

  if (!apiKey || apiKey === 'MY_API_KEY') {
    throw new Error('Missing valid Gemini API key.');
  }

  return apiKey;
}
