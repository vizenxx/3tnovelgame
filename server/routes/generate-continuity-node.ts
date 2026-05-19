import { Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from '../_auth.js';
import { generateGeminiJsonWithFallback, parseGeminiJson } from '../_gemini.js';
import { getRequestLogContext, logGenerationError, logGenerationInfo } from '../_log.js';
import { buildContinuityNodePrompt } from '../../Prompt/seriesWorld.js';
import { normalizeGenerationLanguage } from '../_language.js';

const continuityNodeSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    endingDomain: { type: Type.STRING },
    endingId: { type: Type.STRING },
    requiredBranchIds: { type: Type.ARRAY, items: { type: Type.STRING } },
    optionalBranchIds: { type: Type.ARRAY, items: { type: Type.STRING } },
    bridgeSummary: { type: Type.STRING },
    legacyState: { type: Type.OBJECT },
    repairRules: { type: Type.ARRAY, items: { type: Type.OBJECT } },
    sequelSeedPrompt: { type: Type.STRING },
  },
  required: ['title', 'endingDomain', 'endingId', 'requiredBranchIds', 'optionalBranchIds', 'bridgeSummary', 'legacyState', 'repairRules', 'sequelSeedPrompt'],
};

function normalizeContinuityNode(raw: any, fallback: any) {
  if (!raw || typeof raw !== 'object') throw new Error('AI_RESPONSE_INVALID: continuity node is not an object.');
  const endingDomain = ['left', 'right', 'middle'].includes(String(raw.endingDomain)) ? String(raw.endingDomain) : (fallback.endingDomain || 'middle');
  return {
    title: String(raw.title || '未命名接续节点').trim(),
    endingDomain,
    endingId: String(raw.endingId || fallback.endingId || 'default').trim(),
    requiredBranchIds: Array.isArray(raw.requiredBranchIds) ? raw.requiredBranchIds.map(String).filter(Boolean) : [],
    optionalBranchIds: Array.isArray(raw.optionalBranchIds) ? raw.optionalBranchIds.map(String).filter(Boolean) : [],
    bridgeSummary: String(raw.bridgeSummary || '').trim(),
    legacyState: raw.legacyState && typeof raw.legacyState === 'object' ? raw.legacyState : {},
    repairRules: Array.isArray(raw.repairRules) ? raw.repairRules.slice(0, 8) : [],
    sequelSeedPrompt: String(raw.sequelSeedPrompt || '').trim(),
    visibility: 'private',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const logContext = getRequestLogContext(req, 'generate-continuity-node');
  if (req.method !== 'POST') return sendMethodNotAllowed(res);
  try {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;
    const language = normalizeGenerationLanguage(req.body?.language);
    const fallback = {
      endingDomain: req.body?.endingDomain || 'middle',
      endingId: req.body?.endingId || 'default',
    };
    const prompt = buildContinuityNodePrompt({
      seriesWorld: req.body?.seriesWorld,
      sourceStory: req.body?.sourceStory,
      endingDomain: fallback.endingDomain,
      endingId: fallback.endingId,
      requiredBranchIds: Array.isArray(req.body?.requiredBranchIds) ? req.body.requiredBranchIds : [],
      language,
    });
    logGenerationInfo(logContext, 'request', {
      uid: user.uid,
      seriesId: req.body?.seriesWorld?.id || null,
      sourceStoryId: req.body?.sourceStory?.storyId || null,
      endingDomain: fallback.endingDomain,
      endingId: fallback.endingId,
      language,
    });
    const { data, model, keyIndex } = await generateGeminiJsonWithFallback({
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: continuityNodeSchema },
      parseResponse: (rawText) => normalizeContinuityNode(parseGeminiJson(rawText), fallback),
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
      return res.status(502).json({ error: 'AI 返回的接续节点格式不完整，请重新生成一次。', code: 'AI_RESPONSE_INVALID' });
    }
    return sendInternalError(res, '生成接续节点失败', error);
  }
}
