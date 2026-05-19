import { Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from './_auth.js';
import { generateGeminiJsonWithFallback, parseGeminiJson } from './_gemini.js';
import { getRequestLogContext, logGenerationError, logGenerationInfo } from './_log.js';
import { buildCanonicalWorldStatePrompt, buildDeltaWorldStatePrompt } from '../Prompt/storyStateDigest.js';
import { generationLanguageInstruction, normalizeGenerationLanguage } from './_language.js';

const canonicalSchema = {
  type: Type.OBJECT,
  properties: {
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          permanent_traits: { type: Type.STRING, description: '角色不应因干涉而改变的永久特质，30字内' },
          core_relationships: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                with_id: { type: Type.STRING },
                type: { type: Type.STRING, description: '关系类型，如共谋/对立/追求/守护' },
              },
              required: ['with_id', 'type'],
            },
          },
          arc: { type: Type.STRING, description: '角色在初版故事中的变化弧线，20字内' },
        },
        required: ['id', 'name', 'permanent_traits', 'core_relationships', 'arc'],
      },
    },
    objects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          first_seen_chapter: { type: Type.INTEGER },
          holder_or_location: { type: Type.STRING },
          significance: { type: Type.STRING },
        },
        required: ['name', 'first_seen_chapter', 'holder_or_location', 'significance'],
      },
    },
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          chapters_appear: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          significance: { type: Type.STRING },
        },
        required: ['name', 'chapters_appear', 'significance'],
      },
    },
    core_rules: { type: Type.ARRAY, items: { type: Type.STRING } },
    style_anchor: { type: Type.STRING, description: '来自第一章的文风锚点示例，约100字' },
  },
  required: ['characters', 'objects', 'scenes', 'core_rules', 'style_anchor'],
};

const deltaSchema = {
  type: Type.OBJECT,
  properties: {
    characters_changed: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          delta_description: { type: Type.STRING },
        },
        required: ['id', 'delta_description'],
      },
    },
    objects_changed: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          delta_description: { type: Type.STRING },
        },
        required: ['name', 'delta_description'],
      },
    },
    scenes_changed: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          delta_description: { type: Type.STRING },
        },
        required: ['name', 'delta_description'],
      },
    },
    deviation_level: { type: Type.STRING, description: 'low / medium / high' },
  },
  required: ['characters_changed', 'objects_changed', 'scenes_changed', 'deviation_level'],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const logContext = getRequestLogContext(req, 'digest-chapter');
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  try {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;

    const {
      mode,
      blueprint,
      chapters,
      endings,
      branches,
      canonicalWorldState,
      rewrittenChapter,
      endingValue,
      interventionAction,
    } = req.body || {};
    const language = normalizeGenerationLanguage(req.body?.language);
    if (mode === 'canonical') {
      if (!Array.isArray(chapters) || !blueprint) {
        return res.status(400).json({ error: 'canonical 模式参数不合法。' });
      }

      const chaptersText = chapters
        .slice(0, 7)
        .map((chapter: any) => `第${chapter.chapter_num}章《${chapter.title || `章节${chapter.chapter_num}`}》：\n${String(chapter.text || chapter.summary || '').substring(0, 600)}`)
        .join('\n\n');

      const endingsText = endings
        ? [
            endings.default ? `默认结局：${String(endings.default).substring(0, 400)}` : '',
            endings.left ? `左结局：${String(endings.left).substring(0, 400)}` : '',
            endings.right ? `右结局：${String(endings.right).substring(0, 400)}` : '',
          ].filter(Boolean).join('\n')
        : '';

      const branchesText = (branches || [])
        .slice(0, 10)
        .map((branch: any) => `支线「${branch.name}」（${branch.side}侧）：${branch.desc || ''}`)
        .join('\n');

      const styleAnchorFallback = String((chapters || []).find((chapter: any) => chapter.chapter_num === 1)?.text || '').substring(0, 150);

      const prompt = `${generationLanguageInstruction(language)}\n\n${buildCanonicalWorldStatePrompt({
        blueprint,
        fullText: [
          `初版章节内容：\n${chaptersText}`,
          `初版结局原型：\n${endingsText || '（未提供）'}`,
          `支线事件：\n${branchesText || '（未提供）'}`,
        ].join('\n\n'),
        language,
      })}`;

      const { data: result } = await generateGeminiJsonWithFallback({
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: canonicalSchema,
        },
        parseResponse: (rawText) => parseGeminiJson(rawText),
        logContext,
        logInfo: logGenerationInfo,
        logError: logGenerationError,
        metadata: { mode },
      });

      if (!result.style_anchor && styleAnchorFallback) {
        result.style_anchor = styleAnchorFallback;
      }

      return res.status(200).json({ canonicalWorldState: result });
    }

    if (mode === 'delta') {
      if (!canonicalWorldState || !rewrittenChapter) {
        return res.status(400).json({ error: 'delta 模式缺少 canonicalWorldState 或 rewrittenChapter。' });
      }

      const prompt = `${generationLanguageInstruction(language)}\n\n${buildDeltaWorldStatePrompt({
        canonicalWorldState,
        rewrittenChapter: {
          ...rewrittenChapter,
          text: String(rewrittenChapter.text || '').substring(0, 800),
        },
        interventionAction,
        language,
      })}`;

      const { data } = await generateGeminiJsonWithFallback({
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: deltaSchema,
        },
        parseResponse: (rawText) => parseGeminiJson(rawText),
        logContext,
        logInfo: logGenerationInfo,
        logError: logGenerationError,
        metadata: { mode },
      });

      return res.status(200).json({ deltaWorldState: data });
    }

    return res.status(400).json({ error: '无效的 mode，请使用 canonical 或 delta。' });
  } catch (error) {
    logGenerationError(logContext, 'failed', error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('GEMINI_QUOTA_EXHAUSTED')) {
      return res.status(429).json({ error: 'AI 额度暂时用尽，多个 API key 都已触发限制，请更换 key 或稍后再试。', code: 'GEMINI_QUOTA_EXHAUSTED' });
    }
    return sendInternalError(res, 'digest 处理失败', error);
  }
}
