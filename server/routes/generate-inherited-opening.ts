import { Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from '../_auth.js';
import { generateGeminiJsonWithFallback, parseGeminiJson } from '../_gemini.js';
import { generationLanguageInstruction, normalizeGenerationLanguage, type GenerationLanguage } from '../_language.js';
import { getRequestLogContext, logGenerationError, logGenerationInfo } from '../_log.js';

export const maxDuration = 60;

function stripGeneratedMarkup(raw: unknown) {
  return String(raw ?? '')
    .replace(/&lt;\s*\/?\s*mark\s*&gt;/gi, '')
    .replace(/<\s*\/?\s*mark\s*>/gi, '')
    .replace(/```(?:json|html|xml|markdown|md)?/gi, '')
    .replace(/<\/?(?:span|strong|em|b|i)>/gi, '')
    .trim();
}

function ensureParagraphing(raw: string) {
  let text = stripGeneratedMarkup(raw).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return text;
  text = text.replace(/\n{3,}/g, '\n\n');
  if (!text.includes('\n\n')) {
    const sentences = text.split(/(?<=[。！？!?…])\s*/g).map((item) => item.trim()).filter(Boolean);
    const chunks: string[] = [];
    const perChunk = Math.max(1, Math.ceil(sentences.length / 8));
    for (let index = 0; index < sentences.length; index += perChunk) {
      chunks.push(sentences.slice(index, index + perChunk).join(''));
    }
    text = chunks.join('\n\n');
  }
  return text;
}

const inheritedOpeningSchema = {
  type: Type.OBJECT,
  properties: {
    chapter_num: { type: Type.INTEGER },
    title: { type: Type.STRING },
    text: { type: Type.STRING },
    summary: { type: Type.STRING },
    present_characters: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['chapter_num', 'title', 'text', 'summary', 'present_characters'],
};

function buildPrompt(args: {
  blueprint: any;
  originalChapter: any;
  fateRecord: any;
  requirement: any;
  targetWordCount: number;
  language: GenerationLanguage;
}) {
  const isEnglish = args.language === 'en-US';
  const record = args.fateRecord || {};
  const requirement = args.requirement || {};
  const originalChapter = args.originalChapter || {};
  const branches = Array.isArray(requirement.requiredBranches) && requirement.requiredBranches.length
    ? requirement.requiredBranches
    : (Array.isArray(record.unlockedBranches) ? record.unlockedBranches : []);
  const chapterSummaries = Array.isArray(record.chapterSummaries) ? record.chapterSummaries : [];
  const repairRules = Array.isArray(requirement.repairRules) ? requirement.repairRules : [];
  const characters = Array.isArray(args.blueprint?.characters) ? args.blueprint.characters : [];

  if (isEnglish) {
    return `${generationLanguageInstruction(args.language)}

You are rewriting the opening chapter of a sequel in an interactive fiction game.

Goal:
Create a complete new Chapter 1 that naturally fuses:
1. The sequel's original Chapter 1 plot and style.
2. The inherited previous-play record.
3. The selected previous ending and required branches.
4. The sequel continuity hard rules.

Story premise:
${args.blueprint?.main_axis || ''}

Main cast:
${characters.map((character: any) => `${character.id}: ${character.name} — ${character.desc || ''}`).join('\n')}

Original sequel Chapter 1 prototype:
Title: ${originalChapter.title || 'Chapter 1'}
Summary: ${originalChapter.summary || ''}
Text:
${String(originalChapter.text || '').slice(0, 5000)}

Inherited previous fate record:
Previous story: ${record.storyTitle || requirement.sourceTitle || 'previous story'}
Ending: ${record.selectedEndingTitle || requirement.endingName || record.selectedEndingId || record.endingDomain || 'specified ending'}
Ending domain: ${record.endingDomain || requirement.endingDomain || 'middle'}
Conclusion / aftermath:
${String(record.storyConclusion || '').slice(0, 2400)}

Previous story chapter arc:
${chapterSummaries.map((chapter: any) => `Chapter ${chapter.chapterNum || chapter.chapter_num}: ${chapter.title || ''} — ${chapter.summary || ''}`).join('\n')}

Required inherited branches and plot elements:
${branches.map((branch: any) => `- ${branch.name || branch.title || branch.id}: ${branch.desc || branch.description || ''} ${branch.sceneText ? `Scene: ${branch.sceneText}` : ''} ${branch.inject ? `Must: ${JSON.stringify(branch.inject)}` : ''}`).join('\n') || 'None.'}

Character states inherited from previous record:
${JSON.stringify(record.characterStatuses || {}, null, 2)}

Continuity bridge and hard rules:
Bridge summary: ${requirement.bridgeSummary || ''}
Hard rules:
${repairRules.map((rule: any) => `- ${rule.rule || rule.text || rule}`).join('\n') || requirement.sequelSeedPrompt || 'No extra hard rule.'}

Requirements:
1. Rewrite Chapter 1 as prose, not as a recap note. Do not prepend labels like "Inherited context".
2. Make the opening feel like the sequel always began this way.
3. Use the previous ending and branches as facts before the sequel begins.
4. If inherited facts conflict with the sequel prototype, smooth the conflict in Chapter 1 without breaking the sequel's core premise.
5. Preserve the sequel's intended Chapter 1 events where possible.
6. Target about ${args.targetWordCount} English words, 8-12 paragraphs. Do not return a short bridge note, outline, or recap.
7. Open inside an actual scene with concrete action, atmosphere, character movement, and natural dialogue where suitable.
8. Weave inherited facts through what characters notice, avoid, remember, decide, or fear. Do not dump all inherited facts in one explanatory paragraph.
9. Preserve and expand the sequel prototype's intended hook. The result should feel publishable as Chapter 1.
10. Plain prose only: no HTML, Markdown, <mark>, system terms, or meta commentary.

Return strict JSON only.`;
  }

  return `${generationLanguageInstruction(args.language)}

你是互动小说续作的开场重写引擎。

目标：
请生成一个完整的新第一章，把以下四层自然融合，而不是简单添加前情提要：
1. 续作原本第一章的情节、气氛与文风。
2. 玩家继承的前作完成记录。
3. 被指定作为前置条件的前作结局与支线。
4. 续作的继承硬设定。

故事主轴：
${args.blueprint?.main_axis || ''}

主要角色：
${characters.map((character: any) => `${character.id}：${character.name}——${character.desc || ''}`).join('\n')}

续作原第一章原型：
标题：${originalChapter.title || '第一章'}
摘要：${originalChapter.summary || ''}
正文：
${String(originalChapter.text || '').slice(0, 5000)}

继承的前作命运记录：
前作：${record.storyTitle || requirement.sourceTitle || '前作'}
前作结局：${record.selectedEndingTitle || requirement.endingName || record.selectedEndingId || record.endingDomain || '指定结局'}
结局域：${record.endingDomain || requirement.endingDomain || 'middle'}
结局余波 / 结语：
${String(record.storyConclusion || '').slice(0, 2400)}

前作章节概况：
${chapterSummaries.map((chapter: any) => `第${chapter.chapterNum || chapter.chapter_num}章：${chapter.title || ''}——${chapter.summary || ''}`).join('\n')}

必须继承的支线与情节要素：
${branches.map((branch: any) => `- ${branch.name || branch.title || branch.id}：${branch.desc || branch.description || ''} ${branch.sceneText ? `场景：${branch.sceneText}` : ''} ${branch.inject ? `必须纳入：${JSON.stringify(branch.inject)}` : ''}`).join('\n') || '无。'}

前作人物状态：
${JSON.stringify(record.characterStatuses || {}, null, 2)}

接续摘要与继承硬设定：
接续摘要：${requirement.bridgeSummary || ''}
硬设定：
${repairRules.map((rule: any) => `- ${rule.rule || rule.text || rule}`).join('\n') || requirement.sequelSeedPrompt || '无额外硬设定。'}

生成要求：
1. 输出真正的新第一章正文，不要写成“继承前情”说明块，也不要像系统摘要。
2. 让开场读起来像这部续作本来就从这条前作命运线自然开始。
3. 前作指定结局与支线必须被视为续作开始前已经发生的事实。
4. 若继承事实与续作原第一章原型冲突，必须在第一章内圆润处理，不破坏续作核心主轴。
5. 尽量保留续作原第一章应有的主要事件、氛围和钩子。
6. 字数约 ${args.targetWordCount}，拆成 8-12 段。不要输出短短的接续说明、剧情提纲或前情摘要。
7. 开篇必须落在真实场景里，要有具体行动、氛围、人物反应，适合时加入自然对白。
8. 继承来的前作事实应通过人物的观察、回避、记忆、选择或恐惧自然渗入情节，不要把所有资料堆成一段说明。
9. 保留并扩写续作原第一章本应有的钩子与主要事件，让结果像一章可以正式发布的正文。
10. 正文只能是纯文本，不得出现 HTML、Markdown、<mark>、系统术语或元叙事解释。

请严格输出 JSON。`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const logContext = getRequestLogContext(req, 'generate-inherited-opening');
  if (req.method !== 'POST') return sendMethodNotAllowed(res);

  try {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;

    const language = normalizeGenerationLanguage(req.body?.language);
    const blueprint = req.body?.blueprint;
    const originalChapter = req.body?.originalChapter;
    const fateRecord = req.body?.fateRecord;
    const requirement = req.body?.requirement;
    const targetWordCount = Math.min(1600, Math.max(900, Number(req.body?.targetWordCount) || 1100));

    if (!blueprint || !originalChapter || !fateRecord) {
      return res.status(400).json({ error: '继承开场参数不完整。', code: 'INHERITED_OPENING_BAD_REQUEST' });
    }

    logGenerationInfo(logContext, 'request', {
      uid: user.uid,
      sourceStoryId: fateRecord?.sourceStoryId,
      endingId: fateRecord?.selectedEndingId,
      branchCount: Array.isArray(requirement?.requiredBranches) ? requirement.requiredBranches.length : 0,
      language,
    });

    const { data, model, keyIndex } = await generateGeminiJsonWithFallback({
      contents: buildPrompt({ blueprint, originalChapter, fateRecord, requirement, targetWordCount, language }),
      config: {
        responseMimeType: 'application/json',
        responseSchema: inheritedOpeningSchema,
      },
      parseResponse: (rawText) => parseGeminiJson(rawText),
      logContext,
      logInfo: logGenerationInfo,
      logError: logGenerationError,
      metadata: { sourceStoryId: fateRecord?.sourceStoryId },
    });

    const text = ensureParagraphing((data as any)?.text || '');
    const minTextLength = language === 'en-US' ? 1800 : 700;
    if (text.length < minTextLength) {
      return res.status(502).json({ error: 'AI 返回的继承开场内容不完整，请重试。', code: 'AI_RESPONSE_INVALID' });
    }

    logGenerationInfo(logContext, 'success', { model, keyIndex, textLength: text.length });
    return res.status(200).json({
      ...(data as any),
      chapter_num: 1,
      title: stripGeneratedMarkup((data as any)?.title || originalChapter?.title || '第一章'),
      text,
      summary: stripGeneratedMarkup((data as any)?.summary || originalChapter?.summary || ''),
      present_characters: Array.isArray((data as any)?.present_characters) ? (data as any).present_characters.map(String).filter(Boolean) : [],
    });
  } catch (error) {
    logGenerationError(logContext, 'failed', error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('GEMINI_QUOTA_EXHAUSTED')) {
      return res.status(429).json({ error: 'AI 额度暂时用尽，无法重写续作开场。', code: 'GEMINI_QUOTA_EXHAUSTED' });
    }
    if (message.includes('API key') || message.includes('API_KEY_INVALID')) {
      return res.status(503).json({ error: 'AI 服务配置未完成，无法重写续作开场。', code: 'AI_CONFIG_MISSING' });
    }
    return sendInternalError(res, '生成继承开场失败', error);
  }
}
