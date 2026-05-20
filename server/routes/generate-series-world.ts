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

function normalizeBaselineRules(worldBible: any) {
  const source = Array.isArray(worldBible?.baselineRules) && worldBible.baselineRules.length
    ? worldBible.baselineRules
    : Array.isArray(worldBible?.coreRules)
      ? worldBible.coreRules
      : Array.isArray(worldBible?.ironLaws)
        ? worldBible.ironLaws
        : [];
  return source.map((rule: any, index: number) => ({
    id: String(rule?.id || `rule_${index + 1}`),
    title: String(rule?.title || rule?.rule || rule || `世界基准 ${index + 1}`).trim(),
    detail: String(rule?.detail || rule?.rule || rule || '').trim(),
    kind: String(rule?.kind || rule?.scope || '世界').trim(),
  })).filter((rule: any) => rule.title || rule.detail).slice(0, 12);
}

function normalizeCharacterPool(worldBible: any) {
  const source = Array.isArray(worldBible?.characterPool) && worldBible.characterPool.length
    ? worldBible.characterPool
    : Array.isArray(worldBible?.characters) && worldBible.characters.length
      ? worldBible.characters
      : Array.isArray(worldBible?.recurringCharacterSeeds)
        ? worldBible.recurringCharacterSeeds
        : [];
  return source.map((card: any, index: number) => ({
    id: String(card?.id || `char_${index + 1}`),
    name: String(card?.name || card?.title || card || `角色 ${index + 1}`).trim(),
    role: String(card?.role || card?.type || '').trim(),
    desc: String(card?.desc || card?.description || card?.profile || card || '').trim(),
    status: String(card?.status || '').trim(),
  })).filter((card: any) => card.name || card.desc).slice(0, 12);
}

function normalizeWorldBible(raw: any, fallbackTitle: string) {
  const worldBible = raw && typeof raw === 'object' ? raw : {};
  return {
    ...worldBible,
    worldview: String(worldBible.worldview || worldBible.summary || worldBible.overview || fallbackTitle || '').trim(),
    baselineRules: normalizeBaselineRules(worldBible),
    characterPool: normalizeCharacterPool(worldBible),
    plotNotes: Array.isArray(worldBible.plotNotes)
      ? worldBible.plotNotes.map(String).filter(Boolean).slice(0, 12)
      : Array.isArray(worldBible.plotMaterials)
        ? worldBible.plotMaterials.map(String).filter(Boolean).slice(0, 12)
        : [],
  };
}

function normalizeSeriesWorld(raw: any) {
  if (!raw || typeof raw !== 'object') throw new Error('AI_RESPONSE_INVALID: series world is not an object.');
  const title = String(raw.title || '未命名长篇世界').trim();
  const worldBible = normalizeWorldBible(raw.worldBible, title);
  return {
    title: String(raw.title || '未命名长篇世界').trim(),
    pitch: String(raw.pitch || worldBible.worldview || '').trim(),
    genreTags: Array.isArray(raw.genreTags) ? raw.genreTags.map(String).filter(Boolean).slice(0, 8) : [],
    worldBible,
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
