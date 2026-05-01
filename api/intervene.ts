import { Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireFirebaseAuth, sendInternalError, sendMethodNotAllowed } from './_auth.js';
import { generateGeminiJsonWithFallback, parseGeminiJson } from './_gemini.js';
import { getRequestLogContext, logGenerationError, logGenerationInfo } from './_log.js';
import { buildInterventionRewritePrompt, buildInterventionWorldStatePrompt } from '../Prompt/interventionRewrite.js';

type InterventionAction = 'bless' | 'curse';
type InterventionHistoryItem = { chapterNum: number; charId: string; action: InterventionAction };

function ensureParagraphing(raw: string, opts?: { minParas?: number; maxParas?: number }) {
  const minParas = opts?.minParas ?? 6;
  const maxParas = opts?.maxParas ?? 10;
  let text = String(raw ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return text;

  text = text.replace(/\n{3,}/g, '\n\n');
  if (!text.includes('\n\n')) {
    const sentences = text
      .split(/(?<=[。！？!?…])\s*/g)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    const targetParas = Math.min(maxParas, Math.max(minParas, Math.ceil((sentences.length || 1) / 3)));
    const perChunk = Math.max(1, Math.ceil(sentences.length / targetParas));
    const chunks: string[] = [];
    for (let index = 0; index < sentences.length; index += perChunk) {
      chunks.push(sentences.slice(index, index + perChunk).join(''));
    }
    text = chunks.join('\n\n');
  }

  let paragraphs = text.split(/\n{2,}/g).map((paragraph) => paragraph.trim()).filter(Boolean);
  if (paragraphs.length < minParas) {
    const expanded: string[] = [];
    for (const paragraph of paragraphs) {
      if (expanded.length >= minParas) {
        expanded.push(paragraph);
      } else if (paragraph.length > 220) {
        const midpoint = Math.floor(paragraph.length / 2);
        expanded.push(paragraph.slice(0, midpoint).trim(), paragraph.slice(midpoint).trim());
      } else {
        expanded.push(paragraph);
      }
    }
    paragraphs = expanded.filter(Boolean);
  }

  if (paragraphs.length > maxParas) {
    const merged: string[] = [];
    const perChunk = Math.ceil(paragraphs.length / maxParas);
    for (let index = 0; index < paragraphs.length; index += perChunk) {
      merged.push(paragraphs.slice(index, index + perChunk).join('\n'));
    }
    paragraphs = merged;
  }

  return paragraphs.join('\n\n').trim();
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeChapter(chapter: any) {
  const chapterNum = asNumber(chapter?.chapter_num ?? chapter?.chapterNum, 0);
  return {
    ...chapter,
    chapter_num: chapterNum,
    title: String(chapter?.title || (chapterNum ? `第${chapterNum}章` : '章节')),
    text: String(chapter?.text || ''),
    summary: String(chapter?.summary || ''),
    present_characters: Array.isArray(chapter?.present_characters) ? chapter.present_characters : [],
  };
}

function normalizeHistoryItem(item: any): InterventionHistoryItem | null {
  const chapterNum = asNumber(item?.chapterNum ?? item?.chapter_num, 0);
  const charId = String(item?.charId ?? item?.condition_char ?? '').trim();
  const action = item?.action === 'curse' || item?.condition_action === 'curse'
    ? 'curse'
    : item?.action === 'bless' || item?.condition_action === 'bless'
      ? 'bless'
      : null;
  if (!chapterNum || !charId || !action) return null;
  return { chapterNum, charId, action };
}

function evalTrigger(trigger: any, fullHistory: InterventionHistoryItem[]) {
  if (!trigger) return false;

  if (trigger.type === 'single' && trigger.single) {
    const single = trigger.single;
    const chapterNum = asNumber(single.chapterNum ?? single.chapter_num, 0);
    const charId = String(single.charId ?? single.condition_char ?? '').trim();
    const action = single.action === 'curse' || single.condition_action === 'curse' ? 'curse' : 'bless';
    if (chapterNum && (chapterNum < 2 || chapterNum > 6)) return false;
    return fullHistory.some((item) => (!chapterNum || item.chapterNum === chapterNum) && item.charId === charId && item.action === action);
  }

  if (trigger.type === 'count' && trigger.count) {
    const count = trigger.count;
    const upToChapterNum = asNumber(count.upToChapterNum ?? count.up_to_chapter_num, 0);
    const charId = String(count.charId ?? count.condition_char ?? '').trim();
    const action = count.action === 'curse' || count.condition_action === 'curse' ? 'curse' : 'bless';
    const minCount = Math.max(1, asNumber(count.minCount ?? count.min_count, 1));
    const relevant = fullHistory.filter((item) => item.charId === charId && item.action === action);
    const sliced = upToChapterNum ? relevant.filter((item) => item.chapterNum <= upToChapterNum) : relevant;
    return sliced.length >= minCount;
  }

  return false;
}

function getSingleTriggerChapter(trigger: any) {
  if (trigger?.type === 'single' && trigger.single) {
    return asNumber(trigger.single.chapterNum ?? trigger.single.chapter_num, 0);
  }
  return 0;
}

function isBranchTriggered(branch: any, fullHistory: InterventionHistoryItem[], rewriteFromChapter: number) {
  const triggerGroups = Array.isArray(branch?.triggerGroups) ? branch.triggerGroups.filter(Boolean) : [];
  if (triggerGroups.length > 0) {
    const hasFutureSingleTrigger = triggerGroups.some((group: any) => {
      const triggerChapter = getSingleTriggerChapter(group);
      return triggerChapter > rewriteFromChapter;
    });
    if (hasFutureSingleTrigger) return false;
    return triggerGroups.slice(0, 3).every((group: any) => evalTrigger(group, fullHistory));
  }

  if (branch?.trigger) {
    const triggerChapter = getSingleTriggerChapter(branch.trigger);
    if (triggerChapter > rewriteFromChapter) return false;
    return evalTrigger(branch.trigger, fullHistory);
  }

  const chapterNum = asNumber(branch?.condition_chapter ?? branch?.chapterNum, 0);
  const charId = String(branch?.condition_char ?? branch?.charId ?? '').trim();
  const action = branch?.condition_action === 'curse' || branch?.action === 'curse'
    ? 'curse'
    : branch?.condition_action === 'bless' || branch?.action === 'bless'
      ? 'bless'
      : null;
  if (!chapterNum || !charId || !action) return false;
  if (chapterNum > rewriteFromChapter) return false;
  return fullHistory.some((item) => item.chapterNum === chapterNum && item.charId === charId && item.action === action);
}

function uniqueBranches(branches: any[]) {
  const seen = new Set<string>();
  return branches.filter((branch) => {
    const id = String(branch?.id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

const rewriteSchema = {
  type: Type.OBJECT,
  properties: {
    chapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          chapter_num: { type: Type.INTEGER },
          text: { type: Type.STRING, description: '重写后的章节完整正文' },
          summary: { type: Type.STRING, description: '本章节的最新剧情大纲，20-40字' },
          present_characters: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '本章出场的角色ID列表',
          },
        },
        required: ['chapter_num', 'text', 'summary', 'present_characters'],
      },
    },
    character_updates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: '角色ID' },
          status: { type: Type.STRING, description: '如：存活、重伤、死亡、黑化、失踪等' },
          is_dead: { type: Type.BOOLEAN, description: '是否已死亡' },
        },
        required: ['id', 'status', 'is_dead'],
      },
    },
  },
  required: ['chapters', 'character_updates'],
};

