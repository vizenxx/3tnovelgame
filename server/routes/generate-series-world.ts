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

function fallbackCharactersFromStory(sourceStory: any) {
  const characters = [
    ...(Array.isArray(sourceStory?.meta?.characters) ? sourceStory.meta.characters : []),
    ...(Array.isArray(sourceStory?.characters) ? sourceStory.characters : []),
    ...(Array.isArray(sourceStory?.blueprint?.characters) ? sourceStory.blueprint.characters : []),
  ];
  const seen = new Set<string>();
  return characters
    .map((character: any, index: number) => {
      const name = String(character?.name || character?.title || '').trim();
      if (!name || seen.has(name)) return null;
      seen.add(name);
      return {
        id: String(character?.id || `char_${index + 1}`),
        name,
        role: String(character?.role || '原作角色').trim(),
        desc: String(character?.desc || character?.description || character?.profile || `${name} 是从原作中提取的角色。`).trim(),
        status: String(character?.status || '').trim(),
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

function fallbackRulesFromStory(sourceStory: any) {
  const meta = sourceStory?.meta || sourceStory || {};
  const rules: any[] = [];
  const mainAxis = String(meta.main_axis || sourceStory?.main_axis || '').trim();
  if (mainAxis) {
    rules.push({
      id: 'rule_main_axis',
      title: '保留原作核心命题',
      detail: `后续生成需要尊重原作主轴：${mainAxis}`,
      kind: '主轴',
    });
  }
  const branches = Array.isArray(sourceStory?.branches) ? sourceStory.branches : [];
  branches.slice(0, 6).forEach((branch: any, index: number) => {
    const name = String(branch?.name || branch?.title || `支线 ${index + 1}`).trim();
    const detail = String(branch?.desc || branch?.description || branch?.story || '').trim();
    if (name || detail) {
      rules.push({
        id: `rule_branch_${index + 1}`,
        title: `保留支线条件：${name}`,
        detail: detail || `原作存在「${name}」这条支线，续作或同世界作品应尊重其条件与影响。`,
        kind: '支线',
      });
    }
  });
  const endings = Array.isArray(sourceStory?.endings) ? sourceStory.endings : [];
  if (endings.length > 0) {
    rules.push({
      id: 'rule_endings',
      title: '保留结局域的可能性',
      detail: `原作包含这些结局出口：${endings.map((ending: any) => ending?.title || ending?.id || '未命名结局').filter(Boolean).join('、')}。后续设定不应轻易否定这些出口。`,
      kind: '结局',
    });
  }
  return rules.slice(0, 12);
}

function normalizeSeriesWorld(raw: any, sourceStory?: any, mode: 'new' | 'extract' = 'new') {
  if (!raw || typeof raw !== 'object') throw new Error('AI_RESPONSE_INVALID: series world is not an object.');
  const title = String(raw.title || '未命名长篇世界').trim();
  const worldBible = normalizeWorldBible(raw.worldBible, title);
  if (mode === 'extract' && sourceStory) {
    if (!worldBible.worldview) {
      const meta = sourceStory.meta || sourceStory;
      worldBible.worldview = String(meta.main_axis || meta.description || meta.premise || title).trim();
    }
    if (!Array.isArray(worldBible.characterPool) || worldBible.characterPool.length === 0) {
      worldBible.characterPool = fallbackCharactersFromStory(sourceStory);
    }
    if (!Array.isArray(worldBible.baselineRules) || worldBible.baselineRules.length === 0) {
      worldBible.baselineRules = fallbackRulesFromStory(sourceStory);
    }
  }
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
    const mode = req.body?.mode === 'extract' ? 'extract' : 'new';
    const sourceStory = req.body?.sourceStory;
    const { data, model, keyIndex } = await generateGeminiJsonWithFallback({
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: seriesWorldSchema },
      parseResponse: (rawText) => normalizeSeriesWorld(parseGeminiJson(rawText), sourceStory, mode),
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
