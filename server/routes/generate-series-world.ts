import { Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from '../_auth.js';
import { generateGeminiJsonWithFallback, parseGeminiJson } from '../_gemini.js';
import { getRequestLogContext, logGenerationError, logGenerationInfo } from '../_log.js';
import { buildSeriesWorldPrompt } from '../../Prompt/seriesWorld.js';
import { normalizeGenerationLanguage } from '../_language.js';

const seriesWorldSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    pitch: { type: Type.STRING },
    genreTags: { type: Type.ARRAY, items: { type: Type.STRING } },
    worldBible: { type: Type.OBJECT },
    timelineNotes: { type: Type.STRING },
    ironLaws: { type: Type.ARRAY, items: { type: Type.OBJECT } },
    futureDirections: { type: Type.ARRAY, items: { type: Type.OBJECT } },
  },
  required: ['title', 'pitch', 'genreTags', 'worldBible', 'timelineNotes', 'ironLaws', 'futureDirections'],
};

function normalizeSeriesWorld(raw: any) {
  if (!raw || typeof raw !== 'object') throw new Error('AI_RESPONSE_INVALID: series world is not an object.');
  return {
    title: String(raw.title || '未命名长篇世界').trim(),
    pitch: String(raw.pitch || '').trim(),
    genreTags: Array.isArray(raw.genreTags) ? raw.genreTags.map(String).filter(Boolean).slice(0, 8) : [],
    worldBible: raw.worldBible && typeof raw.worldBible === 'object' ? raw.worldBible : {},
    timelineNotes: String(raw.timelineNotes || '').trim(),
    ironLaws: Array.isArray(raw.ironLaws) ? raw.ironLaws.slice(0, 8) : [],
    futureDirections: Array.isArray(raw.futureDirections) ? raw.futureDirections.slice(0, 8) : [],
    visibility: 'private',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const logContext = getRequestLogContext(req, 'generate-series-world');
  if (req.method !== 'POST') return sendMethodNotAllowed(res);
  try {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;
    const language = normalizeGenerationLanguage(req.body?.language);
    const prompt = buildSeriesWorldPrompt({
      mode: req.body?.mode === 'extract' ? 'extract' : 'new',
      genreTags: Array.isArray(req.body?.genreTags) ? req.body.genreTags : [],
      tone: req.body?.tone,
      coreConflict: req.body?.coreConflict,
      lengthHint: req.body?.lengthHint,
      authorSeed: req.body?.authorSeed,
      sourceStory: req.body?.sourceStory,
      language,
    });
    logGenerationInfo(logContext, 'request', {
      uid: user.uid,
      mode: req.body?.mode === 'extract' ? 'extract' : 'new',
      genreTagCount: Array.isArray(req.body?.genreTags) ? req.body.genreTags.length : 0,
      hasSourceStory: Boolean(req.body?.sourceStory),
      language,
    });
    const { data, model, keyIndex } = await generateGeminiJsonWithFallback({
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: seriesWorldSchema },
      parseResponse: (rawText) => normalizeSeriesWorld(parseGeminiJson(rawText)),
      logContext,
      logInfo: logGenerationInfo,
      logError: logGenerationError,
    });
    logGenerationInfo(logContext, 'success', { model, keyIndex, title: data.title });
    return res.status(200).json(data);
  } catch (error) {
    logGenerationError(logContext, 'failed', error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('GEMINI_QUOTA_EXHAUSTED')) {
      return res.status(429).json({ error: 'AI 额度暂时用尽，请稍后再试。', code: 'GEMINI_QUOTA_EXHAUSTED' });
    }
    if (message.includes('AI_RESPONSE_INVALID') || message.includes('JSON')) {
      return res.status(502).json({ error: 'AI 返回的长篇设定格式不完整，请重新生成一次。', code: 'AI_RESPONSE_INVALID' });
    }
    return sendInternalError(res, '生成长篇设定失败', error);
  }
}