async function generateWithGeminiFallback(prompt: string, logContext: { flow: string; requestId: string }, chapterNum: number) {
  const { data, model, keyIndex } = await generateGeminiJsonWithFallback({
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: rewriteSchema,
    },
    parseResponse: (rawText) => parseGeminiJson(rawText),
    logContext,
    logInfo: logGenerationInfo,
    logError: logGenerationError,
    metadata: { chapterNum },
  });
  logGenerationInfo(logContext, 'model-success', { model, keyIndex, chapterNum });
  return data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const logContext = getRequestLogContext(req, 'intervene');
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  try {
    const user = await requireFirebaseAuth(req, res);
    if (!user) return;

    const {
      blueprint,
      chapters,
      chapterNum,
      charId,
      action,
      currentEndingValue,
      currentUnlockedBranches,
      targetWordCount,
      interventionHistory,
      worldState,
    } = req.body || {};
    logGenerationInfo(logContext, 'request', {
      uid: user.uid,
      chapterNum,
      charId,
      action,
      currentEndingValue,
      targetWordCount,
      chapterCount: Array.isArray(chapters) ? chapters.length : 0,
      historyCount: Array.isArray(interventionHistory) ? interventionHistory.length : 0,
      hasWorldState: Boolean(worldState),
    });

    const safeChapterNum = Math.min(6, Math.max(2, asNumber(chapterNum, 2)));
    const safeTargetWordCount = Math.min(1200, Math.max(400, asNumber(targetWordCount, 600)));
    const safeCurrentUnlockedBranches = Array.isArray(currentUnlockedBranches) ? currentUnlockedBranches : [];
    const safeChapters = Array.isArray(chapters) ? chapters.map(normalizeChapter).filter((chapter: any) => chapter.chapter_num >= 1) : [];
    const history = Array.isArray(interventionHistory)
      ? interventionHistory.map(normalizeHistoryItem).filter(Boolean) as InterventionHistoryItem[]
      : [];
    const safeCharId = String(charId || '').trim();

    if (!blueprint || !Array.isArray(blueprint.characters) || !Array.isArray(blueprint.branches) || safeChapters.length === 0) {
      return res.status(400).json({ error: '干涉请求参数不合法。' });
    }
    if (!safeCharId || !blueprint.characters.some((character: any) => character?.id === safeCharId)) {
      return res.status(400).json({ error: '干涉目标角色不合法。' });
    }
    if (action !== 'bless' && action !== 'curse') {
      return res.status(400).json({ error: '干涉动作不合法。' });
    }

    const justTriggeredHistory: InterventionHistoryItem[] = [
      ...history.filter((item) => !(item.chapterNum === safeChapterNum && item.charId === safeCharId && item.action === action)),
      { chapterNum: safeChapterNum, charId: safeCharId, action },
    ];

    const countTriggered = blueprint.branches.filter((branch: any) => isBranchTriggered(branch, justTriggeredHistory, safeChapterNum));
    const unlocked = countTriggered[0];
    const newlyUnlocked = countTriggered.filter((branch: any) => !safeCurrentUnlockedBranches.some((existing: any) => existing.id === branch.id));
    const newUnlockedBranches = uniqueBranches([...safeCurrentUnlockedBranches, ...newlyUnlocked]);

    const leftBranches = blueprint.branches.filter((branch: any) => branch.side === 'left');
    const rightBranches = blueprint.branches.filter((branch: any) => branch.side === 'right');
    const leftTotalWeight = leftBranches.reduce((sum: number, branch: any) => sum + asNumber(branch.score, 0), 0);
    const rightTotalWeight = rightBranches.reduce((sum: number, branch: any) => sum + asNumber(branch.score, 0), 0);

    let directEVChange = 0;
    for (const branch of newlyUnlocked) {
      const score = asNumber(branch.score, 0);
      if (branch.side === 'left') {
        directEVChange += (score / (leftTotalWeight || 1)) * 10;
      } else if (branch.side === 'right') {
        directEVChange -= (score / (rightTotalWeight || 1)) * 10;
      }
    }

    const newEndingValue = Math.max(-25, Math.min(25, asNumber(currentEndingValue, 0) + directEVChange));
    const charName = blueprint.characters.find((character: any) => character.id === safeCharId)?.name || '未知角色';
    const endingProto = blueprint?.authorAssets?.endingPrototypes;
    const activeInjectedBranches = uniqueBranches(newUnlockedBranches)
      .map((branch: any) => ({ id: branch.id, name: branch.name, inject: branch.inject, sceneText: branch.sceneText, side: branch.side, desc: branch.desc }))
      .filter((branch: any) => branch.name || branch.sceneText || branch.desc || branch.inject);
    const injected = activeInjectedBranches.length > 0
      ? activeInjectedBranches
      : null;
    const prevChapterText = safeChapters.find((chapter: any) => chapter.chapter_num === safeChapterNum - 1)?.text || '';

    const worldStatePrompt = buildInterventionWorldStatePrompt({
      blueprint,
      worldState,
      endingProto,
      safeChapters,
      safeChapterNum,
      prevChapterText,
    });

    const prompt = buildInterventionRewritePrompt({
      blueprint,
      safeChapterNum,
      actionLabel: action === 'bless' ? '正向' : '逆向',
      targetCharacterName: charName,
      worldStatePrompt,
      safeChapters,
      newEndingValue,
      currentEndingValue: asNumber(currentEndingValue, 0),
      newlyUnlocked,
      injected,
      endingProto,
      targetWordCount: safeTargetWordCount,
    });

    const aiData = await generateWithGeminiFallback(prompt, logContext, safeChapterNum);
    if (!Array.isArray(aiData?.chapters)) {
      throw new Error('Gemini response missed chapters array.');
    }

    aiData.chapters = aiData.chapters.map((chapter: any) => {
      const normalized = normalizeChapter(chapter);
      if (normalized.chapter_num >= safeChapterNum && normalized.chapter_num <= 7) {
        return { ...normalized, text: ensureParagraphing(normalized.text, { minParas: 6, maxParas: 10 }) };
      }
      return normalized;
    });

    const returnedChapterNums = new Set(aiData.chapters.map((chapter: any) => chapter.chapter_num));
    const missingChapterNums = safeChapters
      .filter((chapter: any) => chapter.chapter_num >= safeChapterNum && chapter.chapter_num <= 7 && !returnedChapterNums.has(chapter.chapter_num))
      .map((chapter: any) => chapter.chapter_num);
    if (missingChapterNums.length > 0) {
      throw new Error(`Gemini response missed rewritten chapters: ${missingChapterNums.join(', ')}`);
    }

    if (!Array.isArray(aiData.character_updates)) {
      aiData.character_updates = [];
    }

    const leftProgress = Math.min(100, Math.max(0, (newEndingValue / 25) * 100));
    const rightProgress = Math.min(100, Math.max(0, (-newEndingValue / 25) * 100));
    let endingLabel = '均衡道';
    if (newEndingValue > 5) endingLabel = '秩序律';
    if (newEndingValue < -5) endingLabel = '混沌终';

    logGenerationInfo(logContext, 'success', {
      chapterNum: safeChapterNum,
      newEndingValue,
      unlockedBranchId: unlocked?.id || null,
      returnedChapters: Array.isArray(aiData.chapters) ? aiData.chapters.length : 0,
    });
    return res.status(200).json({
      aiData,
      newEndingValue,
      newUnlockedBranches,
      unlockedBranch: unlocked && !safeCurrentUnlockedBranches.some((branch: any) => branch.id === unlocked.id) ? unlocked : null,
      uiFeedback: {
        leftProgress,
        rightProgress,
        endingLabel,
      },
    });
  } catch (error) {
    logGenerationError(logContext, 'failed', error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('GEMINI_QUOTA_EXHAUSTED')) {
      return res.status(429).json({ error: 'AI 额度暂时用尽，多个 API key 都已触发限制，请更换 key 或稍后再试。', code: 'GEMINI_QUOTA_EXHAUSTED' });
    }
    return sendInternalError(res, '干涉处理失败', error);
  }
}
