import { Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from './_auth.js';
import { generateGeminiJsonWithFallback, parseGeminiJson } from './_gemini.js';
import { getRequestLogContext, logGenerationError, logGenerationInfo } from './_log.js';
import { buildQuickStoryBlueprintPrompt } from '../Prompt/quickStoryBlueprint.js';

const blueprintSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: '第一篇章标题' },
    main_axis: { type: Type.STRING, description: '第一篇章的核心主轴/大纲，作为后续发展的基架' },
    left_mainline_default: { type: Type.NUMBER, description: '左侧主线默认影响率 (0-100)' },
    right_mainline_default: { type: Type.NUMBER, description: '右侧主线默认影响率 (0-100)' },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: '如 c1, c2' },
          name: { type: Type.STRING, description: '纯粹的姓名，不要包含任何简介或括号附加信息' },
          desc: { type: Type.STRING, description: '一句话简介' },
        },
        required: ['id', 'name', 'desc'],
      },
    },
    chapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          chapter_num: { type: Type.INTEGER },
          title: { type: Type.STRING, description: '章节标题（6-12字）' },
          summary: { type: Type.STRING, description: '该章节的剧情要点大纲(20-40字)' },
          present_characters: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '本章出场的角色ID列表',
          },
        },
        required: ['chapter_num', 'title', 'summary', 'present_characters'],
      },
    },
    endings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: 'good, normal, or bad' },
          text: { type: Type.STRING, description: '第一篇章结局走向描述' },
        },
        required: ['type', 'text'],
      },
    },
    branches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          score: { type: Type.INTEGER, description: '权重：1(小), 2(中), 3(大), 5(隐)' },
          side: { type: Type.STRING, description: 'left, right' },
          condition_char: { type: Type.STRING },
          condition_action: { type: Type.STRING },
          condition_chapter: { type: Type.INTEGER },
          desc: { type: Type.STRING },
          is_hidden: { type: Type.BOOLEAN },
          hint: { type: Type.STRING },
        },
        required: ['id', 'name', 'score', 'side', 'condition_char', 'condition_action', 'condition_chapter', 'desc', 'is_hidden', 'hint'],
      },
    },
  },
  required: ['title', 'main_axis', 'left_mainline_default', 'right_mainline_default', 'characters', 'chapters', 'endings', 'branches'],
};

function normalizeBlueprint(raw: any) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI_RESPONSE_INVALID: blueprint response is not an object.');
  }

  const characters = Array.isArray(raw.characters)
    ? raw.characters.slice(0, 5).map((character: any, index: number) => ({
        id: String(character?.id || `c${index + 1}`).trim() || `c${index + 1}`,
        name: String(character?.name || `角色${index + 1}`).trim(),
        desc: String(character?.desc || '尚待命运揭示的关键人物').trim(),
      })).filter((character: any) => character.name)
    : [];

  const chapters = Array.isArray(raw.chapters)
    ? raw.chapters.slice(0, 7).map((chapter: any, index: number) => ({
        chapter_num: Math.min(7, Math.max(1, Number(chapter?.chapter_num) || index + 1)),
        title: String(chapter?.title || `第${index + 1}章`).trim(),
        summary: String(chapter?.summary || '命运仍在雾中等待成形。').trim(),
        present_characters: Array.isArray(chapter?.present_characters)
          ? chapter.present_characters.map((id: any) => String(id)).filter(Boolean)
          : characters.map((character: any) => character.id).slice(0, 3),
      }))
    : [];

  const endings = Array.isArray(raw.endings)
    ? raw.endings.slice(0, 3).map((ending: any, index: number) => ({
        type: ['good', 'normal', 'bad'].includes(String(ending?.type)) ? String(ending.type) : ['normal', 'good', 'bad'][index] || 'normal',
        text: String(ending?.text || '命运在终章留下尚未命名的回声。').trim(),
      }))
    : [];

  const branches = Array.isArray(raw.branches)
    ? raw.branches.slice(0, 10).map((branch: any, index: number) => ({
        id: String(branch?.id || `b_${index + 1}`).trim(),
        name: String(branch?.name || characters[index % Math.max(1, characters.length)]?.name || `角色${index + 1}`).trim(),
        score: Math.min(5, Math.max(1, Number(branch?.score) || 1)),
        side: String(branch?.side) === 'right' ? 'right' : 'left',
        condition_char: String(branch?.condition_char || characters[index % Math.max(1, characters.length)]?.id || 'c1'),
        condition_action: String(branch?.condition_action) === 'curse' ? 'curse' : 'bless',
        condition_chapter: Math.min(6, Math.max(2, Number(branch?.condition_chapter) || 2)),
        desc: String(branch?.desc || '一次干涉会令潜藏的命运分歧浮现。').trim(),
        is_hidden: Boolean(branch?.is_hidden),
        hint: String(branch?.hint || '命运有细微回声').trim(),
      }))
    : [];

  if (!String(raw.title || '').trim() || !String(raw.main_axis || '').trim()) {
    throw new Error('AI_RESPONSE_INVALID: blueprint missed title or main_axis.');
  }
  if (characters.length === 0 || chapters.length === 0 || endings.length === 0 || branches.length === 0) {
    throw new Error('AI_RESPONSE_INVALID: blueprint missed required arrays.');
  }

  return {
    ...raw,
    title: String(raw.title).trim(),
    main_axis: String(raw.main_axis).trim(),
    left_mainline_default: Math.min(100, Math.max(0, Number(raw.left_mainline_default) || 40)),
    right_mainline_default: Math.min(100, Math.max(0, Number(raw.right_mainline_default) || 40)),
    characters,
    chapters,
    endings,
    branches,
  };
}

