import { Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from '../_auth.js';
import { generateGeminiJsonWithFallback, parseGeminiJson } from '../_gemini.js';
import { getRequestLogContext, logGenerationError, logGenerationInfo } from '../_log.js';
import { buildChapterContinuationPrompt, buildChapterWorldStatePrompt } from '../../Prompt/chapterContinuation.js';
import { generationLanguageInstruction, normalizeGenerationLanguage } from '../_language.js';
import { assertProseQuality, ensureParagraphing } from '../_generationQuality.js';

export const maxDuration = 60;

function stripGeneratedMarkup(raw: unknown) {
  return String(raw ?? '')
    .replace(/&lt;\s*\/?\s*mark\s*&gt;/gi, '')
    .replace(/<\s*\/?\s*mark\s*>/gi, '')
    .replace(/```(?:json|html|xml|markdown|md)?/gi, '')
    .replace(/<\/?(?:span|strong|em|b|i)>/gi, '')
    .trim();
}

const chapterSchema = {
  type: Type.OBJECT,
  properties: {
    chapter_num: { type: Type.INTEGER },
    text: { type: Type.STRING },
    present_characters: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['chapter_num', 'text', 'present_characters'],
};

function normalizeGeneratedChapter(raw: any, chapterNum: number) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI_RESPONSE_INVALID: chapter response is not an object.');
  }
  const text = stripGeneratedMarkup(raw.text || '');
  if (text.length < 50) {
    throw new Error('AI_RESPONSE_INVALID: chapter text is empty or too short.');
  }
  return {
    ...raw,
    chapter_num: Math.min(7, Math.max(1, Number(raw.chapter_num) || chapterNum)),
    text: ensureParagraphing(text, { minParas: 6, maxParas: 10 }),
    present_characters: Array.isArray(raw.present_characters)
      ? raw.present_characters.map((id: any) => String(id)).filter(Boolean)
      : [],
  };
}

async function generateChapterWithFallback(
  prompt: string,
  chapterNum: number,
  logContext: { flow: string; requestId: string }
) {
  const { data, model, keyIndex } = await generateGeminiJsonWithFallback({
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: chapterSchema,
    },
    parseResponse: (rawText) => normalizeGeneratedChapter(parseGeminiJson(rawText), chapterNum),
    logContext,
    logInfo: logGenerationInfo,
    logError: logGenerationError,
    metadata: { chapterNum },
  });
  logGenerationInfo(logContext, 'model-success', {
    model,
    keyIndex,
    chapterNum: data.chapter_num,
    textLength: data.text.length,
    presentCharacters: data.present_characters.length,
  });
  return data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const logContext = getRequestLogContext(req, 'generate-next-chapter');
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  try {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;

    const { blueprint, currentChapters, chapters: chaptersBody, targetChapterNum, targetWordCount, worldState, narrativePerson } = req.body || {};
    const language = normalizeGenerationLanguage(req.body?.language);
    const safeTargetChapterNum = Math.min(7, Math.max(1, Number(targetChapterNum) || 1));
    const safeTargetWordCount = Math.min(1200, Math.max(400, Number(targetWordCount) || 400));
    const allChapters: any[] = Array.isArray(chaptersBody) && chaptersBody.length
      ? chaptersBody.slice(0, 7)
      : (Array.isArray(currentChapters) ? currentChapters.slice(0, 7) : []);
    logGenerationInfo(logContext, 'request', {
      uid: user.uid,
      chapterNum: safeTargetChapterNum,
      targetWordCount: safeTargetWordCount,
      chapterCount: allChapters.length,
      hasWorldState: Boolean(worldState),
      narrativePerson: narrativePerson || blueprint?.narrative_person || 'third',
      language,
    });

    if (!blueprint || typeof blueprint.main_axis !== 'string' || !Array.isArray(blueprint.characters)) {
      return res.status(400).json({ error: '蓝图参数不合法。' });
    }

    const historyChapters = allChapters.filter((chapter: any) =>
      chapter?.text &&
      String(chapter.text).trim().length > 0 &&
      Number(chapter.chapter_num) < safeTargetChapterNum
    );
    const blueprintChapter = blueprint?.chapters?.find((chapter: any) => chapter.chapter_num === safeTargetChapterNum);
    const liveChapter = allChapters.find((chapter: any) => chapter.chapter_num === safeTargetChapterNum);
    const outlineSummary = (liveChapter?.summary && String(liveChapter.summary).trim())
      ? String(liveChapter.summary).trim()
      : (blueprintChapter?.summary || '');
    const futureOutlines = allChapters
      .filter((chapter: any) => chapter.chapter_num > safeTargetChapterNum && chapter.summary && String(chapter.summary).trim())
      .map((chapter: any) => language === 'en-US'
        ? `Chapter ${chapter.chapter_num} outline: ${String(chapter.summary).trim()}`
        : `第${chapter.chapter_num}章要点：${String(chapter.summary).trim()}`)
      .join('\n');

    const defaultText = blueprint?.authorAssets?.defaultChapters?.[safeTargetChapterNum]?.text;
    const endingProto = blueprint?.authorAssets?.endingPrototypes;
    const prevChapterText = allChapters.find((chapter: any) => chapter.chapter_num === safeTargetChapterNum - 1)?.text || '';

    const worldStatePrompt = buildChapterWorldStatePrompt({
      worldState,
      endingProto,
      prevChapterText,
      historyChapters,
      targetChapterNum: safeTargetChapterNum,
      language,
    });
    const prompt = `${generationLanguageInstruction(language)}\n\n${buildChapterContinuationPrompt({
      blueprint,
      narrativePerson,
      worldStatePrompt,
      outlineSummary,
      futureOutlines,
      defaultText,
      endingProto,
      targetChapterNum: safeTargetChapterNum,
      targetWordCount: safeTargetWordCount,
      language,
    })}`;

    const data = await generateChapterWithFallback(prompt, safeTargetChapterNum, logContext);
    assertProseQuality(data.text, {
      label: `chapter ${safeTargetChapterNum}`,
      targetWordCount: safeTargetWordCount,
      minRatio: 0.85,
      maxRatio: 1.15,
      minUnits: 240,
      minParagraphs: 4,
    });

    logGenerationInfo(logContext, 'success', { chapterNum: data.chapter_num, textLength: data.text.length });
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
      return res.status(502).json({ error: 'AI 返回的章节格式不完整，请重新生成一次。', code: 'AI_RESPONSE_INVALID' });
    }
    return sendInternalError(res, '生成章节失败', error);
  }
}