async function generateBlueprintWithFallback(prompt: string, logContext: { flow: string; requestId: string }) {
  const { data, model, keyIndex } = await generateGeminiJsonWithFallback({
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: blueprintSchema,
    },
    parseResponse: (rawText) => normalizeBlueprint(parseGeminiJson(rawText)),
    logContext,
    logInfo: logGenerationInfo,
    logError: logGenerationError,
  });
  logGenerationInfo(logContext, 'model-success', {
    model,
    keyIndex,
    chapters: data.chapters.length,
    branches: data.branches.length,
    endings: data.endings.length,
  });
  return data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const logContext = getRequestLogContext(req, 'generate-blueprint');
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  try {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;

    const { selectedThemes, customOutline, targetWordCount, narrativePerson } = req.body || {};
    logGenerationInfo(logContext, 'request', {
      uid: user.uid,
      themeCount: Array.isArray(selectedThemes) ? selectedThemes.length : 0,
      hasOutline: Boolean(String(customOutline || '').trim()),
      targetWordCount,
      narrativePerson,
    });

    if (!Array.isArray(selectedThemes) && !customOutline) {
      return res.status(400).json({ error: '必须选择至少一个主题或提供大纲' });
    }

    const safeTargetWordCount = Math.min(1200, Math.max(600, Number(targetWordCount) || 600));

    const prompt = buildQuickStoryBlueprintPrompt({
      selectedThemes,
      customOutline,
      targetWordCount: safeTargetWordCount,
      narrativePerson,
    });

    const data = await generateBlueprintWithFallback(prompt, logContext);
    logGenerationInfo(logContext, 'success', { title: data.title });
    return res.status(200).json(data);
  } catch (error) {
    logGenerationError(logContext, 'failed', error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('GEMINI_QUOTA_EXHAUSTED')) {
      return res.status(429).json({ error: 'AI 额度暂时用尽，多个 API key 都已触发限制，请更换 key 或稍后再试。', code: 'GEMINI_QUOTA_EXHAUSTED' });
    }
    if (message.includes('Missing valid Gemini API key.') || message.includes('API key not valid') || message.includes('API_KEY_INVALID')) {
      return res.status(503).json({ error: 'AI 服务配置未完成，请稍后再试。', code: 'AI_CONFIG_MISSING' });
    }
    if (message.includes('AI_RESPONSE_INVALID') || message.includes('JSON')) {
      console.error('生成蓝图失败', error);
      return res.status(502).json({ error: 'AI 返回的蓝图格式不完整，请重新生成一次。', code: 'AI_RESPONSE_INVALID' });
    }
    return sendInternalError(res, '生成蓝图失败', error);
  }
}
